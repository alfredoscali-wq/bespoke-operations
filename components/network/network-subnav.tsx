import Link from "next/link"

import { cn } from "@/lib/utils"

const ITEMS = [
  { id: "home", href: "/network", label: "Resumen" },
  { id: "agents", href: "/network/agents", label: "Agents" },
  { id: "sites", href: "/network/sites", label: "Sitios" },
  { id: "devices", href: "/network/devices", label: "Devices" },
  { id: "topology", href: "/network/topology", label: "Topología" },
  { id: "discovery", href: "/network/discovery", label: "Discovery" },
] as const

export function NetworkSubnav({
  current,
}: {
  current: (typeof ITEMS)[number]["id"]
}) {
  return (
    <nav className="flex flex-wrap gap-2">
      {ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm",
            current === item.id
              ? "border-primary/30 bg-primary/10 text-foreground"
              : "border-border/70 text-muted-foreground hover:bg-muted/50"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
