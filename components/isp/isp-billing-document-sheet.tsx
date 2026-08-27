import type { ReactNode } from "react"
import { Globe, Mail, MapPin, Phone, type LucideIcon } from "lucide-react"

import {
  BILLING_DOCUMENT_QR_RESERVED_LABEL,
  BILLING_DOCUMENT_QR_ZONE_LABEL,
  BILLING_DOCUMENT_TABLE_COLUMNS,
  type BillingDocumentTemplateModel,
} from "@/lib/isp/billing-document-template"
import { cn } from "@/lib/utils"

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[9px] font-semibold tracking-[0.22em] text-primary uppercase">
      {children}
    </p>
  )
}

function Hairline({ accent = false }: { accent?: boolean }) {
  return (
    <div
      className={cn("h-px w-full", accent ? "bg-primary/35" : "bg-neutral-200")}
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
      className={cn(
        "h-[64px] w-auto max-w-[220px] object-contain object-left",
        className
      )}
    />
  )
}

function IssuerLine({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <p className="flex items-start gap-2 text-[11px] leading-[1.55] text-neutral-500">
      {Icon ? (
        <Icon
          aria-hidden="true"
          className="mt-0.5 size-3 shrink-0 text-primary"
          strokeWidth={1.75}
        />
      ) : null}
      <span>{children}</span>
    </p>
  )
}

function IssuerBlock({ model }: { model: BillingDocumentTemplateModel }) {
  const position = model.issuer.logoPosition
  const logo = <IssuerLogo model={model} />

  return (
    <div className="min-w-0 space-y-3.5">
      {logo ? (
        <div
          className={cn(
            position === "center" && "flex justify-center",
            position === "right" && "flex justify-end"
          )}
        >
          {logo}
        </div>
      ) : null}
      <div className="space-y-1.5 text-left">
        <p className="text-[15.5px] leading-snug font-semibold tracking-tight text-neutral-900">
          {model.issuer.legalName}
        </p>
        <p className="text-[11px] text-neutral-600">CUIT {model.issuer.taxId}</p>
        {model.issuer.vatConditionLabel !== "—" ? (
          <p className="text-[11px] text-neutral-600">
            {model.issuer.vatConditionLabel}
          </p>
        ) : null}
        {model.issuer.addressLine ? (
          <IssuerLine icon={MapPin}>{model.issuer.addressLine}</IssuerLine>
        ) : null}
        {model.issuer.localityLine ? (
          <IssuerLine>{model.issuer.localityLine}</IssuerLine>
        ) : null}
        {model.issuer.phone ? (
          <IssuerLine icon={Phone}>{model.issuer.phone}</IssuerLine>
        ) : null}
        {model.issuer.email ? (
          <IssuerLine icon={Mail}>{model.issuer.email}</IssuerLine>
        ) : null}
        {model.issuer.website ? (
          <IssuerLine icon={Globe}>{model.issuer.website}</IssuerLine>
        ) : null}
      </div>
    </div>
  )
}

function IdentificationMetaRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="text-[10.5px] text-neutral-500">{label}</dt>
      <dd className="max-w-[58%] text-right text-[11px] font-semibold text-neutral-900">
        {value}
      </dd>
    </div>
  )
}

