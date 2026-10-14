"use client";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Car,
  Package,
  UserRound,
  Check,
  Eye,
  EyeOff,
  MapPin,
  ShieldCheck,
  Mail,
} from "lucide-react";
import type { Product } from "./use-product";
import type { Role } from "../../lib/product/types";
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Redo home">
      <span className="brand-symbol">
        <i />
      </span>
      Redo
    </a>
  );
}
export function Auth({ model }: { model: Product }) {
  const [mode, setMode] = useState<
      "welcome" | "signup" | "login" | "verify" | "recover" | "password"
    >(model.recovery ? "password" : "welcome"),
    [role, setRole] = useState<Role>("customer"),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [email, setEmail] = useState(""),
    [verification, setVerification] = useState<"signup" | "recovery">("signup"),
    [note, setNote] = useState("");
  const go = (next: typeof mode) => {
    model.setRecovery(false);
    setMode(next);
    setError("");
    setNote("");
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await model.auth({
        ...values,
        action: mode,
        email: values.email || email,
        ...(mode === "signup" ? { role } : {}),
        ...(mode === "verify" ? { type: verification } : {}),
      });
      if (mode === "recover") {
        setVerification("recovery");
        setMode("verify");
        setNote("Check your inbox for a recovery code.");
      } else if (mode === "signup" && result.verify) {
        setVerification("signup");
        setMode("verify");
        setNote(result.message || "Check your email.");
      } else if (mode === "verify" && verification === "recovery") {
        model.setRecovery(true);
        setMode("password");
        setNote("Choose a new password.");
      } else {
        await model.reload();
        if (mode === "password") {
          model.setRecovery(false);
          setMode("login");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Brand />
        <div className="story-copy">
          <span className="eyebrow pale">YOUR CITY. YOUR WAY.</span>
          <h1>
            A fair fare.
            <br />A better <em>way to go.</em>
          </h1>
          <p>
            Move across town or send something special. Agree on the price,
            choose your driver, and get going.
          </p>
        </div>
        <div className="journey-art" aria-hidden="true">
          <div className="art-road r1" />
          <div className="art-road r2" />
          <div className="art-road r3" />
          <div className="art-park" />
          <svg viewBox="0 0 500 230">
            <path
              d="M70 185L70 75Q70 50 100 50H285Q325 50 325 85V142Q325 168 355 168H435"
              fill="none"
              stroke="#c4f365"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray="1 13"
            />
          </svg>
          <span className="art-pin from">
            <MapPin size={24} />
          </span>
          <span className="art-pin to">
            <Car size={25} />
          </span>
          <div className="art-label">
            <i />
            On your terms
          </div>
        </div>
        <div className="story-bottom">
          <span>
            <ShieldCheck size={18} />
            Your choice, every journey.
          </span>
          <span>Made for the way you move.</span>
        </div>
      </aside>
      <section className="auth-main">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-top">
          {mode === "login" ? (
            <>
              New to Redo?{" "}
              <button className="text-button" onClick={() => go("signup")}>
                Sign up <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="text-button" onClick={() => go("login")}>
                Log in <ArrowRight size={15} />
              </button>
            </>
          )}
        </div>
        <div className="auth-card">
          {mode !== "welcome" && (
            <button className="back-button" onClick={() => go("welcome")}>
              <ArrowLeft size={18} />
              Back
            </button>
          )}
          {model.configured && model.error && (
            <div className="notice-box error" role="alert">
              {model.error}
            </div>
          )}
          {!model.configured && (
            <div className="notice-box">
              Account services are not connected yet. Registration will open
              once Redo’s operator completes setup.
            </div>
          )}
          {mode === "welcome" ? (
            <>
              <span className="eyebrow">LET’S GET YOU MOVING</span>
              <h2>Welcome to Redo.</h2>
              <p className="muted">
                One place for your rides, deliveries, and next opportunity. How
                will you use Redo?
              </p>
              <RolePicker role={role} setRole={setRole} />
              <button className="btn primary wide" onClick={() => go("signup")}>
                Get started <ArrowRight size={19} />
              </button>
              <p className="auth-fine">
                Have an account?{" "}
                <button className="text-button" onClick={() => go("login")}>
                  Log in
                </button>
              </p>
            </>
          ) : (
            <>
              <span className="eyebrow">
                {mode === "login"
                  ? "GOOD TO HAVE YOU BACK"
                  : mode === "signup"
                    ? "YOUR NEXT CHAPTER STARTS HERE"
                    : "ACCOUNT ACCESS"}
              </span>
              <h2>
                {mode === "login"
                  ? "Welcome back."
                  : mode === "signup"
                    ? "Create your account."
                    : mode === "verify"
                      ? "Check your inbox."
                      : mode === "recover"
                        ? "Forgot your password?"
                        : "Set a new password."}
              </h2>
              <p className="muted">
                {mode === "login"
                  ? "Log in to pick up where you left off."
                  : mode === "signup"
                    ? "Your account opens the Redo experience that fits you."
                    : mode === "verify"
                      ? `Enter the email verification code sent to ${email}.`
                      : "We’ll help you securely access your account."}
              </p>
              {note && (
                <div className="notice-box success">
                  <Mail size={18} />
                  {note}
                </div>
              )}
              {error && (
                <div className="notice-box error" role="alert">
                  {error}
                </div>
              )}
              <form onSubmit={submit} className="form-stack">
                {mode === "signup" && (
                  <>
                    <RolePicker compact role={role} setRole={setRole} />
                    <label>
                      Full name
                      <input
                        name="name"
                        autoComplete="name"
                        placeholder="Your first and last name"
                        minLength={2}
                        maxLength={100}
                        required
                      />
                    </label>
                    {role === "merchant" && (
                      <label>
                        Business name
                        <input
                          name="business_name"
                          placeholder="Your business name"
                          required
                          maxLength={120}
                        />
                      </label>
                    )}
                    <label>
                      Phone number
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="+234 800 000 0000"
                        pattern="[+0-9 ()\-]{7,30}"
                        required
                      />
                    </label>
                  </>
                )}
                {["login", "signup", "recover"].includes(mode) && (
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={254}
                    />
                  </label>
                )}
                {["login", "signup", "password"].includes(mode) && (
                  <label>
                    Password
                    <div className="password-input">
                      <input
                        name="password"
                        type={show ? "text" : "password"}
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        minLength={mode === "login" ? 1 : 12}
                        maxLength={128}
                        placeholder={
                          mode === "login"
                            ? "Your password"
                            : "At least 12 characters"
                        }
                        required
                      />
                      <button
                        type="button"
                        aria-label={show ? "Hide password" : "Show password"}
                        onClick={() => setShow(!show)}
                      >
                        {show ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>
                )}
                {mode === "verify" && (
                  <label>
                    Verification code
                    <input
                      name="token"
                      className="pin-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6,10}"
                      required
                      placeholder="000000"
                    />
                  </label>
                )}
                {mode === "login" && (
                  <button
                    type="button"
                    className="text-button align-right"
                    onClick={() => go("recover")}
                  >
                    Forgot password?
                  </button>
                )}
                <button
                  disabled={busy || !model.configured}
                  className="btn primary wide"
                >
                  {busy
                    ? "Please wait…"
                    : mode === "login"
                      ? "Log in"
                      : mode === "signup"
                        ? "Create account"
                        : mode === "verify"
                          ? "Verify email"
                          : mode === "recover"
                            ? "Send recovery code"
                            : "Update password"}
                  <ArrowRight size={18} />
                </button>
              </form>
              {mode === "verify" && (
                <button
                  disabled={busy}
                  className="text-button"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await model.auth({
                        action:
                          verification === "signup" ? "resend" : "recover",
                        email,
                      });
                      setNote("If eligible, a new email is on its way.");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Try again.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Resend email
                </button>
              )}
              {mode === "signup" && (
                <p className="auth-fine">
                  {role === "driver"
                    ? "Driver accounts require vehicle and licence review before accepting requests."
                    : "Your email and phone help keep your bookings connected to you."}
                </p>
              )}
            </>
          )}
        </div>
        <footer className="auth-footer">
          <span>Redo · Ride & delivery</span>
          <span>Abuja & Lagos</span>
        </footer>
      </section>
    </div>
  );
}
function RolePicker({
  role,
  setRole,
  compact = false,
}: {
  role: Role;
  setRole: (r: Role) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`role-options ${compact ? "compact" : ""}`}
      role="radiogroup"
      aria-label="Account type"
    >
      {(
        [
          {
            id: "customer",
            icon: UserRound,
            title: "I need a ride",
            desc: "Book rides and send packages.",
          },
          {
            id: "driver",
            icon: Car,
            title: "I want to drive",
            desc: "Find requests and earn on your terms.",
          },
          {
            id: "merchant",
            icon: Package,
            title: "For my business",
            desc: "Manage deliveries for your customers.",
          },
        ] as const
      ).map((r) => (
        <button
          key={r.id}
          type="button"
          role="radio"
          aria-checked={role === r.id}
          className={role === r.id ? "role-option selected" : "role-option"}
          onClick={() => setRole(r.id)}
        >
          <span className="role-icon">
            <r.icon size={21} />
          </span>
          <span>
            <strong>{r.title}</strong>
            {!compact && <small>{r.desc}</small>}
          </span>
          <span className="radio-circle">
            {role === r.id && <Check size={12} />}
          </span>
        </button>
      ))}
    </div>
  );
}
