"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, XCircle } from "lucide-react"

import { EvidenceChecklistPanel } from "@/components/evidencias/evidence-checklist-panel"
import { EvidenceNavigationBar } from "@/components/evidencias/evidence-navigation"
import { EvidencePreview } from "@/components/evidencias/evidence-preview"
import { EvidenceRejectDialog } from "@/components/evidencias/evidence-reject-dialog"
import { EvidenceVoidDialog } from "@/components/evidencias/evidence-void-dialog"
import { EvidenceUploadHistory } from "@/components/evidencias/evidence-upload-history"
import { useEvidence } from "@/components/evidencias/evidence-provider"
import { useAuth } from "@/components/auth/auth-provider"
import {
  EvidenceCategoryBadge,
  EvidenceStatusBadge,
  EvidenceTypeBadge,
  EvidenceVoidedBadge,
} from "@/components/evidencias/evidence-badges"
import { formatEvidenceDateTime } from "@/lib/evidence/constants"
import { formatAppUserRole } from "@/lib/auth/current-user"
import { resolveEvidenceUploadedByRole } from "@/lib/auth/evidence-uploader"
import {
  canVoidEvidence,
  resolveEvidenceVoidDetails,
} from "@/lib/evidence/utils"
import type { EvidenceNavigation, EvidenceRecord } from "@/lib/types/evidence"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type EvidenceDetailViewProps = {
  record: EvidenceRecord
  navigation: EvidenceNavigation
}

export function EvidenceDetailView({
  record,
  navigation,
}: EvidenceDetailViewProps) {
  const { approveEvidence, rejectEvidence, voidEvidence } = useEvidence()
  const { sessionUser } = useAuth()
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const uploadedByRole = resolveEvidenceUploadedByRole(record)
  const voidDetails = resolveEvidenceVoidDetails(record)
  const isVoided = Boolean(record.deletedAt)
  const canVoid =
    !isVoided && canVoidEvidence(sessionUser?.systemRole)

  function handleApprove() {
    const result = approveEvidence(record.id)
    if (result.success) {
      setActionMessage(result.message ?? null)
      setActionError(null)
    } else {
      setActionError(result.message ?? "No se pudo aprobar la evidencia.")
      setActionMessage(null)
    }
  }

  function handleReject(comment: string) {
    const result = rejectEvidence(record.id, comment)
    if (result.success) {
      setActionMessage(result.message ?? null)
      setActionError(null)
    } else {
      setActionError(result.message ?? "No se pudo rechazar la evidencia.")
      setActionMessage(null)
    }
  }

  function handleVoid(reason: string) {
    const result = voidEvidence(record.id, reason)
    if (result.success) {
      setActionMessage(result.message ?? null)
      setActionError(null)
    } else {
      setActionError(result.message ?? "No se pudo anular la evidencia.")
      setActionMessage(null)
    }
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 gap-1.5 text-muted-foreground"
        asChild
      >
        <Link href="/evidencias">
          <ArrowLeft className="size-4" />
          Volver a evidencias
        </Link>
      </Button>

      <EvidenceNavigationBar
        navigation={navigation}
        taskCode={record.taskCode}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <EvidenceCategoryBadge evidenceType={record.evidenceType} />
            <EvidenceTypeBadge type={record.type} />
            <EvidenceStatusBadge status={record.status} />
            {isVoided && <EvidenceVoidedBadge />}
          </div>
          <h2 className="text-xl font-semibold tracking-tight break-all sm:text-2xl">
            {record.fileName}
          </h2>
          <p className="text-sm text-muted-foreground">{record.description}</p>
        </div>

        {canVoid && (
          <div className="flex flex-wrap gap-2">
            {record.status === "pending-review" && (
              <>
                <Button
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleApprove}
                >
                  <CheckCircle2 className="size-4" />
                  Aprobar
                </Button>
                <Button
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => setRejectOpen(true)}
                >
                  <XCircle className="size-4" />
                  Rechazar
                </Button>
              </>
            )}
            <Button
              variant="outline"
              className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={() => setVoidOpen(true)}
            >
              <Ban className="size-4" />
              Anular evidencia
            </Button>
          </div>
        )}
      </div>

      {isVoided && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Evidencia anulada el{" "}
            {voidDetails.voidedAt
              ? formatEvidenceDateTime(voidDetails.voidedAt)
              : "—"}{" "}
            por {voidDetails.voidedBy ?? "—"}.
            {voidDetails.voidReason ? (
              <>
                {" "}
                Motivo: {voidDetails.voidReason}
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {actionMessage && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>{actionMessage}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <EvidencePreview record={record} />

          <EvidenceChecklistPanel
            taskId={record.taskId}
            taskCode={record.taskCode}
            taskTitle={record.taskTitle}
            evidenceCount={navigation.totalInTask}
          />

          <EvidenceUploadHistory history={record.uploadHistory} />
        </div>

        <Card className="shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
            <CardDescription>Información de la evidencia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Tipo de evidencia</p>
              <div className="mt-1">
                <EvidenceCategoryBadge evidenceType={record.evidenceType} />
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Proyecto</p>
              <Link
                href={`/obras/${record.projectId}`}
                className="font-medium text-primary hover:underline"
              >
                {record.projectCode}
              </Link>
              <p className="mt-0.5 text-muted-foreground">{record.projectName}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Tarea</p>
              <Link
                href={`/tareas/${record.taskId}`}
                className="font-medium text-primary hover:underline"
              >
                {record.taskCode}
              </Link>
              <p className="mt-0.5 text-muted-foreground">{record.taskTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {navigation.totalInTask}{" "}
                {navigation.totalInTask === 1
                  ? "evidencia registrada"
                  : "evidencias registradas"}
              </p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Subido por</p>
                <p className="font-medium">{record.worker}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rol</p>
                <p className="font-medium">
                  {uploadedByRole ? formatAppUserRole(uploadedByRole) : "—"}
                </p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Cuadrilla</p>
              <p className="font-medium">{record.crew}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Fecha de carga</p>
              <p className="font-medium">
                {formatEvidenceDateTime(record.uploadedAt)}
              </p>
            </div>
            <Separator />
            {isVoided && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Anulada por</p>
                  <p className="font-medium">{voidDetails.voidedBy ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Fecha de anulación
                  </p>
                  <p className="font-medium">
                    {voidDetails.voidedAt
                      ? formatEvidenceDateTime(voidDetails.voidedAt)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Motivo</p>
                  <p className="font-medium">{voidDetails.voidReason ?? "—"}</p>
                </div>
                <Separator />
              </>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Estado de aprobación</p>
              <div className="mt-1">
                <EvidenceStatusBadge status={record.status} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Comentarios</CardTitle>
          <CardDescription>
            Notas de supervisión y validación
          </CardDescription>
        </CardHeader>
        <CardContent>
          {record.comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin comentarios registrados
            </p>
          ) : (
            <div className="space-y-3">
              {record.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {comment.author}
                    </span>
                    <span>·</span>
                    <span>{formatEvidenceDateTime(comment.timestamp)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EvidenceRejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={handleReject}
        fileName={record.fileName}
      />

      <EvidenceVoidDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        onConfirm={handleVoid}
        fileName={record.fileName}
      />
    </div>
  )
}
