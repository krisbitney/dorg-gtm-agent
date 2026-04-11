// 1. Claim a lead
import {DORG_API_BASE, headers} from "./constants.ts";
import type {ClaimLeadResponse} from "./types.ts";

async function claimLead(
  identifier: string,
  channel: string
): Promise<{ success: boolean; lead_id?: string; message: string }> {
  const res = await fetch(`${DORG_API_BASE}/leads/claim`, {
    method: "POST",
    headers,
    body: JSON.stringify({ identifier, channel }),
  });

  const data: ClaimLeadResponse = await res.json() as ClaimLeadResponse;

  if (res.ok && data.claimed) {
    return {
      success: true,
      lead_id: data.lead_id,
      message: "Claimed",
    };
  } else {
    return {
      success: false,
      message: `Failed: ${JSON.stringify(data)}`,
    };
  }
}

// 2. Surface a lead
async function surfaceLead(
  lead_id: string,
  brief: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${DORG_API_BASE}/leads/surface`, {
    method: "POST",
    headers,
    body: JSON.stringify({ lead_id, brief }),
  });

  const data = await res.json();

  if (res.ok) {
    return { success: true, message: "Surfaced." };
  } else {
    return { success: false, message: `Failed: ${JSON.stringify(data)}` };
  }
}

// 3. Send message to Discord thread
async function sendMessage(
  content: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${DORG_API_BASE}/discord/post`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content: content.slice(0, 1900) }),
  });

  const data = await res.json();

  if (res.ok) {
    return { success: true, message: "Sent." };
  } else {
    return { success: false, message: `Failed: ${JSON.stringify(data)}` };
  }
}

export function dOrgApiFactory() {
  return {
    claimLead,
    surfaceLead,
    sendMessage,
  };
}