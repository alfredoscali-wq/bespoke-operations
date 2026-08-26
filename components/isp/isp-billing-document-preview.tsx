import { Receipt } from "lucide-react"

import {
  ISP_BILLING_DOCUMENT_ARCA_PENDING,
  ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE,
  ISP_BILLING_DOCUMENT_TYPE_LABELS,
} from "@/lib/isp/billing-constants"
import { formatCuit, isFiscalBillingDocument } from "@/lib/isp/billing-integrity"
import {
  formatBillingMoney,
  vatConditionLabel,
} from "@/lib/isp/billing-document-integrity"
import type { IspBillingDocument } from "@/lib/isp/billing-document-types"
import { formatDateOnly } from "@/lib/dates/date-only"

export function IspBillingDocumentPreview({
  document,
}: {
  document: IspBillingDocument
}) {
  const fiscal = isFiscalBillingDocument(document.documentType)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {document.issuerLogoUrlSnapshot ? (
            <img
              src={document.issuerLogoUrlSnapshot}
              alt=""
              className="h-14 w-auto object-contain"
            />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-lg bg-slate-50 text-slate-300">
              <Receipt className="size-6" />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-base font-semibold text-slate-900">
              {document.issuerLegalNameSnapshot}
            </p>
            <p className="text-sm text-slate-600">
              CUIT {formatCuit(document.issuerTaxIdSnapshot) || "—"} ·{" "}
              {vatConditionLabel(document.issuerVatConditionSnapshot)}
            </p>
            <p className="text-sm text-slate-500">
              {[
                document.issuerTaxAddressSnapshot,
                document.issuerCitySnapshot,
                document.issuerProvinceSnapshot,
                document.issuerPostalCodeSnapshot,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-800">
            {ISP_BILLING_DOCUMENT_TYPE_LABELS[document.documentType]}
          </p>
          <p className="text-sm text-slate-500">
            {document.formattedNumber ?? "Sin número"}
          </p>
          <p className="text-xs text-slate-400">
            PV {String(document.pointOfSaleNumber).padStart(4, "0")}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Cliente
          </p>
          <p className="mt-1 font-medium text-slate-800">
            {document.customerNameSnapshot}
          </p>
          <p className="text-slate-500">
            {document.customerDocumentTypeSnapshot.toUpperCase()}{" "}
            {document.customerDocumentNumberSnapshot ||
              document.customerTaxIdSnapshot ||
              "—"}
          </p>
          {document.customerVatConditionSnapshot ? (
            <p className="text-slate-500">
              {vatConditionLabel(document.customerVatConditionSnapshot)}
            </p>
          ) : null}
          <p className="text-slate-500">
            {[
              document.customerTaxAddressSnapshot,
              document.customerCitySnapshot,
              document.customerProvinceSnapshot,
              document.customerPostalCodeSnapshot,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-slate-500">
            Fecha {formatDateOnly(document.issueDate, { locale: "es-AR" })}
          </p>
          {document.dueDate ? (
            <p className="text-slate-500">
              Vence {formatDateOnly(document.dueDate, { locale: "es-AR" })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Concepto</th>
              <th className="px-3 py-2 font-medium">Cant.</th>
              <th className="px-3 py-2 font-medium">P. unit.</th>
              <th className="px-3 py-2 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {document.items.map((item) => (
              <tr key={item.id || `${item.sortOrder}-${item.description}`} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">{item.description}</td>
                <td className="px-3 py-2 text-slate-500">{item.quantity}</td>
                <td className="px-3 py-2 text-slate-500">
                  {formatBillingMoney(item.unitPrice)}
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-800">
                  {formatBillingMoney(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between text-slate-500">
          <dt>Subtotal</dt>
          <dd>{formatBillingMoney(document.subtotal)}</dd>
        </div>
        <div className="flex justify-between text-slate-500">
          <dt>Descuentos</dt>
          <dd>{formatBillingMoney(document.discountTotal)}</dd>
        </div>
        <div className="flex justify-between text-slate-500">
          <dt>Impuestos</dt>
          <dd>{formatBillingMoney(document.taxTotal)}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
          <dt>Total</dt>
          <dd>{formatBillingMoney(document.total)}</dd>
        </div>
      </dl>

      {document.observations.trim() ? (
        <p className="mt-4 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Observaciones: </span>
          {document.observations}
        </p>
      ) : null}

      <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {fiscal
          ? ISP_BILLING_DOCUMENT_ARCA_PENDING
          : ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE}
      </p>
    </div>
  )
}
