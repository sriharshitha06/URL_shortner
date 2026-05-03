# Module 03 Risk Plan

## Risk Annotations

- User Authentication — Risk 2 — dependency
- Listings Data Model — Risk 3 — dependency, scale
- Provider Onboarding — Risk 3 — novelty, dependency
- Availability Management — Risk 3 — novelty, dependency
- Search & Browse — Risk 3 — scale, dependency
- Provider Profile — Risk 2 — dependency
- Booking Flow — Risk 4 — novelty, dependency
- Payment Processing — Risk 5 — integration, dependency
- Notification System — Risk 2 — integration
- Cancellation Flow — Risk 3 — integration, novelty
- Review System — Risk 1 — low significant risk
- Admin Review Tool (Minimal) — Risk 2 — novelty
- Admin Dashboard (Full) — Risk 2 — dependency

## Top 3 Highest-Risk Items

1. Payment Processing — Risk 5
   Types: integration, dependency
   Reason: external API, money flow, failure handling, and reconciliation complexity.

2. Booking Flow / Time-Slot Conflict Handling — Risk 4
   Types: novelty, dependency
   Reason: concurrency, race conditions, and consistency between booking and payment.

3. Search & Browse (multi-city assumptions) — Risk 3
   Types: scale, dependency
   Reason: must feel instant, drives user experience, and needs to scale across cities and larger datasets.

## Ordered Build Plan

1. User Authentication — Risk 2, dependency
   Build first because it unblocks nearly every user-facing and provider-facing flow.

2. Listings Data Model — Risk 3, dependency, scale
   Build early because provider profiles, booking, search, and admin workflows all depend on the data shape.

3. Provider Onboarding — Risk 3, novelty, dependency
   Build next so real provider records and approval states exist before downstream flows.

4. Payment Processing Spike — Risk 5, integration, dependency
   Highest-risk unknown. Test Stripe integration as soon as minimum dependencies exist so we do not build on a broken assumption.

5. Availability Management — Risk 3, novelty, dependency
   Needed before booking can work reliably because providers must expose real slots.

6. Booking Flow / Time-Slot Conflict Handling — Risk 4, novelty, dependency
   Build early after availability because concurrency and booking consistency are major unknowns.

7. Provider Profile — Risk 2, dependency
   Lower risk, but needed for the actual marketplace browsing experience.

8. Search & Browse — Risk 3, scale, dependency
   Build after profile and data foundations so we can shape search around real provider and city data.

9. Notification System — Risk 2, integration
   Useful, but not critical before core booking and payment behavior is proven.

10. Cancellation Flow — Risk 3, integration, novelty
    Build after payment and booking because refund logic depends on both working correctly.

11. Review System — Risk 1, low significant risk
    Low uncertainty and not critical to proving the core business flow.

12. Admin Review Tool (Minimal) — Risk 2, novelty
    Small workflow surface, can be added after core booking risk is retired.

13. Admin Dashboard (Full) — Risk 2, dependency
    Lowest urgency because it depends on data from many earlier flows and is not needed to prove the product works.
