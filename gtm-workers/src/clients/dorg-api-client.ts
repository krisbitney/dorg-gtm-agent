import { appEnv } from "../config/app-env.js";

/**
 * Interface for the dOrg API client.
 */
export interface DorgApiClientInterface {
  claimLead(options: { identifier: string; channel: string }): Promise<{
    success: boolean;
    leadId?: string;
    message?: string;
    status?: number;
  }>;
  surfaceLead(options: { leadId: string; brief: string }): Promise<{
    success: boolean;
    message?: string;
    status?: number;
  }>;
  sendMessage(options: { content: string }): Promise<{
    success: boolean;
    message?: string;
    status?: number;
  }>
}

/**
 * Concrete implementation of DorgApiClient.
 * Communicates with the dOrg API to claim and surface leads.
 */
export class DorgApiClient implements DorgApiClientInterface {
  private readonly baseUrl = appEnv.DORG_API_BASE_URL;
  private readonly token = appEnv.DORG_API_TOKEN;
  private readonly timeout = 30000; // 30 seconds

  /**
   * Claims a lead in dOrg.
   */
  async claimLead({ identifier, channel }: { identifier: string; channel: string }) {
    const response = await fetch(`${this.baseUrl}/leads/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ identifier, channel }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        message: `dOrg claim failed (${response.status}): ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as { lead_id: string };
    return { success: true, leadId: data.lead_id };
  }

  /**
   * Surfaces a lead in dOrg (notifies the system).
   */
  async surfaceLead({ leadId, brief }: { leadId: string; brief: string }) {
    const response = await fetch(`${this.baseUrl}/leads/surface`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ lead_id: leadId, brief }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        message: `dOrg surface failed (${response.status}): ${errorText}`,
        status: response.status,
      };
    }

    return { success: true };
  }

  async sendMessage({ content }: { content: string }) {
    const response = await fetch(`${this.baseUrl}/discord/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `dOrg discord message failed (${response.status}): ${errorText}`,
        status: response.status,
      };
    }

    return { success: true };
  }
}
