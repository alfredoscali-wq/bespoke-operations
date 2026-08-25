export type VisualTone =
  | "green"
  | "red"
  | "yellow"
  | "blue"
  | "violet"
  | "gray"
  | "neutral"
  | "orange"
  | "amber"
  | "dark"

/** Soft tinted surfaces for KPI cards (≈4–6% opacity). */
export const KPI_TONE_STYLES: Record<
  VisualTone,
  { card: string; icon: string; iconColor: string }
> = {
  green: {
    card: "border-emerald-100/80 bg-emerald-500/[0.04] dark:border-emerald-800/50 dark:bg-emerald-500/[0.08]",
    icon: "bg-emerald-500/[0.08] dark:bg-emerald-500/20",
    iconColor: "text-emerald-700 dark:text-emerald-300",
  },
  red: {
    card: "border-red-100/80 bg-red-500/[0.04] dark:border-red-800/50 dark:bg-red-500/[0.08]",
    icon: "bg-red-500/[0.08] dark:bg-red-500/20",
    iconColor: "text-red-700 dark:text-red-300",
  },
  yellow: {
    card: "border-amber-100/80 bg-amber-500/[0.05] dark:border-amber-800/50 dark:bg-amber-500/[0.08]",
    icon: "bg-amber-500/[0.08] dark:bg-amber-500/20",
    iconColor: "text-amber-800 dark:text-amber-200",
  },
  blue: {
    card: "border-blue-100/80 bg-blue-500/[0.04] dark:border-blue-800/50 dark:bg-blue-500/[0.08]",
    icon: "bg-blue-500/[0.08] dark:bg-blue-500/20",
    iconColor: "text-blue-700 dark:text-blue-300",
  },
  violet: {
    card: "border-violet-100/80 bg-violet-500/[0.04] dark:border-violet-800/50 dark:bg-violet-500/[0.08]",
    icon: "bg-violet-500/[0.08] dark:bg-violet-500/20",
    iconColor: "text-violet-700 dark:text-violet-300",
  },
  gray: {
    card: "border-slate-200/80 bg-slate-500/[0.04] dark:border-slate-700/60 dark:bg-slate-500/[0.08]",
    icon: "bg-slate-500/[0.08] dark:bg-slate-500/20",
    iconColor: "text-slate-700 dark:text-slate-300",
  },
  neutral: {
    card: "border-border/80 bg-muted/40",
    icon: "bg-primary/[0.08]",
    iconColor: "text-primary",
  },
  orange: {
    card: "border-orange-100/80 bg-orange-500/[0.05] dark:border-orange-800/50 dark:bg-orange-500/[0.08]",
    icon: "bg-orange-500/[0.08] dark:bg-orange-500/20",
    iconColor: "text-orange-800 dark:text-orange-200",
  },
  amber: {
    card: "border-amber-200/80 bg-amber-500/[0.06] dark:border-amber-700/50 dark:bg-amber-500/[0.1]",
    icon: "bg-amber-500/[0.1] dark:bg-amber-500/20",
    iconColor: "text-amber-900 dark:text-amber-200",
  },
  dark: {
    card: "border-zinc-300/80 bg-zinc-700/[0.06] dark:border-zinc-600/60 dark:bg-zinc-500/[0.1]",
    icon: "bg-zinc-600/[0.1] dark:bg-zinc-500/20",
    iconColor: "text-zinc-800 dark:text-zinc-200",
  },
}

/** Unified badge shell used across modules. */
export const STATUS_BADGE_BASE =
  "rounded-md border px-2.5 py-0.5 text-xs font-medium shadow-none"

export const STATUS_TONE_STYLES: Record<VisualTone, string> = {
  green:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-200",
  red: "border-red-200/80 bg-red-50 text-red-800 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-200",
  yellow:
    "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-200",
  blue: "border-blue-200/80 bg-blue-50 text-blue-800 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-200",
  violet:
    "border-violet-200/80 bg-violet-50 text-violet-800 dark:border-violet-800/70 dark:bg-violet-950/60 dark:text-violet-200",
  gray: "border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200",
  neutral: "border-border/80 bg-muted/50 text-foreground",
  orange:
    "border-orange-200/80 bg-orange-50 text-orange-900 dark:border-orange-800/70 dark:bg-orange-950/60 dark:text-orange-200",
  amber:
    "border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/70 dark:text-amber-100",
  dark: "border-zinc-400/80 bg-zinc-100 text-zinc-800 dark:border-zinc-600/70 dark:bg-zinc-800/70 dark:text-zinc-100",
}

export const STATUS_DOT_STYLES: Record<VisualTone, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
  yellow: "bg-amber-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  gray: "bg-slate-400",
  neutral: "bg-muted-foreground",
  orange: "bg-orange-500",
  amber: "bg-amber-600",
  dark: "bg-zinc-600 dark:bg-zinc-300",
}

export const STATUS_ACCENT_BORDER_STYLES: Record<VisualTone, string> = {
  green: "border-l-emerald-500",
  red: "border-l-red-500",
  yellow: "border-l-amber-500",
  blue: "border-l-blue-500",
  violet: "border-l-violet-500",
  gray: "border-l-slate-400",
  neutral: "border-l-border",
  orange: "border-l-orange-500",
  amber: "border-l-amber-500",
  dark: "border-l-zinc-600",
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
  orange:
    "border-orange-200/80 bg-orange-50/90 text-orange-900 hover:bg-orange-100/80",
  amber:
    "border-amber-300/80 bg-amber-50/90 text-amber-950 hover:bg-amber-100/80",
  dark: "border-zinc-400/80 bg-zinc-100/90 text-zinc-900 hover:bg-zinc-200/80",
}

/** Shared KPI card interaction — pointer, hover lift, consistent height. */
export const KPI_CARD_INTERACTION_CLASS =
  "h-full min-h-[7.5rem] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"

/** Compact KPI cards (RRHH summary). */
export const KPI_CARD_COMPACT_INTERACTION_CLASS =
  "h-full min-h-[4.5rem] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"

/** Module filter bar layout tokens. */
export const FILTER_BAR_CLASS = "space-y-3"

export const FILTER_SEARCH_INPUT_CLASS = "h-9 bg-background pl-8"

export const FILTER_SELECT_TRIGGER_CLASS = "h-9 w-full bg-background"

export const FILTER_RESULT_COUNT_CLASS = "text-xs text-muted-foreground"

export const FILTER_CLEAR_BUTTON_CLASS =
  "text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm"