function IdentificationBlock({ model }: { model: BillingDocumentTemplateModel }) {
  const letter = model.identification.letter
  const showKindLabel = letter !== "X"

  return (
    <div className="w-[min(44%,248px)] shrink-0 border-l border-neutral-200 pl-8">
      <div className="ml-auto w-[148px] border border-neutral-200 px-4 py-3.5 text-center">
        {showKindLabel ? (
          <p
            className={cn(
              "leading-snug font-semibold text-neutral-900 uppercase",
              model.identification.kindLabel.length > 10
                ? "text-[9px] tracking-[0.12em]"
                : "text-[11px] tracking-[0.22em]"
            )}
          >
            {model.identification.kindLabel}
          </p>
        ) : null}
        {letter ? (
          <div
            className={cn(
              "mx-auto flex size-[52px] items-center justify-center bg-primary",
              showKindLabel ? "mt-2.5" : "mt-0"
            )}
          >
            <span className="text-[28px] leading-none font-semibold text-white">
              {letter}
            </span>
          </div>
        ) : null}
      </div>
      <dl className="mt-5 space-y-2">
        <IdentificationMetaRow
          label="Punto de venta"
          value={model.identification.pointOfSaleLabel}
        />
        <IdentificationMetaRow
          label="Número"
          value={model.identification.documentNumberLabel}
        />
        <IdentificationMetaRow
          label="Fecha"
          value={model.identification.issueDateLabel}
        />
        {model.identification.dueDateLabel ? (
          <IdentificationMetaRow
            label="Vencimiento"
            value={model.identification.dueDateLabel}
          />
        ) : null}
        {model.identification.vatConditionLabel ? (
          <IdentificationMetaRow
            label="Condición frente al IVA"
            value={model.identification.vatConditionLabel}
          />
        ) : null}
      </dl>
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
      className="flex flex-col bg-white text-[#1c2028] shadow-[0_12px_40px_rgba(15,23,42,0.10)]"
      style={{ minHeight: "297mm", padding: "20mm 20mm 18mm" }}
    >
      <div className="flex-1">
        <header className="flex items-start justify-between gap-12">
          <div className="min-w-0 flex-1">
            <IssuerBlock model={model} />
          </div>
          <IdentificationBlock model={model} />
        </header>

        <div className="mt-9">
          <Hairline />
        </div>

        <section className="mt-7">
          <SectionLabel>Cliente</SectionLabel>
          <div className="mt-3.5 max-w-md space-y-1.5 text-[11px] leading-[1.55]">
            <p className="text-[13.5px] leading-snug font-semibold text-neutral-900">
              {model.customer.name}
            </p>
            <p className="text-neutral-600">{model.customer.documentLabel}</p>
            {model.customer.vatConditionLabel ? (
              <p className="text-neutral-600">{model.customer.vatConditionLabel}</p>
            ) : null}
            {model.customer.addressLine ? (
              <p className="text-neutral-500">{model.customer.addressLine}</p>
            ) : null}
            {model.customer.localityLine ? (
              <p className="text-neutral-500">{model.customer.localityLine}</p>
            ) : null}
          </div>
        </section>

        <section className="mt-9">
          <SectionLabel>Conceptos</SectionLabel>
          <div className="mt-3.5 overflow-hidden">
            <table className="w-full table-fixed border-collapse text-[10.5px]">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[34%]" />
                <col className="w-[8%]" />
                <col className="w-[14%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="bg-primary/10">
                  {BILLING_DOCUMENT_TABLE_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className={cn(
                        "py-2.5 font-semibold tracking-[0.04em] whitespace-nowrap text-neutral-600 uppercase",
                        column.align === "right" ? "px-2.5 text-right" : "px-3 text-left",
                        column.key === "index" && "pl-2.5 pr-1"
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
                    className="border-b border-neutral-100"
                  >
                    <td className="py-2.5 pr-1.5 pl-2.5 align-top text-right tabular-nums text-neutral-400">
                      {item.indexLabel}
                    </td>
                    <td className="px-3 py-2.5 align-top text-neutral-800">
                      {item.description}
                    </td>
                    <td className="px-2.5 py-2.5 align-top text-right tabular-nums text-neutral-600">
                      {item.quantityLabel}
                    </td>
                    <td className="px-2.5 py-2.5 align-top text-right tabular-nums text-neutral-600">
                      {item.unitPriceLabel}
                    </td>
                    <td
                      className={cn(
                        "px-2.5 py-2.5 align-top text-right tabular-nums",
                        item.hasDiscount ? "text-red-700" : "text-neutral-400"
                      )}
                    >
                      {item.discountLabel}
                    </td>
                    <td className="px-2.5 py-2.5 align-top text-right text-neutral-600">
                      {item.taxLabel}
                    </td>
                    <td className="px-2.5 py-2.5 align-top text-right tabular-nums font-medium text-neutral-900">
                      {item.amountLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <dl className="ml-auto mt-10 w-full max-w-[220px] space-y-2.5 text-[11px]">
          {model.totals.map((row) => (
            <div
              key={row.label}
              className={cn(
                "flex items-baseline justify-between gap-10",
                row.variant === "total" &&
                  "mt-3.5 border-t-2 border-primary pt-3.5 text-[15px] font-semibold tracking-wide text-primary"
              )}
            >
              <dt
                className={cn(
                  row.variant === "total" && "text-primary",
                  row.variant === "default" && "text-neutral-500",
                  row.variant === "discount" && "text-neutral-500",
                  row.variant === "tax" && "text-neutral-500"
                )}
              >
                {row.label}
              </dt>
              <dd
                className={cn(
                  "tabular-nums",
                  row.variant === "discount" && "text-red-700",
                  row.variant === "total" && "text-primary"
                )}
              >
                {row.amountLabel}
              </dd>
            </div>
          ))}
        </dl>

        {model.observations ? (
          <section className="mt-12">
            <SectionLabel>Observaciones</SectionLabel>
            <p className="mt-3.5 max-w-lg text-[11px] leading-[1.6] text-neutral-600">
              {model.observations}
            </p>
          </section>
        ) : null}
      </div>

      <footer className="mt-14 border-t border-neutral-200 pt-6">
        <div className="grid grid-cols-[1fr_auto_72px] items-start gap-10">
          <div className="min-w-0 space-y-2 text-[9px] leading-relaxed text-neutral-400">
            {model.nonFiscalNotice ? (
              <p className="font-medium tracking-[0.08em] text-neutral-600 uppercase">
                {model.nonFiscalNotice}
              </p>
            ) : null}
            {model.footerLegend ? <p>{model.footerLegend}</p> : null}
          </div>
          <div className="min-w-[158px] space-y-1.5 text-[10px] text-neutral-500">
            <p>
              <span className="text-neutral-400">CAE: </span>
              <span
                className={
                  model.fiscal.showCae ? "font-medium text-neutral-800" : undefined
                }
              >
                {model.fiscal.caeDisplay}
              </span>
            </p>
            <p>
              <span className="text-neutral-400">Fecha de vencimiento CAE: </span>
              <span
                className={
                  model.fiscal.showCae ? "font-medium text-neutral-800" : undefined
                }
              >
                {model.fiscal.caeExpiresDisplay}
              </span>
            </p>
          </div>
          <div className="text-center">
            <p className="mb-1.5 text-[8px] tracking-[0.12em] text-neutral-400 uppercase">
              {BILLING_DOCUMENT_QR_RESERVED_LABEL}
            </p>
            <div
              data-billing-qr-reserved="true"
              className="flex size-[72px] items-center justify-center border border-dashed border-neutral-300 text-[8px] tracking-[0.14em] text-neutral-400 uppercase"
            >
              {BILLING_DOCUMENT_QR_ZONE_LABEL}
            </div>
          </div>
        </div>
      </footer>
    </article>
  )
}
