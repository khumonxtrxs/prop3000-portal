import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const DEMO_PASSWORD = "Prop3000#2026";

const DEMO_USERS = [
    {
        role: "client",
        email: "client@prop3000.demo",
        name: "Thandi Client",
    },
    {
        role: "admin",
        email: "admin@prop3000.demo",
        name: "Office Admin",
    },
    {
        role: "agent",
        email: "agent@prop3000.demo",
        name: "Riaan Agent",
    },
    {
        role: "supervisor",
        email: "supervisor@prop3000.demo",
        name: "Sipho Supervisor",
    },
    {
        role: "owner",
        email: "owner@prop3000.demo",
        name: "Leah's Dad",
    },
];

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "demo-prop3000";

/*
 * The Admin SDK connects to the local Firebase emulators when
 * FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST are set.
 *
 * "demo-prop3000" is a local emulator project ID only. It can be
 * replaced by the real Firebase project ID when the hosted project
 * is configured later.
 */
initializeApp({
    projectId: PROJECT_ID,
});

const auth = getAuth();
const db = getFirestore();

/**
 * Returns an existing Firebase Auth user or creates the user when they
 * do not yet exist.
 *
 * Existing demo users are updated so the script can safely be rerun
 * without creating duplicate accounts.
 */
async function ensureAuthUser(account) {
    try {
        const existingUser = await auth.getUserByEmail(account.email);

        await auth.updateUser(existingUser.uid, {
            displayName: account.name,
            password: DEMO_PASSWORD,
            emailVerified: true,
            disabled: false,
        });

        console.log(`Updated Auth user: ${account.email}`);

        return existingUser.uid;
    } catch (error) {
        if (error.code !== "auth/user-not-found") {
            throw error;
        }

        const newUser = await auth.createUser({
            email: account.email,
            password: DEMO_PASSWORD,
            displayName: account.name,
            emailVerified: true,
            disabled: false,
        });

        console.log(`Created Auth user: ${account.email}`);

        return newUser.uid;
    }
}

/**
 * Creates or updates the Firestore role document associated with the
 * Firebase Auth user.
 *
 * The Firebase UID is used as the document ID so authentication and
 * authorization data can be joined directly.
 */
async function ensureRoleDocument(uid, account) {
    await db.collection("user_roles").doc(uid).set(
        {
            role: account.role,
        },
        {
            merge: true,
        },
    );

    console.log(`Assigned role "${account.role}" to ${account.email}`);
}

/**
 * Seeds the five shared demo accounts used across the portal.
 *
 * Running the script again updates existing
 * users and role documents instead of creating duplicates.
 */
async function seedDemoUsers() {
    console.log("Seeding PROP3000 Firebase demo users...\n");

    for (const account of DEMO_USERS) {
        const uid = await ensureAuthUser(account);
        await ensureRoleDocument(uid, account);
    }

    console.log("\nDemo user seeding complete.");
}

seedDemoUsers().catch((error) => {
    console.error("\nFailed to seed demo users:");
    console.error(error);

    process.exit(1);
});
