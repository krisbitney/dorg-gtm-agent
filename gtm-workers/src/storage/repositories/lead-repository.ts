import { eq } from "drizzle-orm";
import { db } from "../database.js";
import { leads, type Lead, type NewLead } from "../schema/leads-table.js";
import { LeadStatus, type LeadStatusType } from "../../constants/lead-status.js";

/**
 * Repository for managing lead records in the database.
 */
export class LeadRepository {
  /**
   * Inserts a new pending lead record.
   */
  async insert(lead: NewLead): Promise<void> {
    await db.insert(leads).values({
      ... lead ,
      updatedAt: new Date(),
    });
  }

  /**
   * Fetches a lead record by its ID.
   */
  async findById(id: string): Promise<Lead | undefined> {
    const results = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return results[0];
  }

  /**
   * Saves the lead score result and advances the lead status.
   */
  async saveScore(id: string, leadProbability: number, status: LeadStatusType): Promise<void> {
    await db.update(leads)
      .set({
        leadProbability,
        status,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));
  }

  /**
   * Saves the lead analysis result and advances the lead status.
   */
  async saveAnalysis(
    id: string,
    analysis: {
      whyFit: string;
      needs: string;
      timing?: string | null;
      contactInfo: string;
    },
    status: LeadStatusType
  ): Promise<void> {
    await db.update(leads)
      .set({
        ...analysis,
        status,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));
  }

  /**
   * Saves the claimed dOrg lead ID and advances the lead status.
   */
  async saveDorgLeadId(id: string, dorgLeadId: string, status: LeadStatusType): Promise<void> {
    await db.update(leads)
      .set({
        dorgLeadId,
        status,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));
  }

  /**
   * Marks a lead as having failed to claim in dOrg.
   */
  async markClaimFailed(id: string, errorMessage: string): Promise<void> {
    await db.update(leads)
      .set({
        status: LeadStatus.CLAIM_FAILED,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));
  }

  /**
   * Marks a lead as successfully completed.
   */
  async markCompleted(id: string): Promise<void> {
    await db.update(leads)
      .set({
        status: LeadStatus.COMPLETED,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));
  }

  /**
   * Marks a lead as having an unexpected error.
   */
  async markError(id: string, errorMessage: string): Promise<void> {
    await db.update(leads)
      .set({
        status: LeadStatus.ERROR,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));
  }
  
  /**
   * Updates the status of a  lead .
   */
  async updateStatus(id: string, status: LeadStatusType): Promise<void> {
    await db.update(leads)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));
  }
}
