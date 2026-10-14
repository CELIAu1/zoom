# Rydo authenticated product rewrite

Prepared 13 October 2026. Target: GitHub/Vercel, native Next.js 16, Node 24, Supabase Auth/PostgreSQL.

## What changed

Rebuilt the interface around the Lovable reference's emerald green, lime highlights, cream surfaces, round offer cards and mobile bottom navigation. Added a separate account entrance with customer, driver and business selection, email/password signup, verification, login, recovery and password changes. Login loads the role recorded in the database; there is no role switcher. Admin is operator-assigned only.

Replaced the per-user demo JSON workspace with normalised, shared PostgreSQL records and authenticated database transactions. Removed the demo endpoints, guest sessions, browser fallback, seeded drivers, simulated approval and fake receipts from application code. Existing demo tables are left untouched and unused.

Implemented:

- Real customer/business requests visible to approved online drivers in the matching city.
- Driver offers and counter offers, three negotiation turns, five-minute offer expiry and atomic assignment.
- Vehicle applications and audited human approval, rejection or suspension.
- Pickup arrival, customer-only PIN, persistent failed-attempt lockout, start, completion and delivery confirmation notes.
- Cash receipt confirmation by the assigned driver, once; customer ratings, once.
- Cash collected, commission owed and net earnings ledger (10% fare commission).
- Saved places, account updates and persistent support requests with an operations inbox.
- Optional Mapbox address search and real foreground device location sharing. No synthetic positions or ETA calculations.
- Shared state refresh every eight seconds while visible, with foreground refresh and stale-read protection around commands.

## Verified

`pnpm test`: nine tests pass. The database tests run the actual migration and stored procedures on embedded PostgreSQL (PGlite), not a mocked booking engine. Tests cover access/role boundaries, signup escalation, direct-table denial, real multi-identity booking transitions, negotiation limits, competing assignment refusal, record isolation, expiry, delivery privacy and proof, PIN guessing lockout and one-time cash/rating updates.

API tests cover missing configuration, no anonymous fallback, cross-origin mutation refusal, HttpOnly/Secure/SameSite cookies, refresh rotation, role input rejection, monetary validation, caller-identity stripping, persisted PIN errors and logout cleanup. Network provider responses are mocked in these API tests.

`pnpm build`: native Next.js production build and TypeScript validation pass. The output includes `/`, `/api/auth`, `/api/product`, `/api/places` and the `.next/routes-manifest.json` Vercel requires. `git diff --check` passes.

## Not yet verified / launch dependencies

No Supabase or Mapbox credentials were available in the workspace. The migration has not been applied to a live project; signup mail, real token flows, deployed multi-device races and device GPS have not been exercised against live services. The environment does not expose the supported local browser QA capability, so responsive layouts and browser interactions have not been visually tested. PGlite tests verify transaction rules sequentially, not a load or concurrent-connection stress test.

The Claude artifact requires sign-in and was not readable. The Lovable interface was inspected directly and the supplied screenshots informed the design.

This is a cash-first implementation, not a card payment/payout integration. Mapbox is optional and needs permanent-geocoding entitlement to store results. Manual addresses work without it. The live map shows a driver's voluntarily shared latest device position, not navigation or background tracking. Delivery confirmation is a textual operational record, not photographic evidence or a recipient signature. No emergency dispatch or guaranteed response time is advertised. History currently returns the latest 100 relevant bookings; jobs return the latest 50 open city requests.

Before public launch, complete `VERCEL_DEPLOYMENT.md`: configure Supabase, SMTP, email templates, rate limits, an operations account and the live acceptance checks. The business must supply its real support process, driver verification, privacy/terms and operating arrangements. The source is ready for review and staging configuration; it is not evidence that a live marketplace is already operational.

The existing private ChatGPT Sites deployment remains unchanged. This rewrite is prepared separately for GitHub review and Vercel deployment.
