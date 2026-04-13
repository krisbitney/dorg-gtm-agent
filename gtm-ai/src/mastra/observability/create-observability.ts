import {Observability, DefaultExporter, CloudExporter, SensitiveDataFilter, BaseExporter} from '@mastra/observability';
import { appEnv } from '../config/app-env';

/**
 * Creates the observability instance for the Mastra service.
 * Configures tracing exporters and data filters.
 */
export const createObservability = () => {
  const exporters: BaseExporter[] = [
    new DefaultExporter(), // Persists traces to storage for Mastra Studio
  ];

  // Only enable CloudExporter if access token is provided
  if (appEnv.MASTRA_CLOUD_ACCESS_TOKEN) {
    exporters.push(new CloudExporter());
  }

  return new Observability({
    configs: {
      default: {
        serviceName: 'gtm-ai',
        exporters,
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
        requestContextKeys: ['postId', 'platform', 'source', 'workerRunId'],
      },
    },
  });
};
