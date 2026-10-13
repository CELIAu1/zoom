# Deploy Waka on Vercel

## Build settings

1. Import `CELIAu1/zoom`, branch `main`.
2. Set Framework Preset to **Next.js** and Root Directory to **.**.
3. Leave Output Directory at its default; do not enter `dist` or `dist/client`.
4. The tracked `vercel.json` selects `pnpm run build:vercel`, which runs `next build --webpack`. If you have an explicit conflicting dashboard override, clear it.
5. Redeploy the latest commit. Installation continues to use the committed pnpm lockfile. Node is pinned to the supported 24.x line.

The default `build` script remains the Vinext/Cloudflare build used by the private Sites version. Running it as a Next.js build is what caused the original missing routes-manifest error.

## Preview without credentials

The Vercel page opens in setup mode and clearly states that server storage is unavailable. Select **Try browser-only demo** to test ride/delivery forms, negotiations, pickup PIN, lifecycle, history and earnings on your current device.

This is an explicit local simulation. Its records live in localStorage and its state rules run in the browser. They are not server-authoritative, are not isolated by real account authentication, and do not synchronize across devices. Clearing browser data removes them. No live dispatch, payments or verification are provided. Do not use this mode as production storage.

## Database-backed guest demo

1. Create or use a Supabase project.
2. In its SQL editor, execute `supabase/vercel-demo.sql` once. It creates `waka_demo_workspaces` with RLS enabled and no client-role table access.
3. In **Vercel → Project → Settings → Environment Variables**, set:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | Your project URL, e.g. `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | The project's legacy `service_role` JWT API key; server use only |
| `WAKA_SESSION_SECRET` | A stable, random secret of at least 32 characters |

Use the same environment scope as your deployment (Production and/or Preview). Never prefix these secret keys with `NEXT_PUBLIC_`. `.env.example` documents names only. A new secret can be generated locally with `openssl rand -hex 32`; keep it stable across deployments or existing guest sessions will become invalid.

4. Redeploy to apply the variables.
5. Use a fresh browser profile, or remove only the `waka-browser-demo-v1` localStorage entry before opening the new deployment. Existing browser-only records do not automatically migrate to Supabase.
6. The API sets a signed HttpOnly cookie identifying a guest workspace. Records persist in Supabase and mutations use an owner-and-version condition to reject competing updates.

This is database-backed **guest demo** persistence, not verified customer authentication. Customer and Partner modes still operate within one guest workspace. Real marketplace accounts, admin approval and multi-user dispatch require a separate production implementation.

## Verification status

The native Next.js production build was run successfully and `.next/routes-manifest.json` was verified. Automated tests cover both runtime handlers with isolated SQLite or mocked Supabase transport. Remote Vercel deployment and a real Supabase service have not been verified from this environment.
