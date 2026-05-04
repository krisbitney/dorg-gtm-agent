import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { appEnv } from "../config/app-env.js";
import * as leadsSchema from "./schema/leads-table.js";
import * as searchRunsSchema from "./schema/search-runs-table.js";

const schema = {
  ...leadsSchema,
  ...searchRunsSchema,
};

const queryClient = postgres(appEnv.DATABASE_URL);
export const db = drizzle(queryClient, { schema });
