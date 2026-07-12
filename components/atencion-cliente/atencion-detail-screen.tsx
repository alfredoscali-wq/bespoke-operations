"use client"

import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  canStartConsultationManagement,
  isConsultationManagedByAnotherEmployee,
  isConsultationManagedByEmployee,
} from "@/lib/customer-atenciones/consultation-management"
import {
  CUSTOMER_ATENCION_NEXT_STEP_OPTIONS,
  formatCustomerAtencionChannelLabel,
  formatCustomerAtencionMotivoLabel,
  formatCustomerAtencionNextStepLabel,
  formatCustomerAtencionStatusLabel,
} from "@/lib/customer-atenciones/format"
import { getCustomerById } from "@/lib/supabase/customers.browser"
import { getEmployeeById } from "@/lib/supabase/employees.browser"
import type {
  CustomerAtencion,
  CustomerAtencionNextStep,
} from "@/lib/types/customer-atenciones"
import type { Customer } from "@/lib/types/customers"
import type { Employee } from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

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

function formatEmployeeName(employee: Employee | null | undefined): string {
  if (!employee) {
    return "—"
  }

  return `${employee.firstName} ${employee.lastName}`.trim() || "—"
}

export function AtencionDetailScreen({ atencionId }: AtencionDetailScreenProps) {
  const {
    refreshAtencionById,
    currentEmployeeId,
    startConsultationManagement,
    resolveConsultation,
    deferConsultation,
  } = useAtencionCliente()
  const [atencion, setAtencion] = useState<CustomerAtencion | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [creatorEmployee, setCreatorEmployee] = useState<Employee | null>(null)
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [isDeferring, setIsDeferring] = useState(false)
  const [resolution, setResolution] = useState("")
  const [deferNextStep, setDeferNextStep] = useState<CustomerAtencionNextStep | "">(
    ""
  )

  const loadDetail = useCallback(async () => {
    setIsLoading(true)

    try {
      const loadedAtencion = await refreshAtencionById(atencionId)

      if (!loadedAtencion) {
        setAtencion(null)
        return
      }

      const [customerResult, creatorResult, activeResult] = await Promise.all([
        getCustomerById(loadedAtencion.customerId),
        getEmployeeById(loadedAtencion.attendedByEmployeeId),
        loadedAtencion.activeManagementEmployeeId
          ? getEmployeeById(loadedAtencion.activeManagementEmployeeId)
          : Promise.resolve({ data: null, error: null }),
      ])

      setAtencion(loadedAtencion)
      setCustomer(customerResult.data)
      setCreatorEmployee(creatorResult.data)
      setActiveEmployee(activeResult.data)
    } finally {
      setIsLoading(false)
    }
  }, [atencionId, refreshAtencionById])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  async function handleStartManagement() {
    setActionError(null)
    setIsStarting(true)

    try {
      const result = await startConsultationManagement(atencionId)

      if (!result.success) {
        setActionError(result.message)
        await loadDetail()
        return
      }

      await loadDetail()
    } finally {
      setIsStarting(false)
    }
  }

  async function handleResolve() {
    setActionError(null)

    if (!resolution.trim()) {
      setActionError("Completá la resolución de la consulta.")
      return
    }

    setIsResolving(true)

    try {
      const result = await resolveConsultation(atencionId, resolution)

      if (!result.success) {
        setActionError(result.message)
        return
      }

      setResolution("")
      await loadDetail()
    } finally {
      setIsResolving(false)
    }
  }

  async function handleDefer() {
    setActionError(null)

    if (!deferNextStep) {
      setActionError("Seleccioná el próximo paso para continuar después.")
      return
    }

    setIsDeferring(true)

    try {
      const result = await deferConsultation(atencionId, deferNextStep)

      if (!result.success) {
        setActionError(result.message)
        return
      }

      setDeferNextStep("")
      await loadDetail()
    } finally {
      setIsDeferring(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando consulta…</p>
  }

  if (!atencion) {
    notFound()
  }

  const isManagedByCurrentEmployee = isConsultationManagedByEmployee(
    atencion,
    currentEmployeeId
  )
  const isManagedByAnother = isConsultationManagedByAnotherEmployee(
    atencion,
    currentEmployeeId
  )
  const canStart = canStartConsultationManagement(atencion.status)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link href="/atencion-cliente" aria-label="Volver a la bandeja">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Detalle de Consulta
          </h1>
          <p className="text-sm text-muted-foreground">
            Creada el {new Date(atencion.createdAt).toLocaleString("es-AR")}
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
          <DetailField
            label="Creada por"
            value={formatEmployeeName(creatorEmployee)}
          />
          <DetailField
            label="Canal"
            value={formatCustomerAtencionChannelLabel(atencion.channel)}
          />
          <DetailField
            label="Motivo"
            value={formatCustomerAtencionMotivoLabel(atencion.motivo)}
          />
          <DetailField
            label="Estado"
            value={formatCustomerAtencionStatusLabel(atencion.status)}
          />
          <DetailField
            label="Próximo paso"
            value={
              atencion.nextStep
                ? formatCustomerAtencionNextStepLabel(atencion.nextStep)
                : "—"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Descripción</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailField label="Detalle" value={atencion.detail} />
        </CardContent>
      </Card>

      {atencion.status === "resuelta" ? (
        <Card>
          <CardHeader>
            <CardTitle>Resolución</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailField label="Qué se hizo" value={atencion.resolution} />
          </CardContent>
        </Card>
      ) : null}

      {isManagedByAnother ? (
        <Card>
          <CardHeader>
            <CardTitle>Gestión activa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              En gestión por{" "}
              <span className="font-medium text-foreground">
                {formatEmployeeName(activeEmployee)}
              </span>
              {atencion.activeManagementStartedAt
                ? ` desde ${new Date(atencion.activeManagementStartedAt).toLocaleString("es-AR")}`
                : null}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {canStart ? (
        <Card>
          <CardHeader>
            <CardTitle>Gestión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta consulta está disponible en la bandeja compartida.
            </p>
            <Button onClick={handleStartManagement} disabled={isStarting}>
              {isStarting ? "Iniciando…" : "Iniciar gestión"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isManagedByCurrentEmployee ? (
        <Card>
          <CardHeader>
            <CardTitle>Gestión en curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Estás gestionando esta consulta
              {atencion.activeManagementStartedAt
                ? ` desde ${new Date(atencion.activeManagementStartedAt).toLocaleString("es-AR")}`
                : null}
              .
            </p>

            <div className="space-y-2">
              <Label htmlFor="consultation-resolution">Resolución</Label>
              <Textarea
                id="consultation-resolution"
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                rows={3}
                placeholder="Qué se hizo para resolver la consulta"
              />
              <Button onClick={handleResolve} disabled={isResolving}>
                {isResolving ? "Guardando…" : "Resolver Consulta"}
              </Button>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="consultation-defer-next-step">Continuar después</Label>
              <Select
                value={deferNextStep}
                onValueChange={(value) =>
                  setDeferNextStep(value as CustomerAtencionNextStep)
                }
              >
                <SelectTrigger id="consultation-defer-next-step" className="w-full">
                  <SelectValue placeholder="Seleccionar próximo paso" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_ATENCION_NEXT_STEP_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleDefer}
                disabled={isDeferring}
              >
                {isDeferring ? "Guardando…" : "Continuar después"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}
    </div>
  )
}
