# gtm-ai

Welcome to the GTM AI Mastra service! This service is responsible for AI-driven decision-making for finding leads for dOrg's tech/dev consultancy.

## Workflows

This service exposes two main workflows:

### `leadScoreWorkflow`
- **ID:** `lead-score-workflow`
- **Input:** `CrawlerPostInput` (JSON)
- **Output:** `{ leadProbability: number }`
- **Description:** A small model that estimates the likelihood of a post being a lead for dOrg's tech/dev consultancy. The likelihood is a number between 0 and 1.

### `leadAnalysisWorkflow`
- **ID:** `lead-analysis-workflow`
- **Input:** `CrawlerPostInput` (JSON)
- **Output:** `{ isLead: false } | { isLead: true, whyFit: string, needs: string, timing: string | null, contactInfo: string | null }`
- **Description:** A smarter model that extracts relevant information from a post if it is deemed a likely lead.

## Usage Examples

### Running a workflow with Request Context

```typescript
const workflow = mastra.getWorkflow('leadScoreWorkflow');
const result = await workflow.execute({
  inputData: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    topic: 'web3',
    url: 'https://reddit.com/r/web3/comments/123',
    username: 'user123',
    content: 'Need help with a smart contract audit',
    ageText: '2 hours ago',
    likes: 10,
    nComments: 5,
    capturedAt: new Date().toISOString(),
  },
  requestContext: {
    postId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    topic: 'web3',
    source: 'manual-test',
  },
});
```

### Worker Integration

The `gtm-workers` service should use the following details to integrate with this service:

- **Lead Score Workflow Key:** `leadScoreWorkflow`
- **Lead Analysis Workflow Key:** `leadAnalysisWorkflow`
- **Lead Score Threshold:** `0.7` (If `leadProbability` < 0.7, skip analysis)

#### Example: Scoring a post
```typescript
const result = await mastra.getWorkflow('leadScoreWorkflow').execute({
  inputData: crawlerPost,
  requestContext: { postId, platform, topic, source: 'worker' }
});
// result.leadProbability
```

#### Example: Analyzing a lead
```typescript
const result = await mastra.getWorkflow('leadAnalysisWorkflow').execute({
  inputData: crawlerPost,
  requestContext: { postId, platform, topic, source: 'worker' }
});
if (result.isLead) {
  // Use result.whyFit, result.needs, etc.
}
```

## Getting Started

Start the development server:

```shell
bun run dev
```

Open [http://localhost:4111](http://localhost:4111) in your browser to access [Mastra Studio](https://mastra.ai/docs/studio/overview). It provides an interactive UI for building and testing your agents, along with a REST API that exposes your Mastra application as a local service. This lets you start building without worrying about integration right away.

You can start editing files inside the `src/mastra` directory. The development server will automatically reload whenever you make changes.

## Learn more

To learn more about Mastra, visit our [documentation](https://mastra.ai/docs/). Your bootstrapped project includes example code for [agents](https://mastra.ai/docs/agents/overview), [tools](https://mastra.ai/docs/agents/using-tools), [workflows](https://mastra.ai/docs/workflows/overview), [scorers](https://mastra.ai/docs/evals/overview), and [observability](https://mastra.ai/docs/observability/overview).

If you're new to AI agents, check out our [course](https://mastra.ai/course) and [YouTube videos](https://youtube.com/@mastra-ai). You can also join our [Discord](https://discord.gg/BTYqqHKUrf) community to get help and share your projects.

## Deploy on Mastra Cloud

[Mastra Cloud](https://cloud.mastra.ai/) gives you a serverless agent environment with atomic deployments. Access your agents from anywhere and monitor performance. Make sure they don't go off the rails with evals and tracing.

Check out the [deployment guide](https://mastra.ai/docs/deployment/overview) for more details.
