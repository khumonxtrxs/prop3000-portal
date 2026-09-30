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
import { CONDITIONS, PROPERTY_TYPES } from "@/lib/prop3000";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell Your Property for Cash — Prop3000 Investments" },
      {
        name: "description",
        content: "Submit your distressed, damaged or inherited property to Prop3000 Investments and get a fast cash offer.",
      },
      { property: "og:title", content: "Get a cash offer — Prop3000 Investments" },
      { property: "og:description", content: "As-is cash purchase. No agents, no repairs, no bond delays." },
    ],
  }),
  component: SellPage,
});

function SellPage() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    property_type: "house",
    condition: "fair",
    bedrooms: "",
    bathrooms: "",
    erf_size: "",
    asking_price: "",
    reason_for_selling: "",
    description: "",
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("property_submissions")
      .insert({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        property_type: form.property_type,
        condition: form.condition,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        erf_size: form.erf_size.trim() || null,
        asking_price: form.asking_price ? Number(form.asking_price) : null,
        reason_for_selling: form.reason_for_selling.trim() || null,
        description: form.description.trim() || null,
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
    toast.success("Property submitted");
  }

  if (reference) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h1 className="text-display mt-4 text-4xl">Property submitted</h1>
          <p className="mt-3 text-muted-foreground">
            Reference <strong className="text-foreground">{reference}</strong>. We'll review the details, book a viewing
            and come back with a cash offer.
          </p>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-display text-4xl">Submit your property for a cash offer</h1>
        <p className="mt-3 text-muted-foreground">Sell as-is. No repairs, no agents, no commission.</p>

        <form onSubmit={submit} className="mt-10 space-y-6 rounded-xl border border-border bg-card p-6 shadow-panel">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s_name">Full name</Label>
              <Input id="s_name" required maxLength={120} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_phone">Mobile number</Label>
              <Input id="s_phone" required maxLength={30} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_email">Email</Label>
              <Input id="s_email" type="email" required maxLength={255} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_price">Price you have in mind (ZAR)</Label>
              <Input id="s_price" type="number" min={0} value={form.asking_price} onChange={(e) => set("asking_price", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s_address">Property address</Label>
            <Input id="s_address" required maxLength={300} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s_type">Property type</Label>
              <select
                id="s_type"
                value={form.property_type}
                onChange={(e) => set("property_type", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_condition">Condition</Label>
              <select
                id="s_condition"
                value={form.condition}
                onChange={(e) => set("condition", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CONDITIONS.map((condition) => (
                  <option key={condition.value} value={condition.value}>
                    {condition.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_beds">Bedrooms</Label>
              <Input id="s_beds" type="number" min={0} max={30} value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_baths">Bathrooms</Label>
              <Input id="s_baths" type="number" min={0} max={30} value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_erf">Erf size</Label>
              <Input id="s_erf" maxLength={60} placeholder="e.g. 420 m²" value={form.erf_size} onChange={(e) => set("erf_size", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_reason">Reason for selling</Label>
              <Input id="s_reason" maxLength={200} value={form.reason_for_selling} onChange={(e) => set("reason_for_selling", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s_desc">Anything else we should know?</Label>
            <Textarea id="s_desc" rows={4} maxLength={2000} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <PhotoUpload
            bucket="lead-photos"
            prefix={`properties/${new Date().getFullYear()}`}
            paths={photos}
            onChange={setPhotos}
            label="Add property photos"
          />

          <Button type="submit" variant="brick" size="xl" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Get my cash offer
          </Button>
        </form>
      </div>
    </SiteLayout>
  );
}
