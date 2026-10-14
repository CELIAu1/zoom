"use client";
import { useState } from "react";
import {
  UserRound,
  Car,
  ShieldCheck,
  LogOut,
  Plus,
  MapPin,
  Trash2,
  MessageCircle,
  Wallet,
  ArrowUpRight,
  Check,
} from "lucide-react";
import { initials, money, type Driver } from "../../lib/product/types";
import { Empty, Modal, type Ready } from "./booking";
export function DriverSetup({ model }: { model: Ready }) {
  const d = model.state.driver;
  const [editing, setEditing] = useState(
    !d || d.status === "incomplete" || d.status === "rejected",
  );
  if (!d) return null;
  return (
    <section className="panel onboarding">
      <span className="eyebrow">DRIVER ONBOARDING</span>
      <h2>
        {d.status === "approved"
          ? "Your vehicle"
          : d.status === "pending"
            ? "Your application is in review."
            : d.status === "suspended"
              ? "Your account needs attention."
              : "Let’s get you on the road."}
      </h2>
      <p className="muted">
        {d.status === "pending"
          ? "Our team must verify your licence, vehicle and operating documents before you can accept requests."
          : d.status === "suspended"
            ? "Please contact support to discuss the review of your driver account."
            : "Tell us about your vehicle. Rydo operations will review your details before you go online."}
      </p>
      <div className="onboarding-steps">
        <span className="done">
          <Check size={15} />
          Account
        </span>
        <i />
        <span className={d.status !== "incomplete" ? "done" : ""}>
          2. Vehicle details
        </span>
        <i />
        <span className={d.status === "approved" ? "done" : ""}>
          3. Approval
        </span>
      </div>
      {d.review_note && <div className="notice-box">{d.review_note}</div>}
      {editing && d.status !== "suspended" ? (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await model.command(
                "application",
                Object.fromEntries(new FormData(e.currentTarget)),
                "Application submitted for review.",
              )
            )
              setEditing(false);
          }}
        >
          <div className="form-row">
            <label>
              Vehicle make & model
              <input
                name="vehicle"
                defaultValue={d.vehicle}
                required
                minLength={3}
                maxLength={100}
                placeholder="Toyota Corolla"
              />
            </label>
            <label>
              Colour
              <input
                name="color"
                defaultValue={d.color}
                required
                maxLength={30}
                placeholder="Silver"
              />
            </label>
          </div>
          <label>
            Plate number
            <input
              name="plate"
              defaultValue={d.plate}
              required
              minLength={4}
              maxLength={30}
              placeholder="ABJ 482 KY"
            />
          </label>
          <label>
            Driving licence reference
            <input
              name="license_reference"
              defaultValue={d.license_reference}
              required
              minLength={4}
              maxLength={100}
              placeholder="Licence number for verification"
            />
          </label>
          <p className="field-hint">
            Visible only to you and authorised Rydo operations staff. Submission
            does not grant approval.
          </p>
          <button className="btn primary" disabled={model.busy}>
            Submit for review <ArrowUpRight size={17} />
          </button>
        </form>
      ) : (
        <>
          <div className="vehicle-summary">
            <Car size={30} />
            <div>
              <h3>{d.vehicle}</h3>
              <p>
                {d.color} · {d.plate}
              </p>
            </div>
            <span
              className={`badge ${d.status === "approved" ? "green" : "amber"}`}
            >
              {d.status}
            </span>
          </div>
          {d.status !== "suspended" && (
            <button className="text-button" onClick={() => setEditing(true)}>
              Update vehicle details (requires a new review)
            </button>
          )}
        </>
      )}
    </section>
  );
}
export function Profile({ model }: { model: Ready }) {
  const p = model.state.profile;
  const [modal, setModal] = useState<"place" | "support" | "password" | null>(
      null,
    ),
    [localError, setLocalError] = useState("");
  return (
    <div className="account-layout">
      <div className="account-main">
        <section className="panel">
          <div className="profile-title">
            <span className="avatar xlarge">{initials(p.name)}</span>
            <div>
              <h2>{p.name}</h2>
              <span className="badge green">
                {p.role === "merchant" ? "Business" : p.role} account
              </span>
            </div>
          </div>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              await model.command(
                "profile",
                Object.fromEntries(new FormData(e.currentTarget)),
                "Profile updated.",
              );
            }}
          >
            <label>
              Full name
              <input
                name="name"
                defaultValue={p.name}
                minLength={2}
                maxLength={100}
                required
              />
            </label>
            <label>
              Phone number
              <input
                name="phone"
                type="tel"
                defaultValue={p.phone}
                pattern="[+0-9 ()\-]{7,30}"
                required
              />
            </label>
            <label>
              City
              <select name="city" defaultValue={p.city}>
                <option>Abuja</option>
                <option>Lagos</option>
              </select>
            </label>
            {p.role === "merchant" ? (
              <label>
                Business name
                <input
                  name="business_name"
                  defaultValue={p.business_name}
                  maxLength={120}
                  required
                />
              </label>
            ) : (
              <input
                type="hidden"
                name="business_name"
                value={p.business_name}
              />
            )}
            <button className="btn primary" disabled={model.busy}>
              Save changes
            </button>
          </form>
        </section>
        {p.role === "driver" && <DriverSetup model={model} />}
      </div>
      <aside>
        <section className="panel">
          <div className="section-heading">
            <h3>Saved places</h3>
            <button
              className="icon-button"
              aria-label="Add saved place"
              onClick={() => setModal("place")}
            >
              <Plus size={19} />
            </button>
          </div>
          {model.state.saved_places.length === 0 ? (
            <p className="muted">Save your regular stops for next time.</p>
          ) : (
            model.state.saved_places.map((s) => (
              <div className="saved-place" key={s.id}>
                <MapPin size={19} />
                <div>
                  <strong>{s.label}</strong>
                  <small>{s.address}</small>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Delete ${s.label}`}
                  disabled={model.busy}
                  onClick={() =>
                    void model.command(
                      "delete_place",
                      { id: s.id },
                      "Saved place removed.",
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </section>
        <section className="panel account-links">
          <h3>Here to help</h3>
          <button onClick={() => setModal("support")}>
            <MessageCircle size={19} />
            Contact support
            <ArrowUpRight size={17} />
          </button>
          <button
            onClick={() => {
              setLocalError("");
              setModal("password");
            }}
          >
            <ShieldCheck size={19} />
            Change password
            <ArrowUpRight size={17} />
          </button>
          <button
            className="danger"
            disabled={model.busy}
            onClick={() => void model.logout()}
          >
            <LogOut size={19} />
            Log out
          </button>
        </section>
        {model.state.tickets.length > 0 && (
          <section className="panel">
            <h3>Your support requests</h3>
            {model.state.tickets.map((t) => (
              <div className="ticket" key={t.id}>
                <span className="badge">{t.status}</span>
                <p>{t.message}</p>
                <small>{new Date(t.created_at).toLocaleDateString()}</small>
              </div>
            ))}
          </section>
        )}
      </aside>
      {modal && (
        <Modal
          title={
            modal === "place"
              ? "Save a place"
              : modal === "password"
                ? "Change password"
                : "Contact Rydo support"
          }
          onClose={() => setModal(null)}
          error={localError || model.error}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = Object.fromEntries(new FormData(e.currentTarget));
              if (modal === "password") {
                try {
                  await model.auth({ action: "password", ...d });
                  model.setNotice("Password changed.");
                  setModal(null);
                } catch (e) {
                  setLocalError(
                    e instanceof Error
                      ? e.message
                      : "Could not update password.",
                  );
                }
              } else if (
                await model.command(
                  modal === "place" ? "save_place" : "support",
                  d,
                  modal === "place"
                    ? "Place saved."
                    : "Support request submitted.",
                )
              )
                setModal(null);
            }}
          >
            {modal === "place" ? (
              <>
                <label>
                  Label
                  <input
                    name="label"
                    required
                    maxLength={40}
                    placeholder="Home, Work…"
                  />
                </label>
                <label>
                  Full address
                  <input
                    name="address"
                    required
                    minLength={3}
                    maxLength={240}
                  />
                </label>
              </>
            ) : modal === "password" ? (
              <label>
                New password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
            ) : (
              <>
                <p className="muted">
                  Send a message to the operations team. This is not an
                  emergency service.
                </p>
                <label>
                  How can we help?
                  <textarea
                    name="message"
                    minLength={10}
                    maxLength={3000}
                    required
                    placeholder="Include the trip reference if relevant."
                  />
                </label>
              </>
            )}
            <button className="btn primary" disabled={model.busy}>
              Save & submit
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function Payments({ model }: { model: Ready }) {
  const driver = model.state.profile.role === "driver";
  const trips = model.state.bookings.filter((b) => b.status === "completed");
  const paid = trips.filter((b) => b.payment_status === "cash_received");
  const gross = paid.reduce((sum, b) => sum + (b.agreed_fare || 0), 0),
    commission = paid.reduce(
      (sum, b) =>
        sum + Math.floor(((b.agreed_fare || 0) * b.commission_bps) / 10000),
      0,
    );
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">{driver ? "YOUR EARNINGS" : "PAYMENTS"}</span>
        <h1>
          {driver ? "Every journey counts." : "All your receipts, together."}
        </h1>
        <p>
          Cash payments recorded by your driver after each completed journey.
        </p>
      </div>
      <div className="metrics">
        <section className="panel">
          <small>{driver ? "Cash collected" : "Confirmed cash payments"}</small>
          <strong>{money(gross)}</strong>
          <span>{paid.length} confirmed receipts</span>
        </section>
        {driver && (
          <>
            <section className="panel">
              <small>Platform commission owed</small>
              <strong>{money(commission)}</strong>
              <span>10% of confirmed trip fares</span>
            </section>
            <section className="panel">
              <small>Net earnings</small>
              <strong>{money(gross - commission)}</strong>
              <span>Collected cash less commission owed</span>
            </section>
          </>
        )}
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Receipts</h2>
          <span className="badge">Cash</span>
        </div>
        {trips.length === 0 ? (
          <Empty icon={Wallet} title="Your receipts will appear here">
            Complete a journey to see the agreed fare and payment record.
          </Empty>
        ) : (
          trips.map((b) => (
            <div className="payment-row" key={b.id}>
              <div>
                <strong>{b.destination}</strong>
                <small>
                  {new Date(b.created_at).toLocaleDateString()} · #
                  {b.id.slice(0, 8)}
                </small>
              </div>
              <span
                className={`badge ${b.payment_status === "cash_received" ? "green" : "amber"}`}
              >
                {b.payment_status === "cash_received"
                  ? "Received"
                  : "Awaiting confirmation"}
              </span>
              <strong>{money(b.agreed_fare || 0)}</strong>
            </div>
          ))
        )}
      </section>
      {driver && (
        <p className="field-hint">
          This is an earnings ledger, not a wallet balance. Rydo does not move
          cash or automatically settle commission.
        </p>
      )}
    </>
  );
}
export function Admin({ model }: { model: Ready }) {
  const [review, setReview] = useState<Driver | null>(null);
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">RYDO OPERATIONS</span>
        <h1>Keep the city moving.</h1>
        <p>Review driver applications and handle support requests.</p>
      </div>
      <div className="metrics">
        <section className="panel">
          <small>Awaiting review</small>
          <strong>
            {
              model.state.applications.filter((d) => d.status === "pending")
                .length
            }
          </strong>
        </section>
        <section className="panel">
          <small>Approved drivers</small>
          <strong>
            {
              model.state.applications.filter((d) => d.status === "approved")
                .length
            }
          </strong>
        </section>
        <section className="panel">
          <small>Open support requests</small>
          <strong>{model.state.support_queue.length}</strong>
        </section>
      </div>
      <div className="account-layout">
        <section className="panel">
          <h2>Driver applications</h2>
          {model.state.applications.length === 0 ? (
            <Empty title="No applications yet">
              New driver applications will appear here.
            </Empty>
          ) : (
            model.state.applications.map((d) => (
              <div className="application-row" key={d.id}>
                <span className="avatar">{initials(d.name || "Driver")}</span>
                <div>
                  <h3>{d.name}</h3>
                  <p>
                    {d.vehicle || "Vehicle not submitted"} · {d.plate}
                  </p>
                  <span className="badge">{d.status}</span>
                </div>
                <button className="btn secondary" onClick={() => setReview(d)}>
                  Review
                </button>
              </div>
            ))
          )}
        </section>
        <section className="panel">
          <h2>Support inbox</h2>
          {model.state.support_queue.length === 0 ? (
            <p className="muted">No open support requests.</p>
          ) : (
            model.state.support_queue.map((t) => (
              <article className="ticket" key={t.id}>
                <small>
                  {t.user_id} · {new Date(t.created_at).toLocaleString()}
                </small>
                <p>{t.message}</p>
                {t.booking_id && <small>Trip {t.booking_id}</small>}
                <button
                  className="text-button"
                  disabled={model.busy}
                  onClick={() =>
                    void model.command(
                      "resolve_ticket",
                      { id: t.id },
                      "Request marked resolved.",
                    )
                  }
                >
                  <Check size={16} />
                  Mark resolved
                </button>
              </article>
            ))
          )}
        </section>
      </div>
      {review && (
        <Modal
          title={`Review ${review.name}`}
          onClose={() => setReview(null)}
          error={model.error}
        >
          <dl className="review-details">
            <dt>Vehicle</dt>
            <dd>
              {review.color} {review.vehicle}
            </dd>
            <dt>Plate</dt>
            <dd>{review.plate}</dd>
            <dt>Licence reference</dt>
            <dd>{review.license_reference}</dd>
            <dt>Contact</dt>
            <dd>{review.phone}</dd>
            <dt>City</dt>
            <dd>{review.city}</dd>
          </dl>
          <p className="notice-box">
            Approve only after independently checking the driver’s identity,
            licence, vehicle and required operating documents.
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await model.command(
                  "review_driver",
                  {
                    driver_id: review.id,
                    ...Object.fromEntries(new FormData(e.currentTarget)),
                  },
                  "Review saved.",
                )
              )
                setReview(null);
            }}
          >
            <label>
              Decision
              <select name="status">
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
                <option value="suspended">Suspend</option>
              </select>
            </label>
            <label>
              Verification / decision notes
              <textarea name="note" required minLength={10} maxLength={1000} />
            </label>
            <button className="btn primary" disabled={model.busy}>
              Save decision
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
