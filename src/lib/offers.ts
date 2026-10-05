// Offer writes. Postgres did two things here automatically that Firestore does not:
// copying listing details onto the offer (a join), and the notify_offer_status() trigger that
// told the buyer whenever their offer was made or its status changed. Both happen here instead.
import { collection, doc, getDoc, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";

import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";
import { insertRow, newReference, nowIso } from "@/integrations/firebase/db";
import type { Tables } from "@/lib/db-types";

/** Same wording as the old notify_offer_status() trigger. */
function statusMessage(reference: string, status: string): { title: string; body: string } {
  const title = `Offer ${reference} is now ${status}`;
  switch (status) {
    case "approved":
      return { title, body: "Your offer was approved. The agent's contact details are now available on your offer." };
    case "countered":
      return { title, body: "The agent countered your offer. Open your offer to respond." };
    case "declined":
      return { title, body: "Unfortunately your offer was declined." };
    default:
      return { title, body: `Your offer status changed to ${status}.` };
  }
}

/** A signed-in buyer makes an offer on a published listing. Returns the offer reference. */
export async function submitListingOffer(input: {
  listingId: string;
  user: User;
  phone: string | null;
  amount: number;
  message: string | null;
}): Promise<string> {
  const listingSnap = await getDoc(doc(firestore(), COLLECTIONS.listings, input.listingId));
  if (!listingSnap.exists()) throw new Error("This listing is no longer available.");
  const listing = listingSnap.data() as Tables<"listings">;

  const reference = newReference("OF");
  const offerId = await insertRow("offers", {
    reference,
    listing_id: input.listingId,
    client_id: input.user.uid,
    client_name: input.user.displayName || input.user.email || "Client",
    client_email: input.user.email ?? "",
    client_phone: input.phone,
    amount: input.amount,
    message: input.message,
    status: "pending",
    counter_amount: null,
    agent_notes: null,
    listing_title: listing.title,
    listing_address: listing.address,
    asking_price: listing.price,
    agent_name: listing.agent_name,
    agent_phone: listing.agent_phone,
    agent_email: listing.agent_email,
  });

  await insertRow("notifications", {
    user_id: input.user.uid,
    title: `Offer ${reference} submitted`,
    body: "We received your offer. An agent will review it shortly.",
    link: "/offers",
    offer_id: offerId,
    read: false,
  });

  return reference;
}

/** An agent approves, declines or counters an offer, and the buyer is notified in the same write. */
export async function decideOffer(input: {
  offer: Pick<Tables<"offers">, "id" | "reference" | "status" | "client_id">;
  status: string;
  counter: number | null;
  note: string | null;
}): Promise<void> {
  const db = firestore();
  const now = nowIso();
  const batch = writeBatch(db);

  batch.update(doc(db, COLLECTIONS.offers, input.offer.id), {
    status: input.status,
    counter_amount: input.counter,
    agent_notes: input.note,
    updated_at: now,
  });

  if (input.status !== input.offer.status) {
    batch.set(doc(collection(db, COLLECTIONS.notifications)), {
      user_id: input.offer.client_id,
      ...statusMessage(input.offer.reference, input.status),
      link: "/offers",
      offer_id: input.offer.id,
      read: false,
      created_at: now,
    });
  }

  await batch.commit();
}
