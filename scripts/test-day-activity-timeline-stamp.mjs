/**
 * Sprint Activity Engine — visible date+time on Jornada timeline cards.
 */
import assert from "node:assert/strict"
import test from "node:test"

import { formatDayActivityTimelineStamp } from "../lib/activity/activity-timeline-groups.ts"

test("formatDayActivityTimelineStamp: Hoy · HH:mm for today", () => {
  const now = new Date(2026, 7, 7, 18, 0, 0) // 7 Aug 2026 local
  const stamp = formatDayActivityTimelineStamp(
    new Date(2026, 7, 7, 12, 53, 4).toISOString(),
    now
  )
  assert.equal(stamp, "Hoy · 12:53")
})

test("formatDayActivityTimelineStamp: Ayer · HH:mm for yesterday", () => {
  const now = new Date(2026, 7, 7, 18, 0, 0)
  const stamp = formatDayActivityTimelineStamp(
    new Date(2026, 7, 6, 14, 22, 0).toISOString(),
    now
  )
  assert.equal(stamp, "Ayer · 14:22")
})

test("formatDayActivityTimelineStamp: absolute date for older days", () => {
  const now = new Date(2026, 7, 7, 18, 0, 0)
  const stamp = formatDayActivityTimelineStamp(
    new Date(2026, 7, 5, 9, 41, 0).toISOString(),
    now
  )
  assert.equal(stamp, "05 Ago 2026 · 09:41")
})
