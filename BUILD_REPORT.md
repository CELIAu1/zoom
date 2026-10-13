# Waka build report

Built from scratch against the supplied Waka brief and screenshots. The repository `CELIAu1/zoom` was inspected through GitHub: it contained only README.md on main. Both public reference URLs failed retrieval; their content was not claimed as inspected. Supplied screenshots informed rounded cards, typography hierarchy, offer composition and map/bottom-sheet relationship.

## Delivered

A private TypeScript application with React/Vinext and a persistent D1 backend. Warm neutral design tokens, dark primary actions, DM Sans with system fallback, responsive layouts, consistent icons, offer cards and active-job sheets replace the dominant green reference palette. Customer navigation is Home/History/Profile; Partner navigation is My Work/History/Profile. Payment records live in Profile and completed bookings.

Customer ride/delivery request forms include validation and proposed fares. Delivery collects recipient/contact, parcel description, size and optional instructions. Driver offers can be accepted, declined or countered. Partner can accept the original fare or respond with a counter. Offers retain their history, enforce response turns, expire after five minutes and allow up to three rounds. Booking confirmation is distinct from fare agreement and pickup.

Active jobs require assigned-partner arrival, correct pickup PIN, start and explicit completion. Delivery requires a textual demo handover note. Completion updates history and accrued earnings once. Demo receipts, tips and ratings are validated; earnings calculations use integer kobo and a centralized 10% commission on fare only. All three sample drivers can be operated by choosing their demo persona.

Profile edits and saved places persist. History has type/status filters, full details, event and offer logs, and device share/clipboard fallback. Onboarding submission does not imply approval; approval simulation is separately labelled. Calls, real payments and emergency response are explicitly unavailable.

## Persistence and permissions

Hosted authentication is ChatGPT sign-in with owner-private access. Each user has a separate demo workspace in D1. API writes verify identity, origin, payload size and row version. Fare and lifecycle rules are checked on the server. Compare-and-swap writes reject stale or competing commands. Switching roles and simulating approval are intentional demo controls within the owner's workspace; they are not production partner authorization.

## Verification

- TypeScript type check passed.
- Ten automated tests passed: seven domain/schema tests plus three HTTP-handler tests.
- Covered complete ride and delivery lifecycles, direct fare acceptance, two-way countering, offer expiry, wrong-role actions, unapproved partners, wrong assigned partner, invalid fares, incorrect PIN, repeated completion/receipt, delivery proof requirement, owner isolation, unauthenticated/cross-origin/oversized requests and simultaneous updates.
- API tests use the actual route handler bundled with test identity and D1-compatible in-memory SQLite bindings. They are not a deployed-service/browser test.
- Production build and private deployment results are reported with the delivery link.

Browser automation was unavailable. Responsive CSS and accessibility behaviors are implemented, but real-device visual QA, keyboard/assistive-technology testing, platform-authenticated API smoke tests and an end-to-end browser journey remain unverified.

## Remaining work for a live marketplace

Separate live customer/partner identities and production approval; normalized multi-user dispatch and real-time subscriptions; Supabase configuration if chosen for production; maps/geocoding/GPS; operational payments/payouts; secure document uploads and verification review; real contact mechanisms; notifications; emergency procedures and proof-of-delivery media. The current version is a persistent, single-owner simulation with two role views.

GitHub write access was subsequently enabled and the source was published to CELIAu1/zoom. The initial downloadable ZIP predates the Vercel compatibility fix; the repository is the current source.


## Vercel compatibility fix

The initial exported source used Vinext and Cloudflare runtime bindings, while Vercel auto-detected Next.js. This caused a missing `.next/routes-manifest.json` after the Vinext build. The repository now includes `vercel.json`, a native `build:vercel` command, a Vercel-specific TypeScript configuration and separate workspace handlers resolved per build target.

The native Next.js build passes and emits the required manifest. The original Sites build is preserved. Four additional tests cover missing configuration, signed guest session tampering/expiry, Supabase-adapter persistence and session isolation/concurrent updates. Total automated tests: 14. Supabase tests mock its REST transport; no real Supabase project has been configured or remotely verified.

Vercel opens a setup mode without credentials and requires the visitor to explicitly enable browser-only demo mode for local sample records. Optional Supabase server persistence uses a signed HTTP-only guest cookie, service-role-only workspace table and version-guarded writes. These guest sessions are not production customer/partner identity. The Cloudflare deployment continues using its existing ChatGPT identity and D1 records.

No Vercel account connection is available here, so Vercel redeployment itself is not verified. Trigger a deployment from the new GitHub commit and use the supplied setup guide.
