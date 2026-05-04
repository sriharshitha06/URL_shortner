# Design Doc: API Rate Limiting

## Problem Statement
Our public API has no automated rate limiting, which means one customer can accidentally or intentionally degrade service for everyone else. Last month, a single customer sent 50,000 requests per minute, response times dropped across the platform, and the on-call engineer had to manually block the customer’s API key at 2 AM by editing config and redeploying.

This is now both a reliability problem and a product problem. We cannot protect shared infrastructure fairly, and we also cannot launch a paid tier with guaranteed request limits because no rate limiting foundation exists today.

## Proposed Approach
I propose adding rate limiting at the API gateway using a token bucket algorithm backed by Redis. A rate limiter is a control that limits how many requests a client can make in a time window. A token bucket gives each client a request budget that refills steadily over time, which handles bursts better than a simple fixed counter.

The API gateway is the front door of the system, so this is the best place to reject excess traffic before requests consume application capacity. Redis is an in-memory data store that is well suited for fast shared counters across multiple API servers.

Each API key will have a configurable limit based on plan tier. When a client exceeds its limit, the gateway will return a clear rate-limit response instead of passing the request downstream. We should also include standard response headers that tell the client its limit, remaining budget, and reset behavior.

## Alternatives Considered
### Alternative 1: Application-level rate limiting only
We could enforce rate limiting inside the application code instead of at the gateway. This would keep the logic closer to business rules and may be easier for application engineers to change.

I rejected this as the primary approach because abusive traffic would still reach the application before being rejected. That means we would spend compute and database capacity on requests we already know should be blocked.

### Alternative 2: Fixed-window counters at the gateway
We could use a fixed-window algorithm that counts requests per minute and resets at the top of each minute. This is simpler to explain and implement than token bucket logic.

I rejected this because it creates burst unfairness around window boundaries. A client can send a large spike at the end of one minute and another at the start of the next, which weakens protection exactly when traffic is spiky.

### Alternative 3: In-memory counters on each API server
We could store counters locally in each server process and avoid Redis. This would reduce infrastructure complexity and remove an external dependency.

I rejected this because limits would become inconsistent across multiple servers behind a load balancer. A client could bypass effective limits simply by having requests spread across instances.

## Risks and Mitigations
### Risk: Redis becomes a dependency for request handling
If Redis is slow or unavailable, rate limiting may fail open or fail closed in a way that affects customer traffic.

Mitigation: define failure behavior explicitly. For general traffic, fail open for short Redis incidents to preserve availability, but log and alert aggressively. For known abusive keys or high-risk endpoints, allow an override path for fail-closed behavior if needed later.

### Risk: Limits are too strict or too loose at launch
If default limits are wrong, we may block legitimate customers or fail to protect the system enough.

Mitigation: start with conservative limits, observe traffic for one week, and tune by plan tier. Also create internal dashboards for top keys, rejection counts, and near-limit traffic.

### Risk: Gateway-only logic misses product-specific exceptions
Some endpoints may eventually need different rate rules than the default API-key policy.

Mitigation: launch with API-key tier limits first, but design the configuration model so endpoint-specific overrides can be added later without rewriting the system.

### Risk of doing nothing
If we do nothing, one customer can continue to degrade service for everyone else, on-call will keep handling incidents manually, and the paid tier cannot launch with enforceable guarantees.

## Open Questions
- Should limits apply only per API key, or also per IP address for extra abuse protection?
- Do some endpoints need stricter limits than others at launch?
- What exact limits should map to free, standard, and paid tiers?
- Should rejected requests be visible to customers through billing or admin dashboards?
- Does the infrastructure team want Redis reused from an existing cluster or isolated for gateway controls?
