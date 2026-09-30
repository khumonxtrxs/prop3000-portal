import { cn } from "@/lib/utils";

/**
 * A photo in the handoff's 7px white frame, rotated a few degrees.
 * Where a real photo doesn't exist yet, pass no src and it renders the
 * prototype's diagonal hatch fill with a caption instead of stock imagery.
 */
export function PhotoFrame({
  src,
  alt,
  caption,
  className,
}: {
  src?: string;
  alt: string;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={cn("border-[7px] border-white bg-white shadow-frame", className)}>
      {src ? (
        <img src={src} alt={alt} className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="hatch-fill flex size-full items-center justify-center p-4 text-center">
          <span className="text-label text-[12px] text-ink-subtle">{caption ?? alt}</span>
        </div>
      )}
    </figure>
  );
}
