# Module 7 - Blast Radius

## Company Accounts

### Core Surfaces

| Area | Status + Impact |
|---|---|
| User data model | MAJOR — add `company_name` and `can_book_for_others` so company-context behavior can be represented in user records and downstream logic. |
| Auth/JWT system | MINOR — keep auth flow unchanged, but expose `can_book_for_others` and company context in token/session data for authorization and UI behavior. |
| Booking flow (API) | MAJOR — accept and validate `booked_for_name` and `booked_for_email`; enforce that only users with `can_book_for_others = true` can delegate; default missing delegation fields to self-booking. |
| Booking flow (UI) | MAJOR — add conditional book-for-others fields and clearly show "booked by" vs. "booked for" so the delegation workflow is visible in the demo. |
| Payment/billing | MINOR — preserve the existing billing infrastructure, but explicitly enforce the rule that company-style bookings still charge the authenticated booking user; no invoice split or org billing. |

### Extended Surfaces

| Area | Status + Impact |
|---|---|
| Provider dashboard | MINOR — display both the actor and subject of the booking so providers can tell who made the booking and who will attend. |
| Search/listing | NO IMPACT — provider discovery does not change because company booking affects booking semantics, not search behavior. |
| Interface contracts between streams | MAJOR — booking payloads and user context now carry `company_name`, `can_book_for_others`, and `booked_for_*` fields, so API, UI, and provider surfaces must share one contract to avoid semantic drift. |
| Tickets: completed | NO IMPACT — keep stable unless a completed artifact emits or consumes booking/user payloads that now need the new fields. |
| Tickets: in progress | MAJOR — any booking-related work already in flight must adapt to the updated contract and authorization rules. |
| Tickets: not started | MAJOR — replan around the new company-booking contract now so later work does not invent conflicting payload shapes or meanings. |

## Compressed Timeline

### MUST SHIP

- Booking API updates for `booked_for_*` fields and authorization validation
- Booking UI updates for the book-for-others flow
- User context updates for `company_name` and `can_book_for_others`
- Provider visibility for "booked by" vs. "booked for"
- Validation rules that prevent unauthorized delegation

### SHOULD SHIP

- Minimal audit visibility showing who booked for whom
- Edge-case handling that defaults missing delegation fields to self-booking

### CUT

- Full company account system
- Company billing and invoicing
- Employee directory
- Advanced RBAC
