# dorg-gtm-agent

This repository contains the code for a dOrg GTM Agent hackathon submission. The dOrg GTM Agent is a system that uses LLMs to extract lead data from social media posts. My strategy is to scrape all social media posts at specified URLs and search terms, and then to check each post to see if it contains a sales lead for the dOrg software development consultancy.

Process:
- Scrape all social media posts at specified URLs and search terms
- Estimate probability that a post is a lead using a small LLM
- Extract lead data with larger LLM
- Hand off to human or smart LLM for outreach

## System Design

![system-design.png](system-design.png)

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
