# Module 01 Requirements Extraction

## Requirement Matrix

| # | Requirement | Type | Stakeholder | Source | Confidence |
| - | ----------- | ---- | ----------- | ------ | ---------- |
| 1 | Users can book time slots | functional | user | P1 explicit | high |
| 2 | Users can pay through the platform | functional | user | P1 explicit | high |
| 3 | Users can browse providers by category | functional | user | P1 explicit | high |
| 4 | Users can view provider profiles with ratings | functional | user | P1 explicit | high |
| 5 | Users receive confirmation emails after booking | functional | user | P1 explicit | high |
| 6 | Platform displays available time slots | functional | user | P1 implicit | medium |
| 7 | Platform prevents double booking of slots | constraint | platform/ops | P1 implicit | high |
| 8 | Platform links each booking to a specific provider | functional | platform/ops | P1 implicit | high |
| 9 | Platform links each payment to a booking | functional | platform/ops | P1 implicit | high |
| 10 | Platform tracks booking status such as pending, confirmed, or failed | functional | platform/ops | P1 implicit | medium |
| 11 | Providers can set availability | functional | provider | P2 explicit | high |
| 12 | Providers can set pricing for services | functional | provider | P2 explicit | high |
| 13 | Providers can add or edit service descriptions | functional | provider | P2 explicit | high |
| 14 | Providers have a dashboard to view bookings | functional | provider | P2 explicit | high |
| 15 | Providers can view earnings | functional | provider | P2 explicit | high |
| 16 | Providers can view user reviews | functional | provider | P2 explicit | high |
| 17 | Providers can flag users as no-shows | functional | provider | P2 explicit | high |
| 18 | Platform takes a 15% commission on bookings | constraint | platform/ops | P3 explicit | high |
| 19 | Ops/admin vets providers before onboarding | functional | platform/ops | P3 explicit | high |
| 20 | Ops/admin handles disputes and escalations | functional | platform/ops | P3 explicit | high |
| 21 | Platform tracks analytics on bookings and usage | functional | platform/ops | P3 explicit | high |
| 22 | System must scale from one city to five cities within six months | quality attribute | platform/ops | P3 explicit | high |
| 23 | System must support at least a few thousand users | quality attribute | platform/ops | P3 explicit | high |
| 24 | Search and browsing should feel instant to users | quality attribute | user | P3 explicit | high |

## Open Questions for the PM

1. When exactly is a booking confirmed: after payment, or only after provider approval?
2. What should happen to the slot if payment fails: release immediately or hold temporarily?
3. Can providers reject bookings after payment, or is booking final once payment succeeds?

## Business Rules and Constraints

- Cancellation policy source of truth: V1 uses a platform-wide cancellation and refund policy.
- Provider-specific cancellation policies are out of scope for V1 and must not override platform behavior.
- All refund logic must use the platform policy only.

## Dependency Ordering

1. Ops/admin vets providers before onboarding.
2. Providers set availability.
3. Providers set pricing.
4. Providers add service descriptions.
5. Users browse providers by category.
6. Users view provider profiles with ratings.
7. Platform displays available time slots.
8. Users book a time slot.
9. Users pay through the platform.
10. Users receive confirmation email.

Notes:
- For the first vertical slice, provider vetting can be treated as a pre-seeded condition instead of an implementation blocker.
- The critical path for the slice is provider data -> available slot data -> booking -> payment -> confirmation.

## First Vertical Slice

Goal: prove one end-to-end booking and payment flow works.

Scope:
- One approved provider is pre-seeded.
- The provider has two or three fixed time slots and a fixed price.
- The user can view the provider profile, select a time slot, complete mock or sandbox payment, and receive confirmation.
- The system creates a booking, marks it confirmed after payment, and emits confirmation through email or a log.

Flow:

`Browse -> View Provider -> Select Slot -> Pay -> Booking Confirmed`

Included requirements:
- 1, 2, 3, 4, 5, 6, 8, 9

Excluded for now:
- Provider dashboard
- Review system
- Commission logic beyond a stub
- Disputes and admin tooling
- Multi-city expansion work

Proof of success:
- User selects a slot and receives a success response while a booking record is created.
- Payment success marks the booking confirmed.
- The same slot cannot be booked twice.
- Confirmation output is generated.

## Failure Cases, Mitigations, and Proof Tests

1. Concurrent booking race
   - mitigation: Use an atomic database transaction or a unique constraint on `slot_id` for active bookings.
   - proof test: Send two booking requests for the same slot at the same time; only one succeeds and the other returns a conflict.

2. Payment succeeds but booking is not saved
   - mitigation: Create the booking as `pending` before payment, then update it to `confirmed` only after verified payment success.
   - proof test: Simulate payment success with a database update failure; the system keeps a recoverable pending booking or payment reference instead of losing the transaction.

3. Booking is created but payment fails
   - mitigation: Mark the booking as `payment_failed` and release the slot after failure or timeout.
   - proof test: Force payment failure; the booking is not confirmed and the slot becomes available again.

4. User abandons payment mid-flow
   - mitigation: Use a reservation expiry timer for pending bookings.
   - proof test: Create a pending booking, skip payment, wait past the expiry, and verify the slot is released automatically.

5. Invalid or expired slot selection
   - mitigation: Re-check slot availability on submit, not only when rendering the page.
   - proof test: Open a stale slot page, make the slot unavailable elsewhere, then submit the booking and verify the request is rejected safely.
