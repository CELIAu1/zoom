import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Snapshot } from "../lib/product/types.ts";
const ids = {
  customer: "10000000-0000-4000-8000-000000000001",
  customer2: "10000000-0000-4000-8000-000000000002",
  driver: "20000000-0000-4000-8000-000000000001",
  driver2: "20000000-0000-4000-8000-000000000002",
  merchant: "30000000-0000-4000-8000-000000000001",
  admin: "40000000-0000-4000-8000-000000000001",
};
async function setup() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610130001_product.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const [role, id] of Object.entries(ids))
    await db.query("insert into auth.users values($1,$2)", [
      id,
      JSON.stringify({
        name: role + " Person",
        role: role.replace("2", ""),
        phone: "+2348000000000",
      }),
    ]);
  await db.query("update public.waka_profiles set role='admin' where id=$1", [
    ids.admin,
  ]);
  return db;
}
async function as(db: PGlite, id: string) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function command(
  db: PGlite,
  id: string,
  action: string,
  data: Record<string, unknown> = {},
): Promise<Snapshot & { error?: string }> {
  await as(db, id);
  return (
    await db.query<{ v: Snapshot }>(
      "select public.waka_command($1,$2::jsonb) v",
      [action, JSON.stringify(data)],
    )
  ).rows[0].v;
}
async function snapshot(db: PGlite, id: string) {
  await as(db, id);
  return (await db.query<{ v: Snapshot }>("select public.waka_snapshot() v"))
    .rows[0].v;
}
const request = {
  service: "ride",
  pickup: "Wuse 2 main gate",
  destination: "Jabi Lake Mall main entrance",
  fare: 250000,
  recipient: "",
  recipient_phone: "",
  parcel: "",
  instructions: "",
};
async function approve(db: PGlite, id = ids.driver) {
  await command(db, id, "application", {
    vehicle: "Toyota Corolla",
    plate: "ABJ 482 KY",
    color: "Silver",
    license_reference: "verified-offline-ref",
  });
  await command(db, ids.admin, "review_driver", {
    driver_id: id,
    status: "approved",
    note: "Identity and vehicle documents checked offline",
  });
  await command(db, id, "availability", { online: true });
}

