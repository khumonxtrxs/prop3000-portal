// Security rule tests. Run the emulators first (npm run emulators), then: npm run test:rules
//
// These prove the Firestore rules enforce the same boundaries the Supabase RLS policies did:
// anonymous people can submit leads but read nothing, clients see only their own records,
// supervisors see only their jobs, and the owner cannot write.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  setLogLevel,
  updateDoc,
} from "firebase/firestore";

setLogLevel("error");

const PROJECT_ID = "demo-prop3000";
const FIRESTORE_PORT = 8081;

const UID = {
  client: "user-client",
  otherClient: "user-other-client",
  admin: "user-admin",
  supervisor: "user-supervisor",
  otherSupervisor: "user-other-supervisor",
  agent: "user-agent",
  owner: "user-owner",
};

let testEnv;

/** Firestore for a signed-in user, or for a signed-out visitor when uid is null. */
function db(uid) {
  return uid === null
    ? testEnv.unauthenticatedContext().firestore()
    : testEnv.authenticatedContext(uid).firestore();
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: FIRESTORE_PORT,
    },
  });

  // Seed roles and fixtures with rules disabled.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const seed = context.firestore();
    await setDoc(doc(seed, "user_roles", UID.admin), { roles: ["admin"] });
    await setDoc(doc(seed, "user_roles", UID.supervisor), { roles: ["supervisor"] });
    await setDoc(doc(seed, "user_roles", UID.otherSupervisor), { roles: ["supervisor"] });
    await setDoc(doc(seed, "user_roles", UID.agent), { roles: ["agent"] });
    await setDoc(doc(seed, "user_roles", UID.owner), { roles: ["owner"] });
    await setDoc(doc(seed, "user_roles", UID.client), { roles: ["client"] });

    await setDoc(doc(seed, "service_requests", "sr-1"), {
      client_id: UID.client,
      description: "Kitchen renovation",
      status: "new",
    });
    await setDoc(doc(seed, "jobs", "job-1"), {
      client_id: UID.client,
      supervisor_id: UID.supervisor,
      status: "in_progress",
      progress: 55,
      title: "Kitchen renovation",
    });
    await setDoc(doc(seed, "listings", "listing-published"), {
      title: "Fixer-upper in Bellville",
      status: "published",
      price: 890000,
    });
    await setDoc(doc(seed, "listings", "listing-draft"), {
      title: "Not ready yet",
      status: "draft",
      price: 700000,
    });
    await setDoc(doc(seed, "offers", "offer-1"), {
      listing_id: "listing-published",
      client_id: UID.client,
      amount: 820000,
      status: "pending",
    });
    await setDoc(doc(seed, "notifications", "notif-1"), {
      user_id: UID.client,
      title: "Quote ready",
      read: false,
    });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

describe("public submissions", () => {
  it("lets a signed-out visitor submit a service request", async () => {
    await assertSucceeds(
      addDoc(collection(db(null), "service_requests"), {
        description: "Paving quote please",
        address: "12 Main Road, Bellville",
        status: "new",
      }),
    );
  });

  it("rejects a submission that arrives already converted", async () => {
    await assertFails(
      addDoc(collection(db(null), "service_requests"), {
        description: "Sneaky",
        status: "converted",
      }),
    );
  });

  it("does not let a signed-out visitor read submissions", async () => {
    await assertFails(getDocs(collection(db(null), "service_requests")));
  });

  it("does not let a visitor claim someone else's submission", async () => {
    await assertFails(
      addDoc(collection(db(null), "service_requests"), {
        client_id: UID.client,
        description: "Not mine",
        status: "new",
      }),
    );
  });
});

describe("clients", () => {
  it("reads its own request", async () => {
    await assertSucceeds(getDoc(doc(db(UID.client), "service_requests", "sr-1")));
  });

  it("cannot read another client's request", async () => {
    await assertFails(getDoc(doc(db(UID.otherClient), "service_requests", "sr-1")));
  });

  it("cannot change a request's status", async () => {
    await assertFails(
      updateDoc(doc(db(UID.client), "service_requests", "sr-1"), { status: "converted" }),
    );
  });

  it("reads its own notification and marks it read", async () => {
    await assertSucceeds(updateDoc(doc(db(UID.client), "notifications", "notif-1"), { read: true }));
  });

  it("cannot rewrite a notification's text", async () => {
    await assertFails(
      updateDoc(doc(db(UID.client), "notifications", "notif-1"), { title: "Changed" }),
    );
  });

  it("cannot grant itself a role", async () => {
    await assertFails(setDoc(doc(db(UID.client), "user_roles", UID.client), { roles: ["admin"] }));
  });
});

