/**
 * Automatic Reports 1.0 — punto de entrada del scheduler.
 * Vercel Cron invoca GET /api/cron/weekly-report (ver vercel.json).
 * Alternativas futuras: Supabase pg_cron, GitHub Actions, etc.
 */

export {
  resolveInformedWeekRange,
  formatInformedWeekLabel,
  resolveIsoWeekNumber,
} from "@/lib/reports/automatic/scheduler/week-range"

export { runWeeklyAutomaticReport } from "@/lib/reports/automatic"
