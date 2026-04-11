import {appEnv} from "../env.ts";

export const DORG_API_BASE = "https://agentsofdorg.tech/api";

export const headers = {
  "Authorization": `Bearer ${appEnv.dorgApiToken}`,
  "Content-Type": "application/json",
};