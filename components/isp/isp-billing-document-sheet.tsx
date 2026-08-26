import type { ReactNode } from "react"

import {
  BILLING_DOCUMENT_TABLE_COLUMNS,
  type BillingDocumentTemplateModel,
} from "@/lib/isp/billing-document-template"
import { cn } from "@/lib/utils"

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[9px] font-medium tracking-[0.18em] text-primary uppercase">
      {children}
    </p>
  )
}

function Hairline({ accent = false }: { accent?: boolean }) {
  return (
    <div
      className={cn("h-px w-full", accent ? "bg-primary/45" : "bg-neutral-200")}
    />
  )
}

function IssuerLogo({
  model,
  className,
}: {
  model: BillingDocumentTemplateModel
  className?: string
}) {
  if (!model.issuer.showLogo || !model.issuer.logoUrl) return null
  return (
    <img
      src={model.issuer.logoUrl}
      alt=""
      className={cn("h-11 w-auto max-w-[140px] object-contain", className)}
    />
  )
}

function IssuerBlock({ model }: { model: BillingDocumentTemplateModel }) {
  const position = model.issuer.logoPosition
  const logo = <IssuerLogo model={model} />
  const text = (
    <div className="min-w-0 space-y-1">
      <p className="text-[15px] leading-tight font-semibold tracking-tight text-neutral-900">
        {model.issuer.legalName}
      </p>
      <p className="text-[11px] text-neutral-600">
        CUIT {model.issuer.taxId}
        {model.issuer.vatConditionLabel !== "—"
          ? ` · ${model.issuer.vatConditionLabel}`
          : ""}
      </p>
      {model.issuer.addressLine ? (
        <p className="text-[11px] text-neutral-500">{model.issuer.addressLine}</p>
      ) : null}
      {model.issuer.localityLine ? (
        <p className="text-[11px] text-neutral-500">{model.issuer.localityLine}</p>
      ) : null}
      {model.issuer.phone || model.issuer.email ? (
        <p className="text-[11px] text-neutral-500">
          {[model.issuer.phone, model.issuer.email].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </div>
  )

  if (!logo) return text

  if (position === "center") {
    return (
      <div className="space-y-3">
        <div className="flex justify-center">{logo}</div>
        {text}
      </div>
    )
  }

  if (position === "right") {
    return (
      <div className="flex items-start justify-between gap-4">
        {text}
        {logo}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-4">
      {logo}
      {text}
    </div>
  )
}

function IdentificationBox({ model }: { model: BillingDocumentTemplateModel }) {
  return (
    <div className="w-[148px] shrink-0 border border-primary/35 px-3 py-3 text-center">
      {model.identification.letter ? (
        <p className="text-[34px] leading-none font-semibold tracking-tight text-primary">
          {model.identification.letter}
        </p>
      ) : null}
      <p
        className={cn(
          "font-medium tracking-[0.18em] text-neutral-800 uppercase",
          model.identification.letter ? "mt-2 text-[9px]" : "text-[11px]"
        )}
      >
        {model.identification.kindLabel}
      </p>
      <p className="mt-2 font-mono text-[11px] tracking-wide text-neutral-800">
        {model.identification.numberLabel}
      </p>
      <p className="mt-1 text-[10px] text-neutral-500">
        {model.identification.issueDateLabel}
      </p>
      {model.identification.dueDateLabel ? (
        <p className="mt-0.5 text-[9px] text-neutral-400">
          Vence {model.identification.dueDateLabel}
        </p>
      ) : null}
    </div>
  )
}

export function IspBillingDocumentA4Stage({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto bg-[#eceef1] px-3 py-6 sm:px-8",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[min(100%,210mm)]">{children}</div>
    </div>
  )
}

export function IspBillingDocumentSheet({
  model,
}: {
  model: BillingDocumentTemplateModel
}) {
  return (
    <article
      data-billing-document-sheet="true"
      className="bg-white text-[#1c2028] shadow-[0_12px_40px_rgba(15,23,42,0.10)]"
      style={{ minHeight: "297mm", padding: "14mm 16mm 16mm" }}
    >
      <header className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <IssuerBlock model={model} />
        </div>
        <IdentificationBox model={model} />
      </header>

      <div className="mt-6">
        <Hairline accent />
      </div>

      <section className="mt-6">
        <SectionLabel>Datos del cliente</SectionLabel>
        <div className="mt-1.5">
          <Hairline />
        </div>
        <div className="mt-3 grid gap-x-8 gap-y-2 text-[11px] sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[13px] font-medium text-neutral-900">
              {model.customer.name}
            </p>
            <p className="text-neutral-500">{model.customer.documentLabel}</p>
            {model.customer.vatConditionLabel ? (
              <p className="text-neutral-500">{model.customer.vatConditionLabel}</p>
            ) : null}
          </div>
          <div className="space-y-1 text-neutral-500 sm:text-right">
            {model.customer.addressLine ? <p>{model.customer.addressLine}</p> : null}
            {model.customer.localityLine ? (
              <p>{model.customer.localityLine}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <SectionLabel>Conceptos</SectionLabel>
        <div className="mt-3">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-primary/10 text-primary">
                {BILLING_DOCUMENT_TABLE_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "border-b border-primary/25 py-2 font-medium tracking-[0.12em] uppercase",
                      column.key === "quantity" && "w-14 pr-2 text-left",
                      column.key === "description" && "px-2 text-left",
                      column.key === "unitPrice" && "w-28 px-2 text-right",
                      column.key === "amount" && "w-28 pl-2 text-right"
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.items.map((item, index) => (
                <tr
                  key={`${item.description}-${index}`}
                  className="border-b border-neutral-200"
                >
                  <td className="py-2.5 pr-2 align-top text-neutral-500">
                    {item.quantityLabel}
                  </td>
                  <td className="px-2 py-2.5 align-top text-neutral-800">
                    {item.description}
                  </td>
                  <td className="px-2 py-2.5 align-top text-right tabular-nums text-neutral-500">
                    {item.unitPriceLabel}
                  </td>
                  <td className="py-2.5 pl-2 align-top text-right tabular-nums text-neutral-800">
                    {item.amountLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dl className="ml-auto mt-6 w-full max-w-[240px] space-y-1.5 text-[11px]">
        {model.totals.map((row) => (
          <div
            key={row.label}
            className={cn(
              "flex items-baseline justify-between gap-6",
              row.emphasize &&
                "mt-2 border-t border-neutral-800 pt-2 text-[13px] font-semibold tracking-wide text-neutral-900"
            )}
          >
            <dt className={row.emphasize ? "text-neutral-900" : "text-neutral-500"}>
              {row.label}
            </dt>
            <dd className="tabular-nums">{row.amountLabel}</dd>
          </div>
        ))}
      </dl>

      {model.observations ? (
        <section className="mt-8">
          <SectionLabel>Observaciones</SectionLabel>
          <div className="mt-1.5">
            <Hairline />
          </div>
          <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-neutral-600">
            {model.observations}
          </p>
        </section>
      ) : null}

      {model.nonFiscalNotice ? (
        <p className="mt-10 border border-neutral-900 px-3 py-2.5 text-center text-[11px] font-semibold tracking-[0.16em] text-neutral-900">
          {model.nonFiscalNotice}
        </p>
      ) : null}

      {model.fiscal.showCae && model.fiscal.cae ? (
        <section className="mt-10">
          <SectionLabel>Información fiscal</SectionLabel>
          <div className="mt-1.5">
            <Hairline />
          </div>
          <div className="mt-3 text-[11px] text-neutral-600">
            <p>CAE {model.fiscal.cae}</p>
            {model.fiscal.caeExpiresAtLabel ? (
              <p>Vto. CAE {model.fiscal.caeExpiresAtLabel}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {model.footerLegend ? (
        <p className="mt-10 text-center text-[10px] leading-relaxed text-neutral-400">
          {model.footerLegend}
        </p>
      ) : null}
    </article>
  )
}
