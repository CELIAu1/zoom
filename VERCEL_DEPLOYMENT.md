# Deploying the authenticated Waka product

## 1. Supabase

Use a new production project (or a dedicated staging project first). The migration creates `waka_profiles`, `waka_drivers`, `waka_bookings`, `waka_booking_secrets`, `waka_offers`, `waka_events`, `waka_support`, `waka_saved_places` and `waka_admin_audit`. No existing demo records are imported.

Run `supabase/migrations/202610130001_product.sql` once in the SQL editor **before creating Waka users**. Alternatively use Supabase CLI migrations. For an existing project containing Auth users, plan a profile backfill; the trigger applies to new users. Do not drop existing data to rerun a migration.

Enable Email + Password Auth and leave email confirmations enabled. Set minimum password length to 12, configure production SMTP, Auth rate limits and your exact site/redirect URLs. Supabase's default email sender is not a production mail service.

Waka uses email codes entered on the same screen. Configure the **Confirm signup** and **Reset password** email templates to show `{{ .Token }}` prominently. For example:

```html
<h2>Your Waka verification code</h2>
<p>Enter this code in Waka:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>If you did not request this, ignore this email.</p>
```

Use the signup template for signup and reset template for recovery; Waka validates the matching token type. Configure short OTP expiry in Auth. Auth handles account creation, credential hashing, verification, rate limits and token rotation. Do not disable confirmation to work around email setup.

## 2. Vercel

- Repository: `CELIAu1/zoom`; choose the product rewrite branch when testing it.
- Framework preset: Next.js.
- Root directory: `.`
- Output directory: default; no override.
- Node: 24.x.
- Build: configured by `vercel.json` (`pnpm run build:vercel`). The default `pnpm build` also uses Next.js.

Set these server environment variables for the target deployment environment:

| Variable              | Value                                                         |
| --------------------- | ------------------------------------------------------------- |
| `SUPABASE_URL`        | `https://YOUR_PROJECT.supabase.co`                            |
| `SUPABASE_ANON_KEY`   | Supabase publishable or legacy anon key, **not** service-role |
| `MAPBOX_ACCESS_TOKEN` | Optional Mapbox key entitled to permanent geocoding           |

No service-role key is needed or used. Requests to PostgreSQL carry the logged-in user's access token. Never put secrets into committed source or chat.

Redeploy after setting environment variables. A successful build alone does not verify live Auth or the migration.

## 3. Assign the first administrator

Create and confirm your own account through the app. In the trusted Supabase SQL editor, identify the exact account by email and assign the admin role. Replace the sample email before running:

```sql
update public.waka_profiles p
set role = 'admin'
from auth.users u
where p.id = u.id and u.email = 'YOUR_OPERATIONS_EMAIL';
```

Only trusted database operators may do this. There is no public admin signup. Driver approval is a recorded human decision; verify identity, driving licence, vehicle and required operating documents outside the app, then record the decision and notes in Operations. Driver self-approval and direct client writes are denied.

## 4. Live acceptance check

Use distinct customer and driver accounts in separate devices/browser profiles, and an operations account:

1. Sign up; verify email; log out/in; recover and change a password.
2. Driver submits vehicle details. Confirm they cannot receive jobs before approval.
3. Operations verifies the driver and approves. Driver goes online in the customer's city.
4. Customer creates a ride. Driver offers a fare. Customer counters; driver accepts.
5. Verify that another user cannot read contacts, trip details or PIN. Verify only the customer sees the pickup PIN.
6. Driver arrives, enters the customer's PIN, starts and completes the ride. Driver confirms received cash once. Customer rates the ride.
7. Repeat for a business delivery; recipient details remain private until assignment and completion requires a delivery confirmation note.
8. Try competing offer acceptance from two devices, expired offers, cancellation and refresh/reconnect.
9. Check optional foreground location sharing and map on real iOS/Android devices. Test denied location permissions.
10. Submit and resolve a support request. Check history and cash ledger.

Do not announce public launch until these pass against the deployed project. Configure monitoring, backups, mail deliverability and an actual support/driver-review process. Terms, privacy notices and operating requirements must reflect your actual business before launch; this repository does not invent legal agreements.

## Existing demo deployment

The private ChatGPT Sites URL still serves the previously deployed demo until deliberately replaced. Old D1/Supabase demo tables are not read by this product. Production uses the new Supabase schema and independent email/password identities. This branch preserves the Sites build adapter for future work but Vercel is the intended deployment target of this release.
