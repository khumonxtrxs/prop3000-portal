// Loads the full demo data set into Firestore: the five demo users, then every lead, job, quote,
// booking, listing, offer and notification the dashboards demonstrate.
//
//   npm run seed:demo-data                      # local emulators (start them first)
//   FIREBASE_PROJECT_ID=<id> GOOGLE_APPLICATION_CREDENTIALS=<key.json> npm run seed:demo-data
//
// The data is read straight from the SQL the team already maintains, so there is one source of
// demo data: docs/legacy-supabase-schema/seed.sql, plus the service types and first six listings
// from the original migrations. Relative dates such as `now() - interval '3 days'` are worked out
// at seed time, so the demo always looks recent. Re-running replaces the same documents.
import { readFileSync } from "node:fs";

import { getFirestore } from "firebase-admin/firestore";

import { adminApp, seedDemoUsers } from "./seed-demo-users.mjs";

const SCHEMA_DIR = "docs/legacy-supabase-schema";
const SOURCES = [
    `${SCHEMA_DIR}/migrations/20260805112222_e7f95a03-d4ec-4234-9c58-1911cb4455c0.sql`,
    `${SCHEMA_DIR}/migrations/20260810151806_ef1e1319-03df-48e8-89af-9be3837f8a9a.sql`,
    `${SCHEMA_DIR}/seed.sql`,
];

// ------------------------------------------------------------------ SQL values

const DAY_MS = 24 * 60 * 60 * 1000;

function shiftDate(date, amount, unit) {
    const d = new Date(date);
    const u = unit.replace(/s$/, "");
    if (u === "month") d.setMonth(d.getMonth() + amount);
    else if (u === "year") d.setFullYear(d.getFullYear() + amount);
    else if (u === "week") d.setTime(d.getTime() + amount * 7 * DAY_MS);
    else if (u === "day") d.setTime(d.getTime() + amount * DAY_MS);
    else if (u === "hour") d.setTime(d.getTime() + amount * 60 * 60 * 1000);
    else throw new Error(`Unknown interval unit: ${unit}`);
    return d;
}

/** Parses the VALUES of an INSERT: strings, numbers, NULL, booleans, ARRAY[...], JSON and relative dates. */
class ValueParser {
    constructor(text, now) {
        this.text = text;
        this.i = 0;
        this.now = now;
    }

    skip() {
        for (;;) {
            while (/\s/.test(this.text[this.i] ?? "")) this.i++;
            if (this.text.startsWith("--", this.i)) {
                while (this.i < this.text.length && this.text[this.i] !== "\n") this.i++;
            } else return;
        }
    }

    peek(token) {
        this.skip();
        return this.text.slice(this.i, this.i + token.length).toLowerCase() === token.toLowerCase();
    }

    expect(token) {
        if (!this.peek(token)) throw new Error(`Expected "${token}" near: ${this.text.slice(this.i, this.i + 60)}`);
        this.i += token.length;
    }

    string() {
        this.expect("'");
        let out = "";
        for (;;) {
            const ch = this.text[this.i++];
            if (ch === undefined) throw new Error("Unterminated string");
            if (ch === "'") {
                if (this.text[this.i] === "'") {
                    out += "'";
                    this.i++;
                } else break;
            } else out += ch;
        }
        return out;
    }

