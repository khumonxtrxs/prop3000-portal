import { pathToFileURL } from "node:url";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const DEMO_PASSWORD = "Prop3000#2026";

/*
 * Each demo account has a fixed uid, the same id the Supabase seed gave it
 * (docs/legacy-supabase-schema/seed.sql), so the demo jobs, quotes and offers
 * loaded by seed-demo-data.mjs point at the right people.
 */
export const DEMO_USERS = [
    {
        uid: "10000000-0000-0000-0000-000000000001",
        role: "client",
        email: "client@prop3000.demo",
        name: "Thandi Client",
    },
    {
        uid: "10000000-0000-0000-0000-000000000002",
        role: "admin",
        email: "admin@prop3000.demo",
        name: "Office Admin",
    },
    {
        uid: "10000000-0000-0000-0000-000000000003",
        role: "agent",
        email: "agent@prop3000.demo",
        name: "Riaan Agent",
    },
    {
        uid: "10000000-0000-0000-0000-000000000004",
        role: "supervisor",
        email: "supervisor@prop3000.demo",
        name: "Sipho Supervisor",
    },
    {
        uid: "10000000-0000-0000-0000-000000000005",
        role: "owner",
        email: "owner@prop3000.demo",
        name: "Leah's Dad",
    },
];

/*
 * The Admin SDK connects to the local Firebase emulators when
 * FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST are set.
 *
 * "demo-prop3000" is a local emulator project ID only. Set
 * FIREBASE_PROJECT_ID (and GOOGLE_APPLICATION_CREDENTIALS) to seed
 * a hosted project instead.
 */
export function adminApp() {
    return initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "demo-prop3000",
    });
}

/**
 * Creates the demo Auth user with its fixed uid, or updates it when it
 * already exists. A demo account that was created earlier with a random uid
 * is recreated, so the seeded data links to it.
 */
async function ensureAuthUser(auth, account) {
    const profile = {
        email: account.email,
        displayName: account.name,
        password: DEMO_PASSWORD,
        emailVerified: true,
        disabled: false,
    };

    try {
        const existingUser = await auth.getUserByEmail(account.email);

        if (existingUser.uid === account.uid) {
            await auth.updateUser(account.uid, profile);
            console.log(`Updated Auth user: ${account.email}`);
            return;
        }

        await auth.deleteUser(existingUser.uid);
        console.log(`Replaced ${account.email} (old uid ${existingUser.uid}) with its fixed demo uid`);
    } catch (error) {
        if (error.code !== "auth/user-not-found") {
            throw error;
        }
    }

    await auth.createUser({ uid: account.uid, ...profile });
    console.log(`Created Auth user: ${account.email}`);
}

/**
 * Writes the role document the security rules read ({ roles: [...] }) and
 * the matching profile. The uid is the document id in both collections.
 */
async function ensureRoleAndProfile(db, account) {
    const now = new Date().toISOString();

    await db.collection("user_roles").doc(account.uid).set({ roles: [account.role] });
    await db.collection("profiles").doc(account.uid).set(
        {
            full_name: account.name,
            email: account.email,
            phone: null,
            created_at: now,
            updated_at: now,
        },
        { merge: true },
    );

    console.log(`Assigned role "${account.role}" to ${account.email}`);
}

/**
 * Seeds the five shared demo accounts used across the portal.
 *
 * Running the script again updates existing users and role documents
 * instead of creating duplicates.
 */
export async function seedDemoUsers(app) {
    const auth = getAuth(app);
    const db = getFirestore(app);

    for (const account of DEMO_USERS) {
        await ensureAuthUser(auth, account);
        await ensureRoleAndProfile(db, account);
    }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    console.log("Seeding PROP3000 Firebase demo users...\n");

    seedDemoUsers(adminApp())
        .then(() => console.log("\nDemo user seeding complete."))
        .catch((error) => {
            console.error("\nFailed to seed demo users:");
            console.error(error);
            process.exit(1);
        });
}
