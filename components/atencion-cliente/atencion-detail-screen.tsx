"use client"

import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  formatCustomerAtencionChannelLabel,
  formatCustomerAtencionMotivoLabel,
  formatCustomerAtencionResultadoLabel,
} from "@/lib/customer-atenciones/format"
import { getCustomerById } from "@/lib/supabase/customers.browser"
import { getEmployeeById } from "@/lib/supabase/employees.browser"
import type { CustomerAtencion } from "@/lib/types/customer-atenciones"
import type { Customer } from "@/lib/types/customers"
import type { Employee } from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type AtencionDetailScreenProps = {
  atencionId: string
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

export function AtencionDetailScreen({ atencionId }: AtencionDetailScreenProps) {
  const { fetchAtencionById } = useAtencionCliente()
  const [atencion, setAtencion] = useState<CustomerAtencion | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      setIsLoading(true)

      try {
        const loadedAtencion = await fetchAtencionById(atencionId)

        if (cancelled) return

        if (!loadedAtencion) {
          setAtencion(null)
          return
        }

        const [customerResult, employeeResult] = await Promise.all([
          getCustomerById(loadedAtencion.customerId),
          getEmployeeById(loadedAtencion.attendedByEmployeeId),
        ])

        if (cancelled) return

        setAtencion(loadedAtencion)
        setCustomer(customerResult.data)
        setEmployee(employeeResult.data)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [atencionId, fetchAtencionById])

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando atención…</p>
  }

  if (!atencion) {
    notFound()
  }

  const attendedByLabel = employee
    ? `${employee.firstName} ${employee.lastName}`.trim()
    : "—"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link href="/atencion-cliente" aria-label="Volver al listado">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Detalle de Atención
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(atencion.createdAt).toLocaleString("es-AR")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información general</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <DetailField
            label="Cliente"
            value={
              customer ? (
                <Link
                  href={`/clientes/${customer.id}`}
                  className="text-primary hover:underline"
                >
                  {customer.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <DetailField label="Atendido por" value={attendedByLabel} />
          <DetailField
            label="Canal"
            value={formatCustomerAtencionChannelLabel(atencion.channel)}
          />
          <DetailField
            label="Motivo"
            value={formatCustomerAtencionMotivoLabel(atencion.motivo)}
          />
          <DetailField
            label="Resultado"
            value={formatCustomerAtencionResultadoLabel(atencion.resultado)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle y resolución</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <DetailField label="Detalle" value={atencion.detail} />
          <DetailField label="Resolución" value={atencion.resolution} />
        </CardContent>
      </Card>
    </div>
  )
}
