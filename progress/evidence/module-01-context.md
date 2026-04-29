# Module 1 Context: Public Consumer URL Shortener

## Core Functionality

- Create a short URL from a long URL.
- Redirect a short URL to the original URL.

## Service Constraints

- Only accept valid `http` or `https` URLs.
- Reject obvious abuse such as unsupported or malicious schemes.
- Keep analytics minimal for now, such as click count only.
- No authentication is required in the first version.

## Key System Characteristics

- The workload is read-heavy: redirects will be much more frequent than link creation.
- Redirects must be low latency because they sit directly in the user path.
- The system should be designed with high scalability in mind because public traffic can grow quickly.

## Out Of Scope For Now

- No user accounts
- No custom aliases
- No advanced analytics
- No multi-tenant support

## Future Considerations

- Rate limiting
- Abuse detection
- Caching with Redis