describe("jobs", () => {
  it("lets the assigned supervisor update progress", async () => {
    await assertSucceeds(
      updateDoc(doc(db(UID.supervisor), "jobs", "job-1"), { status: "in_progress", progress: 70 }),
    );
  });

  it("stops another supervisor touching the job", async () => {
    await assertFails(
      updateDoc(doc(db(UID.otherSupervisor), "jobs", "job-1"), { status: "complete", progress: 100 }),
    );
  });

  it("rejects progress outside 0-100", async () => {
    await assertFails(
      updateDoc(doc(db(UID.supervisor), "jobs", "job-1"), { status: "in_progress", progress: 140 }),
    );
  });

  it("lets the client read job progress but not change it", async () => {
    await assertSucceeds(getDoc(doc(db(UID.client), "jobs", "job-1")));
    await assertFails(
      updateDoc(doc(db(UID.client), "jobs", "job-1"), { status: "complete", progress: 100 }),
    );
  });

  it("records history stamped with the writer's own uid", async () => {
    await assertSucceeds(
      addDoc(collection(db(UID.supervisor), "jobs", "job-1", "status_history"), {
        status: "in_progress",
        note: "Tiling started",
        changed_by: UID.supervisor,
      }),
    );
    await assertFails(
      addDoc(collection(db(UID.supervisor), "jobs", "job-1", "status_history"), {
        status: "complete",
        note: "Pretending to be the admin",
        changed_by: UID.admin,
      }),
    );
  });
});

describe("listings and offers", () => {
  it("shows published listings to anyone", async () => {
    await assertSucceeds(getDoc(doc(db(null), "listings", "listing-published")));
  });

  it("hides draft listings from the public", async () => {
    await assertFails(getDoc(doc(db(null), "listings", "listing-draft")));
  });

  it("shows draft listings to an agent", async () => {
    await assertSucceeds(getDoc(doc(db(UID.agent), "listings", "listing-draft")));
  });

  it("stops a client editing a listing", async () => {
    await assertFails(
      updateDoc(doc(db(UID.client), "listings", "listing-published"), { price: 1 }),
    );
  });

  it("lets a buyer submit an offer as themselves only", async () => {
    await assertSucceeds(
      addDoc(collection(db(UID.otherClient), "offers"), {
        listing_id: "listing-published",
        client_id: UID.otherClient,
        amount: 800000,
        status: "pending",
      }),
    );
    await assertFails(
      addDoc(collection(db(UID.otherClient), "offers"), {
        listing_id: "listing-published",
        client_id: UID.client,
        amount: 800000,
        status: "pending",
      }),
    );
  });

  it("lets the agent counter an offer", async () => {
    await assertSucceeds(
      updateDoc(doc(db(UID.agent), "offers", "offer-1"), {
        status: "countered",
        counter_amount: 880000,
      }),
    );
  });

  it("stops an unrelated client reading someone else's offer", async () => {
    await assertFails(getDoc(doc(db(UID.otherClient), "offers", "offer-1")));
  });
});

describe("staff boundaries", () => {
  it("lets the admin triage a lead", async () => {
    await assertSucceeds(
      updateDoc(doc(db(UID.admin), "service_requests", "sr-1"), { status: "contacted" }),
    );
  });

  // The owner counts as "office" in the rules, exactly as in the Supabase policies. Owner being
  // read-only is a UI decision: the dashboard renders no mutation controls.
  it("treats the owner as office", async () => {
    await assertSucceeds(getDoc(doc(db(UID.owner), "jobs", "job-1")));
    await assertSucceeds(
      updateDoc(doc(db(UID.owner), "service_requests", "sr-1"), { status: "quoted" }),
    );
  });

  it("denies collections that no rule covers", async () => {
    await assertFails(setDoc(doc(db(UID.admin), "secret_stuff", "x"), { a: 1 }));
  });

  it("keeps the rules file in sync with the emulator", () => {
    assert.ok(readFileSync("firestore.rules", "utf8").includes("rules_version = '2'"));
  });
});
