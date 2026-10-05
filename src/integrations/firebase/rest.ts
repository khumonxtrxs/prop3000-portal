// Server-side Firestore reads over the REST API.
//
// The listings pages are server-rendered, and the Cloudflare Workers runtime can't run firebase-admin
// (see docs/firebase-migration.md). Published listings are public under the security rules, so these
// requests carry only the public web API key, never a service account. Anything the rules hide
// (draft listings) comes back as 403/404 and is treated as "not found".
import { FIREBASE_EMULATOR_PORTS } from "./config";

type Env = Record<string, string | undefined>;

function env(): Env {
  return import.meta.env as unknown as Env;
}

function documentsUrl(): string {
  const projectId = env()["VITE_FIREBASE_PROJECT_ID"];
  if (!projectId) {
    throw new Error("Missing Firebase environment variable: VITE_FIREBASE_PROJECT_ID. Add it to .env (see .env.example).");
  }
  const host =
    env()["VITE_FIREBASE_EMULATORS"] === "true"
      ? `http://127.0.0.1:${FIREBASE_EMULATOR_PORTS.firestore}`
      : "https://firestore.googleapis.com";
  return `${host}/v1/projects/${projectId}/databases/(default)/documents`;
}

function withKey(url: string): string {
  const key = env()["VITE_FIREBASE_API_KEY"];
  return key ? `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}` : url;
}

/** Firestore's REST value encoding, e.g. { stringValue: "x" } or { integerValue: "3" }. */
type RestValue = {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  stringValue?: string;
  timestampValue?: string;
  arrayValue?: { values?: RestValue[] };
  mapValue?: { fields?: Record<string, RestValue> };
};

type RestDocument = { name: string; fields?: Record<string, RestValue> };

function decodeValue(value: RestValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue?.values ?? []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue?.fields ?? {});
  return null;
}

function decodeFields(fields: Record<string, RestValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function decodeDocument<T>(document: RestDocument): T {
  const id = document.name.slice(document.name.lastIndexOf("/") + 1);
  return { ...decodeFields(document.fields ?? {}), id } as T;
}

/** One document by id, or null if it doesn't exist or the rules don't let the public read it. */
export async function getPublicDocument<T>(collection: string, id: string): Promise<T | null> {
  const response = await fetch(withKey(`${documentsUrl()}/${collection}/${encodeURIComponent(id)}`));
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status})`);
  return decodeDocument<T>((await response.json()) as RestDocument);
}

/** Documents whose `field` is one of `values`. The query must stay inside what the rules allow. */
export async function queryPublicDocuments<T>(collection: string, field: string, values: string[]): Promise<T[]> {
  const response = await fetch(withKey(`${documentsUrl()}:runQuery`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: "IN",
            value: { arrayValue: { values: values.map((stringValue) => ({ stringValue })) } },
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`Firestore query failed (${response.status})`);
  const rows = (await response.json()) as Array<{ document?: RestDocument }>;
  return rows.flatMap((row) => (row.document ? [decodeDocument<T>(row.document)] : []));
}
