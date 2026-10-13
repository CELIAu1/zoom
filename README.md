# Waka

A mobile-first ride and delivery negotiation application, built in TypeScript with React. Two build targets are supported: Vinext/Cloudflare for Sites and native Next.js for Vercel. The hosted version is an authenticated, owner-private product demo. It is not a live ride-hailing service.

## Vercel deployment

Vercel reads `vercel.json` and runs `pnpm run build:vercel` (native `next build --webpack`). Keep framework preset Next.js, root directory `.`, and Output Directory unset/default. Do not set it to `dist`. The original `pnpm run build` still targets Vinext/Cloudflare.

See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for steps and backend setup. Without server credentials, the Vercel app offers an explicit browser-only demo. Choosing it runs domain validation on the client and stores sample records on that device; it is not server-authoritative or a live service. For database-backed guest sessions, configure Supabase and a stable signing secret as documented. This does not provide real marketplace authentication or dispatch.

## What works

- Customer: Home, History, Profile; ride and delivery request forms; suggested demo locations; proposed fares; partner offers; counteroffers and rejection; explicit booking confirmation; pickup PIN; trip summary sharing; history and negotiation audit trail; profile and saved places; demo receipts, tips and ratings.
- Partner: My Work, History, Profile; onboarding submission; explicit simulation of approval; availability; choosing a sample partner persona; responding to requests; accepting the initial fare or countering; arrival, PIN-verified pickup, start and completion; delivery handover note; earnings by partner.
- Backend: signed-in user isolation, server-side command validation, valid job transitions, enforced five-minute offer expiry and three rounds, immutable offer history, integer-kobo amounts, centrally configured commission, unique completion records and optimistic concurrency protection.

Each signed-in user owns one demo workspace. Customer and Partner modes operate on that same workspace, allowing one person to test both sides. The role switch and simulated approval are demo controls, not production authorization or real identity verification. Sample personas are not live drivers.

## Run and verify

Requires Node 24 for the test runner and SQLite tests. Install with `pnpm install --frozen-lockfile`. The committed pnpm lockfile is the dependency source of truth.

```sh
npm run typecheck
npm test
npm run build
```

The Sites-managed dependency/build helpers handle the managed runtime. In another environment, follow `scripts/install-ci.mjs` and the project's execution-profile configuration.

D1 schema lives in `db/schema.ts`; generated SQL is tracked in `drizzle/`. `npm run db:generate` creates schema migrations. After building, initialize a fresh local database with `node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --file drizzle/0000_nosy_thunderball.sql`. Run this initial schema SQL only once per fresh database. Use the platform migration workflow for later schema revisions. Hosted deployment applies the migration automatically.

Local previews do not automatically have authenticated ChatGPT identity; protected APIs correctly return 401 without it. Do not add client-controlled identity headers or a production authentication bypass. Domain and API tests use isolated test bindings and an in-memory SQLite database.

## Try a complete journey

1. In Customer mode, choose Ride or Delivery, fill required fields and submit your fare.
2. Generate demo responses, then accept an offer or counter it. Alternatively, go through Partner onboarding and accept the original customer fare.
3. To respond to a customer counter, switch to Partner and choose that offer's sample driver. Submit the demo application, explicitly simulate approval and go online.
4. Agree the fare. Switch to Customer and confirm the booking.
5. Switch to Partner (the assigned persona is selected automatically from Customer mode), mark arrival and enter the PIN visible in Customer mode.
6. Start and complete the job. Delivery also requires a textual demo handover note.
7. Return to Customer, select a rating and tip, then record the demo payment. No money is collected.
8. Inspect History and Partner earnings. Refreshing retains records.

## Project structure

- `app/page.tsx`: navigation and app shell.
- `components/waka/`: customer, partner, history, profile, dialogs, shared UI and client controller.
- `app/api/workspace/route.ts`: authenticated read/write API, origin checks, payload limits and compare-and-swap persistence.
- `lib/domain.ts`: pure command engine, booking/offer types, validation and financial calculations.
- `db/schema.ts`, `drizzle/`: database schema and migration.
- `tests/`: lifecycle and HTTP-handler tests.

## Financial rules

All amounts are integer kobo; NGN is the currency. Valid proposed fares are ₦100–₦500,000. `COMMISSION_BPS` is 1000 (10%) and is defined once in the domain module. Commission applies to the agreed fare, not tips. Completion records gross/commission/net accrued earnings; recording a demo receipt credits the selected tip once. Earnings are not payouts and pending demo payment is visible.

## Deployment and integrations

ChatGPT sign-in and private access are supplied by Sites. D1 is configured as `DB` in `.openai/hosting.json`. No privileged keys are in the frontend. Record mutation uses a per-user SQL row with a version-guarded update: two concurrent commands at the same version cannot both succeed.

Supabase is not configured. The hosted demo uses the platform's existing identity and D1 persistence instead of introducing a second authentication stack. A real customer/partner marketplace still needs dedicated accounts, normalized booking/offer tables and real-time dispatch. If moving to Supabase as requested for production, use Auth, PostgreSQL, RLS and transactional RPCs; do not transplant demo role switching as production access control.

Not integrated: real geocoding/maps/GPS, live driver dispatch, payment processing, payouts, push notifications, driver calling, secure verification/document storage, emergency dispatch and photo-based proof of delivery. Location names and the map are illustrative; no route distances or live ETAs are claimed. The safety panel explains its limitations. Share uses the device share sheet or clipboard with a clearly marked demo summary; it does not publish a live tracking link.

## Verification limits

Type checking, lifecycle tests, database concurrency tests, HTTP-handler tests and the deployment build were run. Automated browser QA was unavailable in this environment. Device layout, keyboard interaction, platform-authenticated API access and deployed journey smoke tests still need browser verification before any production launch.
