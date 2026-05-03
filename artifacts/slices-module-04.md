# Module 04 Vertical Slices

## Slice 1: Browse and Book (Seeded Data)

- Scope (What Is In):
  - Show 3 hardcoded provider cards with name, category, and rating
  - Open one provider detail page
  - Display one service with fixed time slots
  - Allow user to pick a slot and create a booking
  - Persist booking and show on-screen confirmation with booking reference
- Anti-Scope (What Is Explicitly Out):
  - No authentication
  - No payment processing
  - No email confirmation
  - No search or filtering
  - No provider self-service
  - No cancellations
  - No reviews
  - No real-time availability
- Dependencies:
  - None
- Acceptance Criteria:
  1. Open the app and see 3 providers listed.
  2. Click one provider and see one service with fixed time slots.
  3. Pick a slot and click Book.
  4. See a confirmation screen with booking reference, provider name, service, and time.
  5. Refresh and confirm the booking still exists.
- Estimated Complexity:
  - S

## Slice 2: Real Provider Self-Service

- Scope (What Is In):
  - Provider creates a profile
  - Provider adds one service
  - Provider sets simple availability
  - Demand-side flow now reads provider-created data instead of only seeded data
- Anti-Scope (What Is Explicitly Out):
  - No payment processing
  - No search
  - No reviews
  - No cancellations
  - No advanced scheduling rules
  - No multi-service complexity
- Dependencies:
  - Slice 1
- Acceptance Criteria:
  1. Create a provider profile.
  2. Add one service and basic time slots.
  3. Open the demand-side flow and see that provider appear.
  4. Book that provider through the same end-to-end path.
- Estimated Complexity:
  - M

## Slice 3: Authentication and Ownership

- Scope (What Is In):
  - Provider authentication
  - Basic session handling
  - Provider can edit only their own listing and availability
- Anti-Scope (What Is Explicitly Out):
  - No social auth
  - No password reset
  - No user booking history
  - No admin roles
- Dependencies:
  - Slice 2
- Acceptance Criteria:
  1. Sign in as a provider.
  2. Edit your own profile and availability.
  3. Attempt to access another provider's data and confirm it is blocked.
- Estimated Complexity:
  - M

## Slice 4: Booking Integrity

- Scope (What Is In):
  - Real availability check before confirmation
  - Double-booking prevention
  - Booking status states persisted in storage
- Anti-Scope (What Is Explicitly Out):
  - No payments
  - No refunds
  - No cancellations
  - No waitlists
- Dependencies:
  - Slices 1-3
- Acceptance Criteria:
  1. Attempt to book the same slot from two flows.
  2. Confirm only one booking succeeds.
  3. Confirm booking status is stored and visible in the result.
- Estimated Complexity:
  - M

## Slice 5: Payment Boundary

- Scope (What Is In):
  - Payment interface contract
  - Stubbed payment implementation
  - Booking flow calls payment boundary
  - Success and failure paths shown in UI
- Anti-Scope (What Is Explicitly Out):
  - No live Stripe integration
  - No real money movement
  - No refunds
  - No commission handling on real transactions
- Dependencies:
  - Slice 4
- Acceptance Criteria:
  1. Complete a booking and trigger the payment boundary.
  2. See a success outcome when the stub returns success.
  3. See a failure outcome when the stub returns failure.
  4. Confirm the booking result follows the payment response.
- Estimated Complexity:
  - S/M
