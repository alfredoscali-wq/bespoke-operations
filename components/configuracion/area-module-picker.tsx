"use client"

import {
  applyModuleSelection,
  applySidebarGroupSelection,
  buildAreaConfigSidebarGroups,
  getSidebarGroupSelectionState,
  type AreaConfigScreen,
  type AreaConfigSidebarGroup,
} from "@/lib/navigation/area-config-screen-tree"
import type { AppModuleKey, ModuleVisibilityMap } from "@/lib/roles/app-modules"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const AREA_CONFIG_GROUPS = buildAreaConfigSidebarGroups()

type AreaModulePickerProps = {
  visibility: ModuleVisibilityMap
  disabled?: boolean
  onChange: (visibility: ModuleVisibilityMap) => void
}

function groupCheckboxState(state: "all" | "some" | "none"): boolean | "indeterminate" {
  if (state === "all") return true
  if (state === "some") return "indeterminate"
  return false
}

function ScreenRow({
  screen,
  checked,
  disabled,
  onToggle,
}: {
  screen: AreaConfigScreen
  checked: boolean
  disabled?: boolean
  onToggle: (moduleKey: AppModuleKey, enabled: boolean) => void
}) {
  const Icon = screen.icon
  return (
    <div className="flex items-center gap-2.5 py-1.5 pl-7 pr-2">
      <Checkbox
        id={`area-screen-${screen.id}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onToggle(screen.moduleKey, value === true)}
      />
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Label
        htmlFor={`area-screen-${screen.id}`}
        className={cn(
          "text-sm leading-snug text-foreground",
          disabled && "text-muted-foreground"
        )}
      >
        {screen.title}
      </Label>
    </div>
  )
}

function SidebarGroupBlock({
  group,
  visibility,
  disabled,
  onToggleGroup,
  onToggleModule,
}: {
  group: AreaConfigSidebarGroup
  visibility: ModuleVisibilityMap
  disabled?: boolean
  onToggleGroup: (group: AreaConfigSidebarGroup, enabled: boolean) => void
  onToggleModule: (moduleKey: AppModuleKey, enabled: boolean) => void
}) {
  const selection = getSidebarGroupSelectionState(group.screens, visibility)
  const GroupIcon = group.icon

  return (
    <section
      className="rounded-lg border bg-card"
      data-testid={`area-config-group-${group.id}`}
    >
      <div className="flex items-center gap-2.5 border-b bg-muted/25 px-3 py-2">
        <Checkbox
          id={`area-group-${group.id}`}
          checked={groupCheckboxState(selection)}
          disabled={disabled}
          onCheckedChange={(value) => onToggleGroup(group, value === true)}
        />
        <GroupIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Label
          htmlFor={`area-group-${group.id}`}
          className="text-xs font-semibold tracking-[0.14em] text-foreground uppercase"
        >
          {group.label}
        </Label>
      </div>
      <div className="py-1">
        {group.screens.map((screen) => (
          <ScreenRow
            key={screen.id}
            screen={screen}
            checked={visibility[screen.moduleKey]}
            disabled={disabled}
            onToggle={onToggleModule}
          />
        ))}
      </div>
    </section>
  )
}

export function AreaModulePicker({
  visibility,
  disabled = false,
  onChange,
}: AreaModulePickerProps) {
  function handleToggleGroup(group: AreaConfigSidebarGroup, enabled: boolean) {
    onChange(applySidebarGroupSelection(visibility, group.screens, enabled))
  }

  function handleToggleModule(moduleKey: AppModuleKey, enabled: boolean) {
    onChange(applyModuleSelection(visibility, moduleKey, enabled))
  }

  return (
    <div className="space-y-3" data-testid="area-module-picker">
      {AREA_CONFIG_GROUPS.map((group) => (
        <SidebarGroupBlock
          key={group.id}
          group={group}
          visibility={visibility}
          disabled={disabled}
          onToggleGroup={handleToggleGroup}
          onToggleModule={handleToggleModule}
        />
      ))}
    </div>
  )
}
