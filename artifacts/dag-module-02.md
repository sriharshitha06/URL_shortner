# Module 02 DAG

## Work Items
1. User Authentication
2. Listings Data Model
3. Provider Onboarding
4. Availability Management
5. Search & Browse
6. Provider Profile
7. Booking Flow
8. Payment Processing
9. Notification System
10. Cancellation Flow
11. Review System
12. Admin Dashboard (Full)
13. Admin Review Tool (Minimal)

## Dependency Graph
- Listings Data Model -> Provider Profile (H)
- Listings Data Model -> Search & Browse (H)
- Listings Data Model -> Booking Flow (H)
- Listings Data Model -> Admin Dashboard (Full) (H)
- Listings Data Model -> Admin Review Tool (Minimal) (H)
- Provider Onboarding -> Provider Profile (H)
- Provider Onboarding -> Availability Management (H)
- User Authentication -> Booking Flow (H)
- User Authentication -> Review System (H)
- Provider Profile -> Search & Browse (S)
- Availability Management -> Booking Flow (H)
- Booking Flow -> Payment Processing (H)
- Booking Flow -> Notification System (S)
- Booking Flow -> Cancellation Flow (H)
- Booking Flow -> Review System (H)
- Payment Processing -> Cancellation Flow (S)
- Payment Processing -> Admin Dashboard (Full) (S)
- Cancellation Flow -> Admin Dashboard (Full) (S)
- Review System -> Admin Dashboard (Full) (S)
- Admin Review Tool (Minimal) -> Provider Onboarding / Vetting (H)
- Provider Onboarding / Vetting -> Admin Dashboard (Full) (S)

## No Incoming Dependencies
- User Authentication
- Listings Data Model
- Provider Onboarding

## No Outgoing Dependencies
- Search & Browse
- Notification System
- Admin Dashboard (Full)

## Critical Path
- Listings Data Model -> Availability Management -> Booking Flow -> Payment Processing -> Cancellation Flow

## Timeline Estimate
- Listings Data Model: 2 days
- Availability Management: 2 days
- Booking Flow: 3 days
- Payment Processing: 3 days
- Cancellation Flow: 2 days
- Minimum timeline: about 12 working days

## Cycle Fix
- Split `Admin / Ops Dashboard` into:
  - `Admin Review Tool (Minimal)` for provider approval and rejection
  - `Admin Dashboard (Full)` for analytics, disputes, provider management, and ops visibility
- This removes the cycle because onboarding no longer depends on the full dashboard.
