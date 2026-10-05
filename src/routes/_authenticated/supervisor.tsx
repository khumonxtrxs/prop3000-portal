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
import { supabase } from "@/integrations/supabase/client";
import { money, prettyStatus, shortDate } from "@/lib/prop3000";
import { statusTone, type StatusTone } from "@/lib/status";

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

const JOB_ACTIONS = ["approved", "in_progress", "on_hold", "complete"] as const;

/** 4px status-coloured top border for job cards (S7). */
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
  const [progressDraft, setProgressDraft] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const jobs = useQuery({
    queryKey: ["jobs", "supervisor", user?.id, isOffice],
    enabled: !!user?.id && isStaff,
    queryFn: async () => {
      let query = supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (!isOffice) query = query.eq("supervisor_id", user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const jobIds = (jobs.data ?? []).map((job) => job.id);

  const history = useQuery({
    queryKey: ["job-history", jobIds.join(",")],
    enabled: jobIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_status_history")
        .select("id, job_id, status, note, created_at")
        .in("job_id", jobIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const photos = useQuery({
    queryKey: ["job-photos", jobIds.join(",")],
    enabled: jobIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("job_photos").select("id, job_id, storage_path").in("job_id", jobIds);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];
      // Private bucket: short-lived signed URLs, never public links.
      const { data: signed } = await supabase.storage
        .from("job-photos")
        .createSignedUrls(
          rows.map((row) => row.storage_path),
          3600,
        );
      return rows.map((row, index) => ({ ...row, url: signed?.[index]?.signedUrl ?? null }));
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    await queryClient.invalidateQueries({ queryKey: ["job-history"] });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const setStatus = useMutation({
    mutationFn: async (input: { id: string; reference: string; status: string }) => {
      const { error } = await supabase
        .from("jobs")
        .update({
          status: input.status,
          completed_at: input.status === "complete" ? new Date().toISOString() : null,
        })
        .eq("id", input.id);
      if (error) throw error;
      const { error: historyError } = await supabase
        .from("job_status_history")
        .insert({ job_id: input.id, status: input.status, note: null, changed_by: user!.id });
      if (historyError) throw historyError;
    },
    onSuccess: async (_res, input) => {
      toast.success(`Job ${input.reference} marked ${prettyStatus(input.status).toLowerCase()} — office and client can see it.`);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setProgress = useMutation({
    mutationFn: async (input: { id: string; reference: string; progress: number }) => {
      const { error } = await supabase.from("jobs").update({ progress: input.progress }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: async (_res, input) => {
      toast.success(`Job ${input.reference} at ${input.progress}% — office and client can see it.`);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logNote = useMutation({
    mutationFn: async (input: { id: string; reference: string; status: string; note: string }) => {
      const { error } = await supabase
        .from("job_status_history")
        .insert({ job_id: input.id, status: input.status, note: input.note, changed_by: user!.id });
      if (error) throw error;
    },
    onSuccess: async (_res, input) => {
      toast.success(`Site note logged on ${input.reference}.`);
      setNotes((current) => ({ ...current, [input.id]: "" }));
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadPhoto = useMutation({
    mutationFn: async (input: { id: string; reference: string; file: File }) => {
      const extension = input.file.name.split(".").pop() ?? "jpg";
      const path = `${input.id}/${Date.now()}.${extension}`;
      const { error } = await supabase.storage
        .from("job-photos")
        .upload(path, input.file, { contentType: input.file.type });
      if (error) throw error;
      const { error: rowError } = await supabase
        .from("job_photos")
        .insert({ job_id: input.id, storage_path: path, stage: "progress", uploaded_by: user!.id });
      if (rowError) throw rowError;
    },
    onSuccess: async (_res, input) => {
      toast.success(`Photo added to ${input.reference}.`);
      await queryClient.invalidateQueries({ queryKey: ["job-photos"] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  const rows = jobs.data ?? [];
  const active = rows.filter((job) => job.status === "in_progress").length;

  return (
    <PortalShell
      title="My jobs"
      subtitle={`${active} job${active === 1 ? "" : "s"} in progress · ${rows.length} assigned to you. Update status, progress and photos.`}
    >
      {rows.length === 0 ? (
        <Empty>No jobs assigned to you yet. The office assigns jobs when a lead is converted.</Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-5">
          {rows.map((job) => {
            const progress = progressDraft[job.id] ?? job.progress;
            const jobPhotos = (photos.data ?? []).filter((photo) => photo.job_id === job.id);
            const jobHistory = (history.data ?? []).filter((entry) => entry.job_id === job.id);
            const note = notes[job.id] ?? "";
            const commitProgress = () => {
              if (progress !== job.progress) setProgress.mutate({ id: job.id, reference: job.reference, progress });
            };

            return (
              <li
                key={job.id}
                className={`rounded-sm border border-border border-t-4 bg-card p-6 ${BORDER_TOP[statusTone(job.status)]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-label text-[12px] text-ink-subtle">
                      {job.reference} · {job.client_name}
                    </p>
                    <h2 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                      {job.title}
                    </h2>
                    <p className="mt-1 text-muted-foreground">{job.address}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <span className="text-label text-[12px] text-ink-subtle">Quote</span>
                  <span className="font-display text-3xl font-bold leading-none text-primary">
                    {money(job.quote_amount)}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor={`progress-${job.id}`} className="text-label text-[12px] text-ink-subtle">
                      Progress
                    </label>
                    <span className="text-label text-[12px] text-ink-subtle">{progress}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-sm bg-secondary" aria-hidden="true">
                    <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <input
                    id={`progress-${job.id}`}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progress}
                    className="mt-3 w-full accent-accent"
                    onChange={(e) => setProgressDraft((current) => ({ ...current, [job.id]: Number(e.target.value) }))}
                    onPointerUp={commitProgress}
                    onKeyUp={commitProgress}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={`Status for ${job.reference}`}>
                  {JOB_ACTIONS.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={job.status === status ? "default" : "outline"}
                      aria-pressed={job.status === status}
                      className="font-display font-bold uppercase tracking-wide"
                      disabled={setStatus.isPending || job.status === status}
                      onClick={() => setStatus.mutate({ id: job.id, reference: job.reference, status })}
                    >
                      {prettyStatus(status)}
                    </Button>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {jobPhotos.map((photo, index) =>
                    photo.url ? (
                      <img
                        key={photo.id}
                        src={photo.url}
                        alt={`Site photo ${index + 1} for ${job.reference}`}
                        className="aspect-square w-full rounded-sm object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div key={photo.id} className="hatch-fill aspect-square rounded-sm" aria-hidden="true" />
                    ),
                  )}
                  <label className="flex aspect-square cursor-pointer items-center justify-center rounded-sm border border-dashed border-border text-2xl text-ink-subtle hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
                    {uploadPhoto.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <span aria-hidden="true">+</span>}
                    <span className="sr-only">Upload a site photo for {job.reference}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      disabled={uploadPhoto.isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadPhoto.mutate({ id: job.id, reference: job.reference, file });
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!note.trim()) return;
                    logNote.mutate({ id: job.id, reference: job.reference, status: job.status, note: note.trim() });
                  }}
                >
                  <Input
                    aria-label={`Site note for ${job.reference}`}
                    className="h-11"
                    maxLength={500}
                    placeholder="Site note for the history…"
                    value={note}
                    onChange={(e) => setNotes((current) => ({ ...current, [job.id]: e.target.value }))}
                  />
                  <Button
                    type="submit"
                    className="font-display h-11 font-bold uppercase tracking-wide"
                    disabled={logNote.isPending || !note.trim()}
                  >
                    Log
                  </Button>
                </form>

                {jobHistory.length > 0 && (
                  <div className="mt-4 border-t border-divider pt-4">
                    <h3 className="text-label text-[12px] text-ink-subtle">Status history</h3>
                    <ol className="mt-2 space-y-1.5">
                      {jobHistory.map((entry) => (
                        <li key={entry.id} className="flex justify-between gap-3 text-sm">
                          <span>
                            <span className="font-semibold text-primary">{prettyStatus(entry.status)}</span>
                            {entry.note && <span className="ml-3 text-muted-foreground">{entry.note}</span>}
                          </span>
                          <span className="shrink-0 text-ink-faint">{shortDate(entry.created_at)}</span>
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