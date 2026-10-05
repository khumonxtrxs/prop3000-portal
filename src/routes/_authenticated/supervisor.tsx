import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Empty, PortalShell } from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { PhotoUpload } from "@/components/PhotoUpload";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import { firestore } from "@/integrations/firebase/client";
import {
  COLLECTIONS,
  SUBCOLLECTIONS,
} from "@/integrations/firebase/config";

import { countBy } from "@/lib/portal";
import {
  JOB_STATUSES,
  money,
  prettyStatus,
  shortDate,
} from "@/lib/prop3000";

import {
  statusTone,
  type StatusTone,
} from "@/lib/status";

export const Route = createFileRoute("/_authenticated/supervisor")({
  head: () => ({
    meta: [
      { title: "Site Supervisor Board — Prop3000 Portal" },
      {
        name: "description",
        content: "Foreman workspace: update job status, push progress milestones and upload site photos from the phone.",
      },
      { property: "og:title", content: "Prop3000 site supervisor board" },
      { property: "og:description", content: "Update job progress and upload site photos without a phone call." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupervisorDashboard,
});

type FirestoreRow = DocumentData & {
  id: string;
};

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

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

const JOB_ACTIONS = [
  "approved",
  "in_progress",
  "on_hold",
  "complete",
] as const;

const BORDER_TOP: Record<StatusTone, string> = {
  wait: "border-t-status-wait-foreground",
  motion: "border-t-status-motion-foreground",
  good: "border-t-status-good-foreground",
  bad: "border-t-status-bad-foreground",
  neutral: "border-t-status-neutral-foreground",
};

function SupervisorDashboard() {
  const { user, isStaff, isOffice, loading } = useAuth();
  const queryClient = useQueryClient();

  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [progressDraft, setProgressDraft] = useState<Record<string, number>>({});
  const jobs = useQuery({
    queryKey: [
      "supervisor-jobs",
      user?.uid,
      isOffice,
    ],

    enabled: !!user?.uid && isStaff,

    queryFn: async () => {
      const db = firestore();

      const jobsQuery = isOffice
        ? collection(db, COLLECTIONS.jobs)
        : query(
          collection(
            db,
            COLLECTIONS.jobs,
          ),
          where(
            "supervisor_id",
            "==",
            user!.uid,
          ),
        );

      const snapshot =
        await getDocs(jobsQuery);

      const rows = snapshot.docs.map(
        (jobDoc) => ({
          id: jobDoc.id,
          ...jobDoc.data(),
        }),
      ) as FirestoreRow[];

      rows.sort(
        (a, b) =>
          timestampValue(
            b["created_at"],
          ) -
          timestampValue(
            a["created_at"],
          ),
      );

      return rows;
    },
  });

  const history = useQuery({
    queryKey: [
      "supervisor-history",
      jobs.data?.map((job) => job.id).join(","),
    ],

    enabled: isStaff && !!jobs.data,

    queryFn: async () => {
      const allRows = await Promise.all(
        (jobs.data ?? []).map(async (job) => {
          const snapshot = await getDocs(
            collection(
              firestore(),
              COLLECTIONS.jobs,
              job.id,
              SUBCOLLECTIONS.jobStatusHistory,
            ),
          );

          return snapshot.docs.map((historyDoc) => ({
            id: historyDoc.id,
            job_id: job.id,
            ...historyDoc.data(),
          })) as FirestoreRow[];
        }),
      );

      return allRows
        .flat()
        .sort(
          (a, b) =>
            timestampValue(b["created_at"]) -
            timestampValue(a["created_at"]),
        )
        .slice(0, 15);
    },
  });

  const bookings = useQuery({
    queryKey: [
      "supervisor-bookings",
      user?.uid,
    ],

    enabled: !!user?.uid && isStaff,

    queryFn: async () => {
      const snapshot = await getDocs(
        query(
          collection(
            firestore(),
            COLLECTIONS.bookings,
          ),
          where(
            "assigned_to",
            "==",
            user!.uid,
          ),
        ),
      );

      const rows = snapshot.docs.map(
        (bookingDoc) => ({
          id: bookingDoc.id,
          ...bookingDoc.data(),
        }),
      ) as FirestoreRow[];

      rows.sort((a, b) =>
        String(
          a["scheduled_date"] ?? "",
        ).localeCompare(
          String(
            b["scheduled_date"] ?? "",
          ),
        ),
      );

      return rows;
    },
  });

  const update = useMutation({
    mutationFn: async (input: {
      id: string;
      status?: string;
      progress?: number;
      note?: string;
    }) => {
      const patch: {
        status?: string;
        progress?: number;
        completed_at?:
        | ReturnType<typeof serverTimestamp>
        | null;
      } = {};

      if (input.status) {
        patch.status = input.status;

        patch.completed_at =
          input.status === "complete"
            ? serverTimestamp()
            : null;
      }

      if (input.progress !== undefined) {
        patch.progress = input.progress;
      }

      if (Object.keys(patch).length > 0) {
        await updateDoc(
          doc(
            firestore(),
            COLLECTIONS.jobs,
            input.id,
          ),
          patch,
        );
      }

      if (
        input.status ||
        input.note?.trim()
      ) {
        const historyRef = doc(
          collection(
            firestore(),
            COLLECTIONS.jobs,
            input.id,
            SUBCOLLECTIONS.jobStatusHistory,
          ),
        );

        await setDoc(historyRef, {
          status:
            input.status ?? "note",
          note:
            input.note?.trim() ||
            null,
          changed_by: user!.uid,
          created_at:
            serverTimestamp(),
        });
      }
    },

    onSuccess: async () => {
      toast.success(
        "Job updated — the office and client can see it now.",
      );

      setNoteFor(null);
      setNote("");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "supervisor-jobs",
          ],
        }),

        queryClient.invalidateQueries({
          queryKey: [
            "supervisor-history",
          ],
        }),
      ]);
    },

    onError: (e: Error) =>
      toast.error(e.message),
  });

  const savePhotos = useMutation({
    mutationFn: async (input: {
      jobId: string;
      paths: string[];
    }) => {
      await Promise.all(
        input.paths.map(async (path) => {
          const photoRef = doc(
            collection(
              firestore(),
              COLLECTIONS.jobs,
              input.jobId,
              SUBCOLLECTIONS.jobPhotos,
            ),
          );

          await setDoc(photoRef, {
            storage_path: path,
            stage: "progress",
            uploaded_by: user!.uid,
            created_at: serverTimestamp(),
          });
        }),
      );
    },

    onSuccess: () =>
      toast.success("Site photos attached to the job."),

    onError: (e: Error) =>
      toast.error(e.message),
  });

  if (loading || (isStaff && jobs.isLoading)) {
    return (
      <PortalShell title="My jobs" subtitle="Loading your jobs…">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" aria-label="Loading" />
      </PortalShell>
    );
  }

  if (!isStaff) {
    return (
      <PortalShell title="Supervisors only" subtitle="This board is for site supervisors and office staff.">
        <Empty>Ask an admin to grant you the supervisor role.</Empty>
      </PortalShell>
    );
  }

  if (jobs.isError || bookings.isError || history.isError) {
    const error =
      jobs.error ??
      bookings.error ??
      history.error;

    return (
      <PortalShell
        badge="Site"
        title="Supervisor board"
        subtitle="We couldn't load the supervisor board."
      >
        <p className="text-destructive">
          {error instanceof Error
            ? error.message
            : String(error)}
        </p>
      </PortalShell>
    );
  }

  const rows = jobs.data ?? [];
  const active = rows.filter(
    (job) => job["status"] === "in_progress",
  ).length;

  const done = rows.filter(
    (job) => job["status"] === "complete",
  ).length;

  const avgProgress = rows.length
    ? Math.round(
      rows.reduce(
        (sum, job) =>
          sum + Number(job["progress"] ?? 0),
        0,
      ) / rows.length,
    )
    : 0;

  return (
    <PortalShell
      title="My jobs"
      subtitle={`${active} job${active === 1 ? "" : "s"} in progress · ${rows.length
        } assigned to you. Update status, progress and photos.`}
    >
      {rows.length === 0 ? (
        <Empty>
          No jobs assigned to you yet. The office assigns jobs when a lead is
          converted.
        </Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-5">
          {rows.map((job) => {
            const currentProgress = Number(job["progress"] ?? 0);

            const progress =
              progressDraft[job.id] ?? currentProgress;

            const jobHistory = (history.data ?? []).filter(
              (entry) => entry["job_id"] === job.id,
            );

            const commitProgress = () => {
              if (progress !== currentProgress) {
                update.mutate({
                  id: job.id,
                  progress,
                });
              }
            };

            return (
              <li
                key={job.id}
                className={`rounded-sm border border-border border-t-4 bg-card p-6 ${BORDER_TOP[
                  statusTone(
                    String(job["status"] ?? ""),
                  )
                ]
                  }`}
              >
                {/* Job heading */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-label text-[12px] text-ink-subtle">
                      {String(job["reference"] ?? "")}
                      {" · "}
                      {String(job["client_name"] ?? "")}
                    </p>

                    <h2 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                      {String(job["title"] ?? "Job")}
                    </h2>

                    <p className="mt-1 text-muted-foreground">
                      {String(job["address"] ?? "")}
                    </p>
                  </div>

                  <StatusBadge
                    status={String(job["status"] ?? "")}
                  />
                </div>

                {/* Quote */}
                <div className="mt-5 flex items-end justify-between gap-3">
                  <span className="text-label text-[12px] text-ink-subtle">
                    Quote
                  </span>

                  <span className="font-display text-3xl font-bold leading-none text-primary">
                    {money(
                      Number(
                        job["quote_amount"] ?? 0,
                      ),
                    )}
                  </span>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`progress-${job.id}`}
                      className="text-label text-[12px] text-ink-subtle"
                    >
                      Progress
                    </label>

                    <span className="text-label text-[12px] text-ink-subtle">
                      {progress}%
                    </span>
                  </div>

                  <div
                    className="mt-2 h-2 overflow-hidden rounded-sm bg-secondary"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full bg-accent transition-all"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <input
                    id={`progress-${job.id}`}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progress}
                    className="mt-3 w-full accent-accent"
                    onChange={(e) =>
                      setProgressDraft(
                        (current) => ({
                          ...current,
                          [job.id]: Number(
                            e.target.value,
                          ),
                        }),
                      )
                    }
                    onPointerUp={commitProgress}
                    onKeyUp={commitProgress}
                  />
                </div>

                {/* Job status actions */}
                <div
                  className="mt-4 flex flex-wrap gap-2"
                  role="group"
                  aria-label={`Status for ${String(
                    job["reference"] ?? "",
                  )}`}
                >
                  {JOB_ACTIONS.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={
                        job["status"] === status
                          ? "default"
                          : "outline"
                      }
                      aria-pressed={
                        job["status"] === status
                      }
                      className="font-display font-bold uppercase tracking-wide"
                      disabled={
                        update.isPending ||
                        job["status"] === status
                      }
                      onClick={() =>
                        update.mutate({
                          id: job.id,
                          status,
                        })
                      }
                    >
                      {prettyStatus(status)}
                    </Button>
                  ))}
                </div>

                {/* Firebase photo upload */}
                <div className="mt-5 rounded-sm border border-dashed border-border p-4">
                  <p className="text-label text-[12px] text-ink-subtle">
                    Site photos
                  </p>

                  <div className="mt-3">
                    <PhotoUpload
                      bucket="job-photos"
                      prefix={job.id}
                      paths={[]}
                      label="Upload progress photos"
                      hint="Compressed on your phone first — works on weak site signal."
                      onChange={(paths) => {
                        if (paths.length > 0) {
                          savePhotos.mutate({
                            jobId: job.id,
                            paths,
                          });
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Site note */}
                {noteFor !== job.id ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-4 font-display font-bold uppercase tracking-wide"
                    onClick={() => {
                      setNote("");
                      setNoteFor(job.id);
                    }}
                  >
                    Add site note
                  </Button>
                ) : (
                  <form
                    className="mt-4 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();

                      if (!note.trim()) {
                        return;
                      }

                      update.mutate({
                        id: job.id,
                        note: note.trim(),
                      });
                    }}
                  >
                    <Input
                      aria-label={`Site note for ${String(
                        job["reference"] ?? "",
                      )}`}
                      className="h-11"
                      maxLength={500}
                      placeholder="Site note for the history…"
                      value={note}
                      onChange={(e) =>
                        setNote(e.target.value)
                      }
                    />

                    <Button
                      type="submit"
                      className="font-display h-11 font-bold uppercase tracking-wide"
                      disabled={
                        update.isPending ||
                        !note.trim()
                      }
                    >
                      Log
                    </Button>
                  </form>
                )}

                {/* Firebase status history */}
                {jobHistory.length > 0 && (
                  <div className="mt-4 border-t border-divider pt-4">
                    <h3 className="text-label text-[12px] text-ink-subtle">
                      Status history
                    </h3>

                    <ol className="mt-2 space-y-1.5">
                      {jobHistory.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex justify-between gap-3 text-sm"
                        >
                          <span>
                            <span className="font-semibold text-primary">
                              {prettyStatus(
                                String(
                                  entry["status"] ??
                                  "",
                                ),
                              )}
                            </span>

                            {entry["note"] && (
                              <span className="ml-3 text-muted-foreground">
                                {String(
                                  entry["note"],
                                )}
                              </span>
                            )}
                          </span>

                          <span className="shrink-0 text-ink-faint">
                            {shortDate(
                              entry["created_at"],
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PortalShell>
  );
}