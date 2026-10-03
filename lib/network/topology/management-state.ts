import { isNetworkDiscoveryJobInflight } from "@/lib/network/discovery/job-poll"
import { isNetworkTargetDecryptError } from "@/lib/network/management/errors"
import type { NetworkTopologyManagementJob } from "@/lib/network/topology/types"

export type TopologyCredentialStatus = "none" | "available" | "unavailable"
export type TopologyConnectionStatus =
  | "untested"
  | "verified"
  | "error"
  | "in_progress"
export type TopologyDiscoveryStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"

export type TopologyManagementTargetRef = {
  agentId: string
  host: string
  updatedAt: string
  hasSecret: boolean
}

export type TopologyObservedManagementState = {
  managed: boolean
  credential: TopologyCredentialStatus
  connection: TopologyConnectionStatus
  discovery: TopologyDiscoveryStatus
  diagnosticJob: NetworkTopologyManagementJob | null
  discoveryJob: NetworkTopologyManagementJob | null
  decryptError: boolean
  canAdminister: boolean
  canTest: boolean
  canDiscover: boolean
  canReplace: boolean
}

function jobMatchesDevice(
  job: NetworkTopologyManagementJob,
  device: { id: string; managementIp: string | null }
): boolean {
  if (job.deviceId && job.deviceId === device.id) return true
  return (
    device.managementIp != null &&
    device.managementIp.trim() !== "" &&
    job.targetHost === device.managementIp
  )
}

export function pickLatestTopologyJobForDevice(
  jobs: readonly NetworkTopologyManagementJob[],
  device: { id: string; managementIp: string | null },
  jobType: "diagnostic" | "discovery"
): NetworkTopologyManagementJob | null {
  return (
    jobs.find(
      (job) => job.jobType === jobType && jobMatchesDevice(job, device)
    ) ?? null
  )
}

function findTargetForDevice(
  targets: readonly TopologyManagementTargetRef[],
  device: { agentId: string | null; managementIp: string | null }
): TopologyManagementTargetRef | null {
  const host = device.managementIp?.trim() ?? ""
  const agentId = device.agentId?.trim() ?? ""
  if (!host || !agentId) return null
  return (
    targets.find(
      (target) => target.agentId === agentId && target.host.trim() === host
    ) ?? null
  )
}

function targetSupersedesDecryptFailure(
  target: TopologyManagementTargetRef | null,
  job: NetworkTopologyManagementJob | null
): boolean {
  if (!target || !job) return false
  const jobAt = job.completedAt ?? job.createdAt ?? null
  if (!jobAt) return false
  return Date.parse(target.updatedAt) > Date.parse(jobAt)
}

export function buildObservedDeviceManagementState(input: {
  managed: boolean
  agentId: string | null
  deviceId: string
  managementIp: string | null
  jobs: readonly NetworkTopologyManagementJob[]
  targets: readonly TopologyManagementTargetRef[]
}): TopologyObservedManagementState {
  const device = {
    id: input.deviceId,
    managementIp: input.managementIp,
    agentId: input.agentId,
  }
  const diagnosticJob = pickLatestTopologyJobForDevice(
    input.jobs,
    device,
    "diagnostic"
  )
  const discoveryJob = pickLatestTopologyJobForDevice(
    input.jobs,
    device,
    "discovery"
  )
  const target = findTargetForDevice(input.targets, device)
  const decryptJob =
    diagnosticJob &&
    diagnosticJob.status === "failed" &&
    isNetworkTargetDecryptError(diagnosticJob.errorMessage)
      ? diagnosticJob
      : discoveryJob &&
          discoveryJob.status === "failed" &&
          isNetworkTargetDecryptError(discoveryJob.errorMessage)
        ? discoveryJob
        : null
  const decryptError =
    decryptJob != null && !targetSupersedesDecryptFailure(target, decryptJob)

  let credential: TopologyCredentialStatus = "none"
  if (input.managed) {
    credential = decryptError ? "unavailable" : "available"
  }

  let connection: TopologyConnectionStatus = "untested"
  if (diagnosticJob && isNetworkDiscoveryJobInflight(diagnosticJob.status)) {
    connection = "in_progress"
  } else if (
    diagnosticJob?.status === "failed" &&
    !isNetworkTargetDecryptError(diagnosticJob.errorMessage)
  ) {
    connection = "error"
  } else if (diagnosticJob?.status === "completed") {
    connection = "verified"
  }

  let discovery: TopologyDiscoveryStatus = "pending"
  if (discoveryJob && isNetworkDiscoveryJobInflight(discoveryJob.status)) {
    discovery = "in_progress"
  } else if (discoveryJob?.status === "completed") {
    discovery = "completed"
  } else if (discoveryJob?.status === "failed") {
    discovery = "failed"
  }

  return {
    managed: input.managed,
    credential,
    connection,
    discovery,
    diagnosticJob,
    discoveryJob,
    decryptError,
    canAdminister: !input.managed,
    canTest: input.managed,
    canDiscover: input.managed && credential === "available",
    canReplace: input.managed,
  }
}
