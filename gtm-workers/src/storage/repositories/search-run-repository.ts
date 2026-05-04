import { eq } from "drizzle-orm";
import { db } from "../database.js";
import { searchRuns, type SearchRun, type NewSearchRun } from "../schema/search-runs-table.js";
import { SearchRunStatus } from "../../constants/search-run-status.js";

export class SearchRunRepository {
  async insert(run: NewSearchRun): Promise<void> {
    await db.insert(searchRuns).values({
      ...run,
      updatedAt: new Date(),
    });
  }

  async markCompleted(
    id: string,
    counters: { resultsFound: number; resultsImported: number }
  ): Promise<void> {
    await db.update(searchRuns)
      .set({
        ...counters,
        status: SearchRunStatus.COMPLETED,
        updatedAt: new Date(),
      })
      .where(eq(searchRuns.id, id));
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await db.update(searchRuns)
      .set({
        status: SearchRunStatus.FAILED,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(searchRuns.id, id));
  }

  async findById(id: string): Promise<SearchRun | undefined> {
    const results = await db.select().from(searchRuns).where(eq(searchRuns.id, id)).limit(1);
    return results[0];
  }
}
