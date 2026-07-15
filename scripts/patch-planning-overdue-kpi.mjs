import { readFileSync, writeFileSync } from "node:fs"

const path = "components/planificacion/planning-module.tsx"
let s = readFileSync(path, "utf8")

function replaceOnce(source, from, to, label) {
  if (source.includes(to.slice(0, Math.min(40, to.length))) && label !== "force") {
    // continue
  }
  if (!source.includes(from)) {
    console.error(`MISSING: ${label}`)
    console.error(JSON.stringify(from.slice(0, 120)))
    process.exit(1)
  }
  return source.replace(from, to)
}

if (!s.includes("overdueFilterActive")) {
  s = replaceOnce(
    s,
    "const [crewFilterId, setCrewFilterId] = useState<string | null>(\r\n\r\n    initialFilters.crewFilterId ?? null\r\n\r\n  )",
    "const [crewFilterId, setCrewFilterId] = useState<string | null>(\r\n\r\n    initialFilters.crewFilterId ?? null\r\n\r\n  )\r\n\r\n  const [overdueFilterActive, setOverdueFilterActive] = useState(false)",
    "crewFilter state"
  )
}

if (!s.includes("overdueCount")) {
  s = replaceOnce(
    s,
    "const filteredTasks = useMemo(() => {\r\n\r\n    if (isConfirmedMode) {\r\n\r\n      return filterConfirmedDispatchTasksForPlanning(tasks, { date })\r\n\r\n    }\r\n\r\n\r\n\r\n    return filterPlanningOperationalViewTasks(tasks, { date })\r\n\r\n  }, [tasks, date, isConfirmedMode])",
    "const overdueCount = useMemo(\r\n    () => countOperationallyOverdueTasks(tasks.filter(isWorkOrderTask)),\r\n    [tasks]\r\n  )\r\n\r\n  const filteredTasks = useMemo(() => {\r\n    if (overdueFilterActive) {\r\n      return filterOperationallyOverdueTasks(tasks.filter(isWorkOrderTask))\r\n    }\r\n\r\n    if (isConfirmedMode) {\r\n      return filterConfirmedDispatchTasksForPlanning(tasks, { date })\r\n    }\r\n\r\n    return filterPlanningOperationalViewTasks(tasks, { date })\r\n  }, [tasks, date, isConfirmedMode, overdueFilterActive])",
    "filteredTasks"
  )
}

if (!s.includes("overdueCount={overdueCount}")) {
  s = replaceOnce(
    s,
    "<PlanningOperationalSummary\r\n\r\n          programmedCount={filteredTasks.length}",
    "<PlanningOperationalSummary\r\n\r\n          programmedCount={filteredTasks.length}\r\n\r\n          overdueCount={overdueCount}\r\n\r\n          overdueFilterActive={overdueFilterActive}",
    "summary props"
  )
}

if (!s.includes("onSelectOverdue")) {
  s = replaceOnce(
    s,
    "onSelectAll={() => {\r\n\r\n            setCrewFilterId(null)\r\n\r\n            setCrewActionError(null)\r\n\r\n          }}",
    "onSelectAll={() => {\r\n\r\n            setCrewFilterId(null)\r\n\r\n            setOverdueFilterActive(false)\r\n\r\n            setCrewActionError(null)\r\n\r\n          }}\r\n\r\n          onSelectOverdue={() => {\r\n\r\n            setCrewFilterId(null)\r\n\r\n            setOverdueFilterActive(true)\r\n\r\n            setCrewActionError(null)\r\n\r\n          }}",
    "onSelectAll"
  )
}

if (!s.includes("setOverdueFilterActive(false)\r\n\r\n            setCrewActionError(null)\r\n\r\n          }}\r\n\r\n          onPlanCrew")) {
  s = replaceOnce(
    s,
    "onSelectCrew={(crewId) => {\r\n\r\n            setCrewFilterId(crewId)\r\n\r\n            setCrewActionError(null)\r\n\r\n          }}",
    "onSelectCrew={(crewId) => {\r\n\r\n            setCrewFilterId(crewId)\r\n\r\n            setOverdueFilterActive(false)\r\n\r\n            setCrewActionError(null)\r\n\r\n          }}",
    "onSelectCrew"
  )
}

writeFileSync(path, s)
console.log("OK planning-module patched")
