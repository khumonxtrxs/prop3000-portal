// Small helpers over the Firestore SDK so the screens read like the Supabase code they replaced.
//
// Conventions (see docs/firebase-migration.md):
// - Documents keep the Postgres column names, and every row type comes from src/lib/db-types.ts.
//   Inserts must supply every column (null where empty), so documents always have the full shape.
// - Timestamps are ISO-8601 strings, as Postgres returned them, so sorting and `new Date(row.created_at)`
//   keep working unchanged. UTC ISO strings sort correctly as plain strings.
// - Firestore can't sort and filter on different fields without a composite index, so filtered
//   queries sort in the browser with `sortRows`. The data sets here are small.
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Query,
} from "firebase/firestore";

import { firestore } from "./client";
import type { Tables } from "@/lib/db-types";
import { sortRows } from "@/lib/sort";

export { sortRows };

export type TableName =
  | "service_requests"
  | "property_submissions"
  | "bookings"
  | "jobs"
  | "quotes"
  | "listings"
  | "offers"
  | "notifications"
  | "profiles";

export function nowIso(): string {
  return new Date().toISOString();
}

/** A human-readable reference such as SR-4F2A9C, matching the old Postgres column defaults. */
export function newReference(prefix: "SR" | "PS" | "JOB" | "Q" | "BK" | "LST" | "OF"): string {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${hex}`;
}

/** Runs a query and returns each document's data with its id, the shape Supabase returned. */
export async function listRows<T extends { id: string }>(query: Query<DocumentData>): Promise<T[]> {
  const snapshot = await getDocs(query);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
}

/** Every document in a collection, newest first by default. Only staff can read whole collections. */
export function allRows<T extends TableName>(
  name: T,
  sortField: keyof Tables<T> & string = "created_at" as keyof Tables<T> & string,
  direction: "asc" | "desc" = "desc",
): Promise<Tables<T>[]> {
  return listRows<Tables<T>>(query(collection(firestore(), name), orderBy(sortField, direction)));
}

/**
 * Documents where `field == value`, sorted in the browser (no composite index needed).
 * The filter matters for security too: the rules only allow a client to query their own rows.
 */
export async function rowsWhere<T extends TableName>(
  name: T,
  field: keyof Tables<T> & string,
  value: string,
  sortField: keyof Tables<T> = "created_at" as keyof Tables<T>,
  direction: "asc" | "desc" = "desc",
): Promise<Tables<T>[]> {
  const rows = await listRows<Tables<T>>(query(collection(firestore(), name), where(field, "==", value)));
  return sortRows(rows, sortField, direction);
}

/**
 * Creates a document with a generated id plus created_at (and updated_at, where the table has one),
 * and returns the new id.
 */
export async function insertRow<T extends TableName>(
  name: T,
  data: Omit<Tables<T>, "id" | "created_at" | "updated_at">,
): Promise<string> {
  const ref = doc(collection(firestore(), name));
  const now = nowIso();
  await setDoc(ref, { ...data, created_at: now, ...(name === "notifications" ? {} : { updated_at: now }) });
  return ref.id;
}

/** Notifications may only have `read` changed (see firestore.rules), so no updated_at stamp here. */
export async function markNotificationRead(id: string) {
  await updateDoc(doc(firestore(), "notifications", id), { read: true });
}

/** Updates a document and refreshes updated_at, as the Postgres update triggers did. */
export async function updateRow(name: Exclude<TableName, "notifications">, id: string, patch: Record<string, unknown>) {
  await updateDoc(doc(firestore(), name, id), { ...patch, updated_at: nowIso() });
}
