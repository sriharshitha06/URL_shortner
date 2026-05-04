# Module 7 - Updated Plan

## Preserved

- Auth/JWT core flow — authentication, token issuance, and identity validation remain unchanged.
- Individual billing system — company-style bookings still charge the authenticated booking user; no invoice split or org billing.
- Search/listing — provider discovery remains unchanged because the new requirement does not affect search behavior.

## Modified

- Booking API
  - Extend the payload to accept `booked_for_name` and `booked_for_email`.
  - Enforce that only users with `can_book_for_others = true` can send those fields.
  - Default absent delegation fields to self-booking.
- Booking UI
  - Add book-for-others inputs for name and email.
  - Conditionally render those fields based on `can_book_for_others`.
  - Display "booked by" vs. "booked for" clearly.
- User data model
  - Add `company_name` and `can_book_for_others`.
  - Ensure the new fields propagate consistently into JWT/session context.
- Provider dashboard
  - Show both "booked by" (actor) and "booked for" (subject) in booking details.

## Cut

- Full company account system (organizations and employee management) — safe to cut because the demo only needs visible delegation, not durable org modeling.
- Company billing/invoicing — safe to cut because billing can remain on the booking user without blocking the demo workflow.
- Advanced RBAC/permissions — safe to cut because one delegation flag is enough for the bridge.
- Full audit logging system — safe to cut because minimal provider visibility covers the demo need without broad logging work.

## Added

- Company booking payload support (API)
  - Scope: accept `booked_for_name` and `booked_for_email`, validate authorization, and enforce default self-booking behavior.
  - Estimate: M
- Booking UI extension
  - Scope: add input fields and conditional rendering for book-for-others behavior.
  - Estimate: M
- User context extension
  - Scope: propagate `company_name` and `can_book_for_others` through JWT/session data for downstream consumers.
  - Estimate: S
- Provider dashboard update
  - Scope: display "booked by" vs. "booked for" in booking records.
  - Estimate: S
