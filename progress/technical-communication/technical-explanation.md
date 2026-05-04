# Technical Explanation: REST-to-GraphQL Migration

## Decision Summary
We are migrating ShopStream’s public-facing API from REST to GraphQL over the next 8 weeks. REST is an API style where the server exposes fixed endpoints, which are fixed URLs that return predefined data shapes. GraphQL is a query language for APIs that lets the client ask for exactly the data it needs. We chose this because it will reduce frontend API calls, remove single-purpose aggregation endpoints, and make feature work faster for both web and mobile teams.

## Why We Chose This
Our current REST API has 47 endpoints, and 15 of them exist only because the mobile app needs a different data shape than the web app for the same screen. An endpoint is a specific API route that returns data for a request. This means the backend keeps creating custom routes for screen-specific needs instead of exposing reusable data cleanly.

Frontend developers are also spending about 30% of each sprint building aggregation endpoints. Aggregation endpoints are REST routes that combine data from multiple services into the exact shape one UI screen needs. That work slows delivery and creates maintenance overhead that keeps growing as product needs change.

GraphQL addresses the root problem better than patching REST. A simple way to think about it is this: REST is like ordering from a fixed menu, while GraphQL is like choosing exactly what you want from a buffet. Instead of building many endpoints for different screens, we can let the client request the exact fields it needs in one query.

We considered two alternatives and rejected both. A Backend-for-Frontend, or BFF, is a separate service that reshapes backend data for each frontend, but it would add operational complexity because it is another service to deploy and monitor. Standardizing REST endpoint shapes would reduce some inconsistency, but it would not solve the core issue that web and mobile still need different data for the same product surfaces.

## Risks and Mitigations
The biggest delivery risk is team familiarity. Two of the three engineers assigned full-time to this migration have never used GraphQL before. To reduce that risk, the migration will run over 8 weeks with focused ownership and time for learning while both REST and GraphQL run in parallel.

The biggest technical risk is query performance. GraphQL can become slow if clients request deeply nested data in one call. We will mitigate that by reviewing query patterns early, setting clear limits on query depth where needed, and monitoring performance during the parallel rollout.

Caching is another risk. Caching means saving a result temporarily so we do not have to recompute or refetch it every time. REST is easier to cache because each endpoint has a fixed URL, while GraphQL requests usually send query bodies that are harder to cache in the same way. We will need to be more deliberate about caching strategy during implementation instead of assuming the old REST approach carries over automatically.

## What This Means for Priya
You are joining after the decision has already been made, so your first job is not to re-evaluate the migration. Your first job is to understand the target shape of the new API and help implement it safely. You will be working in a system where both REST and GraphQL exist at the same time during the migration period.

In practice, this means you should expect to touch GraphQL schema work, resolver logic, and migration-related backend changes. A schema is the definition of what data can be requested and how it is structured. A resolver is the server-side function that fetches the data for a GraphQL field. If you have not worked with GraphQL before, that is normal here because two current migration engineers are also learning it during this project.

You should also expect product questions from both web and mobile contexts. One reason for this migration is that the two clients need different data shapes for similar screens. That means part of your work will involve thinking about how to expose flexible data without recreating the same screen-specific backend sprawl we are trying to remove.

## Next Steps
Your first step next week should be to review the current migration plan and the list of REST endpoints that are being replaced first. After that, pair with one of the three migration engineers to walk through the GraphQL schema and the first resolver implementations.

Talk to the backend migration owners first for system context, and talk to the mobile team when a schema decision affects client data shape. In your first week, focus on understanding which 15 aggregation endpoints are being eliminated and how those screen needs map into GraphQL queries.

By the end of onboarding, you should be able to explain three things clearly: why we chose GraphQL, what risks we are managing, and which part of the migration you own first.