test("signup cannot self-provision admin; anonymous and direct table access are denied", async () => {
  const db = await setup();
  try {
    const id = "50000000-0000-4000-8000-000000000001";
    await db.query("insert into auth.users values($1,$2)", [
      id,
      JSON.stringify({ role: "admin", name: "Malicious signup" }),
    ]);
    assert.equal((await snapshot(db, id)).profile.role, "customer");
    await as(db, "");
    await assert.rejects(
      () => db.query("select public.waka_snapshot()"),
      /Account unavailable/,
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      () => db.query("select * from public.waka_booking_secrets"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("update public.waka_profiles set role='admin'"),
      /permission denied/,
    );
    await db.exec("reset role");
    await assert.rejects(
      () =>
        command(db, ids.driver, "review_driver", {
          driver_id: ids.driver,
          status: "approved",
          note: "Self approving not permitted",
        }),
      /Admin access/,
    );
  } finally {
    await db.close();
  }
});

test("real request → negotiation → assignment → protected PIN → trip → cash receipt", async () => {
  const db = await setup();
  try {
    await approve(db);
    let s = await command(db, ids.customer, "create_booking", request);
    const bid = s.bookings[0].id;
    assert.equal((await snapshot(db, ids.driver)).jobs.length, 1);
    assert.equal((await snapshot(db, ids.customer2)).bookings.length, 0);
    s = await command(db, ids.driver, "offer", {
      booking_id: bid,
      amount: 275000,
      eta: 4,
    });
    const offer = s.bookings[0].offers[0].id;
    assert.equal(s.bookings[0].pickup_pin, undefined);
    assert.equal(s.bookings[0].customer_phone, undefined);
    await assert.rejects(
      () =>
        command(db, ids.driver, "accept", { booking_id: bid, offer_id: offer }),
      /other person/,
    );
    s = await command(db, ids.customer, "counter", {
      booking_id: bid,
      offer_id: offer,
      amount: 260000,
    });
    assert.equal(s.bookings[0].offers[0].turn, "driver");
    s = await command(db, ids.driver, "accept", {
      booking_id: bid,
      offer_id: offer,
    });
    assert.equal(s.bookings[0].agreed_fare, 260000);
    assert.equal(s.bookings[0].status, "assigned");
    assert.equal(s.bookings[0].pickup_pin, null);
    const pin = (await snapshot(db, ids.customer)).bookings[0].pickup_pin!;
    assert.match(pin, /^\d{4}$/);
    await assert.rejects(
      () =>
        command(db, ids.customer2, "cancel", {
          booking_id: bid,
          reason: "Not my trip",
        }),
      /not found/,
    );
    await command(db, ids.driver, "arrive", { booking_id: bid });
    const wrong = await command(db, ids.driver, "start", {
      booking_id: bid,
      pin: pin === "0000" ? "0001" : "0000",
    });
    assert.match(wrong.error!, /Incorrect/);
    await command(db, ids.driver, "start", { booking_id: bid, pin });
    await assert.rejects(
      () =>
        command(db, ids.customer, "cancel", {
          booking_id: bid,
          reason: "Too late",
        }),
      /no longer/,
    );
    await command(db, ids.driver, "complete", { booking_id: bid });
    await assert.rejects(
      () => command(db, ids.customer, "cash_received", { booking_id: bid }),
      /assigned driver/,
    );
    s = await command(db, ids.driver, "cash_received", { booking_id: bid });
    assert.equal(s.bookings[0].payment_status, "cash_received");
    await assert.rejects(
      () => command(db, ids.driver, "cash_received", { booking_id: bid }),
      /once/,
    );
    await command(db, ids.customer, "rate", { booking_id: bid, rating: 5 });
    await assert.rejects(
      () => command(db, ids.customer, "rate", { booking_id: bid, rating: 1 }),
      /once/,
    );
  } finally {
    await db.close();
  }
});

test("approval, immutable roles, round limits, expiry and double assignment are enforced", async () => {
  const db = await setup();
  try {
    const bid = (await command(db, ids.customer, "create_booking", request))
      .bookings[0].id;
    await assert.rejects(
      () =>
        command(db, ids.driver, "offer", {
          booking_id: bid,
          amount: 250000,
          eta: 3,
        }),
      /approved/,
    );
    await approve(db);
    await approve(db, ids.driver2);
    let d = await command(db, ids.driver, "offer", {
      booking_id: bid,
      amount: 270000,
      eta: 3,
    });
    const oid = d.bookings[0].offers[0].id;
    await command(db, ids.customer, "counter", {
      booking_id: bid,
      offer_id: oid,
      amount: 260000,
    });
    await command(db, ids.driver, "counter", {
      booking_id: bid,
      offer_id: oid,
      amount: 265000,
    });
    await assert.rejects(
      () =>
        command(db, ids.customer, "counter", {
          booking_id: bid,
          offer_id: oid,
          amount: 250000,
        }),
      /Final negotiation/,
    );
    d = await command(db, ids.driver2, "offer", {
      booking_id: bid,
      amount: 280000,
      eta: 5,
    });
    const oid2 = d.bookings[0].offers[0].id;
    await command(db, ids.customer, "accept", {
      booking_id: bid,
      offer_id: oid,
    });
    await assert.rejects(
      () =>
        command(db, ids.customer, "accept", {
          booking_id: bid,
          offer_id: oid2,
        }),
      /closed/,
    );
    const b2 = (await command(db, ids.customer2, "create_booking", request))
      .bookings[0].id;
    await assert.rejects(
      () =>
        command(db, ids.driver, "offer", {
          booking_id: b2,
          amount: 250000,
          eta: 4,
        }),
      /active trip/,
    );
    await db.query(
      "update public.waka_bookings set expires_at=now()-interval '1 second' where id=$1",
      [b2],
    );
    await assert.rejects(
      () =>
        command(db, ids.driver2, "offer", {
          booking_id: b2,
          amount: 250000,
          eta: 4,
        }),
      /no longer open/,
    );
    await command(db, ids.customer, "profile", {
      name: "Same customer",
      phone: "+2348000000000",
      city: "Abuja",
      business_name: "",
      role: "admin",
    });
    assert.equal((await snapshot(db, ids.customer)).profile.role, "customer");
  } finally {
    await db.close();
  }
});

test("delivery privacy, proof of delivery, PIN lockout and support isolation", async () => {
  const db = await setup();
  try {
    await approve(db);
    const b = (
      await command(db, ids.merchant, "create_booking", {
        ...request,
        service: "delivery",
        recipient: "Recipient Person",
        recipient_phone: "+2348000000001",
        parcel: "Small box of clothes",
        instructions: "Private gate note",
      })
    ).bookings[0];
    const jobs = await snapshot(db, ids.driver);
    assert.equal("recipient_phone" in jobs.jobs[0], false);
    let s = await command(db, ids.driver, "offer", {
      booking_id: b.id,
      amount: 250000,
      eta: 5,
    });
    assert.equal(s.bookings[0].recipient_phone, undefined);
    const oid = s.bookings[0].offers[0].id;
    await command(db, ids.merchant, "accept", {
      booking_id: b.id,
      offer_id: oid,
    });
    s = await snapshot(db, ids.driver);
    assert.equal(s.bookings[0].recipient_phone, "+2348000000001");
    const pin = (await snapshot(db, ids.merchant)).bookings[0].pickup_pin!;
    await command(db, ids.driver, "arrive", { booking_id: b.id });
    for (let i = 0; i < 5; i++)
      await command(db, ids.driver, "start", {
        booking_id: b.id,
        pin: pin === "0000" ? "0001" : "0000",
      });
    assert.match(
      (await command(db, ids.driver, "start", { booking_id: b.id, pin }))
        .error!,
      /Too many/,
    );
    await db.query(
      "update public.waka_booking_secrets set locked_until=null where booking_id=$1",
      [b.id],
    );
    await command(db, ids.driver, "start", { booking_id: b.id, pin });
    await assert.rejects(
      () => command(db, ids.driver, "complete", { booking_id: b.id }),
      /confirmation/,
    );
    await command(db, ids.driver, "complete", {
      booking_id: b.id,
      proof: "Recipient Person received at the main gate.",
    });
    await command(db, ids.customer2, "support", {
      message: "Help with account access please.",
    });
    assert.equal((await snapshot(db, ids.customer)).tickets.length, 0);
    assert.equal((await snapshot(db, ids.admin)).support_queue.length, 1);
  } finally {
    await db.close();
  }
});
