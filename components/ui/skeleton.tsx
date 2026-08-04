import { IconRefresh } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

// `bg-accent` was almost the same value as the dark panels it sits on, so the
// bars were effectively invisible — measured against a real panel, not guessed.
// --surface-3 is the app's "raised fill" token and reads clearly in both themes.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-[var(--surface-3)] animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

// Composites below. A static "Loading…" string gives no sense that anything is
// happening — on the slower panels (forensics can take ~30s) it reads as broken.
// These stand in for the shape of the content that's coming, so the layout
// doesn't jump when it arrives either.

/** Deterministic width jitter so stacked bars look like text, not a block.
 *  Index-based rather than random: a re-render must not reshuffle the widths. */
const TEXT_WIDTHS = ["w-[92%]", "w-[78%]", "w-[85%]", "w-[64%]", "w-[88%]", "w-[71%]"]

/** Paragraph-ish placeholder. */
function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", TEXT_WIDTHS[i % TEXT_WIDTHS.length])} />
      ))}
    </div>
  )
}

/**
 * Placeholder rows for a list or table.
 *
 * `cols` lets a caller echo the real column rhythm (e.g. a wide first cell and
 * narrower numeric ones) so the skeleton reads as the table it precedes.
 */
function SkeletonRows({
  rows = 6,
  cols = ["flex-1", "w-16", "w-12"],
  className,
  rowClassName,
}: {
  rows?: number
  cols?: string[]
  className?: string
  rowClassName?: string
}) {
  return (
    <div className={cn("divide-y divide-[var(--line)]", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={cn("flex items-center gap-3 px-2 py-2.5", rowClassName)}>
          {cols.map((c, i) => (
            <Skeleton
              key={i}
              className={cn("h-3.5", c)}
              // Fade down the list so the eye settles on the top rows.
              style={{ opacity: 1 - Math.min(r, rows) * (0.45 / Math.max(1, rows)) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Placeholder for a chart panel: a bar silhouette over the plot area, so the
 * space a chart is about to occupy is obviously reserved rather than empty.
 */
function SkeletonChart({
  height = 160,
  bars = 24,
  className,
}: {
  height?: number
  bars?: number
  className?: string
}) {
  return (
    <div
      className={cn("flex items-end gap-[3px]", className)}
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <Skeleton
          key={i}
          className="min-w-0 flex-1 rounded-sm"
          // A fixed wave rather than random noise — it reads as a chart and
          // stays identical between renders.
          style={{ height: `${28 + 46 * Math.abs(Math.sin(i * 0.7))}%` }}
        />
      ))}
    </div>
  )
}

/**
 * Spinner + message, for waits where the message earns its place — a long job
 * worth explaining, or an inline slot too small for a skeleton.
 */
function LoadingNote({
  children,
  hint,
  className,
}: {
  children: React.ReactNode
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <IconRefresh className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      <span>
        {children}
        {hint ? <span className="ml-1 text-[var(--text-faint)]">{hint}</span> : null}
      </span>
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonRows, SkeletonChart, LoadingNote }
