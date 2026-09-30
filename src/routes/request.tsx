import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { BUDGET_RANGES } from "@/lib/prop3000";

export const Route = createFileRoute("/request")({
  head: () => ({
    meta: [
      { title: "Request a Renovation Quote — Prop3000 Developers" },
      {
        name: "description",
        content: "Send Prop3000 your renovation or building job with photos and get a written quote without a phone call.",
      },
      { property: "og:title", content: "Request a renovation quote — Prop3000" },
      { property: "og:description", content: "Describe the job, attach photos, pick a budget range. We quote in 48 hours." },
    ],
  }),
  component: RequestPage,
});

const TRADE_OPTIONS = [
  "Renovation",
  "Building",
  "Plumbing",
  "Electrical",
  "Paving",
  "Tiling",
  "Painting",
  "Cabinetry",
  "Waterproofing",
  "Roofing",
];

function RequestPage() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    description: "",
    budget_range: "",
    preferred_start_date: "",
  });
  const [types, setTypes] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const prefix = `requests/${new Date().getFullYear()}`;

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.full_name.trim().length < 2 || form.description.trim().length < 10) {
      toast.error("Please add your name and a short description of the work.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("service_requests")
      .insert({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        description: form.description.trim(),
        budget_range: form.budget_range || null,
        preferred_start_date: form.preferred_start_date || null,
        service_types: types,
        photo_paths: photos,
      })
      .select("reference")
      .single();
    setBusy(false);
    if (error) {
      console.error(error);
      toast.error("We couldn't send that. Please try again.");
      return;
    }
    setReference(data.reference);
    toast.success("Request received");
  }

  if (reference) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h1 className="text-display mt-4 text-4xl">Request sent</h1>
          <p className="mt-3 text-muted-foreground">
            Your reference is <strong className="text-foreground">{reference}</strong>. The office reviews new requests
            daily and will come back with a quote within 48 hours.
          </p>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-display text-4xl">Request a renovation quote</h1>
        <p className="mt-3 text-muted-foreground">
          The more detail and photos you send, the tighter the quote. No account needed.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-6 rounded-xl border border-border bg-card p-6 shadow-panel">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" required maxLength={120} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile number</Label>
              <Input id="phone" required maxLength={30} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required maxLength={255} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Preferred start date</Label>
              <Input id="start" type="date" value={form.preferred_start_date} onChange={(e) => set("preferred_start_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Property address</Label>
            <Input id="address" required maxLength={300} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Type of work</Label>
            <div className="flex flex-wrap gap-2">
              {TRADE_OPTIONS.map((option) => {
                const active = types.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTypes(active ? types.filter((t) => t !== option) : [...types, option])}
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                      active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background hover:border-accent"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget range</Label>
            <select
              id="budget"
              value={form.budget_range}
              onChange={(e) => set("budget_range", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select a range</option>
              {BUDGET_RANGES.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Describe the work</Label>
            <Textarea id="description" required rows={5} maxLength={2000} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <PhotoUpload bucket="lead-photos" prefix={prefix} paths={photos} onChange={setPhotos} label="Add photos of the area" />

          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Send my request
          </Button>
        </form>
      </div>
    </SiteLayout>
  );
}
