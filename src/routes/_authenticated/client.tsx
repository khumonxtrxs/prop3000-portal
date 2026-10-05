import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Empty, PortalShell } from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";
import { money, prettyStatus, shortDate, whatsappLink } from "@/lib/prop3000";
import { STATUS_BORDER_LEFT, statusTone } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/client")({
  head: () => ({
    meta: [
      { title: "My Prop3000 Portal — Requests, Quotes & Progress" },
      {
        name: "description",
        content: "Homeowner portal: approve quotes, follow live job progress, track your cash offer and manage bookings.",
      },
      { property: "og:title", content: "My Prop3000 portal" },
      { property: "og:description", content: "Approve quotes and watch your renovation progress without a phone call." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientDashboard,
});

// Firestore helper
type FirestoreRow = DocumentData & {
  id: string;
};

async function getRows(
  collectionName: string,
  field: string,
  value: string,
): Promise<FirestoreRow[]> {
  const snapshot = await getDocs(
    query(
      collection(firestore(), collectionName),
      where(field, "==", value),
    ),
  );

  return snapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
}

function timestampValue(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

type QuoteLine = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(n) ? n : null;
}

function lineLabel(line: QuoteLine): string {
  const label =
    line["description"] ??
    line["label"] ??
    line["item"] ??
    line["name"];

  return typeof label === "string" && label.trim()
    ? label
    : "Item";
}

function lineAmount(line: QuoteLine): number {
  const direct =
    asNumber(line["amount"]) ??
    asNumber(line["total"]) ??
    asNumber(line["line_total"]) ??
    asNumber(line["price_total"]);

  if (direct !== null) return direct;

  const qty =
    asNumber(line["qty"]) ??
    asNumber(line["quantity"]) ??
    1;

  const unit =
    asNumber(line["unit_price"]) ??
    asNumber(line["rate"]) ??
    asNumber(line["price"]) ??
    asNumber(line["unit_cost"]);

  return unit !== null ? qty * unit : 0;
}

function quoteLines(value: unknown): QuoteLine[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (line): line is QuoteLine =>
      typeof line === "object" &&
      line !== null &&
      !Array.isArray(line),
  );
}

function ClientDashboard() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const data = useQuery({
    queryKey: ["client-portal", user?.uid],
    enabled: !!user?.uid,

    queryFn: async () => {
      const uid = user!.uid;

      const [
        requests,
        properties,
        jobs,
        quotes,
        bookings,
        notifications,
      ] = await Promise.all([
        getRows(
          COLLECTIONS.serviceRequests,
          "client_id",
          uid,
        ),

        getRows(
          COLLECTIONS.propertySubmissions,
          "client_id",
          uid,
        ),

        getRows(
          COLLECTIONS.jobs,
          "client_id",
          uid,
        ),

        getRows(
          COLLECTIONS.quotes,
          "client_id",
          uid,
        ),

        getRows(
          COLLECTIONS.bookings,
          "client_id",
          uid,
        ),

        getRows(
          COLLECTIONS.notifications,
          "user_id",
          uid,
        ),
      ]);

      requests.sort(
        (a, b) =>
          timestampValue(b["created_at"]) -
          timestampValue(a["created_at"]),
      );

      properties.sort(
        (a, b) =>
          timestampValue(b["created_at"]) -
          timestampValue(a["created_at"]),
      );

      jobs.sort(
        (a, b) =>
          timestampValue(b["created_at"]) -
          timestampValue(a["created_at"]),
      );

      quotes.sort(
        (a, b) =>
          timestampValue(b["created_at"]) -
          timestampValue(a["created_at"]),
      );

      bookings.sort((a, b) =>
        String(a["scheduled_date"] ?? "").localeCompare(
          String(b["scheduled_date"] ?? ""),
        ),
      );

      notifications.sort(
        (a, b) =>
          timestampValue(b["created_at"]) -
          timestampValue(a["created_at"]),
      );

      return {
        requests,
        properties,
        jobs,
        quotes,
        bookings,
        notifications: notifications.slice(0, 10),
      };
    },
  });

  const decideQuote = useMutation({
    mutationFn: async (input: {
      id: string;
      number: string;
      status: "approved" | "declined";
    }) => {
      await updateDoc(
        doc(
          firestore(),
          COLLECTIONS.quotes,
          input.id,
        ),
        {
          status: input.status,
        },
      );
    },

    onSuccess: async (_res, input) => {
      toast.success(
        input.status === "approved"
          ? `Quote ${input.number} approved — the office has been notified and will schedule the work.`
          : `Quote ${input.number} declined — the office has been notified.`,
      );

      await queryClient.invalidateQueries({
        queryKey: ["client-portal"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    },

    onError: (e: Error) =>
      toast.error(e.message),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(
        doc(
          firestore(),
          COLLECTIONS.notifications,
          id,
        ),
        {
          read: true,
        },
      );
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["client-portal"],
      });
    },

    onError: (e: Error) =>
      toast.error(e.message),
  });

  if (loading || data.isLoading) {
    return (
      <PortalShell
        title="My portal"
        subtitle="Loading your quotes and requests…"
      >
        <Loader2
          className="mx-auto size-6 animate-spin text-accent"
          aria-label="Loading"
        />
      </PortalShell>
    );
  }

  if (data.isError) {
    return (
      <PortalShell
        title="My portal"
        subtitle="We couldn't load your portal."
      >
        <p className="text-destructive">
          {data.error instanceof Error
            ? data.error.message
            : String(data.error)}
        </p>
      </PortalShell>
    );
  }

  const rows = data.data!;

  const jobsById = new Map(
    rows.jobs.map((job) => [
      job.id,
      job,
    ]),
  );

  const requestsById = new Map(
    rows.requests.map((request) => [
      request.id,
      request,
    ]),
  );

  const waiting = rows.quotes.filter(
    (quote) => quote["status"] === "sent",
  ).length;

  const unread = rows.notifications.filter(
    (notification) =>
      !notification["read"],
  ).length;

  return (
    <PortalShell
      title="My portal"
      subtitle={
        waiting > 0
          ? `${waiting} quote${waiting === 1 ? "" : "s"} waiting on your approval.`
          : "Quotes, jobs, requests and notifications in one place."
      }
    >
      {/* Quotes */}
      <section aria-labelledby="quotes-heading">
        <h2
          id="quotes-heading"
          className="text-display text-3xl uppercase text-foreground"
        >
          My quotes
        </h2>

        {rows.quotes.length === 0 ? (
          <div className="mt-4">
            <Empty>
              No quotes yet. Once the office prices your request it appears here
              to approve.
            </Empty>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {rows.quotes.map((quote) => {
              const jobId = String(
                quote["job_id"] ?? "",
              );

              const requestId = String(
                quote["service_request_id"] ?? "",
              );

              const job = jobId
                ? jobsById.get(jobId)
                : undefined;

              const request = requestId
                ? requestsById.get(requestId)
                : undefined;

              const serviceTypes = Array.isArray(
                request?.["service_types"],
              )
                ? request["service_types"]
                : [];

              const title =
                String(job?.["title"] ?? "") ||
                (serviceTypes.length > 0
                  ? serviceTypes
                    .map((type) =>
                      prettyStatus(String(type)),
                    )
                    .join(", ")
                  : "Renovation quote");

              const lines = quoteLines(
                quote["line_items"],
              );

              const status = String(
                quote["status"] ?? "",
              );

              const quoteNumber = String(
                quote["quote_number"] ?? "",
              );

              const canDecide =
                status === "sent";

              return (
                <li
                  key={quote.id}
                  className={`rounded-sm border border-border border-l-4 bg-card p-6 ${STATUS_BORDER_LEFT[
                    statusTone(status)
                    ]
                    }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {quoteNumber}

                        {job
                          ? ` · ${String(
                            job["reference"] ?? "",
                          )}`
                          : ""}

                        {quote["valid_until"]
                          ? ` · valid to ${shortDate(
                            quote[
                            "valid_until"
                            ],
                          )}`
                          : ""}
                      </p>

                      <h3 className="font-display mt-1 text-3xl font-bold uppercase leading-tight text-foreground">
                        {title}
                      </h3>
                    </div>

                    <StatusBadge
                      status={status}
                    />
                  </div>

                  <dl className="mt-4">
                    {lines.map(
                      (line, index) => (
                        <div
                          key={index}
                          className="flex justify-between gap-4 py-1 text-muted-foreground"
                        >
                          <dt>
                            {lineLabel(line)}
                          </dt>

                          <dd className="shrink-0 font-semibold tabular-nums text-foreground">
                            {money(
                              lineAmount(line),
                            )}
                          </dd>
                        </div>
                      ),
                    )}

                    <div className="mt-2 flex justify-between gap-4 border-t border-divider pt-3 text-muted-foreground">
                      <dt>VAT 15%</dt>

                      <dd className="shrink-0 font-semibold tabular-nums text-foreground">
                        {money(
                          Number(
                            quote["vat"] ?? 0,
                          ),
                        )}
                      </dd>
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-4">
                      <dt className="text-label text-[12px] text-ink-subtle">
                        Total
                      </dt>

                      <dd className="font-display shrink-0 text-[30px] font-bold leading-none tabular-nums text-primary">
                        {money(
                          Number(
                            quote["total"] ?? 0,
                          ),
                        )}
                      </dd>
                    </div>
                  </dl>

                  {canDecide && (
                    <div className="mt-5 flex flex-wrap gap-3 border-t border-divider pt-5">
                      <Button
                        variant="success"
                        size="lg"
                        className="font-display font-bold uppercase tracking-wide"
                        disabled={
                          decideQuote.isPending
                        }
                        onClick={() =>
                          decideQuote.mutate({
                            id: quote.id,
                            number:
                              quoteNumber,
                            status:
                              "approved",
                          })
                        }
                      >
                        Approve quote
                      </Button>

                      <Button
                        variant="outlineBrick"
                        size="lg"
                        className="font-display font-bold uppercase tracking-wide"
                        disabled={
                          decideQuote.isPending
                        }
                        onClick={() =>
                          decideQuote.mutate({
                            id: quote.id,
                            number:
                              quoteNumber,
                            status:
                              "declined",
                          })
                        }
                      >
                        Decline
                      </Button>

                      <Button
                        asChild
                        variant="whatsapp"
                        size="lg"
                        className="font-display font-bold uppercase tracking-wide"
                      >
                        <a
                          href={whatsappLink(
                            `Hi Prop3000, I have a question about quote ${quoteNumber}.`,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Query on WhatsApp
                        </a>
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Notifications */}
      <section
        aria-labelledby="notifications-heading"
        className="mt-10"
      >
        <div className="flex items-end justify-between gap-4">
          <h2
            id="notifications-heading"
            className="text-display text-3xl uppercase text-foreground"
          >
            Notifications
          </h2>

          {unread > 0 && (
            <span className="text-label text-[12px] text-ink-subtle">
              {unread} unread
            </span>
          )}
        </div>

        {rows.notifications.length === 0 ? (
          <div className="mt-4">
            <Empty>
              Nothing yet — we'll ping you when a
              status changes.
            </Empty>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {rows.notifications.map(
              (item) => {
                const isRead =
                  Boolean(item["read"]);

                return (
                  <li
                    key={item.id}
                    className="rounded-sm border border-border bg-card p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p
                          className={
                            isRead
                              ? "font-medium text-muted-foreground"
                              : "font-semibold text-foreground"
                          }
                        >
                          {String(
                            item["title"] ??
                            "Notification",
                          )}
                        </p>

                        {item["body"] && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {String(
                              item["body"],
                            )}
                          </p>
                        )}

                        <p className="mt-2 text-xs text-ink-faint">
                          {shortDate(
                            item["created_at"],
                          )}
                        </p>
                      </div>

                      {!isRead && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            markRead.isPending
                          }
                          onClick={() =>
                            markRead.mutate(
                              item.id,
                            )
                          }
                        >
                          Mark read
                        </Button>
                      )}
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        )}
      </section>

      {/* Renovation jobs */}
      <section
        aria-labelledby="jobs-heading"
        className="mt-10"
      >
        <h2
          id="jobs-heading"
          className="text-display text-3xl uppercase text-foreground"
        >
          My renovation jobs
        </h2>

        {rows.jobs.length === 0 ? (
          <div className="mt-4">
            <Empty>
              No job started yet.
            </Empty>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4">
            {rows.jobs.map((job) => {
              const status = String(
                job["status"] ?? "",
              );

              const progress = Number(
                job["progress"] ?? 0,
              );

              return (
                <li
                  key={job.id}
                  className={`rounded-sm border border-border border-l-4 bg-card p-5 ${STATUS_BORDER_LEFT[
                    statusTone(status)
                    ]
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {String(
                          job["reference"] ?? "",
                        )}
                      </p>

                      <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                        {String(
                          job["title"] ?? "Job",
                        )}
                      </h3>
                    </div>

                    <StatusBadge
                      status={status}
                    />
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {String(
                      job["address"] ?? "",
                    )}{" "}
                    ·{" "}
                    {money(
                      Number(
                        job[
                        "quote_amount"
                        ] ?? 0,
                      ),
                    )}
                  </p>

                  <div className="mt-4">
                    <div className="flex justify-between text-label text-[12px] text-ink-subtle">
                      <span>Progress</span>
                      <span>
                        {progress}%
                      </span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-sm bg-secondary">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Cash-sale submissions */}
      <section
        aria-labelledby="properties-heading"
        className="mt-10"
      >
        <h2
          id="properties-heading"
          className="text-display text-3xl uppercase text-foreground"
        >
          My cash-sale submissions
        </h2>

        {rows.properties.length === 0 ? (
          <div className="mt-4">
            <Empty>
              No property submitted for a cash offer
              yet.
            </Empty>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4">
            {rows.properties.map(
              (property) => {
                const reference = String(
                  property["reference"] ?? "",
                );

                const status = String(
                  property["status"] ?? "",
                );

                const offerAmount =
                  Number(
                    property[
                    "offer_amount"
                    ] ?? 0,
                  );

                return (
                  <li
                    key={property.id}
                    className="rounded-sm border border-border bg-card p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-label text-[12px] text-ink-subtle">
                          {reference}
                        </p>

                        <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                          {String(
                            property[
                            "address"
                            ] ??
                            "Property",
                          )}
                        </h3>
                      </div>

                      <StatusBadge
                        status={status}
                      />
                    </div>

                    <p className="mt-2 text-sm text-muted-foreground">
                      {prettyStatus(
                        String(
                          property[
                          "condition"
                          ] ?? "",
                        ),
                      )}

                      {offerAmount > 0 &&
                        ` · our offer ${money(
                          offerAmount,
                        )}`}
                    </p>

                    {offerAmount > 0 && (
                      <Button
                        asChild
                        size="sm"
                        variant="brick"
                        className="mt-4"
                      >
                        <a
                          href={whatsappLink(
                            `Hi Prop3000, I'd like to discuss the cash offer on ${reference}.`,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Respond to the offer
                        </a>
                      </Button>
                    )}
                  </li>
                );
              },
            )}
          </ul>
        )}
      </section>

      {/* Leah's combined request / booking cards */}
      <section
        aria-labelledby="requests-heading"
        className="mt-10"
      >
        <h2
          id="requests-heading"
          className="text-display text-3xl uppercase text-foreground"
        >
          My requests &amp; bookings
        </h2>

        {rows.requests.length === 0 &&
          rows.bookings.length === 0 ? (
          <div className="mt-4">
            <Empty>
              No requests or bookings yet.
            </Empty>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4">
            {rows.requests.map(
              (request) => {
                const serviceTypes =
                  Array.isArray(
                    request[
                    "service_types"
                    ],
                  )
                    ? request[
                    "service_types"
                    ]
                    : [];

                return (
                  <li
                    key={`request-${request.id}`}
                    className="rounded-sm border border-border bg-card p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {String(
                          request[
                          "reference"
                          ] ?? "",
                        )}{" "}
                        ·{" "}
                        {shortDate(
                          request[
                          "created_at"
                          ],
                        )}
                      </p>

                      <StatusBadge
                        status={String(
                          request[
                          "status"
                          ] ?? "",
                        )}
                      />
                    </div>

                    <h3 className="font-display mt-2 text-2xl font-bold uppercase leading-tight text-foreground">
                      {serviceTypes.length >
                        0
                        ? serviceTypes
                          .map((type) =>
                            prettyStatus(
                              String(type),
                            ),
                          )
                          .join(", ")
                        : "Renovation request"}
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {String(
                        request[
                        "address"
                        ] ?? "",
                      )}
                    </p>
                  </li>
                );
              },
            )}

            {rows.bookings.map(
              (booking) => (
                <li
                  key={`booking-${booking.id}`}
                  className="rounded-sm border border-border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-label text-[12px] text-ink-subtle">
                      {shortDate(
                        booking[
                        "scheduled_date"
                        ],
                      )}{" "}
                      ·{" "}
                      {String(
                        booking[
                        "scheduled_time"
                        ] ?? "",
                      ).slice(0, 5)}
                    </p>

                    <StatusBadge
                      status={String(
                        booking[
                        "status"
                        ] ?? "",
                      )}
                    />
                  </div>

                  <h3 className="font-display mt-2 text-2xl font-bold uppercase leading-tight text-foreground">
                    {prettyStatus(
                      String(
                        booking[
                        "booking_type"
                        ] ?? "",
                      ),
                    )}
                  </h3>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}