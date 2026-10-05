/** Sorts rows by a string field (ISO timestamps or dates). Missing values sort last. */
export function sortRows<T>(rows: T[], key: keyof T, direction: "asc" | "desc" = "desc"): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[key] as unknown as string | null | undefined;
    const right = b[key] as unknown as string | null | undefined;
    if (left == null) return 1;
    if (right == null) return -1;
    return left < right ? -sign : left > right ? sign : 0;
  });
}