    value() {
        this.skip();
        let result;
        if (this.peek("'")) {
            result = this.string();
            if (this.peek("::jsonb")) {
                this.expect("::jsonb");
                result = JSON.parse(result);
            }
        } else if (this.peek("NULL")) {
            this.expect("NULL");
            result = null;
        } else if (this.peek("true")) {
            this.expect("true");
            result = true;
        } else if (this.peek("false")) {
            this.expect("false");
            result = false;
        } else if (this.peek("ARRAY[")) {
            this.expect("ARRAY[");
            result = [];
            while (!this.peek("]")) {
                result.push(this.value());
                if (this.peek(",")) this.expect(",");
            }
            this.expect("]");
        } else if (this.peek("now()")) {
            this.expect("now()");
            result = new Date(this.now);
            if (this.peek("-") || this.peek("+")) {
                const sign = this.text[this.i] === "-" ? -1 : 1;
                this.i++;
                this.expect("interval");
                const [amount, unit] = this.string().trim().split(/\s+/);
                result = shiftDate(result, sign * Number(amount), unit);
            }
            result = result.toISOString();
        } else if (this.peek("current_date")) {
            this.expect("current_date");
            let date = new Date(this.now);
            if (this.peek("-") || this.peek("+")) {
                const sign = this.text[this.i] === "-" ? -1 : 1;
                this.i++;
                this.skip();
                const match = /^\d+/.exec(this.text.slice(this.i));
                this.i += match[0].length;
                date = shiftDate(date, sign * Number(match[0]), "day");
            }
            result = date.toISOString().slice(0, 10);
        } else {
            const match = /^-?\d+(\.\d+)?/.exec(this.text.slice(this.i));
            if (!match) throw new Error(`Unexpected value near: ${this.text.slice(this.i, this.i + 60)}`);
            this.i += match[0].length;
            result = Number(match[0]);
        }
        return result;
    }

    tuple() {
        this.expect("(");
        const values = [];
        while (!this.peek(")")) {
            values.push(this.value());
            if (this.peek(",")) this.expect(",");
        }
        this.expect(")");
        return values;
    }
}

const DATA_TABLES = new Set([
    "service_types", "service_requests", "property_submissions", "listings", "jobs", "job_status_history",
    "quotes", "bookings", "offers", "offer_events", "notifications",
]);

/**
 * Every top-level `INSERT INTO public.<table> (cols) VALUES (...), (...)` for the data tables, as row
 * objects. Only statements at the start of a line count: the indented INSERTs inside trigger
 * functions (handle_new_user, notify_offer_status) are code, not data. Users and roles come from
 * seed-demo-users.mjs instead.
 */
function readInserts(files, now) {
    const rows = {};
    const insert = /^INSERT INTO public\.(\w+)\s*\(([^)]*)\)\s*VALUES/gim;
    for (const file of files) {
        const text = readFileSync(file, "utf8");
        for (const match of text.matchAll(insert)) {
            const [, table, columnList] = match;
            if (!DATA_TABLES.has(table)) continue;
            const columns = columnList.split(",").map((c) => c.trim());
            const parser = new ValueParser(text, now);
            parser.i = match.index + match[0].length;
            rows[table] ??= [];
            for (;;) {
                const values = parser.tuple();
                rows[table].push(Object.fromEntries(columns.map((c, k) => [c, values[k]])));
                if (!parser.peek(",")) break;
                parser.expect(",");
            }
        }
    }
    return rows;
}

// --------------------------------------------------------------- documents

/** Column defaults from the original schema, so every document has the full row shape. */
const DEFAULTS = {
    service_types: { category: "developers", description: null, icon: null, sort_order: 0 },
    service_requests: {
        client_id: null, latitude: null, longitude: null, service_types: [], budget_range: null,
        preferred_start_date: null, photo_paths: [], status: "new", admin_notes: null,
    },
    property_submissions: {
        client_id: null, latitude: null, longitude: null, property_type: "house", condition: "fair",
        bedrooms: null, bathrooms: null, erf_size: null, asking_price: null, description: null,
        reason_for_selling: null, photo_paths: [], status: "new", offer_amount: null, offer_notes: null,
        admin_notes: null,
    },
    jobs: {
        service_request_id: null, client_id: null, client_phone: null, description: null, latitude: null,
        longitude: null, service_types: [], supervisor_id: null, status: "quoted", progress: 0,
        quote_amount: null, start_date: null, target_end_date: null, completed_at: null,
    },
    quotes: {
        service_request_id: null, job_id: null, client_id: null, line_items: [], subtotal: 0, vat: 0,
        total: 0, valid_until: null, status: "draft", notes: null, created_by: null,
    },
    bookings: {
        booking_type: "site_visit", client_id: null, address: null, latitude: null, longitude: null,
        scheduled_time: "09:00", notes: null, service_request_id: null, property_submission_id: null,
        job_id: null, assigned_to: null, status: "requested",
    },
    listings: {
        suburb: null, city: null, latitude: null, longitude: null, property_type: "house", condition: "fair",
        bedrooms: null, bathrooms: null, erf_size: null, price: 0, description: null, photo_paths: [],
        status: "published", agent_id: null, agent_name: "Prop3000 Investments", agent_phone: "081 253 4300",
        agent_email: "info@prop3000.co.za",
    },
    offers: { client_phone: null, message: null, status: "pending", counter_amount: null, agent_notes: null },
    notifications: { body: null, link: null, offer_id: null, read: false },
};

