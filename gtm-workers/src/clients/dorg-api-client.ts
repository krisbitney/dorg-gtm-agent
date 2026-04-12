import { appEnv } from "../config/app-env.js";

/**
 * Interface for the dOrg API client.
 */
export interface DorgApiClientInterface {
  claimLead(options: { identifier: string; channel: string }): Promise<{
    success: boolean;
    leadId?: string;
    message?: string;
  }>;
  surfaceLead(options: { leadId: string; brief: string }): Promise<{
    success: boolean;
    message?: string;
  }>;
}

/**
 * Concrete implementation of DorgApiClient.
 * Communicates with the dOrg API to claim and surface leads.
 */
export class DorgApiClient implements DorgApiClientInterface {
  private readonly baseUrl = appEnv.DORG_API_BASE_URL;
  private readonly token = appEnv.DORG_API_TOKEN;

  /**
   * Claims a lead in dOrg.
   */
  async claimLead({ identifier, channel }: { identifier: string; channel: string }) {
    const response = await fetch(`${this.baseUrl}/claim_lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ identifier, channel }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, message: `dOrg claim failed (${response.status}): ${errorText}` };
    }

    const data = (await response.json()) as { lead_id: string };
    return { success: true, leadId: data.lead_id };
  }

  /**
   * Surfaces a lead in dOrg (notifies the system).
   */
  async surfaceLead({ leadId, brief }: { leadId: string; brief: string }) {
    const response = await fetch(`${this.baseUrl}/surface_lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ lead_id: leadId, brief }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, message: `dOrg surface failed (${response.status}): ${errorText}` };
    }

    return { success: true };
  }
}
