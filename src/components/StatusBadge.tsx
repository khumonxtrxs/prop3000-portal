import { prettyStatus } from "@/lib/prop3000";
import { STATUS_BADGE_CLASSES, statusTone } from "@/lib/status";

export function StatusBadge({ status }: { status: string }) {
  const raw = status ?? "";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm px-2.5 py-1 text-label text-[11px] ${STATUS_BADGE_CLASSES[statusTone(raw)]}`}
    >
      {prettyStatus(raw)}
    </span>
  );
}