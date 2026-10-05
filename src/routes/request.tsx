import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ConfirmationCard, FormField, FormShell, Reassurance } from "@/components/site/FormShell";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/integrations/firebase/config";

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

/** The 13 trades from the handoff; values are stored snake_case, as the dashboards expect. */
const TRADES = [
  { value: "renovations", label: "Renovations" },
  { value: "building", label: "Building" },
  { value: "scheming", label: "Scheming" },
  { value: "plastering", label: "Plastering" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "electrical_gates", label: "Electrical gates" },
  { value: "gate_motors", label: "Gate motors" },
  { value: "paving", label: "Paving" },
  { value: "painting", label: "Painting" },
  { value: "waterproofing", label: "Waterproofing" },
  { value: "cabinet_making", label: "Cabinet making" },
  { value: "built_in_cupboards", label: "Built-in cupboards" },
];

const SA_MOBILE = /^(?:\+27|0)[6-8]\d{8}$/;

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name."),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your mobile number.")
    .refine((value) => SA_MOBILE.test(value.replace(/\s/g, "")), "Enter a South African mobile number, e.g. 081 000 0000."),
  email: z.string().trim().email("Enter a valid email address."),
  address: z.string().trim().min(5, "Enter the property address."),
  service_types: z.array(z.string()),
  budget_range: z.string(),
  description: z.string().trim().max(2000, "Keep the description under 2000 characters."),
  photos: z.array(z.string()).max(6, "You can attach up to 6 photos."),
});

type RequestValues = z.infer<typeof schema>;

/** Reference made on the client so the confirmation works signed out (no read-back needed). */
function newReference() {
  return `SR-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function RequestPage() {
  const { user } = useAuth();
  const [reference, setReference] = useState<string | null>(null);
  const photoPrefix = `requests/${new Date().getFullYear()}`;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RequestValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      phone: "",
      email: "",
      address: "",
      service_types: [],
      budget_range: "",
      description: "",
      photos: [],
    },
  });

  async function onSubmit(values: RequestValues) {
    const ref = newReference();

    try {
      const requestRef = doc(
        collection(firestore(), COLLECTIONS.serviceRequests),
      );

      await setDoc(requestRef, {
        reference: ref,

        client_id: user?.uid ?? null,
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        address: values.address.trim(),
        description: values.description.trim(),

        budget_range: values.budget_range || null,
        service_types: values.service_types,
        photo_paths: values.photos,

        status: "new",
        created_at: serverTimestamp(),
      });

      setReference(ref);
      toast.success("Request received");
    } catch (error) {
      console.error(error);
      toast.error(
        "We couldn't send that. Please try again, or WhatsApp us.",
      );
    }
  }

  const selected = watch("service_types");
  const photos = watch("photos");


  function toggleTrade(value: string) {
    setValue(
      "service_types",
      selected.includes(value) ? selected.filter((t) => t !== value) : [...selected, value],
      { shouldDirty: true },
    );
  }

  const describedBy = (field: keyof RequestValues) => (errors[field] ? `${field}-error` : undefined);

  return (
    <SiteLayout>
      <FormShell
        eyebrow="Prop3000 Developers"
        title="Request a renovation quote"
        intro="Tell us what needs doing, tick the trades involved and add photos. Office staff triage it the same day."
      >
        {reference ? (
          <ConfirmationCard
            reference={reference}
            nextStep="The office will contact you within one working day to arrange a site visit and send your written quote."
            whatsappMessage={`Hi Prop3000, I've just sent quote request ${reference}.`}
          />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
              <FormField id="full_name" label="Full name" error={errors.full_name?.message}>
                <Input
                  id="full_name"
                  autoComplete="name"
                  placeholder="Thandi Mokoena"
                  aria-invalid={!!errors.full_name}
                  aria-describedby={describedBy("full_name")}
                  className="h-12 bg-card"
                  {...register("full_name")}
                />
              </FormField>
              <FormField id="phone" label="Mobile" error={errors.phone?.message}>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="081 000 0000"
                  aria-invalid={!!errors.phone}
                  aria-describedby={describedBy("phone")}
                  className="h-12 bg-card"
                  {...register("phone")}
                />
              </FormField>
              <FormField id="email" label="Email" error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.co.za"
                  aria-invalid={!!errors.email}
                  aria-describedby={describedBy("email")}
                  className="h-12 bg-card"
                  {...register("email")}
                />
              </FormField>
            </div>

            <FormField id="address" label="Property address" error={errors.address?.message}>
              <Input
                id="address"
                autoComplete="street-address"
                placeholder="12 Belvedere Road, Claremont"
                aria-invalid={!!errors.address}
                aria-describedby={describedBy("address")}
                className="h-12 bg-card"
                {...register("address")}
              />
            </FormField>

            <div>
              <p id="service-type-label" className="text-label mb-2 text-[12px] text-ink-subtle">
                Service type
              </p>
              <div role="group" aria-labelledby="service-type-label" className="flex flex-wrap gap-2">
                {TRADES.map((trade) => {
                  const active = selected.includes(trade.value);
                  return (
                    <button
                      key={trade.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleTrade(trade.value)}
                      className={`font-display rounded-sm border px-4 py-2.5 text-lg font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary"
                        }`}
                    >
                      {trade.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <FormField id="budget_range" label="Budget range" error={errors.budget_range?.message}>
              <select
                id="budget_range"
                className="h-12 w-full rounded-sm border border-input bg-card px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("budget_range")}
              >
                <option value="">Select a range</option>
                {BUDGET_RANGES.map((range) => (
                  <option key={range} value={range}>
                    {range}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="description" label="Describe the work" error={errors.description?.message}>
              <Textarea
                id="description"
                rows={5}
                placeholder="e.g. re-tile the bathroom, replace the vanity, damp on the lounge wall…"
                aria-invalid={!!errors.description}
                aria-describedby={describedBy("description")}
                className="bg-card"
                {...register("description")}
              />
            </FormField>

            <div>
              <p className="text-label mb-2 text-[12px] text-ink-subtle">Photos — compressed on your phone before upload</p>
              <PhotoUpload
                bucket="lead-photos"
                prefix={photoPrefix}
                paths={photos}
                onChange={(paths) => setValue("photos", paths, { shouldValidate: true })}
                label="Add photos of the area"
                hint="Up to 6 photos."
              />
              {errors.photos && (
                <p id="photos-error" role="alert" className="mt-1.5 text-sm font-semibold text-brick">
                  Error: {errors.photos.message}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-divider pt-6">
              <Button
                type="submit"
                variant="brick"
                size="xl"
                className="font-display font-bold uppercase tracking-wide"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <Loader2
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                Send my request
              </Button>

              <Reassurance />
            </div>
          </form>
        )}
      </FormShell>
    </SiteLayout>
  );
}