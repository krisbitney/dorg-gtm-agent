/**
 * Handles the health check request.
 */
export function handleHealthRequest() {
  return Response.json({ status: "ok", timestamp: new Date().toISOString() });
}
