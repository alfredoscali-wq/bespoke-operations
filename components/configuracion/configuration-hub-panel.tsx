"use client"

import Link from "next/link"
import { ArrowRight, Building2, ListChecks, Shield, TriangleAlert } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  canAccessSettingsConfigWebModule,
  canManageCompanyAreasWeb,
} from "@/lib/roles/web-module-access"

type ConfigLinkItem = {
  title: string
  description: string
  href?: string
  comingSoon?: boolean
}

type ConfigCategory = {
  id: string
  label: string
  icon: typeof ListChecks
  items: ConfigLinkItem[]
}

function ConfigItemRow({ item }: { item: ConfigLinkItem }) {
  if (item.comingSoon) {
    return (
      <div className="flex items-start justify-between gap-4 rounded-lg border border-dashed bg-muted/10 px-4 py-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
        <Badge variant="secondary">Próximamente</Badge>
      </div>
    )
  }

  if (!item.href) {
    return null
  }

  return (
    <Link
      href={item.href}
      className="flex items-start justify-between gap-4 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        <p className="text-sm text-muted-foreground">{item.description}</p>
      </div>
      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

export function ConfigurationHubPanel() {
  const { sessionUser } = useAuth()
  const canAccessWorkOrderTypes = canAccessSettingsConfigWebModule(sessionUser)
  const canAccessIncidentTypes = canAccessSettingsConfigWebModule(sessionUser)
  const canAccessAreas = canManageCompanyAreasWeb(sessionUser)

  const categories: ConfigCategory[] = [
    {
      id: "operation",
      label: "Operación",
      icon: ListChecks,
      items: [
        ...(canAccessWorkOrderTypes
          ? [
              {
                title: "Tipos de OT",
                description:
                  "Defina tipos de orden de trabajo y el checklist operativo asociado.",
                href: "/configuracion/tipos-ot",
              },
            ]
          : []),
        ...(canAccessIncidentTypes
          ? [
              {
                title: "Tipos de Incidencia",
                description:
                  "Clasificación de incidencias reportadas durante la ejecución de OT.",
                href: "/configuracion/tipos-incidencia",
              },
            ]
          : []),
      ],
    },
    {
      id: "company",
      label: "Empresa",
      icon: Building2,
      items: [
        {
          title: "Datos de la Empresa",
          description:
            "Información corporativa, branding y parámetros generales de la organización.",
          comingSoon: true,
        },
      ],
    },
    {
      id: "security",
      label: "Seguridad",
      icon: Shield,
      items: [
        ...(canAccessAreas
          ? [
              {
                title: "Áreas",
                description:
                  "Configure qué pantallas puede utilizar cada Área de su empresa.",
                href: "/configuracion/roles",
              },
            ]
          : []),
        {
          title: "Permisos",
          description: "Control granular de acciones permitidas por rol.",
          comingSoon: true,
        },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Parámetros de la empresa para adaptar Bespoke Operations a su operación.
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((category) => {
          const Icon = category.icon

          return (
            <Card key={category.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-muted-foreground" />
                  {category.label}
                </CardTitle>
                <CardDescription>
                  {category.id === "operation" && (
                    <>
                      Definiciones operativas que impactan la planificación y
                      ejecución de campo.
                    </>
                  )}
                  {category.id === "company" && (
                    <>Identidad y datos institucionales de la organización.</>
                  )}
                  {category.id === "security" && (
                    <>Accesos, áreas y políticas de la plataforma.</>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {category.items.length === 0 ? (
                  <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    No hay opciones disponibles para su perfil en esta categoría.
                  </div>
                ) : (
                  category.items.map((item) => (
                    <ConfigItemRow key={item.title} item={item} />
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
