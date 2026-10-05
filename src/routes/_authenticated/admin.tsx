import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Empty, PortalShell, StatCard } from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money, prettyStatus, shortDate } from "@/lib/prop3000";
import { STATUS_BORDER_LEFT, statusTone } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Office Lead Desk — Prop3000 Portal" },
      {
        name: "description",
        content: "Admin workspace to triage renovation leads, cash-sale offers, jobs, quotes and bookings for Prop3000.",
      },
      { property: "og:title", content: "Prop3000 office lead desk" },
      { property: "og:description", content: "Triage leads, convert them into jobs and assign site supervisors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

const LEAD_TOGGLES = ["contacted", "quoted", "declined"] as const;
const SELECT_CLASS =
  "h-11 rounded-sm border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Date plus time, e.g. "12 Sep 2026 08:14". Dates still go through shortDate(). */
function when(value: string) {
  const time = new Date(value).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  return `${shortDate(value)} ${time}`;
}

type Draft = { supervisorId: string; amount: string };

function AdminDashboard() {
  const { user, isOffice, loading } = useAuth();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState("");

  const data = useQuery({
    queryKey: ["office-desk"],
    enabled: isOffice,
    queryFn: async () => {
      const [requests, properties, jobs, bookings, quotes] = await Promise.all([
        supabase.from("service_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("property_submissions").select("*").order("created_at", { ascending: false }),
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("bookings").select("*").order("scheduled_date", { ascending: true }),
        supabase.from("quotes").select("*").order("created_at", { ascending: false }),
      ]);
      const firstError = requests.error ?? properties.error ?? jobs.error ?? bookings.error ?? quotes.error;
      if (firstError) throw firstError;
      return {
        requests: requests.data ?? [],
        properties: properties.data ?? [],
        jobs: jobs.data ?? [],
        bookings: bookings.data ?? [],
        quotes: quotes.data ?? [],
      };
    },
  });

  const staff = useQuery({
    queryKey: ["office-staff"],
    enabled: isOffice,
    queryFn: async () => {
      const { data: roleRows, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["supervisor", "admin", "owner"]);
      if (error) throw error;
      const ids = [...new Set((roleRows ?? []).map((r) => r.user_id))];
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name ?? p.email ?? "Team member",
        roles: (roleRows ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["office-desk"] });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const setLeadStatus = useMutation({
    mutationFn: async (input: { id: string; reference: string; status: string }) => {
      const { error } = await supabase.from("service_requests").update({ status: input.status }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: async (_res, input) => {
      toast.success(`Lead ${input.reference} marked ${prettyStatus(input.status).toLowerCase()}.`);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** The four writes from S7: job, lead → converted, first history row, client notification. */
  const convertToJob = useMutation({
    mutationFn: async (input: { leadId: string; supervisorId: string; amount: number | null }) => {
      const source = data.data?.requests.find((r) => r.id === input.leadId);
      if (!source) throw new Error("Lead not found");
      const reference = `JOB-${Date.now().toString().slice(-6)}`;

      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          reference,
          service_request_id: source.id,
          client_id: source.client_id,
          client_name: source.full_name,
          client_phone: source.phone,
          title: `${source.service_types.map(prettyStatus).join(", ")} — ${source.full_name}`,
          description: source.description,
          address: source.address,
          latitude: source.latitude,
          longitude: source.longitude,
          service_types: source.service_types,
          supervisor_id: input.supervisorId || null,
          status: "quoted",
          progress: 0,
          quote_amount: input.amount,
        })
        .select("id, reference")
        .single();
      if (error) throw error;

      const { error: leadError } = await supabase
        .from("service_requests")
        .update({ status: "converted" })
        .eq("id", source.id);
      if (leadError) throw leadError;

      const { error: historyError } = await supabase
        .from("job_status_history")
        .insert({ job_id: job.id, status: "quoted", changed_by: user!.id });
      if (historyError) throw historyError;

      let clientNotified = false;
      if (source.client_id) {
        const { error: notifyError } = await supabase.from("notifications").insert({
          user_id: source.client_id,
          title: `Job ${job.reference} created`,
          body: `Your request ${source.reference} is now a job${input.amount ? `, quoted at ${money(input.amount)}` : ""}.`,
        });
        clientNotified = !notifyError;
      }
      return { reference: job.reference, client: source.full_name, clientNotified };
    },
    onSuccess: async (result, input) => {
      if (result.clientNotified) {
        toast.success(`Job ${result.reference} created — ${result.client} notified.`);
      } else {
        toast.warning(`Job ${result.reference} created, but the client could not be notified in the portal.`);
      }
      setDrafts((current) => {
        const next = { ...current };
        delete next[input.leadId];
        return next;
      });
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPropertyStatus = useMutation({
    mutationFn: async (input: { id: string; reference: string; status: string; offer?: number | null }) => {
      const patch: { status: string; offer_amount?: number | null } = { status: input.status };
      if (input.offer !== undefined) patch.offer_amount = input.offer;
      const { error } = await supabase.from("property_submissions").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: async (_res, input) => {
      toast.success(`${input.reference} marked ${prettyStatus(input.status).toLowerCase()}.`);
      setOfferFor(null);
      setOfferAmount("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBooking = useMutation({
    mutationFn: async (input: { id: string; assigned_to?: string | null; status?: string }) => {
      const patch: { assigned_to?: string | null; status?: string } = {};
      if (input.assigned_to !== undefined) patch.assigned_to = input.assigned_to;
      if (input.status) patch.status = input.status;
      const { error } = await supabase.from("bookings").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: async (_res, input) => {
      toast.success(input.status ? `Booking marked ${input.status}.` : "Booking assigned.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || (isOffice && data.isLoading)) {
    return (
      <PortalShell title="Lead triage" subtitle="Loading the pipeline…">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" aria-label="Loading" />
      </PortalShell>
    );
  }

  if (!isOffice || !data.data) {
    return (
      <PortalShell title="Admins only" subtitle="This desk belongs to office staff and the owner.">
        <Empty>Your account doesn't have office access. Ask an admin to grant it.</Empty>
      </PortalShell>
    );
  }

  const rows = data.data;
  const people = staff.data ?? [];
  const supervisors = people.filter((p) => p.roles.includes("supervisor"));
  const assignable = supervisors.length > 0 ? supervisors : people;
  const defaultSupervisor = assignable[0]?.id ?? "";
  const draftFor = (id: string): Draft => drafts[id] ?? { supervisorId: defaultSupervisor, amount: "" };
  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...draftFor(id), ...patch } }));

  const newLeads = rows.requests.filter((r) => r.status === "new").length;
  const quotesWaiting = rows.quotes.filter((q) => q.status === "sent").length;
  const activeJobs = rows.jobs.filter((j) => j.status === "in_progress" || j.status === "approved").length;
  const toConfirm = rows.bookings.filter((b) => b.status === "requested").length;
  const nameFor = (id: string | null) => people.find((p) => p.id === id)?.name ?? "Unassigned";

  return (
    <PortalShell
      title="Lead triage"
      subtitle={`${newLeads} new service request${newLeads === 1 ? "" : "s"} waiting to be actioned.`}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
        <StatCard tone="accent" label="New leads" value={String(newLeads)} hint="awaiting first contact" />
        <StatCard tone="primary" label="Quoted" value={String(quotesWaiting)} hint="waiting on the client" />
        <StatCard tone="success" label="Active jobs" value={String(activeJobs)} hint="assigned to supervisors" />
        <StatCard tone="brick" label="Bookings to confirm" value={String(toConfirm)} hint="requested, not yet confirmed" />
      </div>

      {/* Lead triage */}
      <section aria-label="Renovation leads" className="mt-8">
        {rows.requests.length === 0 ? (
          <Empty>No renovation requests yet.</Empty>
        ) : (
          <ul className="space-y-4">
            {rows.requests.map((lead) => {
              const draft = draftFor(lead.id);
              const converted = lead.status === "converted";
              return (
                <li
                  key={lead.id}
                  className={`rounded-sm border border-border border-l-4 bg-card p-6 ${STATUS_BORDER_LEFT[statusTone(lead.status)]}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label text-[12px] text-ink-subtle">
                        {lead.reference} · {when(lead.created_at)}
                      </p>
                      <h2 className="font-display mt-1 text-3xl font-bold uppercase leading-tight text-foreground">
                        {lead.full_name}
                      </h2>
                      <p className="mt-1 text-muted-foreground">
                        {lead.service_types.map(prettyStatus).join(", ")} · {lead.address}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">
                        {lead.phone} · budget {lead.budget_range ?? "TBC"}
                      </p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>

                  {lead.description && <p className="mt-4 text-foreground">{lead.description}</p>}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
                    <div className="flex flex-wrap gap-2" role="group" aria-label={`Status for ${lead.reference}`}>
                      {LEAD_TOGGLES.map((status) => (
                        <Button
                          key={status}
                          variant={lead.status === status ? "default" : "outline"}
                          aria-pressed={lead.status === status}
                          className="font-display font-bold uppercase tracking-wide"
                          disabled={setLeadStatus.isPending || converted}
                          onClick={() => setLeadStatus.mutate({ id: lead.id, reference: lead.reference, status })}
                        >
                          {prettyStatus(status)}
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Supervisor for ${lead.reference}`}
                        className={SELECT_CLASS}
                        value={draft.supervisorId}
                        disabled={converted}
                        onChange={(e) => setDraft(lead.id, { supervisorId: e.target.value })}
                      >
                        {assignable.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        aria-label={`Quote amount for ${lead.reference}`}
                        className="h-11 w-44"
                        inputMode="numeric"
                        placeholder="Quote amount"
                        value={draft.amount}
                        disabled={converted}
                        onChange={(e) => setDraft(lead.id, { amount: e.target.value })}
                      />
                      <Button
                        className="font-display h-11 font-bold uppercase tracking-wide"
                        disabled={convertToJob.isPending || converted}
                        onClick={() =>
                          convertToJob.mutate({
                            leadId: lead.id,
                            supervisorId: draft.supervisorId,
                            amount: Number(draft.amount.replace(/\D/g, "")) || null,
                          })
                        }
                      >
                        {converted ? "Converted" : "Convert to job"}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Property submissions */}
      <section aria-labelledby="properties-heading" className="mt-10">
        <h2 id="properties-heading" className="text-display text-3xl uppercase text-foreground">
          Property submissions
        </h2>
        {rows.properties.length === 0 ? (
          <div className="mt-4">
            <Empty>No property submissions yet.</Empty>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
            {rows.properties.map((property) => (
              <li key={property.id} className="rounded-sm border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-label text-[12px] text-ink-subtle">{property.reference}</p>
                    <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                      {property.address}
                    </h3>
                  </div>
                  <StatusBadge status={property.status} />
                </div>
                <p className="mt-1 text-muted-foreground">
                  {prettyStatus(property.property_type)} · {prettyStatus(property.condition)}
                </p>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  Asking {money(property.asking_price)} · {property.full_name}
                  {property.offer_amount ? ` · our offer ${money(property.offer_amount)}` : ""}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-divider pt-4">
                  <Button
                    variant="brick"
                    className="font-display font-bold uppercase tracking-wide"
                    onClick={() => setOfferFor(offerFor === property.id ? null : property.id)}
                    aria-expanded={offerFor === property.id}
                  >
                    Make cash offer
                  </Button>
                  <Button
                    variant="outlineNavy"
                    className="font-display font-bold uppercase tracking-wide"
                    disabled={setPropertyStatus.isPending || property.status === "viewing_booked"}
                    onClick={() =>
                      setPropertyStatus.mutate({ id: property.id, reference: property.reference, status: "viewing_booked" })
                    }
                  >
                    Book viewing
                  </Button>
                </div>

                {offerFor === property.id && (
                  <div className="mt-3 flex flex-wrap gap-2 rounded-sm bg-secondary p-3">
                    <Input
                      aria-label={`Cash offer for ${property.reference}`}
                      className="max-w-[12rem]"
                      inputMode="numeric"
                      placeholder="Offer amount (R)"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                    />
                    <Button
                      className="font-display font-bold uppercase tracking-wide"
                      disabled={setPropertyStatus.isPending}
                      onClick={() =>
                        setPropertyStatus.mutate({
                          id: property.id,
                          reference: property.reference,
                          status: "offer_made",
                          offer: Number(offerAmount.replace(/\D/g, "")) || null,
                        })
                      }
                    >
                      Send offer
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Jobs (target of the JOBS tab) */}
      <section id="jobs" aria-labelledby="jobs-heading" className="mt-10 scroll-mt-6">
        <h2 id="jobs-heading" className="text-display text-3xl uppercase text-foreground">
          Jobs
        </h2>
        {rows.jobs.length === 0 ? (
          <div className="mt-4">
            <Empty>No jobs yet. Convert a lead to create one.</Empty>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
            {rows.jobs.map((job) => (
              <li
                key={job.id}
                className={`rounded-sm border border-border border-t-4 bg-card p-5 ${
                  {
                    wait: "border-t-status-wait-foreground",
                    motion: "border-t-status-motion-foreground",
                    good: "border-t-status-good-foreground",
                    bad: "border-t-status-bad-foreground",
                    neutral: "border-t-status-neutral-foreground",
                  }[statusTone(job.status)]
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-label text-[12px] text-ink-subtle">{job.reference}</p>
                  <StatusBadge status={job.status} />
                </div>
                <h3 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                  {job.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {nameFor(job.supervisor_id)} · {money(job.quote_amount)}
                </p>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-sm bg-secondary"
                  role="progressbar"
                  aria-label={`${job.reference} progress`}
                  aria-valuenow={job.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full bg-accent" style={{ width: `${job.progress}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

            {/* Booking diary (target of the BOOKINGS tab) */}
      <section id="bookings" aria-labelledby="bookings-heading" className="mt-10 scroll-mt-6">
        <h2 id="bookings-heading" className="text-display text-3xl uppercase text-foreground">
          Booking diary
        </h2>
        {rows.bookings.length === 0 ? (
          <div className="mt-4">
            <Empty>No bookings yet.</Empty>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-sm border border-border bg-card">
            <table className="w-full min-w-[960px] text-left">
              <thead className="bg-primary text-primary-foreground">
                <tr>
                  {["Date · slot", "Type", "Client", "Address", "Status", "Action"].map((heading) => (
                    <th key={heading} scope="col" className="text-label px-5 py-4 text-[12px]">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-border">
                    <td className="font-display whitespace-nowrap px-5 py-4 text-xl font-bold">
                      {shortDate(booking.scheduled_date)} · {booking.scheduled_time.slice(0, 5)}
                    </td>
                    <td className="px-5 py-4">{prettyStatus(booking.booking_type)}</td>
                    <td className="px-5 py-4">{booking.full_name}</td>
                    <td className="px-5 py-4 text-muted-foreground">{booking.address ?? "—"}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="success"
                          className="font-display font-bold uppercase"
                          disabled={updateBooking.isPending || booking.status === "confirmed"}
                          onClick={() => updateBooking.mutate({ id: booking.id, status: "confirmed" })}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outlineNavy"
                          className="font-display font-bold uppercase"
                          disabled={updateBooking.isPending || booking.status === "completed"}
                          onClick={() => updateBooking.mutate({ id: booking.id, status: "completed" })}
                        >
                          Complete
                        </Button>
                        <select
                          aria-label={`Assign booking for ${booking.full_name}`}
                          className={`${SELECT_CLASS} h-9`}
                          value={booking.assigned_to ?? ""}
                          onChange={(e) => updateBooking.mutate({ id: booking.id, assigned_to: e.target.value || null })}
                        >
                          <option value="">Assign…</option>
                          {people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PortalShell>
  );
}