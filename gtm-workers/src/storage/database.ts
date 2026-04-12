import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { appEnv } from "../config/app-env.js";
import * as postsSchema from "./schema/posts-table.js";
import * as crawlRunsSchema from "./schema/crawl-runs-table.js";

const schema = {
  ...postsSchema,
  ...crawlRunsSchema,
};

const queryClient = postgres(appEnv.DATABASE_URL);
export const db = drizzle(queryClient, { schema });
