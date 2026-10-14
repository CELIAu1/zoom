"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowDown,
  MapPin,
  Car,
  Package,
  Clock,
  Star,
  Check,
  Phone,
  Share2,
  ShieldCheck,
  Navigation,
  Receipt,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import {
  active,
  initials,
  money,
  statusLabel,
  type Booking,
  type Job,
  type Offer,
} from "../../lib/product/types";
import type { Product } from "./use-product";
export type Ready = Product & { state: NonNullable<Product["state"]> };
export function RouteLine({
  pickup,
  destination,
}: {
  pickup: string;
  destination: string;
}) {
  return (
    <div className="route-line">
      <span className="route-dots">
        <i />
        <em />
        <b />
      </span>
      <div>
        <p>
          <small>Pickup</small>
          {pickup}
        </p>
        <p>
          <small>Destination</small>
          {destination}
        </p>
      </div>
    </div>
  );
}
export function Empty({
  icon: Icon = Car,
  title,
  children,
}: {
  icon?: typeof Car;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span>
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function AddressInput({
  label,
  name,
  value,
  onChange,
  onSelect,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (p: { label: string; lat: number; lng: number }) => void;
}) {
  const [places, setPlaces] = useState<
      { label: string; lat: number; lng: number }[]
    >([]),
    [hint, setHint] = useState(""),
    [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused || value.trim().length < 3) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/places?q=" + encodeURIComponent(value), {
          signal: controller.signal,
        });
        const j = (await r.json()) as {
          places?: { label: string; lat: number; lng: number }[];
          manual?: boolean;
          error?: string;
        };
        setPlaces(j.places || []);
        setHint(
          j.manual
            ? "Enter the full address and a useful landmark."
            : j.error || "",
        );
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          setHint("Address search is unavailable. Enter the full address.");
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, focused]);
  return (
    <label className="address-label">
      {label}
      <div className="icon-input">
        <MapPin size={19} />
        <input
          name={name}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            label === "Pickup"
              ? "Where should we meet you?"
              : "Where are you going?"
          }
          minLength={3}
          maxLength={240}
          autoComplete="off"
          required
        />
      </div>
      {focused && places.length > 0 && (
        <div className="address-results">
          {places.map((p, i) => (
            <button
              type="button"
              key={i}
              onClick={() => {
                onSelect(p);
                setFocused(false);
                setPlaces([]);
              }}
            >
              <MapPin size={16} />
              {p.label}
            </button>
          ))}
        </div>
      )}
      {focused && hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
export function RequestForm({
  model,
  onCreated,
}: {
  model: Ready;
  onCreated: () => void;
}) {
  const merchant = model.state.profile.role === "merchant";
  const [service, setService] = useState<"ride" | "delivery">(
      merchant ? "delivery" : "ride",
    ),
    [pickup, setPickup] = useState(""),
    [destination, setDestination] = useState(""),
    [coords, setCoords] = useState<Record<string, number | null>>({}),
    [review, setReview] = useState<Record<string, unknown> | null>(null);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    setReview({
      ...d,
      ...coords,
      service,
      pickup,
      destination,
      fare: Math.round(Number(d.fare) * 100),
    });
  };
  return (
    <section className="panel request-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {model.state.profile.city.toUpperCase()}
          </span>
          <h2>{merchant ? "Send a delivery." : "Where are you going?"}</h2>
        </div>
        <span className="small-icon">
          <Navigation size={21} />
        </span>
      </div>
      <p className="muted">
        You name the fare. Choose the offer that works for you.
      </p>
      {!merchant && (
        <div className="segmented service-select">
          <button
            className={service === "ride" ? "selected" : ""}
            onClick={() => setService("ride")}
          >
            <Car size={19} />
            Ride
          </button>
          <button
            className={service === "delivery" ? "selected" : ""}
            onClick={() => setService("delivery")}
          >
            <Package size={19} />
            Send a package
          </button>
        </div>
      )}
      <form className="form-stack" onSubmit={submit}>
        <AddressInput
          label="Pickup"
          name="pickup"
          value={pickup}
          onChange={(v) => {
            setPickup(v);
            setCoords({ ...coords, pickup_lat: null, pickup_lng: null });
          }}
          onSelect={(p) => {
            setPickup(p.label);
            setCoords({ ...coords, pickup_lat: p.lat, pickup_lng: p.lng });
          }}
        />
        <AddressInput
          label="Destination"
          name="destination"
          value={destination}
          onChange={(v) => {
            setDestination(v);
            setCoords({
              ...coords,
              destination_lat: null,
              destination_lng: null,
            });
          }}
          onSelect={(p) => {
            setDestination(p.label);
            setCoords({
              ...coords,
              destination_lat: p.lat,
              destination_lng: p.lng,
            });
          }}
        />
        {model.state.saved_places.length > 0 && (
          <div className="saved-chips">
            {model.state.saved_places.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => {
                  setDestination(s.address);
                  setCoords({
                    ...coords,
                    destination_lat: null,
                    destination_lng: null,
                  });
                }}
              >
                <MapPin size={13} />
                {s.label}
              </button>
            ))}
          </div>
        )}
        {service === "delivery" ? (
          <>
            <div className="form-row">
              <label>
                Recipient name
                <input
                  name="recipient"
                  placeholder="Who’s receiving?"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label>
                Recipient phone
                <input
                  name="recipient_phone"
                  type="tel"
                  required
                  pattern="[+0-9 ()\-]{7,30}"
                  placeholder="+234…"
                />
              </label>
            </div>
            <label>
              What are you sending?
              <input
                name="parcel"
                required
                minLength={3}
                maxLength={500}
                placeholder="e.g. A small box of clothing"
              />
            </label>
          </>
        ) : (
          <>
            <input type="hidden" name="recipient" value="" />
            <input type="hidden" name="recipient_phone" value="" />
            <input type="hidden" name="parcel" value="" />
          </>
        )}
        <label>
          {service === "delivery" ? "Delivery instructions" : "Pickup note"}{" "}
          <span className="optional">Optional</span>
          <input
            name="instructions"
            maxLength={1000}
            placeholder="A landmark or anything your driver should know"
          />
        </label>
        <div className="fare-field">
          <label>
            Your offer <span>NGN</span>
            <div>
              <span>₦</span>
              <input
                name="fare"
                type="number"
                min="100"
                max="500000"
                step="1"
                required
                placeholder="2,500"
              />
            </div>
          </label>
          <span className="cash-tag">
            Pay cash after {service === "ride" ? "your ride" : "delivery"}
          </span>
        </div>
        <button className="btn primary wide" disabled={model.busy}>
          Review request <ArrowRight size={18} />
        </button>
      </form>
      {review && (
        <Modal
          title="Ready to request?"
          onClose={() => setReview(null)}
          error={model.error}
        >
          <RouteLine pickup={pickup} destination={destination} />
          <div className="receipt-row">
            <span>Your first offer</span>
            <strong>{money(Number(review.fare))}</strong>
          </div>
          <p className="muted">
            This sends a real request to approved drivers in{" "}
            {model.state.profile.city}. You’ll choose an offer before a driver
            is assigned.
          </p>
          <button
            className="btn primary wide"
            disabled={model.busy}
            onClick={async () => {
              if (
                await model.command(
                  "create_booking",
                  review,
                  "Your request has been sent.",
                )
              ) {
                setReview(null);
                onCreated();
              }
            }}
          >
            {model.busy ? "Sending…" : "Find a driver"}
            <ArrowRight size={18} />
          </button>
        </Modal>
      )}
    </section>
  );
}
export function BookingCard({
  booking: b,
  onClick,
}: {
  booking: Booking;
  onClick: () => void;
}) {
  return (
    <button className="booking-summary panel" onClick={onClick}>
      <span className="trip-icon">
        {b.service === "ride" ? <Car size={22} /> : <Package size={22} />}
      </span>
      <div>
        <span className={`badge ${b.status === "completed" ? "green" : ""}`}>
          {statusLabel(b.status)}
        </span>
        <h3>{b.destination}</h3>
        <p>
          {b.pickup} <ArrowRight size={13} />{" "}
          {money(b.agreed_fare || b.initial_fare)}
        </p>
      </div>
      <ChevronRight size={20} />
    </button>
  );
}
export function JobCard({ job, model }: { job: Job; model: Ready }) {
  const [open, setOpen] = useState(false);
  const already = model.state.bookings.some(
    (b) => b.id === job.id && b.offers.length > 0,
  );
  return (
    <article className="panel job-card">
      <div className="section-heading">
        <span className="badge green">
          {job.service === "ride" ? "Ride request" : "Delivery request"}
        </span>
        <strong className="price">{money(job.initial_fare)}</strong>
      </div>
      <RouteLine pickup={job.pickup} destination={job.destination} />
      <p className="muted">{job.city} · Customer’s offer</p>
      <button
        className="btn primary wide"
        disabled={already || model.busy}
        onClick={() => setOpen(true)}
      >
        {already ? "Offer sent — view in Activity" : "Make an offer"}
        <ArrowRight size={17} />
      </button>
      {open && (
        <Modal
          title="Make your offer"
          onClose={() => setOpen(false)}
          error={model.error}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              if (
                await model.command(
                  "offer",
                  {
                    booking_id: job.id,
                    amount: Math.round(Number(d.get("amount")) * 100),
                    eta: Number(d.get("eta")),
                  },
                  "Your offer was sent.",
                )
              )
                setOpen(false);
            }}
          >
            <label>
              Your fare (₦)
              <input
                name="amount"
                type="number"
                min={100}
                max={500000}
                step={1}
                defaultValue={job.initial_fare / 100}
                required
              />
            </label>
            <label>
              Estimated pickup time (minutes)
              <input
                name="eta"
                type="number"
                min={1}
                max={120}
                required
                placeholder="Your estimate"
              />
            </label>
            <p className="muted">
              Offers expire in 5 minutes. If the customer accepts, you’re
              assigned at this fare. A 10% platform fee applies to the fare.
            </p>
            <button className="btn primary" disabled={model.busy}>
              Send offer
            </button>
          </form>
        </Modal>
      )}
    </article>
  );
}
export function Modal({
  title,
  onClose,
  children,
  error,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  error?: string;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLDialogElement>("dialog");
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="section-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {error && (
          <p className="notice-box error" role="alert">
            {error}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
export function Trip({
  booking: b,
  model,
  onBack,
}: {
  booking: Booking;
  model: Ready;
  onBack: () => void;
}) {
  const isCustomer = b.customer_id === model.state.profile.id,
    assigned = b.driver_id === model.state.profile.id;
  const [modal, setModal] = useState<
      "cancel" | "counter" | "start" | "complete" | "cash" | null
    >(null),
    [offer, setOffer] = useState<Offer | null>(null),
    [now, setNow] = useState(Date.now()),
    [sharing, setSharing] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const canShare =
    assigned && ["assigned", "arrived", "in_progress"].includes(b.status);
  useEffect(() => {
    if (!sharing || !canShare) return;
    if (!navigator.geolocation) {
      model.setError("Location sharing is not supported on this device.");
      setSharing(false);
      return;
    }
    let last = 0;
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - last < 15000) return;
        last = Date.now();
        void model.command(
          "location",
          { lat: p.coords.latitude, lng: p.coords.longitude },
          "",
        );
      },
      () => {
        model.setError("Location access was denied or unavailable.");
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [sharing, canShare]); // the hook uses current state setters; watch is deliberately stable
  const share = async () => {
    const text = `Redo trip ${b.id.slice(0, 8)}\n${b.pickup} → ${b.destination}\n${b.driver_name || ""} · ${b.driver_plate || ""}`;
    try {
      if (navigator.share)
        await navigator.share({ title: "My Redo journey", text });
      else {
        await navigator.clipboard.writeText(text);
        model.setNotice("Trip details copied.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        model.setError(
          "Sharing isn’t available. You can copy the trip details from this page.",
        );
    }
  };
  const expired =
    b.status === "searching" && new Date(b.expires_at).getTime() <= now;
  return (
    <div className="trip-page">
      <button className="text-button" onClick={onBack}>
        ← Back to activity
      </button>
      <div className="trip-layout">
        <section className="panel trip-main">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {b.service === "ride" ? "YOUR RIDE" : "YOUR DELIVERY"}
              </span>
              <h2>{expired ? "Request expired" : statusLabel(b.status)}</h2>
            </div>
            <span className="trip-icon">
              {b.status === "completed" ? (
                <Check size={27} />
              ) : (
                <Car size={27} />
              )}
            </span>
          </div>
          <RouteLine pickup={b.pickup} destination={b.destination} />
          {b.status === "searching" && (
            <>
              <div className="search-status">
                <Search size={20} />
                <div>
                  <strong>
                    {expired
                      ? "No driver was selected in time."
                      : "Waiting for driver offers"}
                  </strong>
                  <p>
                    {expired
                      ? "Cancel this request to start a new one."
                      : "Your request is visible to approved drivers in your city. Offers will appear here when they respond."}
                  </p>
                </div>
              </div>
              <div className="receipt-row">
                <span>Your first offer</span>
                <strong>{money(b.initial_fare)}</strong>
              </div>
              <div className="offers-list">
                {b.offers
                  .filter((o) => o.status === "pending")
                  .map((o) => {
                    const left = Math.max(
                      0,
                      Math.floor(
                        (new Date(o.expires_at).getTime() - now) / 1000,
                      ),
                    );
                    const yourTurn = isCustomer
                      ? o.turn === "customer"
                      : o.turn === "driver";
                    return (
                      <article className="offer-card" key={o.id}>
                        <div className="offer-top">
                          <span className="avatar">
                            {initials(o.driver_name)}
                          </span>
                          <div>
                            <h3>{o.driver_name}</h3>
                            <p>
                              <Star size={14} />
                              {o.rating || "New driver"}{" "}
                              <span>· {o.trips} trips</span>
                            </p>
                            <small>
                              {o.color} {o.vehicle} · {o.plate}
                            </small>
                          </div>
                          <strong className="offer-price">
                            {money(o.amount)}
                          </strong>
                        </div>
                        <div className="offer-meta">
                          <span>
                            <Clock size={14} />
                            {o.eta_minutes} min estimate
                          </span>
                          <span>Round {o.round}/3</span>
                          <span>
                            {left > 0
                              ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
                              : "Expired"}
                          </span>
                        </div>
                        {yourTurn && left > 0 && !expired ? (
                          <div className="offer-actions">
                            <button
                              className="icon-button"
                              aria-label={`Decline ${o.driver_name}'s offer`}
                              disabled={model.busy}
                              onClick={() =>
                                void model.command(
                                  "decline",
                                  { booking_id: b.id, offer_id: o.id },
                                  "Offer declined",
                                )
                              }
                            >
                              <X size={21} />
                            </button>
                            <button
                              className="btn secondary"
                              disabled={model.busy || o.round >= 3}
                              onClick={() => {
                                setOffer(o);
                                setModal("counter");
                              }}
                            >
                              Counter
                            </button>
                            <button
                              className="btn primary"
                              disabled={model.busy}
                              onClick={() =>
                                void model.command(
                                  "accept",
                                  { booking_id: b.id, offer_id: o.id },
                                  "Fare agreed. Your driver is assigned.",
                                )
                              }
                            >
                              <Check size={17} />
                              Accept
                            </button>
                          </div>
                        ) : (
                          <p className="muted">
                            {left > 0
                              ? "Waiting for the other person to respond."
                              : "This offer has expired."}
                          </p>
                        )}
                      </article>
                    );
                  })}
              </div>
            </>
          )}
          {b.driver_id && (
            <>
              <div className="driver-card">
                <span className="avatar large">
                  {initials(
                    isCustomer
                      ? b.driver_name || "Driver"
                      : b.customer_name || "Customer",
                  )}
                </span>
                <div>
                  <h3>{isCustomer ? b.driver_name : b.customer_name}</h3>
                  <p>{isCustomer ? b.driver_vehicle : "Customer"}</p>
                  <span className="verified">
                    <ShieldCheck size={14} />
                    {isCustomer
                      ? "Driver application approved"
                      : "Booking contact"}
                  </span>
                </div>
                {isCustomer && (
                  <strong className="plate">{b.driver_plate}</strong>
                )}
              </div>
              {isCustomer && b.pickup_pin && (
                <div className="pin-card">
                  <div>
                    <p>Pickup PIN · Share only when you meet</p>
                    <strong>{b.pickup_pin}</strong>
                  </div>
                  <ShieldCheck size={34} />
                </div>
              )}
              <div className="trip-facts">
                <div>
                  <small>Agreed fare</small>
                  <strong>{money(b.agreed_fare || 0)}</strong>
                </div>
                <div>
                  <small>Payment</small>
                  <strong>
                    {b.payment_status === "cash_received"
                      ? "Cash received"
                      : "Cash after trip"}
                  </strong>
                </div>
              </div>
              <div className="contact-actions">
                {(isCustomer ? b.driver_phone : b.customer_phone) && (
                  <a
                    className="btn secondary"
                    href={
                      "tel:" + (isCustomer ? b.driver_phone : b.customer_phone)
                    }
                  >
                    <Phone size={18} />
                    Call {isCustomer ? "driver" : "customer"}
                  </a>
                )}
                <button className="btn secondary" onClick={() => void share()}>
                  <Share2 size={18} />
                  Share details
                </button>
              </div>
            </>
          )}
          {b.service === "delivery" && b.recipient && (
            <div className="delivery-details">
              <h3>Delivery details</h3>
              <p>
                {b.recipient} · {b.recipient_phone}
              </p>
              <p>{b.parcel}</p>
              <p>{b.instructions}</p>
              {b.delivery_proof && (
                <p>
                  <strong>Delivery confirmation:</strong> {b.delivery_proof}
                </p>
              )}
            </div>
          )}
          {assigned && (
            <div className="trip-controls">
              {b.status === "assigned" && (
                <button
                  className="btn primary wide"
                  disabled={model.busy}
                  onClick={() =>
                    void model.command(
                      "arrive",
                      { booking_id: b.id },
                      "Customer notified of your arrival.",
                    )
                  }
                >
                  I’ve arrived at pickup
                </button>
              )}
              {b.status === "arrived" && (
                <button
                  className="btn primary wide"
                  onClick={() => setModal("start")}
                >
                  Enter pickup PIN & start
                </button>
              )}
              {b.status === "in_progress" && (
                <button
                  className="btn primary wide"
                  onClick={() => setModal("complete")}
                >
                  Complete {b.service === "ride" ? "ride" : "delivery"}
                </button>
              )}
              {b.status === "completed" && b.payment_status === "unpaid" && (
                <button
                  className="btn primary wide"
                  onClick={() => setModal("cash")}
                >
                  Confirm cash received
                </button>
              )}
              {canShare && (
                <button
                  className="btn secondary wide"
                  onClick={() => setSharing(!sharing)}
                >
                  <Navigation size={17} />
                  {sharing
                    ? "Stop sharing my location"
                    : "Share my live location"}
                </button>
              )}
              {sharing && canShare && (
                <small className="muted">
                  Sharing while this screen stays open. Your customer sees only
                  recent location updates.
                </small>
              )}
            </div>
          )}
          {isCustomer && b.status === "completed" && (
            <div className="rating">
              <h3>
                {b.rating
                  ? "Thanks for your feedback"
                  : "How was your journey?"}
              </h3>
              <p>Rate {b.driver_name}</p>
              <div>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    aria-label={`Rate ${n} stars`}
                    disabled={model.busy || !!b.rating}
                    onClick={() =>
                      void model.command(
                        "rate",
                        { booking_id: b.id, rating: n },
                        "Thanks for your rating.",
                      )
                    }
                  >
                    <Star
                      size={34}
                      fill={b.rating && n <= b.rating ? "#bdf168" : "none"}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          {active(b) &&
            b.status !== "in_progress" &&
            (isCustomer || assigned) && (
              <button
                className="text-button danger"
                onClick={() => setModal("cancel")}
              >
                Cancel {b.service === "ride" ? "ride" : "delivery"}
              </button>
            )}
        </section>
        <aside className="trip-aside">
          {isCustomer &&
          b.driver_location?.lat != null &&
          b.driver_location?.lng != null ? (
            <section className="panel live-map">
              <iframe
                title="Driver’s last reported location"
                referrerPolicy="no-referrer"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${b.driver_location.lng - 0.015},${b.driver_location.lat - 0.01},${b.driver_location.lng + 0.015},${b.driver_location.lat + 0.01}&layer=mapnik&marker=${b.driver_location.lat},${b.driver_location.lng}`}
              />
              <p>
                <span className="online-dot" />
                Driver location ·{" "}
                {new Date(b.driver_location.at).toLocaleTimeString()}
              </p>
            </section>
          ) : (
            <div className="panel journey-note">
              <Navigation size={26} />
              <h3>
                {b.status === "completed"
                  ? "Journey completed"
                  : "Stay connected"}
              </h3>
              <p>
                {b.status === "completed"
                  ? "Your trip and receipt are saved in Activity."
                  : "Your driver’s location appears here when they choose to share it. Call your driver for pickup directions."}
              </p>
            </div>
          )}
          <section className="panel receipt">
            <h3>
              <Receipt size={20} />
              Trip receipt
            </h3>
            <div className="receipt-row">
              <span>First offer</span>
              <strong>{money(b.initial_fare)}</strong>
            </div>
            <div className="receipt-row">
              <span>Agreed fare</span>
              <strong>
                {b.agreed_fare ? money(b.agreed_fare) : "Not agreed yet"}
              </strong>
            </div>
            <div className="receipt-row total">
              <span>Total</span>
              <strong>{b.agreed_fare ? money(b.agreed_fare) : "—"}</strong>
            </div>
            <span
              className={`badge ${b.payment_status === "cash_received" ? "green" : "amber"}`}
            >
              {b.payment_status === "cash_received"
                ? "Cash receipt confirmed by driver"
                : "Payment not confirmed"}
            </span>
            <small>Trip #{b.id.slice(0, 8).toUpperCase()}</small>
          </section>
          <section className="panel timeline">
            <h3>Journey updates</h3>
            {b.events?.map((e, i) => (
              <div key={i}>
                <i />
                <p>
                  {e.kind.replaceAll("_", " ")}
                  <small>
                    {new Date(e.at).toLocaleString("en-NG", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}
                  </small>
                </p>
              </div>
            ))}
          </section>
        </aside>
      </div>
      {modal && (
        <Modal
          title={
            modal === "cancel"
              ? "Cancel this request?"
              : modal === "counter"
                ? "Make a counter offer"
                : modal === "start"
                  ? "Confirm pickup PIN"
                  : modal === "cash"
                    ? "Have you received the cash?"
                    : "Complete your journey"
          }
          onClose={() => setModal(null)}
          error={model.error}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = Object.fromEntries(new FormData(e.currentTarget));
              let action: string = modal;
              let payload: Record<string, unknown> = { booking_id: b.id, ...d };
              if (modal === "counter")
                payload = {
                  ...payload,
                  offer_id: offer?.id,
                  amount: Math.round(Number(d.amount) * 100),
                };
              if (modal === "cash") action = "cash_received";
              if (
                await model.command(
                  action,
                  payload,
                  modal === "cash" ? "Cash receipt saved." : "Journey updated.",
                )
              )
                setModal(null);
            }}
          >
            {modal === "cancel" ? (
              <label>
                Reason
                <textarea
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder="Let us know why you’re cancelling"
                />
              </label>
            ) : modal === "counter" ? (
              <label>
                Your offer (₦)
                <input
                  name="amount"
                  type="number"
                  min={100}
                  max={500000}
                  step={1}
                  defaultValue={(offer?.amount || 0) / 100}
                  required
                />
              </label>
            ) : modal === "start" ? (
              <>
                <p className="muted">
                  Ask the customer for their 4-digit PIN when you meet at
                  pickup.
                </p>
                <label>
                  Pickup PIN
                  <input
                    name="pin"
                    className="pin-input"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    required
                    autoComplete="off"
                  />
                </label>
              </>
            ) : modal === "complete" ? (
              b.service === "delivery" ? (
                <label>
                  Recipient & delivery confirmation
                  <textarea
                    name="proof"
                    required
                    minLength={10}
                    maxLength={1000}
                    placeholder="Who received it, where and any confirmation details"
                  />
                </label>
              ) : (
                <p>
                  Confirm that you have reached the destination and the customer
                  has left the vehicle.
                </p>
              )
            ) : (
              <p>
                Confirm only after receiving {money(b.agreed_fare || 0)} in
                cash. This records your receipt; Redo does not collect or
                transfer the money.
              </p>
            )}
            <button className="btn primary wide" disabled={model.busy}>
              {model.busy ? "Saving…" : "Confirm"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
