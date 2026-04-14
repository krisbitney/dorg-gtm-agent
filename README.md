# dorg-gtm-agent

This repository contains the code for a dOrg GTM Agent hackathon submission. The dOrg GTM Agent is a system that uses AI to find leads for dOrg's Web3 software development and services consultancy.

Basic strategy:
1. Scrape all social media posts at specified URLs and search terms
2. Estimate the probability that a post is a lead using a small, fast LLM
3. If a post is likely a lead, extract the lead data with a larger LLM
4. Hand off the lead to a human or smart LLM for outreach

## System Design

The dOrg GTM Agent is a distributed system designed to automate lead generation by crawling social media and using AI to qualify and extract information from potential leads. The system consists of three main services and two infrastructure components:

- **GTM Web Crawler**: A specialized crawler built with Crawlee and hosted on Apify. It targets Reddit subreddits to collect posts while using anti-detection measures to respect platform limits.
- **GTM AI**: A Mastra-based service that performs AI analysis. It features a fast, low-cost LLM to filter high-probability leads and a more capable LLM to extract detailed lead data, such as needs, timing, and contact information.
- **GTM Workers**: Orchestrates the lead lifecycle. It includes an API to trigger crawls and handle webhooks from Apify, and a background worker that processes the queue of posts, manages the lead pipeline, and integrates with the dOrg API to claim and surface qualified leads.
- **Infrastructure**: Uses **PostgreSQL** for persistent storage of lead data and **Valkey (Redis)** for efficient message queuing and URL deduplication via Bloom filters.

![system-design.png](system-design.png)

A microservices architecture is useful for a few reasons:
1. There could be many different web crawlers. Each web crawler will typically run in bursts. 
2. It simplifies the implementation to host the web crawler on a cloud service like Apify, which is designed for web crawlers.
3. LLM calls are relatively slow and scale differently from the orchestration workers, so hosting the AI service in a separate instance can facilitate scaling later on.
4. The AI service's advanced observability and monitoring tools work well when using Mastra's server tooling,  which wraps server frameworks like Hono to monitor the AI request from start to finish.

We could improve scalability further, at the cost of increased complexity, by using a more robust message queue like RabbitMQ or Kafka, or a document database for storing social media posts.

## Packages

This repository contains independent Bun packages:

- `gtm-ai`
- `gtm-workers`
- `gtm-web-crawler`

Each package has its own `package.json` and `bun.lock`.

## Install dependencies

Install dependencies from each package directory:

```bash
cd gtm-ai && bun install
cd gtm-workers && bun install
cd gtm-web-crawler && bun install
```

## Run with Docker Compose

From the repository root:

```bash
docker compose up --build
```
