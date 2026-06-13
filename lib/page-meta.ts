import { mainNavItems } from "@/lib/navigation"

export function getPageMeta(pathname: string) {
  const match =
    mainNavItems.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
    ) ?? mainNavItems[0]

  return {
    title: match.title,
    subtitle: match.description ?? "Gestión operativa de infraestructura",
  }
}
