"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Car,
  Package,
  House,
  Clock,
  UserRound,
  Wallet,
  RefreshCw,
  LoaderCircle,
  ShieldCheck,
  X,
  Navigation,
  Briefcase,
  Plus,
} from "lucide-react";
import { useProduct } from "../components/product/use-product";
import { Auth, Brand } from "../components/product/auth";
import {
  RequestForm,
  BookingCard,
  JobCard,
  Trip,
  Empty,
  type Ready,
} from "../components/product/booking";
import {
  Profile,
  Payments,
  DriverSetup,
  Admin,
} from "../components/product/account";
import { active, initials } from "../lib/product/types";
export default function App() {
  const controller = useProduct();
  const [tab, setTab] = useState("home"),
    [tripId, setTripId] = useState<string | null>(null),
    [filter, setFilter] = useState("all");
  useEffect(() => {
    setTab("home");
    setTripId(null);
    setFilter("all");
  }, [controller.state?.profile.id]);
  if (controller.loading)
    return (
      <div className="loading-screen">
        <Brand />
        <LoaderCircle className="spin" />
        <p>Opening Waka…</p>
      </div>
    );
  if (!controller.state || controller.recovery)
    return <Auth model={controller} />;
  const model = { ...controller, state: controller.state } as Ready;
  const { state } = model;
  const p = state.profile,
    driver = p.role === "driver",
    merchant = p.role === "merchant",
    admin = p.role === "admin";
  const trip = state.bookings.find((b) => b.id === tripId);
  const own = state.bookings.filter((b) =>
    driver ? b.driver_id === p.id : b.customer_id === p.id,
  );
  const ongoing = own.filter(active);
  const bids = driver
    ? state.bookings.filter(
        (b) => b.status === "searching" && b.driver_id !== p.id,
      )
    : [];
  const navigate = (t: string) => {
    setTab(t);
    setTripId(null);
  };
  const view = (id: string) => {
    setTripId(id);
    setTab("activity");
  };
  const nav = [
    {
      id: "home",
      icon: admin ? ShieldCheck : driver ? Briefcase : House,
      label: admin ? "Operations" : driver ? "My work" : "Home",
    },
    {
      id: "activity",
      icon: Clock,
      label: merchant ? "Deliveries" : "Activity",
    },
    { id: "payments", icon: Wallet, label: driver ? "Earnings" : "Payments" },
    { id: "profile", icon: UserRound, label: "Profile" },
  ];
  return (
    <div className="product-shell">
      <header className="topbar">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "selected" : ""}
              onClick={() => navigate(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="header-account">
          <span className="city-label">
            <Navigation size={14} />
            {p.city}
          </span>
          <button
            className="avatar"
            aria-label="Open profile"
            onClick={() => navigate("profile")}
          >
            {initials(p.name)}
          </button>
        </div>
      </header>
      {model.error && (
        <div className="global-feedback error" role="alert">
          {model.error}
          <button onClick={() => model.setError("")} aria-label="Dismiss">
            <X size={17} />
          </button>
        </div>
      )}
      {model.notice && (
        <div className="toast" role="status">
          <ShieldCheck size={18} />
          {model.notice}
        </div>
      )}
      <main className="product-main">
        {trip ? (
          <Trip
            key={trip.id}
            booking={trip}
            model={model}
            onBack={() => setTripId(null)}
          />
        ) : (
          <>
            {tab === "home" &&
              (admin ? (
                <Admin model={model} />
              ) : (
                <>
                  <div className="page-title heading-row">
                    <div>
                      <span className="eyebrow">
                        {merchant
                          ? "WAKA FOR BUSINESS"
                          : driver
                            ? "YOUR DRIVER WORKSPACE"
                            : "LET’S GET MOVING"}
                      </span>
                      <h1>
                        {driver
                          ? `Ready when you are, ${p.name.split(" ")[0]}.`
                          : merchant
                            ? `${p.business_name || "Your business"}, on the move.`
                            : `Where to, ${p.name.split(" ")[0]}?`}
                      </h1>
                      <p>
                        {driver
                          ? "Find your next trip. Agree on a fare. Make it a good one."
                          : merchant
                            ? "Keep every customer delivery in one place."
                            : "Across the city or just around the corner. Make it your journey."}
                      </p>
                    </div>
                    {driver && state.driver?.status === "approved" && (
                      <button
                        disabled={model.busy}
                        className={`availability ${state.driver.online ? "online" : ""}`}
                        onClick={() =>
                          void model.command(
                            "availability",
                            { online: !state.driver!.online },
                            state.driver!.online
                              ? "You’re offline."
                              : "You’re online and can respond to requests.",
                          )
                        }
                      >
                        <i />
                        {state.driver.online
                          ? "Online · Taking requests"
                          : "Offline · Go online"}
                      </button>
                    )}
                  </div>
                  {driver && state.driver?.status !== "approved" ? (
                    <DriverSetup model={model} />
                  ) : (
                    <>
                      {ongoing.length > 0 && (
                        <section className="active-section">
                          <div className="section-heading">
                            <h2>
                              {driver ? "Your active journey" : "In progress"}
                            </h2>
                            <span className="badge green">
                              {ongoing.length} active
                            </span>
                          </div>
                          {ongoing.map((b) => (
                            <BookingCard
                              key={b.id}
                              booking={b}
                              onClick={() => view(b.id)}
                            />
                          ))}
                        </section>
                      )}
                      {driver ? (
                        <>
                          <div className="section-heading feed-heading">
                            <div>
                              <span className="eyebrow">NEAR YOU</span>
                              <h2>Open requests</h2>
                            </div>
                            <button
                              className="icon-button"
                              aria-label="Refresh requests"
                              onClick={() => void model.reload()}
                            >
                              <RefreshCw size={18} />
                            </button>
                          </div>
                          {!state.driver?.online ? (
                            <section className="panel">
                              <Empty title="You’re currently offline">
                                Go online when you’re ready to see requests in{" "}
                                {p.city}.
                              </Empty>
                            </section>
                          ) : state.jobs.length === 0 ? (
                            <section className="panel">
                              <Empty title="Waiting for the next request">
                                New ride and delivery requests in {p.city} will
                                appear here automatically.
                              </Empty>
                            </section>
                          ) : (
                            <div className="jobs-grid">
                              {state.jobs.map((j) => (
                                <JobCard job={j} key={j.id} model={model} />
                              ))}
                            </div>
                          )}
                          {bids.length > 0 && (
                            <section className="active-section">
                              <h2>Your pending offers</h2>
                              {bids.map((b) => (
                                <BookingCard
                                  key={b.id}
                                  booking={b}
                                  onClick={() => view(b.id)}
                                />
                              ))}
                            </section>
                          )}
                        </>
                      ) : (
                        <div className="home-layout">
                          <RequestForm
                            model={model}
                            onCreated={() => navigate("activity")}
                          />
                          <aside className="home-aside">
                            <section className="green-feature">
                              <span className="feature-label">
                                <span />
                                THE WAKA WAY
                              </span>
                              <h2>
                                Your journey.
                                <br />
                                Your <em>fair fare.</em>
                              </h2>
                              <p>
                                Make an offer. Compare responses.
                                <br />
                                Choose who takes you there.
                              </p>
                              <div className="feature-route">
                                <span>
                                  <MapDot />
                                  You
                                </span>
                                <i />
                                <Car size={35} />
                                <i />
                                <span>
                                  <MapDot />
                                  Your next stop
                                </span>
                              </div>
                              <div className="feature-bottom">
                                <ShieldCheck size={20} />
                                <span>A pickup PIN for every journey.</span>
                              </div>
                            </section>
                            <section className="panel recent-panel">
                              <div className="section-heading">
                                <h3>Recent journeys</h3>
                                <button
                                  className="text-button"
                                  onClick={() => navigate("activity")}
                                >
                                  View all <ArrowUpRight size={15} />
                                </button>
                              </div>
                              {own.length === 0 ? (
                                <Empty
                                  icon={Navigation}
                                  title="Your next chapter starts here"
                                >
                                  Your recent destinations will appear after
                                  your first request.
                                </Empty>
                              ) : (
                                own.slice(0, 3).map((b) => (
                                  <button
                                    className="recent-row"
                                    key={b.id}
                                    onClick={() => view(b.id)}
                                  >
                                    <span className="small-icon">
                                      {b.service === "delivery" ? (
                                        <Package size={18} />
                                      ) : (
                                        <Clock size={18} />
                                      )}
                                    </span>
                                    <div>
                                      <strong>{b.destination}</strong>
                                      <small>{b.pickup}</small>
                                    </div>
                                    <ArrowRight size={17} />
                                  </button>
                                ))
                              )}
                            </section>
                            <div className="tip-note">
                              <ShieldCheck size={19} />
                              <p>
                                Always check your driver’s name and plate. Share
                                your pickup PIN only when you meet.
                              </p>
                            </div>
                          </aside>
                        </div>
                      )}
                    </>
                  )}
                </>
              ))}
            {tab === "activity" && (
              <>
                <div className="page-title heading-row">
                  <div>
                    <span className="eyebrow">YOUR JOURNEYS</span>
                    <h1>
                      {merchant
                        ? "Every delivery. One place."
                        : "A little history. A lot of movement."}
                    </h1>
                    <p>
                      Follow active requests and revisit the trips you’ve taken.
                    </p>
                  </div>
                  {!driver && !admin && (
                    <button
                      className="btn primary"
                      onClick={() => navigate("home")}
                    >
                      <Plus size={18} />
                      New request
                    </button>
                  )}
                </div>
                <div className="activity-filters">
                  {["all", "active", "completed", "cancelled"].map((f) => (
                    <button
                      key={f}
                      className={filter === f ? "selected" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {f === "all"
                        ? "All journeys"
                        : f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="activity-list">
                  {state.bookings
                    .filter(
                      (b) =>
                        filter === "all" ||
                        (filter === "active" ? active(b) : b.status === filter),
                    )
                    .map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        onClick={() => view(b.id)}
                      />
                    ))}
                  {state.bookings.filter(
                    (b) =>
                      filter === "all" ||
                      (filter === "active" ? active(b) : b.status === filter),
                  ).length === 0 && (
                    <section className="panel">
                      <Empty title="No journeys here yet">
                        Your requests and completed trips will appear here.
                      </Empty>
                    </section>
                  )}
                </div>
              </>
            )}
            {tab === "payments" && <Payments model={model} />}
            {tab === "profile" && (
              <>
                <div className="page-title">
                  <span className="eyebrow">YOUR WAKA</span>
                  <h1>A few things about you.</h1>
                  <p>Your details, regular places, and account settings.</p>
                </div>
                <Profile model={model} />
              </>
            )}
          </>
        )}
        <footer className="workspace-footer">
          <span>
            Waka · {p.role === "merchant" ? "Business" : p.role} workspace
          </span>
          <button className="text-button" onClick={() => void model.reload()}>
            <RefreshCw size={12} />
            {model.lastSync
              ? `Synced ${model.lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Refresh"}
          </button>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? "selected" : ""}
            aria-current={tab === n.id ? "page" : undefined}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={22} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
function MapDot() {
  return <b className="map-dot" />;
}
