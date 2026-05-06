## Module 02 Task Tree

### Task 1 - Define Invitation Policy and State Machine

- Why first: defines the lifecycle, trust boundary, and behavioral rules that every later storage and API decision depends on.
- Input context needed:
  - Feature goal
  - Existing auth and ownership model
  - Current project and team membership assumptions
  - Verified architecture artifacts from Module 1
- Expected output:
  - A reviewable policy spec covering invitation states, valid and invalid transitions, authorization matrix, token lifecycle, duplicate-invite rules, expiry and revocation behavior, membership rules, edge cases, and open questions.
- Acceptance criteria:
  - Confirmed rules are separated from assumptions
  - Every state transition is defined
  - Actor permissions are explicit
  - The artifact is reviewable without reading code
- Dependencies:
  - None

### Task 2 - Design Invitation Data Model and Persistence Contract

- Why second: schema, token fields, relationships, and ownership constraints should be derived from approved lifecycle rules, not guessed independently.
- Input context needed:
  - Approved Task 1 policy and state-machine spec
  - Module 1 architecture artifacts
  - Current persistence patterns in `src/db.js` and `src/link-store.js`
- Expected output:
  - A storage design document defining the invitation entity, fields, relationships, indexes and constraints, token storage approach, and required persistence operations.
- Acceptance criteria:
  - Supports every approved invitation state and transition
  - Enforces ownership and security boundaries
  - Avoids storing raw reusable secrets where possible
  - Defines duplicate and expiry behavior
  - Provides clear persistence operations for later API tasks
- Dependencies:
  - Task 1

### Task 3 - Define API Contracts and Authorization Flows

- Why third: routes, request and response shapes, and permission enforcement depend on both the lifecycle model and persistence structure.
- Input context needed:
  - Approved Task 1 policy and state-machine spec
  - Approved Task 2 persistence contract
  - Existing route and auth patterns from `src/index.js`, `src/auth.js`, and `src/http-response.js`
- Expected output:
  - An API contract document listing invitation-related endpoints, request contracts, response shapes, auth requirements, authorization rules, validation failures, and expected status codes.
- Acceptance criteria:
  - Every endpoint maps back to an approved policy rule and persistence operation
  - Protected actions use the existing auth model
  - Ownership and team boundaries are explicit
  - Error cases are defined before implementation
- Dependencies:
  - Task 1
  - Task 2

### Critical Path

- Task 1 -> Task 2 -> Task 3
- Task 1 is the earliest dependency bottleneck because lifecycle and permission decisions must be settled before storage or API contracts can be designed correctly.

### Riskiest Task

- Task 2 is the riskiest task because token storage, expiry, uniqueness, and persistence constraints can silently encode security or lifecycle mistakes that later tasks will treat as fixed truth.

### Split Strategy If Task 2 Expands

- Task 2A - Design Invitation Entity and Persistence Operations
  - Define the invitation schema, relationships, constraints, and storage operations that later API tasks can depend on.
- Task 2B - Design Invitation Token Security and Validation Model
  - Define token generation, hashing and storage strategy, lookup flow, expiry and revocation behavior, replay protection, and other security-sensitive lifecycle rules separately from general schema design.
