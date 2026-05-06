## Task 1 Prompt

Task: Define the Team Invitations policy and state machine before any implementation work begins.

Feature goal:
Add team collaboration through invitation-based membership while preserving the project's existing ownership and authorization patterns.

Context files/artifacts:
- `progress/ai-augmented-engineering/module-01/architecture-summary.md`
- `progress/ai-augmented-engineering/module-01/extension-points.md`
- `progress/ai-augmented-engineering/module-01/trust-audit.md`
- `src/auth.js`
- `src/index.js`
- `src/link-store.js`

Instructions:
Do not write implementation code, database schema, or API handlers yet. Your job is to define the behavioral contract for the feature so later storage and API tasks do not invent policy decisions independently.

Produce a reviewable policy specification with these sections:

1. Invitation lifecycle states
   - Define all invitation states
   - Define valid and invalid transitions
   - Explain transition triggers

2. Authorization and trust boundaries
   - Who can create invitations
   - Who can revoke invitations
   - Who can resend invitations
   - Who can accept invitations
   - Ownership/team boundary rules
   - Any assumptions about admins vs members

3. Token and invitation rules
   - Token purpose
   - Expiry behavior
   - Revocation behavior
   - Reuse policy
   - Invalid/expired token handling
   - Duplicate invitation policy

4. Membership rules
   - When membership becomes active
   - Whether acceptance is idempotent
   - Rules for existing members
   - Rules for already-pending invites

5. Edge cases and failure cases
   - Expired invite acceptance
   - Revoked invite acceptance
   - Duplicate invite attempts
   - Concurrent acceptance attempts
   - Unauthorized invite creation
   - Team/project mismatch cases

6. Acceptance criteria
   - Define externally reviewable success conditions for the policy

7. Open questions and assumptions
   - Separate confirmed decisions from assumptions
   - Explicitly list unresolved policy questions

Output requirements:
- Use tables where useful
- Include a state-transition table
- Keep policy decisions explicit and testable
- Do not assume behavior that is not justified from the provided context
- Flag uncertain areas instead of inventing defaults

## Task 2 Prompt

Task: Design the Team Invitations data model and persistence contract based on the approved invitation policy/state-machine specification.

Feature goal:
Add invitation-based team collaboration while preserving the project's existing ownership, authorization, and persistence patterns.

Required context:
- Approved output from Task 1: Invitation Policy and State Machine
- `progress/ai-augmented-engineering/module-01/architecture-summary.md`
- `progress/ai-augmented-engineering/module-01/extension-points.md`
- `src/db.js`
- `src/link-store.js`
- `src/auth.js`

Instructions:
Do not write API handlers, route definitions, UI code, or background-job implementations yet. Your job is to define the storage model and persistence interface that later API tasks will rely on.

Design the persistence layer so it follows the project's existing architectural patterns instead of inventing a new structure.

Produce a reviewable storage and persistence specification with these sections:

1. Invitation entity/data model
   - Define all fields
   - Explain the purpose of each field
   - Identify required vs optional fields
   - Define relationships to users/teams/memberships if needed

2. Token storage strategy
   - Explain whether tokens are stored raw, hashed, or derived
   - Explain lookup and validation flow
   - Explain expiry and revocation handling
   - Explain replay/reuse protections
   - Justify security-sensitive decisions explicitly

3. Constraints and indexes
   - Uniqueness rules
   - Duplicate-invite prevention rules
   - Foreign-key relationships
   - Expiry/query performance considerations
   - Any indexes needed for lookup paths

4. Invitation persistence contract
   Define the storage operations that later API tasks are allowed to depend on.
   Include:
   - create invitation
   - find invitation by token
   - revoke invitation
   - mark invitation accepted
   - list pending invitations
   - detect duplicate invitations
   - validate invitation state before acceptance

5. Ownership and authorization boundaries
   - Explain how persistence operations enforce team/project ownership
   - Identify which checks belong in storage vs route layer
   - Prevent cross-team access assumptions

6. In-memory vs database considerations
   - Explain how the design would behave in both modes
   - Identify any gaps or risks in in-memory test support

7. Edge cases and failure modes
   - Concurrent acceptance attempts
   - Expired invitations
   - Revoked invitations
   - Duplicate active invites
   - Deleted teams/projects
   - Token collision or replay scenarios

8. Acceptance criteria
   - Define externally reviewable success conditions for the persistence design

9. Open questions and assumptions
   - Separate confirmed decisions from assumptions
   - Explicitly flag risky or uncertain storage decisions

Output requirements:
- Use tables where useful
- Keep persistence operations implementation-agnostic
- Do not generate SQL migrations or application code yet
- Do not invent behavior outside the approved Task 1 policy
- Explicitly justify security-sensitive storage choices

## Task 3 Prompt

Task: Define the Team Invitations API contracts and authorization flows based on the approved policy/state-machine specification and persistence contract.

Feature goal:
Add invitation-based team collaboration while preserving the project's existing auth, ownership, validation, and error-handling patterns.

Required context:
- Approved output from Task 1: Invitation Policy and State Machine
- Approved output from Task 2: Invitation Data Model and Persistence Contract
- `progress/ai-augmented-engineering/module-01/architecture-summary.md`
- `progress/ai-augmented-engineering/module-01/extension-points.md`
- `src/index.js`
- `src/auth.js`
- `src/http-response.js`
- `src/link-store.js`

Instructions:
Do not implement handlers, database code, UI flows, or background jobs yet. Your job is to define the externally visible API contract and authorization behavior so implementation tasks can follow a stable interface.

Follow the project's existing route/auth/error-response patterns instead of inventing a new API style.

Produce a reviewable API contract specification with these sections:

1. Endpoint inventory
   Define all invitation-related endpoints, including:
   - HTTP method
   - route path
   - endpoint purpose
   - whether the endpoint is public or protected

2. Request contracts
   For each endpoint define:
   - required request fields
   - optional request fields
   - validation rules
   - invalid-input behavior
   - authorization requirements

3. Response contracts
   For each endpoint define:
   - success response shape
   - error response shape
   - status codes
   - invalid-state responses
   - unauthorized/forbidden behavior

4. Authorization and trust boundaries
   - Who may create invitations
   - Who may revoke invitations
   - Who may resend invitations
   - Who may view pending invitations
   - Who may accept invitations
   - Cross-team/project access protections
   - Route-layer vs persistence-layer enforcement responsibilities

5. State-transition mapping
   - Map each endpoint to the invitation state transitions it is allowed to trigger
   - Define invalid transitions explicitly

6. Persistence-operation mapping
   - Identify which persistence-contract operations each endpoint may call
   - Prevent routes from bypassing approved persistence boundaries

7. Edge cases and failure scenarios
   Include:
   - expired invite acceptance
   - revoked invite acceptance
   - duplicate invite creation
   - repeated acceptance attempts
   - invalid token usage
   - unauthorized invite management
   - concurrent acceptance behavior

8. Acceptance criteria
   - Define externally reviewable success conditions for the API contract

9. Open questions and assumptions
   - Separate confirmed behavior from assumptions
   - Explicitly flag unresolved API or authorization decisions

Output requirements:
- Use tables where useful
- Keep contracts implementation-agnostic
- Do not generate route handlers or application code yet
- Keep response/error behavior explicit and consistent
- Do not invent behavior outside the approved Task 1 and Task 2 outputs
