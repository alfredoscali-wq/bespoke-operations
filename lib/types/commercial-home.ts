import type { CommercialStatusCode } from "@/lib/commercial/catalogs"

export type CommercialHomeDaySummary = {
  newOpportunities: number
  commitmentsToday: number
  commitmentsOverdue: number
}

export type CommercialHomeDerivationItem = {
  opportunityId: string
  opportunityCode: string
  personName: string
  companyName: string
  derivedAt: string
  derivedByEmployeeId: string | null
  derivedByName: string
  reason: string
  atencionId: string | null
}

export type CommercialHomeCommitmentItem = {
  commitmentId: string
  opportunityId: string
  opportunityCode: string
  personName: string
  title: string
  dueAt: string
  daysOverdue: number | null
  priority: string
  assignedEmployeeId: string | null
}

export type CommercialHomeKpis = {
  activeOpportunities: number
  wonThisMonth: number
  lostThisMonth: number
  inactiveOver7Days: number
}

export type CommercialHomeRecentActivityItem = {
  id: string
  opportunityId: string
  opportunityCode: string
  personName: string
  activityTypeCode: string
  activityTypeLabel: string
  title: string
  description: string
  occurredAt: string
  employeeName: string
  status: CommercialStatusCode | null
}

export type CommercialHomeDesk = {
  daySummary: CommercialHomeDaySummary
  newDerivations: CommercialHomeDerivationItem[]
  overdueCommitments: CommercialHomeCommitmentItem[]
  todayCommitments: CommercialHomeCommitmentItem[]
  kpis: CommercialHomeKpis
  recentActivity: CommercialHomeRecentActivityItem[]
}
