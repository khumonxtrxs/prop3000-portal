import { prettyStatus } from "@/lib/prop3000";

type Tone = "wait" | "motion" | "good" | "bad" | "neutral";

// Status → tone, exactly as listed in the team task doc (S1, step 3).
const TONE_BY_STATUS = new Map<string, Tone>([
  ["new", "wait"],
  ["pending", "wait"],
  ["reviewing", "wait"],
  ["requested", "wait"],
  ["in_progress", "wait"],
  ["offer_made", "wait"],
  ["under_offer", "wait"],

  ["contacted", "motion"],
  ["quoted", "motion"],
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
]);

// Full class strings so Tailwind can see them at build time.
// Colours come only from the tokens in src/styles.css — no hex values here.
const TONE_CLASSES: Record<Tone, string> = {
  wait: "bg-status-wait text-status-wait-foreground",
  motion: "bg-status-motion text-status-motion-foreground",
  good: "bg-status-good text-status-good-foreground",
  bad: "bg-status-bad text-status-bad-foreground",
  neutral: "bg-status-neutral text-status-neutral-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  const raw = status ?? "";
  // Unknown or missing statuses fall back to neutral instead of crashing.
  const tone = TONE_BY_STATUS.get(raw.trim().toLowerCase()) ?? "neutral";

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm px-2.5 py-1 text-label text-[11px] ${TONE_CLASSES[tone]}`}
    >
      {prettyStatus(raw)}
    </span>
  );
}