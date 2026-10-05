type FirestoreValue =
    | { stringValue: string }
    | { integerValue: string }
    | { doubleValue: number }
    | { booleanValue: boolean }
    | { timestampValue: string }
    | { nullValue: null }
    | { arrayValue: { values?: FirestoreValue[] } }
    | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
    name: string;
    fields?: Record<string, FirestoreValue>;
};

type RunQueryResult = {
    document?: FirestoreDocument;
};

function config() {
    const env = import.meta.env as unknown as Record<string, string | undefined>;

    const projectId = env["VITE_FIREBASE_PROJECT_ID"];
    const apiKey = env["VITE_FIREBASE_API_KEY"];

    if (!projectId || !apiKey) {
        throw new Error(
            "Missing VITE_FIREBASE_PROJECT_ID or VITE_FIREBASE_API_KEY.",
        );
    }

    return { projectId, apiKey };
}

function decodeValue(value: FirestoreValue): unknown {
    if ("stringValue" in value) return value.stringValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return value.doubleValue;
    if ("booleanValue" in value) return value.booleanValue;
    if ("timestampValue" in value) return value.timestampValue;
    if ("nullValue" in value) return null;

    if ("arrayValue" in value) {
        return (value.arrayValue.values ?? []).map(decodeValue);
    }

    if ("mapValue" in value) {
        return decodeFields(value.mapValue.fields ?? {});
    }

    return undefined;
}

function decodeFields(fields: Record<string, FirestoreValue>) {
    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
            key,
            decodeValue(value),
        ]),
    );
}

export function decodeFirestoreDocument<T extends Record<string, unknown>>(
    document: FirestoreDocument,
): T & { id: string } {
    return {
        id: document.name.split("/").at(-1)!,
        ...decodeFields(document.fields ?? {}),
    } as T & { id: string };
}

export async function runFirestoreQuery(body: unknown) {
    const { projectId, apiKey } = config();

    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(body),
        },
    );

    if (!response.ok) {
        throw new Error(
            `Firestore query failed (${response.status}): ${await response.text()}`,
        );
    }

    return response.json() as Promise<RunQueryResult[]>;
}

export async function getFirestoreDocument<
    T extends Record<string, unknown>
>(
    collectionName: string,
    id: string,
): Promise<(T & { id: string }) | null> {
    const { projectId, apiKey } = config();

    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(id)}?key=${apiKey}`,
    );

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(
            `Firestore read failed (${response.status}): ${await response.text()}`,
        );
    }

    return decodeFirestoreDocument<T>(
        (await response.json()) as FirestoreDocument,
    );
}