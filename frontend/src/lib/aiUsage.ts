import type { UsageInfo } from "../types";

/** Failed attempts still consume quota; the API sends its reservation in headers. */
export function attemptUsage(response: Response): UsageInfo | null {
  const used = response.headers.get("X-AI-Used");
  const limit = response.headers.get("X-AI-Limit");
  if (used === null || limit === null) return null;
  const used_today = Number(used), daily_limit = Number(limit);
  return Number.isInteger(used_today) && used_today >= 0 && Number.isInteger(daily_limit) && daily_limit > 0
    ? { used_today, daily_limit } : null;
}
