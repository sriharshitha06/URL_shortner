# Module 7 - Adaptation Note (PM)

We can deliver company-style booking in the 6-day demo using a minimal bridge: users can book on behalf of others with clear "booked by vs. booked for" visibility across the system.

This does not include a full company account system: no organization management, employee directory, role-based permissions, or company-level billing/invoicing. Billing will remain on the authenticated booking user, with no invoice split or org billing.

The main risk is contract drift or authorization gaps, such as users booking for others without permission or inconsistent handling across API and UI surfaces. We are mitigating that by enforcing strict payload validation and using one shared booking contract across API, UI, and provider visibility.

To proceed, we need confirmation on the booking rules for Meridian — specifically who is allowed to book for others and which fields are mandatory — plus approval to keep billing at the individual level for the demo.