const REFERENCE_PREFIX = { listings: "LST" };

function withDefaults(table, row, index, now) {
    const created = row.created_at ?? now.toISOString();
    const doc = { ...DEFAULTS[table], ...row, created_at: created };
    if (table !== "notifications" && table !== "service_types") doc.updated_at = row.updated_at ?? created;
    if (REFERENCE_PREFIX[table] && !doc.reference) {
        doc.reference = `${REFERENCE_PREFIX[table]}-SEED${String(index + 1).padStart(2, "0")}`;
    }
    return doc;
}

/** Rows without an id in the SQL get a stable one, so re-running the seed overwrites instead of duplicating. */
function idFor(table, row, index) {
    return row.id ?? `seed-${table}-${String(index + 1).padStart(2, "0")}`;
}

async function writeAll(db, writes) {
    // Firestore batches hold at most 500 writes.
    for (let start = 0; start < writes.length; start += 400) {
        const batch = db.batch();
        for (const { ref, data } of writes.slice(start, start + 400)) {
            const { id: _id, ...fields } = data;
            batch.set(ref, fields);
        }
        await batch.commit();
    }
}

async function seedDemoData(app) {
    const db = getFirestore(app);
    const now = new Date();
    const rows = readInserts(SOURCES, now);
    const writes = [];

    const topLevel = [
        "service_types", "service_requests", "property_submissions", "listings", "jobs",
        "quotes", "bookings", "notifications",
    ];
    for (const table of topLevel) {
        (rows[table] ?? []).forEach((row, index) => {
            writes.push({
                ref: db.collection(table).doc(idFor(table, row, index)),
                data: withDefaults(table, row, index, now),
            });
        });
    }

    // Offers carry a copy of their listing's details (Firestore has no joins).
    const listingsById = new Map(
        (rows.listings ?? []).map((row, index) => [idFor("listings", row, index), withDefaults("listings", row, index, now)]),
    );
    for (const [index, row] of (rows.offers ?? []).entries()) {
        const listing = listingsById.get(row.listing_id);
        if (!listing) throw new Error(`Offer ${row.reference} points at unknown listing ${row.listing_id}`);
        writes.push({
            ref: db.collection("offers").doc(idFor("offers", row, index)),
            data: {
                ...withDefaults("offers", row, index, now),
                listing_title: listing.title,
                listing_address: listing.address,
                asking_price: listing.price,
                agent_name: listing.agent_name,
                agent_phone: listing.agent_phone,
                agent_email: listing.agent_email,
            },
        });
    }

    // History and events live under their parent document.
    for (const [index, row] of (rows.job_status_history ?? []).entries()) {
        writes.push({
            ref: db.collection("jobs").doc(row.job_id).collection("status_history").doc(idFor("history", row, index)),
            data: { note: null, changed_by: null, ...row, created_at: row.created_at ?? now.toISOString() },
        });
    }
    for (const [index, row] of (rows.offer_events ?? []).entries()) {
        writes.push({
            ref: db.collection("offers").doc(row.offer_id).collection("events").doc(idFor("events", row, index)),
            data: { note: null, amount: null, actor_id: null, ...row, created_at: row.created_at ?? now.toISOString() },
        });
    }

    await writeAll(db, writes);

    const counts = {};
    for (const { ref } of writes) {
        const name = ref.parent.id;
        counts[name] = (counts[name] ?? 0) + 1;
    }
    for (const [name, count] of Object.entries(counts)) console.log(`  ${name}: ${count}`);
}

const app = adminApp();

console.log("Seeding PROP3000 demo users...\n");
seedDemoUsers(app)
    .then(() => {
        console.log("\nSeeding PROP3000 demo data...");
        return seedDemoData(app);
    })
    .then(() => console.log("\nDemo data seeding complete."))
    .catch((error) => {
        console.error("\nFailed to seed demo data:");
        console.error(error);
        process.exit(1);
    });
