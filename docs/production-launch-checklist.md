# Production Launch Checklist

## Current Gate

| Gate | State | Evidence / next action |
| --- | --- | --- |
| Target Supabase project | BLOCKED | `.env.local` and `supabase/config.toml` point to a project, but its environment is unverified. No Supabase CLI or PostgreSQL client is available. Owner must identify the approved Staging and Production projects. |
| Demo exit | BLOCKED | The last direct database read found Demo enabled and preview seed data. Recheck the approved target; do not disable Demo now. |
| Migration ledger and backup | NOT TESTED | No database connection or migration ledger was used in this run. |
| Pending rows with a null hold | NOT CHECKED | Count and inspect them with the owner; never bulk-expire automatically. |
| Local build/typecheck | PASS | `npm run typecheck`, `npm run build`, and `git diff --check` pass. SQL and Supabase behavior remain untested. |
| Pages deployment | PASS | The first build succeeded from GitHub `main` commit `b722d13`; the demo site is live at `https://khaledelomda.pages.dev`. Automatic production deployments are enabled. Verify Auth redirects, custom domain/DNS, and rollback before operational release. |
| Production authorization | BLOCKED | Owner requested a Pages deployment attempt, but the database target/environment and public domain are not confirmed. A Pages preview deployment does not authorize a production release or applying migrations. |

## 1. Confirm Ownership And Scope

- [ ] Owner confirms the exact Staging and Production Supabase project references through an approved channel; do not assume the configured project is Staging.
- [ ] Owner confirms which project may receive migrations and who can approve a production release.
- [ ] Confirm the public business name, requested Rawdat Alwadi identity, and whether the existing Android application ID must remain compatible.
- [ ] Confirm approved phone, WhatsApp, email, address/map, timezone, arrival instructions, and late policy.
- [ ] Obtain owner-approved terms, privacy, cancellation, refund, and guest-support wording.
- [ ] Approve unit and package names, descriptions, capacity, start windows, durations, prices, add-ons, taxes/fees, and publication state.
- [ ] Confirm photo usage rights and approve all image, logo, and map assets.
- [ ] Decide whether cash and bank transfer are the only accepted methods; keep online payments disabled unless its separate gate is complete.
- [ ] Select a phone-ownership verification method and SMS provider; four-digit recovery PINs are not phone verification.

## 2. Staging Database Preparation

- [ ] Confirm the remote migration ledger and compare actual schema/policies with migrations 001-005.
- [ ] Take a restorable backup and record counts for bookings, payments, units, packages, and settings.
- [ ] Review pending holds without changing them:

```sql
select status, payment_status, count(*)
from public.bookings
where status = 'pending'
group by status, payment_status
order by payment_status;

select id, booking_number, unit_id, starts_at, ends_at, payment_method, payment_status, created_at
from public.bookings
where status = 'pending' and hold_expires_at is null
order by created_at;
```

- [ ] Have the owner classify every pending row with no hold as active, expired, or requiring investigation. Do not automatically change historical rows.
- [ ] Inspect pending `processing` payments and verify provider state before releasing any hold.
- [ ] Rehearse migrations 004 and 005 on an isolated clone. Stop if there are unexpected policies, conflicts, overlapping bookings, duplicate/invalid rows, or a migration-ledger mismatch.
- [ ] Apply each approved migration to Staging only, in order, and save migration output and post-migration counts.

## 3. Database And Access Tests

- [ ] Test customer, owner, anon, and service-role permissions for every relevant table, view, and RPC.
- [ ] Test booking terms unchecked, blank, unchanged, and changed between quote and submit; verify only exact current terms can be recorded.
- [ ] Test no add-ons, a null add-on ID, missing required add-on, unavailable add-on, and valid add-on combinations.
- [ ] Test valid availability, expired unpaid/failed holds, live holds, unresolved processing holds, closed intervals, and overlapping reservations.
- [ ] Test two concurrent requests for the same unit and time; exactly one may succeed.
- [ ] Test owner state transitions: pending to confirmed/cancelled/expired; confirmed to checked-in/completed/cancelled; checked-in to completed.
- [ ] Verify invalid transitions, completing a future visit, early expiry, cancelling an unresolved payment, and reactivating a refunded booking all fail.
- [ ] Test atomic cash booking creation: a successful request is confirmed with a terms hash; any confirmation/terms failure leaves no partial booking.
- [ ] Verify a paid state cannot be set without a matching payment record and that a refund requires an existing paid record.
- [ ] Confirm RLS prevents cross-customer booking/payment reads and all unauthorized writes.
- [ ] Verify audit rows and customer notifications for successful owner actions.

## 4. Demo Exit

- [ ] Remove preview units, packages, add-ons, coupon, and FAQ data; do not relabel them as real inventory.
- [ ] Replace all preview identity, policy, location, arrival, late-policy, pricing, and description text with owner-approved values.
- [ ] Verify at least one real published unit and active package assigned to it.
- [ ] Verify owner-approved contact information and policy pages on mobile and desktop.
- [ ] Configure at least one approved payment method; if bank transfer is enabled, verify bank name, beneficiary, IBAN, and hold duration.
- [ ] Test the Demo exit trigger first in Staging. It is a guardrail, not a legal or operational approval.
- [ ] Keep Production in Demo until the owner has reviewed final live content and explicitly approved turning it off.

## 5. Authentication And Payments

- [ ] Configure Supabase Auth site URL, redirects, email/phone confirmation, password policy, rate limits, and CAPTCHA for the approved domain.
- [ ] Implement and test OTP-based phone ownership verification, account recovery, abuse controls, and local Saudi SMS delivery.
- [ ] Decide whether account signup and recovery-PIN updates must be disabled while Demo is on.
- [ ] Keep online payment disabled until provider credentials, signature/ownership checks, webhook verification, reconciliation, per-booking idempotency, late payment handling, and refund handling are implemented and tested.
- [ ] Test manual cash and bank-transfer recording only after actual receipt; test refunds only after actual out-of-app refunds.
- [ ] Verify unresolved or late provider responses reach an operator and do not silently release an occupied slot.

## 6. Web, Hosting, And Mobile Release

- [ ] Run `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build`.
- [ ] Run customer/owner end-to-end tests on desktop and phone-sized screens against Staging.
- [ ] Verify production browser settings, CORS origins, Auth redirects, and Edge Function secrets through the relevant provider consoles. Never place service-role or payment secrets in `VITE_*` variables.
- [ ] Verify the live Pages build command `npm run build`, output directory `dist`, `khaledelomda.pages.dev`, any custom domain/DNS, and rollback procedure before operational release.
- [ ] Confirm repository access, default branch, CI checks, deployment permissions, and commit author before further Git changes.
- [ ] If releasing Android, provide a compatible release keystore, configure signing outside the repository, build a signed release, and test on a physical device.
- [ ] Confirm analytics, privacy disclosure, backups, monitoring, error reporting, incident contact, and recovery procedure.
- [ ] Record the exact deployed commit, migration versions, build artifact, release time, and owner approval.

## Stop Conditions

- Stop before applying any migration if the target project or migration ledger is uncertain.
- Stop before disabling Demo if any preview content remains or the owner has not approved all operating details.
- Stop before enabling online payments if webhook/reconciliation/idempotency and late-payment handling are incomplete.
- Stop before publishing Android if the build is debug-signed or the required release identity is unknown.
- Stop before Production release if a Staging test, backup, rollback procedure, or owner approval is missing. A preview deployment does not satisfy these gates.
