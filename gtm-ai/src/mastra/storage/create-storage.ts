import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from '@mastra/core/storage';
import { appEnv } from '../config/app-env';

/**
 * Creates the composite storage instance for the Mastra service.
 * Uses LibSQL for general storage and DuckDB for observability.
 */
export const createStorage = async () => {
  return new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: "mastra-storage",
      url: appEnv.MASTRA_STORAGE_URL,
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    }
  });
};
