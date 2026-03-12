/**
 * Extract a human-readable error message from an axios error.
 * ERPNext returns structured errors in _server_messages (JSON array of JSON strings).
 * Without this, callers only see "Request failed with status code 417".
 */
export function extractErrorDetail(error: any): string {
  const data = error?.response?.data;
  if (data) {
    if (data._server_messages) {
      try {
        const msgs = JSON.parse(data._server_messages) as string[];
        const details = msgs
          .slice(0, 5)
          .map((m) => {
            try {
              return JSON.parse(m).message;
            } catch {
              return m;
            }
          })
          .filter(Boolean);
        if (details.length) {
          const joined = details.join("; ");
          return joined.length > 1000 ? joined.slice(0, 1000) + "..." : joined;
        }
      } catch {
        /* fall through */
      }
    }
    if (data.message) return String(data.message);
    if (data.exc_type) return String(data.exc_type);
    if (typeof data === "string" && data.length < 500) return data;
  }
  return error?.message || "Unknown error";
}
