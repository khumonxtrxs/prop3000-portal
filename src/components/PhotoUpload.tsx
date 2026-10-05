import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { ref, uploadBytes } from "firebase/storage";
import { firebaseStorage } from "@/integrations/firebase/client";

const MAX_FILES = 8;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/** Shrinks a photo in the browser so uploads survive weak site signal. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.72));
}

export function PhotoUpload({
  bucket,
  prefix,
  paths,
  onChange,
  label = "Add photos",
  hint = "Up to 8 photos. They're compressed on your phone before upload.",
}: {
  bucket: "lead-photos" | "job-photos";
  prefix: string;
  paths: string[];
  onChange: (paths: string[]) => void;
  label?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX_FILES - paths.length);
    if (!list.length) {
      toast.error(`Maximum ${MAX_FILES} photos.`);
      return;
    }
    setBusy(true);
    const added: string[] = [];
    const addedPreviews: Record<string, string> = {};
    try {
      for (const file of list) {
        if (!ALLOWED.includes(file.type)) {
          toast.error(`${file.name}: only JPG, PNG or WEBP images.`);
          continue;
        }
        if (file.size > MAX_SOURCE_BYTES) {
          toast.error(`${file.name} is too large (max 15MB).`);
          continue;
        }
        const blob = await compress(file);
        const path = `${prefix}/${crypto.randomUUID()}.jpg`;
        // The Supabase bucket name becomes the top-level Storage folder; paths stay relative to it.
        try {
          await uploadBytes(ref(firebaseStorage(), `${bucket}/${path}`), blob, { contentType: "image/jpeg" });
        } catch {
          toast.error(`Upload failed for ${file.name}`);
          continue;
        }
        added.push(path);
        addedPreviews[path] = URL.createObjectURL(blob);
      }
      if (added.length) {
        onChange([...paths, ...added]);
        setPreviews((prev) => ({ ...prev, ...addedPreviews }));
        toast.success(`${added.length} photo${added.length > 1 ? "s" : ""} attached`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-4 py-7 text-center transition-colors hover:border-accent hover:bg-accent/5">
        {busy ? (
          <Loader2 className="size-6 animate-spin text-accent" />
        ) : (
          <ImagePlus className="size-6 text-accent" aria-hidden />
        )}
        <span className="text-sm font-semibold">{busy ? "Uploading…" : label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {paths.length > 0 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {paths.map((path) => (
            <li key={path} className="group relative aspect-square overflow-hidden rounded-md border border-border">
              {previews[path] ? (
                <img src={previews[path]} alt="Attached photo" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
                  Photo
                </div>
              )}
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(paths.filter((p) => p !== path))}
                className="absolute right-1 top-1 rounded-full bg-foreground/70 p-1 text-background opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
