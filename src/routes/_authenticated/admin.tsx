import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Briefcase, CalendarDays, Check, Home, Loader2, UserCheck, X } from "lucide-react";
import { CountBars, StatusPie, TrendChart } from "@/components/portal/Charts";
import { Empty, Panel, PortalShell, StatCard } from "@/components/portal/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { countBy, monthlySeries } from "@/lib/portal";
import { money, prettyStatus, shortDate } from "@/lib/prop3000";

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

const LEAD_ACTIONS = ["contacted", "quoted", "approved", "declined"] as const;

function AdminDashboard() {
  const { isOffice, loading } = useAuth();
  const queryClient = useQueryClient();
  const [convertFor, setConvertFor] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
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
  };

  const setLeadStatus = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      const { error } = await supabase.from("service_requests").update({ status: input.status }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Lead updated.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertToJob = useMutation({
    mutationFn: async (lead: { id: string }) => {
      const source = data.data?.requests.find((r) => r.id === lead.id);
      if (!source) throw new Error("Lead not found");
      const amount = Number(quoteAmount.replace(/\D/g, "")) || null;
      const reference = `JOB-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase.from("jobs").insert({
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
        supervisor_id: supervisorId || null,
        status: "approved",
        progress: 0,
        quote_amount: amount,
      });
      if (error) throw error;
      const { error: leadError } = await supabase
        .from("service_requests")
        .update({ status: "converted" })
        .eq("id", source.id);
      if (leadError) throw leadError;
    },
    onSuccess: async () => {
      toast.success("Job created and supervisor assigned.");
      setConvertFor(null);
      setQuoteAmount("");
      setSupervisorId("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPropertyStatus = useMutation({
    mutationFn: async (input: { id: string; status: string; offer?: number | null }) => {
      const patch: { status: string; offer_amount?: number | null } = { status: input.status };
      if (input.offer !== undefined) patch.offer_amount = input.offer;
      const { error } = await supabase.from("property_submissions").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Cash-sale lead updated.");
      setOfferFor(null);
      setOfferAmount("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignBooking = useMutation({
    mutationFn: async (input: { id: string; assigned_to?: string | null; status?: string }) => {
      const patch: { assigned_to?: string | null; status?: string } = {};
      if (input.assigned_to !== undefined) patch.assigned_to = input.assigned_to;
      if (input.status) patch.status = input.status;
      const { error } = await supabase.from("bookings").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Booking updated.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const charts = useMemo(() => {
    const rows = data.data;
    return {
      leadStatus: countBy(rows?.requests ?? [], (r) => r.status),
      jobStatus: countBy(rows?.jobs ?? [], (j) => j.status),
      trend: monthlySeries([...(rows?.requests ?? []), ...(rows?.properties ?? [])]),
    };
  }, [data.data]);

  if (loading || data.isLoading) {
    return (
      <PortalShell badge="Office" title="Lead desk" subtitle="Loading the pipeline…">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" />
      </PortalShell>
    );
  }

  if (!isOffice) {
    return (
      <PortalShell badge="Office" title="Admins only" subtitle="This desk belongs to office staff and the owner.">
        <Empty>Your account doesn't have office access. Ask an admin to grant it.</Empty>
      </PortalShell>
    );
  }

  const rows = data.data!;
  const openLeads = rows.requests.filter((r) => r.status !== "converted" && r.status !== "declined").length;
  const activeJobs = rows.jobs.filter((j) => j.status === "in_progress" || j.status === "approved").length;
  const quoted = rows.jobs.reduce((sum, j) => sum + Number(j.quote_amount ?? 0), 0);

  return (
    <PortalShell
      badge="Admin / office staff"
      title="Lead desk"
      subtitle="Triage every incoming renovation and cash-sale lead, convert leads into jobs with a supervisor, and run the booking diary."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Home} label="Open renovation leads" value={String(openLeads)} hint={`${rows.requests.length} total`} />
        <StatCard icon={Banknote} label="Cash-sale leads" value={String(rows.properties.length)} />
        <StatCard icon={Briefcase} label="Active jobs" value={String(activeJobs)} hint={`${rows.jobs.length} on file`} />
        <StatCard icon={CalendarDays} label="Quoted value" value={money(quoted)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Panel title="Lead intake trend">
          <TrendChart data={charts.trend} label="Leads" />
        </Panel>
        <Panel title="Renovation leads by status">
          <StatusPie data={charts.leadStatus} />
        </Panel>
        <Panel title="Jobs by status">
          <CountBars data={charts.jobStatus} label="Jobs" />
        </Panel>
      </div>

      <div className="mt-8 grid gap-6">
        <Panel title="Renovation leads">
          {rows.requests.length === 0 ? (
            <Empty>No renovation requests yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {rows.requests.map((lead) => (
                <li key={lead.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {lead.full_name} · {lead.reference}
                      </p>
                      <p className="text-sm text-muted-foreground">{lead.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.service_types.map(prettyStatus).join(", ")} · {lead.budget_range ?? "budget TBC"} ·{" "}
                        {shortDate(lead.created_at)}
                      </p>
                      <p className="mt-1 text-sm">{lead.description}</p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {LEAD_ACTIONS.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={lead.status === status ? "accent" : "outline"}
                        disabled={setLeadStatus.isPending}
                        onClick={() => setLeadStatus.mutate({ id: lead.id, status })}
                      >
                        {prettyStatus(status)}
                      </Button>
                    ))}
                    {lead.status !== "converted" && (
                      <Button size="sm" variant="brick" onClick={() => setConvertFor(lead.id)}>
                        <UserCheck className="size-4" /> Convert to job
                      </Button>
                    )}
                  </div>

                  {convertFor === lead.id && (
                    <div className="mt-3 grid gap-3 rounded-lg border border-border bg-secondary/40 p-4 sm:grid-cols-3">
                      <Input
                        inputMode="numeric"
                        placeholder="Quote amount (R)"
                        value={quoteAmount}
                        onChange={(e) => setQuoteAmount(e.target.value)}
                      />
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={supervisorId}
                        onChange={(e) => setSupervisorId(e.target.value)}
                      >
                        <option value="">Assign supervisor…</option>
                        {(staff.data ?? []).map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name} ({person.roles.join("/")})
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="accent"
                          disabled={convertToJob.isPending}
                          onClick={() => convertToJob.mutate({ id: lead.id })}
                        >
                          <Check className="size-4" /> Create job
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConvertFor(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Cash-sale pipeline">
          {rows.properties.length === 0 ? (
            <Empty>No property submissions yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {rows.properties.map((property) => (
                <li key={property.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {property.full_name} · {property.reference}
                      </p>
                      <p className="text-sm text-muted-foreground">{property.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {prettyStatus(property.property_type)} · {prettyStatus(property.condition)} · asking{" "}
                        {money(property.asking_price)} · our offer {money(property.offer_amount)}
                      </p>
                    </div>
                    <StatusBadge status={property.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["reviewing", "viewing_booked", "accepted", "purchased", "declined"].map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={property.status === status ? "accent" : "outline"}
                        disabled={setPropertyStatus.isPending}
                        onClick={() => setPropertyStatus.mutate({ id: property.id, status })}
                      >
                        {prettyStatus(status)}
                      </Button>
                    ))}
                    <Button size="sm" variant="brick" onClick={() => setOfferFor(property.id)}>
                      Make cash offer
                    </Button>
                  </div>
                  {offerFor === property.id && (
                    <div className="mt-3 flex flex-wrap gap-2 rounded-lg border border-border bg-secondary/40 p-4">
                      <Input
                        className="max-w-xs"
                        inputMode="numeric"
                        placeholder="Offer amount (R)"
                        value={offerAmount}
                        onChange={(e) => setOfferAmount(e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="accent"
                        disabled={setPropertyStatus.isPending}
                        onClick={() =>
                          setPropertyStatus.mutate({
                            id: property.id,
                            status: "offer_made",
                            offer: Number(offerAmount.replace(/\D/g, "")) || null,
                          })
                        }
                      >
                        Send offer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setOfferFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Booking diary">
          {rows.bookings.length === 0 ? (
            <Empty>No bookings yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {rows.bookings.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                  <div>
                    <p className="font-semibold">
                      {prettyStatus(booking.booking_type)} · {shortDate(booking.scheduled_date)}{" "}
                      {booking.scheduled_time.slice(0, 5)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {booking.full_name} · {booking.phone} · {booking.address ?? "no address"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={booking.assigned_to ?? ""}
                      onChange={(e) => assignBooking.mutate({ id: booking.id, assigned_to: e.target.value || null })}
                    >
                      <option value="">Unassigned</option>
                      {(staff.data ?? []).map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant={booking.status === "confirmed" ? "accent" : "outline"}
                      onClick={() => assignBooking.mutate({ id: booking.id, status: "confirmed" })}
                    >
                      <Check className="size-4" /> Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => assignBooking.mutate({ id: booking.id, status: "cancelled" })}
                    >
                      <X className="size-4" /> Cancel
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PortalShell>
  );
}
