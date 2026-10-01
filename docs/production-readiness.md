# Production Readiness

## Status

- No migrations were applied. Cloudflare Pages still has no deployment record. The reviewed app source and migration files are on GitHub `main`; automatic production deployments are enabled, and the next commit will trigger the first build.
- The last direct Supabase read in this workspace found `demo_mode=true`, two sample units, and two sample packages. Recheck the actual target project and migration ledger before any future change.
- The GitHub repository now has a populated `main` branch, committed through its web interface. The local workspace still has no local commit and contains staged and unstaged changes; preserve both layers.
- The owner requested a Pages deployment attempt, but public production release remains blocked while the database is in Demo and booking, permissions, payment, and account authentication are unverified against the target project.

## Release Gate

Status values are limited to `PASS`, `BLOCKED`, `NOT TESTED`, and `REQUIRES EXTERNAL INPUT`. A source review is not a runtime verification.

| Area | Status | Evidence | Remaining action |
| --- | --- | --- | --- |
| Local TypeScript and production build | PASS | `npm ci --ignore-scripts --no-audit --no-fund`, `npm run typecheck`, `npm run build`, and `git diff --check` passed. | This verifies the static build only, not Supabase runtime behavior. |
| Automated application/database tests | BLOCKED | `package.json` has no test script or configured test runner; no isolated database test target is available. | Add browser/integration and SQL transition tests once a safe test project is approved. |
| Required add-ons | NOT TESTED | Migration 005 adds a deferred database invariant; the initial RPC also rejects null add-on IDs. | Rehearse `[]`, `[NULL]`, missing required add-on, and valid add-on cases in an isolated Supabase project. |
| Terms consent | NOT TESTED | The new RPC requires the checked flag and exact current terms plus cancellation text; it stores a timestamp and SHA-256 hash. | Test accepted, unchecked, blank, and changed-policy cases in staging. Legacy timestamps without a hash are not evidence of consent. |
| Pending booking holds and status transitions | NOT TESTED | Migration 005 now limits booking status transitions, disallows completing future visits, preserves unresolved `processing` holds, and includes those holds in availability. Cash creation and confirmation are one database transaction. | Test the transition matrix, cash/bank flows, processing/expired holds, availability blocks, and overlap concurrency in staging. Inspect `pending` rows with a null hold; availability hides them while the exclusion constraint can still block that slot. Resolve each with the owner; do not bulk-expire them. |
| Demo-mode guest mutations and exit | NOT TESTED | Database guards block booking status/payment mutations in Demo, including security-definer RPC paths. Demo exit rejects the known fixtures, common preview wording, incomplete business/policy fields, and missing payment details. | Test every customer/admin mutation and verify both intentional rejection and approved exit in staging. Auth signup and recovery-PIN writes remain possible in Demo; decide whether public account creation should be disabled in Supabase Auth. |
| RLS, RPC grants, migrations, and no-double-booking | BLOCKED | Source-reviewed only; no SQL client or isolated target has been used in this run. | Confirm the target project and migration ledger, back up and rehearse migrations 004-005 on an isolated clone, then test role permissions and concurrency. |
| Customer phone verification | BLOCKED | The app still maps phone numbers to synthetic `.invalid` email addresses; no OTP verifies phone ownership. | Select and configure an SMS provider, then implement and test phone OTP and abuse/rate controls. |
| Online payments | BLOCKED | Online payments are database-disabled; there is no webhook or reconciliation/late-payment handling. | Keep disabled until provider secrets, webhook verification, idempotency, late-payment and refund handling are implemented and tested. |
| Resort identity, contact, policies, prices, and media | REQUIRES EXTERNAL INPUT | Seed content is explicitly preview data; current brand identity conflicts with the requested Rawdat Alwadi name. | Obtain owner-approved business details, legal policies, prices, photos/rights, location, and brand/app identity decision. |
| Supabase, domain, hosting, and GitHub release settings | BLOCKED | The ignored local `.env.local` project is not confirmed as Staging or Production. Cloudflare Pages project `khaledelomda` is connected to `2753442a/khaledelomda`, uses production branch `main`, `npm run build`, and `dist`, and has the public Supabase publishable key configured. The user-provided project URL is the code default. Automatic production deployments are enabled, but no deployment exists yet. | Let the new commit trigger the first Pages build, verify `khaledelomda.pages.dev`, and configure approved Auth redirects and any custom domain. Do not apply migrations or expose/commit local environment values. |
| Android release | BLOCKED | No release signing setup is present; the prior APK was debug-only. | Provide a compatible release keystore and configure/test the signed release build with Android tooling. |

The consent hash covers the exact policy text submitted by the booking page and is compared with the current database text under a row lock. It is an audit marker for the policy version, not cryptographic proof that a person clicked the checkbox. The booking UI links to a policy page that now displays both terms and cancellation text. Migration 005 deliberately leaves historical consent timestamps without hashes unverified rather than rewriting booking history.

