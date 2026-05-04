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
- Implement configuration schema validation in the deployment pipeline that blocks releases when required fields are missing for the target environment.
  Owner: Deployment pipeline process
  Deadline: March 21
  Definition of done: CI pipeline includes validation step that fails builds with missing config fields, demonstrated by test failure on invalid config.

- Refactor order creation error handling to fail fast on persistence failures rather than masking them with broad exception catching.
  Owner: Order creation process
  Deadline: March 24
  Definition of done: Code changes ensure non-200 responses and error logs for persistence failures, with automated tests verifying no silent successes.

- Establish business outcome monitoring including orders-per-minute metrics and payment-to-order mismatch detection.
  Owner: Monitoring system
  Deadline: March 21
  Definition of done: Dashboards display business metrics with alerts triggering when orders drop to zero or mismatches exceed thresholds for 5+ minutes.

- Standardize configuration contracts between staging and production environments.
  Owner: Configuration management process
  Deadline: March 26
  Definition of done: Automated checks enforce config schema parity, with pre-deploy validation confirming compatibility.

- Establish recurring rollback testing following infrastructure changes and on a monthly schedule.
  Owner: Release automation process
  Deadline: March 28
  Definition of done: Scheduled drills execute rollback procedures successfully, with automated verification of artifact paths.

- Update incident response playbooks to prioritize checkout anomalies as potential processing failures.
  Owner: Incident response process
  Deadline: March 20
  Definition of done: Playbooks include explicit guidance routing "charged without fulfillment" reports to immediate investigation.

## Lessons Learned
The incident revealed that infrastructure-level monitoring does not guarantee business functionality, highlighting the need for outcome-focused observability.

The availability of payment processor logs enabled complete recovery, demonstrating the value of comprehensive transaction recording.

Future incidents should prompt immediate checks of business metrics when customer reports suggest processing issues, rather than assuming peripheral problems. Rollback procedures should be treated as untrusted until recently validated.
