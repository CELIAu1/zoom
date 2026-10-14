import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const folder = await mkdtemp(join(tmpdir(), "waka-api-"));
for (const name of ["auth", "product"])
  await esbuild.build({
    entryPoints: [
      new URL(`../app/api/${name}/route.ts`, import.meta.url).pathname,
    ],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(folder, `${name}.mjs`),
  });
const auth = await import(pathToFileURL(join(folder, "auth.mjs")).href),
  product = await import(pathToFileURL(join(folder, "product.mjs")).href);
const originalFetch = globalThis.fetch;
const request = (
  path: string,
  data?: unknown,
  origin = "https://waka.example",
  cookie = "",
) =>
  new Request(`https://waka.example/api/${path}`, {
    method: data ? "POST" : "GET",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
const json = (value: unknown, status = 200) => Response.json(value, { status });
const snapshot = {
  profile: { id: "10000000-0000-4000-8000-000000000001", role: "customer" },
  bookings: [],
};

test("no anonymous demo fallback; cross-origin mutations refused", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  let res = await product.GET(request("product"));
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /operator/);
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "publishable-test-key";
  res = await product.GET(request("product"));
  assert.equal(res.status, 401);
  res = await product.POST(
    request(
      "product",
      { action: "availability", data: { online: true } },
      "https://evil.example",
    ),
  );
  assert.equal(res.status, 403);
  res = await product.POST(
    request("product", { action: "generateOffers", data: {} }),
  );
  assert.equal(res.status, 400);
});
test("login uses HttpOnly cookies; signup rejects privileged roles", async () => {
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /token\?grant_type=password/);
    assert.equal(JSON.parse(String(options?.body)).email, "person@example.com");
    return json({
      access_token: "access.jwt.value",
      refresh_token: "secret-refresh",
    });
  };
  try {
    const res = await auth.POST(
      request("auth", {
        action: "login",
        email: "person@example.com",
        password: "longpasswordhere",
      }),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    const cookies = res.headers.get("set-cookie")!;
    assert.match(cookies, /HttpOnly/);
    assert.match(cookies, /SameSite=Lax/);
    assert.match(cookies, /Secure/);
    assert.match(cookies, /waka_refresh/);
    const rejected = await auth.POST(
      request("auth", {
        action: "signup",
        email: "person@example.com",
        password: "longpasswordhere",
        name: "Example Person",
        phone: "+2348000000000",
        role: "admin",
      }),
    );
    assert.equal(rejected.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("expired access refreshes once, retries user identity and rotates cookies", async () => {
  const paths: string[] = [];
  globalThis.fetch = async (url, options) => {
    paths.push(String(url));
    if (String(url).includes("refresh_token"))
      return json({
        access_token: "new.access.token",
        refresh_token: "new-refresh",
      });
    const header = (options?.headers as Record<string, string>).Authorization;
    return header === "Bearer expired.token"
      ? json({ message: "Expired" }, 401)
      : json(snapshot);
  };
  try {
    const res = await product.GET(
      request(
        "product",
        undefined,
        "https://waka.example",
        "waka_access=expired.token; waka_refresh=old-refresh",
      ),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), snapshot);
    assert.equal(paths.length, 3);
    assert.match(res.headers.get("set-cookie")!, /new-refresh/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("commands strip supplied identity, validate integer money and return persisted PIN failures", async () => {
  let payload: unknown;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(String(options?.body));
    return json({
      error: "Incorrect pickup PIN. Ask the customer when you meet.",
    });
  };
  try {
    const bid = "10000000-0000-4000-8000-000000000001";
    const cookie = "waka_access=valid.jwt";
    let res = await product.POST(
      request(
        "product",
        {
          action: "start",
          data: { booking_id: bid, pin: "1234", actor: "admin" },
        },
        "https://waka.example",
        cookie,
      ),
    );
    assert.equal(res.status, 400);
    assert.deepEqual(payload, {
      action: "start",
      data: { booking_id: bid, pin: "1234" },
    });
    assert.match((await res.json()).error, /Incorrect pickup PIN/);
    res = await product.POST(
      request(
        "product",
        {
          action: "offer",
          data: { booking_id: bid, amount: 250000.2, eta: 4 },
        },
        "https://waka.example",
        cookie,
      ),
    );
    assert.equal(res.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("logout clears cookies even with unreachable auth service", async () => {
  globalThis.fetch = async () => {
    throw Error("offline");
  };
  try {
    const res = await auth.POST(
      request(
        "auth",
        { action: "logout" },
        "https://waka.example",
        "waka_access=valid.jwt",
      ),
    );
    assert.equal(res.status, 200);
    assert.match(res.headers.get("set-cookie")!, /Max-Age=0/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(folder, { recursive: true, force: true });
  }
});
