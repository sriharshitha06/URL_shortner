# Postmortem: OrderProcessor Silent Order Drop on Wednesday Afternoon

## Summary
On Wednesday from 14:00 to 16:02, the OrderProcessor service failed silently to persist orders after successful checkouts for approximately 1,400 customers, despite returning success responses and processing payments. The incident began with the v2.14 deployment and was fully resolved through a manual rollback to v2.13 followed by order reprocessing from payment logs. The impact included approximately $186,000 in affected revenue and damage to customer trust from charged payments without order fulfillment or confirmations.

## Timeline
- 14:00: Deployment of OrderProcessor v2.14 completes with removal of the deprecated `warehouse_routing` configuration field.
- 14:00-14:22: Service health checks pass and response codes remain normal.
- 14:22: Initial customer reports of missing confirmation emails appear on social media.
- 14:23-14:38: Support team escalates reports via Slack, initially treating as potential email delivery delay.
- 14:38: Increased volume of support tickets triggers active investigation.
- 14:42: Monitoring dashboards show normal response codes, latency, CPU, and memory metrics.
- 14:55: Database inspection reveals no new orders written since deployment.
- 15:02: Deployment identified as incident trigger; rollback initiated.
- 15:08: Automated rollback fails due to outdated artifact path references from infrastructure migration.
- 15:15: Manual rollback process engaged by infrastructure team.
- 15:34: Manual rollback to v2.13 succeeds; order processing resumes.
- 15:45: Manual reprocessing of affected orders begins using payment processor logs.
- 16:02: All orders reprocessed and confirmation emails sent; incident resolved.

## Root Cause
The primary root cause was a lack of configuration validation in the deployment pipeline, which allowed the removal of a required production configuration field without preventing the deployment. This systemic gap meant that environment-specific dependencies could be silently invalidated during releases.

A secondary root cause was overly broad error handling in the order creation logic, which caught configuration-related exceptions in a generic try/except block, logged them at debug level, and allowed the service to return success while skipping critical persistence operations.

A third root cause was monitoring that focused solely on infrastructure health rather than business outcomes, creating a blind spot where service availability appeared normal while core functionality failed completely.

## Contributing Factors
The incident duration was extended by an escalation process that did not differentiate between email delivery issues and order creation failures, causing initial signals to be under-prioritized.

Rollback reliability was compromised by inadequate testing following the infrastructure migration, leaving automation unverified for four months.

Log visibility contributed to the issue, as configuration errors were emitted at debug level rather than error level, reducing their prominence during investigation.

## Action Items
- Add schema validation for required production configuration fields before deploy.
  Owner: platform team lead
  Deadline: March 21
  Definition of done: deployment pipeline blocks releases when required runtime config fields are missing for the target environment, and a failing validation is demonstrated in CI.

- Replace broad error handling in order creation with fail-closed behavior for persistence-critical paths.
  Owner: OrderProcessor team lead
  Deadline: March 24
  Definition of done: if order persistence fails, the service returns a non-200 error, emits an ERROR-level log, and automated tests prove that silent success responses are no longer possible.

- Add business-level monitoring for orders created per minute and payment-success-without-order anomalies.
  Owner: observability team
  Deadline: March 21
  Definition of done: dashboard widgets are live for orders-per-minute and payment/order mismatch rate, and an alert pages on-call if orders drop to zero or mismatch exceeds threshold for more than 5 minutes.

- Align staging and production config schemas.
  Owner: platform configuration owner
  Deadline: March 26
  Definition of done: staging and production use the same config contract for OrderProcessor, and a release check confirms parity before deploy.

- Test rollback automation after every infrastructure migration and on a recurring schedule.
  Owner: release engineering owner
  Deadline: March 28
  Definition of done: rollback runbook and script are exercised successfully in a scheduled drill, and the current artifact path is verified automatically.

- Improve escalation guidance for customer-reported checkout anomalies.
  Owner: incident response owner
  Deadline: March 20
  Definition of done: support and on-call playbook explicitly treats “charged but no confirmation” as a potential order-processing incident and routes it to immediate investigation.

## Lessons Learned
The most important lesson is that HTTP success is not the same as business success. A service can look healthy at the transport layer while failing at the exact thing customers care about.

What worked well was that payment processor logs allowed full reprocessing of affected orders after recovery, which reduced permanent loss. Manual rollback by the platform team also restored the service once the broken automation path was recognized.

If a similar incident happened tomorrow before these fixes land, the team should immediately check order creation rates and database writes when checkout-related customer reports appear, instead of assuming an email-only problem. The team should also treat rollback automation as untrusted until it has been revalidated.