## Demo Exit Checklist

The migration 005 trigger blocks `demo_mode=true` to `false` while known seed records remain: units `11111111-1111-4111-8111-111111111101` and `11111111-1111-4111-8111-111111111102`; packages `22222222-2222-4222-8222-222222222201` and `22222222-2222-4222-8222-222222222202`; add-on `33333333-3333-4333-8333-333333333301`; coupon `PREVIEW10`; or FAQ/content matching common preview wording. It also requires basic resort identity, contact, policy, and payment configuration. These phrase checks are not exhaustive; manually review all FAQs, media, units, packages, policies, and prices. The trigger cannot prove that replacement content is truthful or approved.

Before the owner disables Demo, verify all of the following against the resort's approved information:

- Remove the known fixtures above; do not merely relabel them.
- Enter the approved public resort name, tagline, description, timezone, logo/hero assets with usage rights, map/location, and arrival instructions.
- Publish at least one actual unit and one active package assigned to a published unit.
- Enter a real contact route: phone, WhatsApp, or email.
- Enter the real address, terms, privacy policy, cancellation policy, and refund policy.
- Set the approved cancellation window and late/arrival policies; verify every public policy page no longer contains preview wording.
- Confirm every unit's name, slug, real photographs and usage rights, descriptions, guest capacity, amenities, base price, and publication state.
- Confirm every package's name, duration, allowed start times, price, active state, and unit assignments.
- Review add-ons, required flags, prices, availability blocks, opening schedule, timezone, and any imported bookings for conflicts.
- Remove preview descriptions, placeholder policies, sample FAQs, and the `PREVIEW10` coupon; confirm map, arrival, contact, and bank details.
- Enable only payment methods the resort is ready to accept. Bank transfer requires an approved bank name, beneficiary, and IBAN. Cash bookings remain unpaid until receipt is recorded.
- Verify backup, RLS and owner roles, Auth configuration, and real booking/cancellation flows in a staging project first.

The trigger checks presence, known fixture identifiers, and common placeholder wording. It cannot prove legal approval, price accuracy, photo rights, map accuracy, or true operational readiness. Human review remains mandatory.

## Configuration Inventory

| Scope | Variable or setting | Required state |
| --- | --- | --- |
| Browser build | `VITE_SUPABASE_URL` | Optional override; the user-provided project URL is the code default. An ignored `.env.local` exists but its project has not been confirmed as Staging or Production. |
| Browser build | `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` | Target project's public publishable/anon key, protected by RLS; both are blank in `.env.example`. Do not print or copy an unverified local value. |
| Browser build | `VITE_MOYASAR_PUBLISHABLE_KEY` | Optional public key; not required while online payments are disabled. |
| Supabase Edge Functions | `SUPABASE_URL` | Target project URL provided to the function runtime. |
| Supabase Edge Functions | `SUPABASE_SERVICE_ROLE_KEY` | Secret, server-side only; never use in Vite or commit to Git. |
| Supabase Edge Functions | `ALLOWED_ORIGIN` | Exact production origin for function CORS; do not leave the wildcard default in production. |
| Supabase Edge Functions | `OWNER_BOOTSTRAP_SECRET` | Long random one-time secret; remove after first owner setup. |
| Supabase Edge Functions | `RECOVERY_HASH_SECRET` | Independent random server secret for recovery IP hashing. |
| Supabase Edge Functions | `MOYASAR_SECRET_KEY` | Optional secret, only if the payment integration is completed and enabled. |
| Supabase Auth dashboard | Site URL, allowed redirects, email/phone providers, OTP templates, rate limits, CAPTCHA | Set for the approved production domain and selected provider; current local config is localhost-only, email confirmations are off, and SMS signup is disabled. |
| Cloudflare Pages | Account/project, production domain/DNS, build command/output directory, build variables, deploy token | Project `khaledelomda` exists at `khaledelomda.pages.dev`, connected to GitHub branch `main`, configured for `npm run build` and `dist`, with a public Supabase key present. Automatic production deployments are enabled; the first deployment is pending the next commit. Verify build variables without printing their values; keep tokens in provider secrets. |
| GitHub | Repository write access, author name/email, default branch and build/deploy permissions | Repository `2753442a/khaledelomda` has a populated `main` branch committed through GitHub's web interface. Git CLI identity/credentials are not configured in this shell; no local commit or push was made. |
| Android | Release keystore, passwords, signing config, version code, Java/Android SDK, device test | No Release signing config or keystore is present; only the debug APK was previously verified. Do not publish it as a release. |

`VITE_SITE_URL` is not read by this application and is intentionally omitted from `.env.example`; the public site URL belongs in Supabase Auth settings. No real or placeholder credentials are stored in `.env.example`. With the public key missing, the client is directed to `127.0.0.1` and `supabaseConfigured` is false, avoiding accidental calls to the configured project.

