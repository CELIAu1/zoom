# Rydo

A green, mobile-first ride and delivery marketplace for Abuja and Lagos. Customers and businesses send real requests; approved drivers negotiate fares and fulfil bookings. No seeded drivers, demo personas, role switcher, simulated payments or browser-only workspace.

## Accounts

- **Customer:** rides, deliveries, fare offers, pickup PIN, history, cash receipts, ratings, saved places and support.
- **Driver:** vehicle application, operations approval, online availability, city request feed, negotiation, trip lifecycle, voluntary foreground location sharing and earnings ledger.
- **Business:** delivery-first dashboard, recipient and parcel details, multiple active deliveries and history.
- **Operations:** protected driver reviews and support inbox. Admin access cannot be selected at signup or changed through the profile API.

Email/password signup, email verification, login, recovery codes, password changes and logout use Supabase Auth. The server stores sessions in HttpOnly cookies. The database, not the interface, enforces roles, booking ownership, negotiation turns, trip transitions and cash receipts.

## Run

Use Node 24 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# Fill the two required Supabase variables. Apply the migration first.
pnpm dev
pnpm test
pnpm build
pnpm start
```

The native Next.js build is the default and the Vercel build command. Sites build tooling remains isolated under `build:sites` / `dev:sites`; this rewrite does not deploy or replace the previously hosted private demo.

## Backend setup

Follow [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md). Apply `supabase/migrations/202610130001_product.sql` to a fresh Supabase project, configure email delivery and set the environment variables. Tables are new and do not read or migrate the old demo workspaces.

Without configuration the entrance screen explicitly says accounts are not open. There is no fake login or local-storage fallback.

## Real operating scope

This release is a **cash-payment marketplace foundation**. It records driver-confirmed cash receipts, with a 10% commission ledger; it does not charge cards, send transfers, pay drivers or settle commission. Location sharing uses actual device coordinates while the driver keeps the screen open; it is not a native background tracking service. Address search is optional; there are no fabricated distances, ETAs, map routes or drivers. ETA is a driver's own estimate.

Launch requires a configured Supabase project and SMTP, an operator to approve drivers and handle support, and validation with separate real customer/driver accounts on deployed devices. See [BUILD_REPORT.md](BUILD_REPORT.md) for verification and remaining launch work.
