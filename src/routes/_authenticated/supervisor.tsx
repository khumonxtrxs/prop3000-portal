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
import { supabase } from "@/integrations/supabase/client";
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

function SupervisorDashboard() {
  const { user, isStaff, isOffice, loading } = useAuth();
  const queryClient = useQueryClient();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const jobs = useQuery({
    queryKey: ["supervisor-jobs", user?.uid, isOffice],
    enabled: !!user?.uid && isStaff,
    queryFn: async () => {
      let query = supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (!isOffice) query = query.eq("supervisor_id", user!.uid);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const history = useQuery({
    queryKey: ["supervisor-history"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_status_history")
        .select("id, job_id, status, note, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });

  const bookings = useQuery({
    queryKey: ["supervisor-bookings", user?.uid],
    enabled: !!user?.uid && isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_type, full_name, address, scheduled_date, scheduled_time, status")
        .eq("assigned_to", user!.uid)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; status?: string; progress?: number; note?: string }) => {
      const patch: { status?: string; progress?: number; completed_at?: string | null } = {};
      if (input.status) {
        patch.status = input.status;
        patch.completed_at = input.status === "complete" ? new Date().toISOString() : null;
      }
      if (input.progress !== undefined) patch.progress = input.progress;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("jobs").update(patch).eq("id", input.id);
        if (error) throw error;
      }
      if (input.status || input.note?.trim()) {
        const { error } = await supabase.from("job_status_history").insert({
          job_id: input.id,
          status: input.status ?? "note",
          note: input.note?.trim() || null,
          changed_by: user!.uid,
        });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Job updated — the office and client can see it now.");
      setNoteFor(null);
      setNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["supervisor-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["supervisor-history"] }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePhotos = useMutation({
    mutationFn: async (input: { jobId: string; paths: string[] }) => {
      const rows = input.paths.map((path) => ({
        job_id: input.jobId,
        storage_path: path,
        stage: "progress",
        uploaded_by: user!.uid,
      }));
      const { error } = await supabase.from("job_photos").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Site photos attached to the job."),
    onError: (e: Error) => toast.error(e.message),
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

  const rows = jobs.data ?? [];
  const active = rows.filter((j) => j.status === "in_progress").length;
  const done = rows.filter((j) => j.status === "complete").length;
  const avgProgress = rows.length ? Math.round(rows.reduce((s, j) => s + j.progress, 0) / rows.length) : 0;

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
          <CountBars data={countBy(rows, (j) => j.status)} label="Jobs" />
        </Panel>
        <Panel title="Site visits assigned to me">
          {(bookings.data ?? []).length === 0 ? (
            <Empty>No site visits booked for you yet.</Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(bookings.data ?? []).map((booking) => (
                <li key={booking.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{prettyStatus(booking.booking_type)}</p>
                    <p className="text-muted-foreground">
                      {booking.full_name} · {booking.address ?? "no address"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {shortDate(booking.scheduled_date)} · {booking.scheduled_time.slice(0, 5)}
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
            <Panel key={job.id} title={job.title} action={<StatusPill status={job.status} />}>
              <p className="text-sm text-muted-foreground">
                {job.address} · {job.client_name} · {job.reference} · {money(job.quote_amount)}
              </p>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <span>Progress</span>
                  <span>{job.progress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  defaultValue={job.progress}
                  className="mt-2 w-full accent-accent"
                  aria-label={`Progress for ${job.title}`}
                  onMouseUp={(e) => update.mutate({ id: job.id, progress: Number(e.currentTarget.value) })}
                  onTouchEnd={(e) => update.mutate({ id: job.id, progress: Number(e.currentTarget.value) })}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {JOB_STATUSES.map((status) => (
                  <Button
                    key={status.value}
                    size="sm"
                    variant={job.status === status.value ? "accent" : "outline"}
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
                    <p className="font-semibold">{prettyStatus(entry.status)}</p>
                    {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{shortDate(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PortalShell>
  );
}
