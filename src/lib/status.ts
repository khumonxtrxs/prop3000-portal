export type StatusTone = "wait" | "motion" | "good" | "bad" | "neutral";

// Status → tone, as listed in the team task doc (S1), plus the quote statuses sent/expired.
const TONE_BY_STATUS = new Map<string, StatusTone>([
  ["new", "wait"],
  ["pending", "wait"],
  ["reviewing", "wait"],
  ["requested", "wait"],
  ["in_progress", "wait"],
  ["offer_made", "wait"],
  ["under_offer", "wait"],

  ["contacted", "motion"],
  ["quoted", "motion"],
  ["sent", "motion"],
  ["countered", "motion"],
  ["viewing_booked", "motion"],

  ["approved", "good"],
  ["converted", "good"],
  ["accepted", "good"],
  ["complete", "good"],
  ["confirmed", "good"],
  ["published", "good"],
  ["purchased", "good"],

  ["declined", "bad"],
  ["on_hold", "bad"],

  ["draft", "neutral"],
  ["completed", "neutral"],
  ["cancelled", "neutral"],
  ["sold", "neutral"],
  ["expired", "neutral"],
]);

/** Unknown or missing statuses fall back to neutral instead of crashing. */
export function statusTone(status: string | null | undefined): StatusTone {
  return TONE_BY_STATUS.get((status ?? "").trim().toLowerCase()) ?? "neutral";
}

// Full class strings so Tailwind can see them at build time. Colours come only from tokens.
export const STATUS_BADGE_CLASSES: Record<StatusTone, string> = {
  wait: "bg-status-wait text-status-wait-foreground",
  motion: "bg-status-motion text-status-motion-foreground",
  good: "bg-status-good text-status-good-foreground",
  bad: "bg-status-bad text-status-bad-foreground",
  neutral: "bg-status-neutral text-status-neutral-foreground",
};

/** 4px status-coloured left border for cards (S7). */
export const STATUS_BORDER_LEFT: Record<StatusTone, string> = {
  wait: "border-l-status-wait-foreground",
  motion: "border-l-status-motion-foreground",
  good: "border-l-status-good-foreground",
  bad: "border-l-status-bad-foreground",
  neutral: "border-l-status-neutral-foreground",
};