## Authentication Gap

The current app maps phone numbers to synthetic `.invalid` email addresses. It does not send an OTP or verify phone ownership. Supabase phone signup is disabled in `supabase/config.toml`, and the four-digit recovery PIN is not a substitute for verified phone authentication. Select an SMS provider and implement/test Supabase phone OTP sign-in, signup, recovery, Saudi delivery, rate limits, and abuse protections before accepting real customer accounts. Provider credentials belong in Supabase Auth/provider settings, never `VITE_*`.

## Booking And Payment Review

- Booking creation checks Demo mode at the database insert trigger, validates the package, capacity, add-ons, coupon, payment method, and time, locks the unit row, and has a GiST exclusion constraint against overlapping active bookings. This is source-reviewed, not tested against production data.
- Availability reads are read-only. A pending hold is treated as occupied while its hold is live or its payment is still `processing`. Expired `unpaid`/`failed` pending rows are cleaned only when another booking is created; there is no scheduled cleanup job. `processing` rows require payment-provider reconciliation and are not released automatically.
- Cash confirmation confirms a reservation but does not mark its payment paid. Manual cash/transfer payment records require an owner action after actual receipt. Database triggers require a matching payment record before a booking can be marked paid.
- Cash reservation creation now records current terms and confirms the cash booking inside the same transaction; a failure rolls back the booking instead of leaving an unconfirmed orphan.
- Owner status changes are limited to pending-to-confirmed/cancelled/expired, confirmed-to-checked-in/completed/cancelled, and checked-in-to-completed. Check-in is restricted to the scheduled window; completion is rejected until the booking end. These rules are source-reviewed only.
- Quote responses are tied to the selected package/add-ons/coupon, so stale asynchronous replies are ignored. The submit handler has an in-flight guard and warns customers to review bookings after an ambiguous network failure; this is not durable server-side request idempotency.
- The failed Moyasar branch writes a failed payment record and requests `payment_status='failed'`; it does not set a booking paid. It now checks the update result and returns an error if the booking state cannot be reconciled. Online payments are blocked by a database constraint and are not presented in the normal payment choices.
- Moyasar verification depends on a signed-in browser returning before the hold expires. There is no payment webhook, reconciliation process, duplicate-success protection per booking, or automatic refund for a charge arriving after expiry. Do not enable online payments until these are implemented and tested.
- No end-to-end test has verified no-double-booking, RLS, cash/transfer recording, failed-payment behavior, or owner permissions against an isolated Supabase project.

## Migration Review And Rollback

| Migration | Reviewed effect | Main risk / rollback note |
| --- | --- | --- |
| `202610010001_initial_resort_platform.sql` | Creates tables, functions, RLS policies, storage bucket/policies, and a no-overlap constraint. | Constraint creation can fail if existing active bookings overlap. There is no safe blanket down migration; dropping created tables would destroy data. |
| `202610010002_booking_payment_guards.sql` | Adds `demo_mode`, forces existing online-payments flags false, adds a permanent false check, financial guards, demo insert guards, payment RPCs, and grants. | The update overwrites any previous `online_payments_enabled=true`; the old value cannot be inferred afterward. Removing the false check alone is not approval to enable payments. |
| `202610010003_phone_alias_auth.sql` | Replaces user-profile and PIN-recovery functions. | No down migration is included; restore the exact prior function definitions only from a reviewed snapshot/source. |
| `202610010004_demo_safety_and_availability.sql` | Makes availability reads side-effect free and adds a database guard for Demo exit. | No data is deleted, but no tested down migration exists. Reverting the availability function to migration 001 reintroduces writes during reads. |
| `202610010005_booking_integrity_and_consent.sql` | Adds required-add-on integrity checks, server-validated terms/cancellation consent, status transition limits, atomic cash confirmation, unresolved-payment hold protection, Demo mutation/exit guards, and recovery attempt limit corrections. | Not applied or runtime-tested. Review pending rows, especially null holds and `processing` payments, before application; rehearse the migration and deploy it before the frontend that calls the new RPCs. |

Before any application, verify the remote migration ledger and live schema match the expected baseline, back up the database, record row counts and critical settings, and rehearse each migration on an isolated clone. Stop if existing rows or policies differ from assumptions. If a production migration fails, stop application writes and prefer a reviewed forward-fix. Restore a pre-migration snapshot only with an explicit plan for any writes made after that snapshot. Do not drop tables, re-run `seed.sql`, or attempt a blind reverse migration in production.

## Identity And Release

The requested project name is Rawdat Alwadi, but current README, seed data, Capacitor app name, Android display name, and application ID still identify Khaled Alomda (`sa.khaledomda.resort`). Confirm the public resort name and whether the Android application ID must remain compatible with an existing app before changing release branding or package identity.
