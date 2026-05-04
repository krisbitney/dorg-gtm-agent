import { LeadRepository } from "../storage/repositories/lead-repository.js";

/**
 * Helper to mark a lead as error in the database.
 */
export async function markLeadError(
  leadId: string,
  errorMessage: string,
  leadRepository: LeadRepository
): Promise<void> {
  try {
    await leadRepository.markError(leadId, errorMessage);
  } catch (err) {
    console.error(`Critial error: failed to mark post ${leadId} as error:`, err);
  }
}
