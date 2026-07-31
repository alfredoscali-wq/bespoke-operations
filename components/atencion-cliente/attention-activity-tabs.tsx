"use client"

import type { ReactNode } from "react"

import { EntityActivityTimeline } from "@/components/activity/entity-activity-timeline"
import { ATTENTION_TIMELINE_FILTERS } from "@/lib/activity/activity-timeline-types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AttentionActivityTabsProps = {
  attentionId: string
  events: ReactNode
}

export function AttentionActivityTabs({
  attentionId,
  events,
}: AttentionActivityTabsProps) {
  return (
    <Tabs defaultValue="eventos" className="space-y-4">
      <div className="overflow-x-auto">
        <TabsList variant="line" className="w-full min-w-max justify-start">
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="eventos">{events}</TabsContent>
      <TabsContent value="activity">
        <EntityActivityTimeline
          scope={{
            kind: "entity",
            entityType: "attention",
            entityId: attentionId,
          }}
          visibleFilters={ATTENTION_TIMELINE_FILTERS}
          layout="embedded"
          showStats
        />
      </TabsContent>
    </Tabs>
  )
}
