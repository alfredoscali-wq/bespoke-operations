import assert from "node:assert/strict"
import test from "node:test"

import {
  collectTaskIncidentPhotoStoragePaths,
  findPermanentDeleteTaskRecordStepIndex,
  PERMANENT_DELETE_TASK_RECORDS_SHARED_BY,
  resolvePermanentDeleteTaskRecordStepSequence,
} from "../lib/admin/permanent-delete-task-records-plan.ts"

test("collectTaskIncidentPhotoStoragePaths ignores null and blank paths", () => {
  assert.deepEqual(
    collectTaskIncidentPhotoStoragePaths([
      { storage_path: null, thumbnail_path: "   " },
      { storage_path: "", thumbnail_path: null },
    ]),
    []
  )
})

test("collectTaskIncidentPhotoStoragePaths collects storage_path and thumbnail_path", () => {
  assert.deepEqual(
    collectTaskIncidentPhotoStoragePaths([
      {
        storage_path: " company-1/incident-1/photo-1.jpg ",
        thumbnail_path: "company-1/incident-1/photo-1-thumb.jpg",
      },
    ]),
    [
      "company-1/incident-1/photo-1.jpg",
      "company-1/incident-1/photo-1-thumb.jpg",
    ]
  )
})

test("collectTaskIncidentPhotoStoragePaths deduplicates repeated paths", () => {
  assert.deepEqual(
    collectTaskIncidentPhotoStoragePaths([
      {
        storage_path: "company-1/incident-1/photo-1.jpg",
        thumbnail_path: "company-1/incident-1/photo-1.jpg",
      },
      {
        storage_path: "company-1/incident-1/photo-1.jpg",
        thumbnail_path: null,
      },
    ]),
    ["company-1/incident-1/photo-1.jpg"]
  )
})

test("task without incidents keeps the existing downstream delete sequence", () => {
  const steps = resolvePermanentDeleteTaskRecordStepSequence({
    hasIncidents: false,
    hasIncidentPhotoStorage: false,
    hasEvidences: true,
    hasTaskPhotos: true,
  })

  assert.equal(findPermanentDeleteTaskRecordStepIndex(steps, "delete_task_incidents"), -1)
  assert.deepEqual(steps, [
    "select_evidences",
    "remove_evidences_storage",
    "delete_evidences",
    "select_task_photos",
    "remove_task_photos_storage",
    "delete_task_photos",
    "delete_tasks",
  ])
})

test("task with incidents deletes incident storage and rows before the task", () => {
  const steps = resolvePermanentDeleteTaskRecordStepSequence({
    hasIncidents: true,
    hasIncidentPhotoStorage: true,
    hasEvidences: true,
    hasTaskPhotos: false,
  })

  const incidentDeleteIndex = findPermanentDeleteTaskRecordStepIndex(
    steps,
    "delete_task_incidents"
  )
  const evidenceDeleteIndex = findPermanentDeleteTaskRecordStepIndex(
    steps,
    "delete_evidences"
  )
  const taskDeleteIndex = findPermanentDeleteTaskRecordStepIndex(steps, "delete_tasks")

  assert.ok(incidentDeleteIndex >= 0)
  assert.ok(
    findPermanentDeleteTaskRecordStepIndex(
      steps,
      "remove_task_incident_photos_storage"
    ) < incidentDeleteIndex
  )
  assert.ok(incidentDeleteIndex < evidenceDeleteIndex)
  assert.ok(incidentDeleteIndex < taskDeleteIndex)
})

test("incident cleanup is modeled for every incident status without filtering", () => {
  const steps = resolvePermanentDeleteTaskRecordStepSequence({
    hasIncidents: true,
    hasIncidentPhotoStorage: false,
    hasEvidences: false,
    hasTaskPhotos: false,
  })

  assert.deepEqual(steps, [
    "select_task_incidents",
    "select_task_incident_photos",
    "delete_task_incidents",
    "delete_tasks",
  ])
})

test("customer permanent delete reuses the central task records helper contract", () => {
  assert.deepEqual(PERMANENT_DELETE_TASK_RECORDS_SHARED_BY, [
    "permanentDeleteTask",
    "permanentDeleteCustomer",
  ])
})
