export type VisualTone =
  | "green"
  | "red"
  | "yellow"
  | "blue"
  | "violet"
  | "gray"
  | "neutral"

/** Soft tinted surfaces for KPI cards (≈4–6% opacity). */
export const KPI_TONE_STYLES: Record<
  VisualTone,
  { card: string; icon: string; iconColor: string }
> = {
  green: {
    card: "border-emerald-100/80 bg-emerald-500/[0.04]",
    icon: "bg-emerald-500/[0.08]",
    iconColor: "text-emerald-700",
  },
  red: {
    card: "border-red-100/80 bg-red-500/[0.04]",
    icon: "bg-red-500/[0.08]",
    iconColor: "text-red-700",
  },
  yellow: {
    card: "border-amber-100/80 bg-amber-500/[0.05]",
    icon: "bg-amber-500/[0.08]",
    iconColor: "text-amber-800",
  },
  blue: {
    card: "border-blue-100/80 bg-blue-500/[0.04]",
    icon: "bg-blue-500/[0.08]",
    iconColor: "text-blue-700",
  },
  violet: {
    card: "border-violet-100/80 bg-violet-500/[0.04]",
    icon: "bg-violet-500/[0.08]",
    iconColor: "text-violet-700",
  },
  gray: {
    card: "border-slate-200/80 bg-slate-500/[0.04]",
    icon: "bg-slate-500/[0.08]",
    iconColor: "text-slate-700",
  },
  neutral: {
    card: "border-border/80 bg-muted/40",
    icon: "bg-primary/[0.08]",
    iconColor: "text-primary",
  },
}

/** Unified badge shell used across modules. */
export const STATUS_BADGE_BASE =
  "rounded-md border px-2.5 py-0.5 text-xs font-medium shadow-none"

export const STATUS_TONE_STYLES: Record<VisualTone, string> = {
  green: "border-emerald-200/80 bg-emerald-50 text-emerald-800",
  red: "border-red-200/80 bg-red-50 text-red-800",
  yellow: "border-amber-200/80 bg-amber-50 text-amber-900",
  blue: "border-blue-200/80 bg-blue-50 text-blue-800",
  violet: "border-violet-200/80 bg-violet-50 text-violet-800",
  gray: "border-slate-200/80 bg-slate-50 text-slate-700",
  neutral: "border-border/80 bg-muted/50 text-foreground",
}

/** Calendar event surfaces aligned with status tones. */
export const CALENDAR_EVENT_TONE_STYLES: Record<VisualTone, string> = {
  green:
    "border-emerald-200/80 bg-emerald-50/90 text-emerald-900 hover:bg-emerald-100/80",
  red: "border-red-200/80 bg-red-50/90 text-red-900 hover:bg-red-100/80",
  yellow:
    "border-amber-200/80 bg-amber-50/90 text-amber-900 hover:bg-amber-100/80",
  blue: "border-blue-200/80 bg-blue-50/90 text-blue-900 hover:bg-blue-100/80",
  violet:
    "border-violet-200/80 bg-violet-50/90 text-violet-900 hover:bg-violet-100/80",
  gray: "border-slate-200/80 bg-slate-50/90 text-slate-800 hover:bg-slate-100/80",
  neutral:
    "border-border/80 bg-muted/40 text-foreground hover:bg-muted/60",
}
