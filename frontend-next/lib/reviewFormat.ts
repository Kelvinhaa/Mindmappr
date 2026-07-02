import type { ReviewQueueItem } from "@/types/study";

export function formatNextReview(iso: string | null | undefined): string {
  if (!iso) return "Not scheduled";
  const diffDays = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
}

export function formatIntervalDays(days: number): string {
  if (days < 1) return "< 1 day";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

export function stabilityPct(stability: number): number {
  return Math.min(100, Math.round((stability / 30) * 100));
}

export function urgencyCardClass(item: ReviewQueueItem): string {
  return item.days_overdue > 1
    ? "session-card session-card--overdue paper-texture"
    : "session-card session-card--due paper-texture";
}

export function urgencyBadge(item: ReviewQueueItem): { cls: string; label: string } {
  if (!item.next_review_at) return { cls: "due-badge due-badge--today", label: "New — review now" };
  if (item.days_overdue > 1) return { cls: "due-badge due-badge--overdue", label: `${Math.floor(item.days_overdue)}d overdue` };
  return { cls: "due-badge due-badge--today", label: "Due today" };
}
