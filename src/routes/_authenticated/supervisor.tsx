import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, HardHat, Images, Loader2 } from "lucide-react";
import { CountBars } from "@/components/portal/Charts";
import { Empty, Panel, PortalShell, StatCard, StatusPill } from "@/components/portal/PortalShell";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
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
import { COLLECTIONS, SUBCOLLECTIONS } from "@/integrations/firebase/config";
import { countBy } from "@/lib/portal";
import { JOB_STATUSES, money, prettyStatus, shortDate } from "@/lib/prop3000";

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

// Firestore Helper
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

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function SupervisorDashboard() {
  const { user, isStaff, isOffice, loading } = useAuth();
  const queryClient = useQueryClient();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const jobs = useQuery({
    queryKey: ["supervisor-jobs", user?.uid, isOffice],
    enabled: !!user?.uid && isStaff,

    queryFn: async () => {
      const db = firestore();

      const jobsQuery = isOffice
        ? collection(db, COLLECTIONS.jobs)
        : query(
          collection(db, COLLECTIONS.jobs),
          where("supervisor_id", "==", user!.uid),
        );

      const snapshot = await getDocs(jobsQuery);

      const rows = snapshot.docs.map((jobDoc) => ({
        id: jobDoc.id,
        ...jobDoc.data(),
      })) as FirestoreRow[];

      rows.sort(
        (a, b) =>
          timestampValue(b["created_at"]) -
          timestampValue(a["created_at"]),
      );

      return rows;
    },
  });

  const history = useQuery({
    queryKey: ["supervisor-history", jobs.data?.map((job) => job.id).join(",")],
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
    queryKey: ["supervisor-bookings", user?.uid],
    enabled: !!user?.uid && isStaff,

    queryFn: async () => {
      const snapshot = await getDocs(
        query(
          collection(firestore(), COLLECTIONS.bookings),
          where("assigned_to", "==", user!.uid),
        ),
      );

      const rows = snapshot.docs.map((bookingDoc) => ({
        id: bookingDoc.id,
        ...bookingDoc.data(),
      })) as FirestoreRow[];

      rows.sort((a, b) =>
        String(a["scheduled_date"] ?? "").localeCompare(
          String(b["scheduled_date"] ?? ""),
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
        completed_at?: ReturnType<typeof serverTimestamp> | null;
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

      if (input.status || input.note?.trim()) {
        const historyRef = doc(
          collection(
            firestore(),
            COLLECTIONS.jobs,
            input.id,
            SUBCOLLECTIONS.jobStatusHistory,
          ),
        );

        await setDoc(historyRef, {
          status: input.status ?? "note",
          note: input.note?.trim() || null,
          changed_by: user!.uid,
          created_at: serverTimestamp(),
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
          queryKey: ["supervisor-jobs"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["supervisor-history"],
        }),
      ]);
    },

    onError: (e: Error) => toast.error(e.message),
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

  if (loading || jobs.isLoading) {
    return (
      <PortalShell badge="Site" title="Supervisor board" subtitle="Loading your jobs…">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" />
      </PortalShell>
    );
  }

  if (!isStaff) {
    return (
      <PortalShell badge="Site" title="Supervisors only" subtitle="This board is for site supervisors and office staff.">
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
  const active = rows.filter((j) => j["status"] === "in_progress").length;
  const done = rows.filter((j) => j["status"] === "complete").length;
  const avgProgress = rows.length ? Math.round(rows.reduce((s, j) => s + j["progress"], 0) / rows.length) : 0;

  return (
    <PortalShell
      badge="Site supervisor / foreman"
      title="Supervisor board"
      subtitle="Your assigned jobs. Move the status, push the progress slider and upload site photos — the office and the client see it instantly."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={HardHat} label="Assigned jobs" value={String(rows.length)} />
        <StatCard icon={Loader2} label="In progress" value={String(active)} />
        <StatCard icon={CheckCircle2} label="Completed" value={String(done)} />
        <StatCard icon={CalendarDays} label="Avg progress" value={`${avgProgress}%`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="My jobs by status">
          <CountBars data={countBy(rows, (j) => j["status"])} label="Jobs" />
        </Panel>
        <Panel title="Site visits assigned to me">
          {(bookings.data ?? []).length === 0 ? (
            <Empty>No site visits booked for you yet.</Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(bookings.data ?? []).map((booking) => (
                <li key={booking.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{prettyStatus(booking["booking_type"])}</p>
                    <p className="text-muted-foreground">
                      {booking["full_name"]} · {booking["address"] ?? "no address"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {shortDate(booking["scheduled_date"])} · {String(booking["scheduled_time"] ?? "").slice(0, 5)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-8 grid gap-6">
        {rows.length === 0 ? (
          <Empty>No jobs assigned to you yet. The office assigns jobs when a lead is converted.</Empty>
        ) : (
          rows.map((job) => (
            <Panel key={job.id} title={job["title"]} action={<StatusPill status={job["status"]} />}>
              <p className="text-sm text-muted-foreground">
                {job["address"]} · {job["client_name"]} · {job["reference"]} · {money(job["quote_amount"])}
              </p>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <span>Progress</span>
                  <span>{job["progress"]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  defaultValue={job["progress"]}
                  className="mt-2 w-full accent-accent"
                  aria-label={`Progress for ${job["title"]}`}
                  onMouseUp={(e) => update.mutate({ id: job.id, progress: Number(e.currentTarget.value) })}
                  onTouchEnd={(e) => update.mutate({ id: job.id, progress: Number(e.currentTarget.value) })}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {JOB_STATUSES.map((status) => (
                  <Button
                    key={status.value}
                    size="sm"
                    variant={job["status"] === status.value ? "accent" : "outline"}
                    disabled={update.isPending}
                    onClick={() => update.mutate({ id: job.id, status: status.value })}
                  >
                    {status.label}
                  </Button>
                ))}
                <Button size="sm" variant="brick" onClick={() => setNoteFor(noteFor === job.id ? null : job.id)}>
                  Add site note
                </Button>
              </div>

              {noteFor === job.id && (
                <div className="mt-3 space-y-2 rounded-lg border border-border bg-secondary/40 p-4">
                  <Textarea
                    rows={2}
                    maxLength={500}
                    placeholder="What happened on site today?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button size="sm" variant="accent" disabled={update.isPending} onClick={() => update.mutate({ id: job.id, note })}>
                    Save note
                  </Button>
                </div>
              )}

              <div className="mt-5 rounded-lg border border-dashed border-border p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Images className="size-4 text-accent" /> Site photos
                </p>
                <div className="mt-3">
                  <PhotoUpload
                    bucket="job-photos"
                    prefix={job.id}
                    paths={[]}
                    label="Upload progress photos"
                    hint="Compressed on your phone first — works on weak site signal."
                    onChange={(paths) => {
                      if (paths.length > 0) savePhotos.mutate({ jobId: job.id, paths });
                    }}
                  />
                </div>
              </div>
            </Panel>
          ))
        )}

        <Panel title="Recent site updates">
          {(history.data ?? []).length === 0 ? (
            <Empty>No status updates logged yet.</Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(history.data ?? []).map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{prettyStatus(entry["status"])}</p>
                    {entry["note"] && <p className="text-muted-foreground">{entry["note"]}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{shortDate(entry["created_at"])}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PortalShell>
  );
}
