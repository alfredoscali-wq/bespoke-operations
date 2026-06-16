import { allNavItems } from "@/lib/navigation"

export function getPageMeta(pathname: string) {
  const match =
    [...allNavItems]
      .filter((item) =>
        item.href === "/"
          ? pathname === "/"
          : pathname.startsWith(item.href)
      )
      .sort((a, b) => b.href.length - a.href.length)[0] ?? allNavItems[0]

  return {
    title: match.pageTitle ?? match.title,
    subtitle: match.description ?? "Gestión operativa de infraestructura",
  }
}
