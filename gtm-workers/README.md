# GTM Workers Service

The GTM Workers service is responsible for orchestrating the Go-To-Market lead finding pipeline.

## Architecture

The service consists of two main runtimes:

1.  **API Server (`bun run api`)**: Exposes endpoints for triggering crawl runs and receiving webhooks from Apify.
2.  **Queue Worker (`bun run worker`)**: A long-running process that consumes leads from a Redis queue, processes them through GTM AI, and surfaces them in the dOrg system.

## HTTP Endpoints

-   `GET /healthz`: Health check endpoint.
-   `POST /internal/crawl-runs`: Internal endpoint to trigger an Apify crawl run. Protected by `TRIGGER_API_TOKEN`.
-   `POST /webhooks/apify/run-finished`: Webhook endpoint called by Apify when a crawl run reaches a terminal state. Protected by `APIFY_WEBHOOK_SECRET`.

## Setup

### Environment Variables

Required variables:

- `WORKERS_API_PORT`: Port for the HTTP API (default: 3000)
- `WORKERS_PUBLIC_BASE_URL`: Publicly accessible URL for Apify webhooks
- `TRIGGER_API_TOKEN`: Secret token for authenticating trigger requests
- `APIFY_WEBHOOK_SECRET`: Secret for authenticating Apify webhooks
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `APIFY_TOKEN`: Apify API token
- `APIFY_ACTOR_ID`: ID of the crawler actor
- `GTM_AI_BASE_URL`: Base URL for the GTM AI service
- `DORG_API_TOKEN`: Token for dOrg API
- `DORG_API_BASE_URL`: Base URL for dOrg API

### Local Infrastructure

Start the required services using Docker Compose from the root directory:

```bash
docker-compose up -d postgres valkey
```

### Database Migrations

Generate migrations:
```bash
bun run db:generate
```

Apply migrations:
```bash
bun run db:migrate
```

### Development

Install dependencies:
```bash
bun install
```

Start API:
```bash
bun run api
```

Start Worker:
```bash
bun run worker
```

## Lead Lifecycle

1.  **Pending**: Post imported from Apify, waiting for processing.
2.  **Scoring**: Post being evaluated by a small LLM for lead likelihood.
3.  **Below Threshold**: Post score is below the required threshold (0.7).
4.  **Analyzing**: Post being analyzed by a larger LLM for lead details.
5.  **Not a Lead**: Post analyzed and determined not to be a lead.
6.  **Claiming**: Lead being claimed in the dOrg API.
7.  **Claim Failed**: dOrg API rejected the lead claim.
8.  **Surfacing**: Lead claimed and being surfaced to the team.
9.  **Completed**: Lead successfully processed and surfaced.
10. **Error**: An unexpected error occurred during processing.

## Dead Letter Queue

Items that fail processing due to unexpected errors are moved to the `gtm:posts:dlq` Redis list for inspection.
