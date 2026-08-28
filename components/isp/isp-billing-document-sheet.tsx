import type { ReactNode } from "react"
import { Globe, Mail, MapPin, Phone, type LucideIcon } from "lucide-react"

import {
  BILLING_DOCUMENT_QR_RESERVED_LABEL,
  BILLING_DOCUMENT_QR_ZONE_LABEL,
  BILLING_DOCUMENT_TABLE_COLUMNS,
  type BillingDocumentTemplateModel,
} from "@/lib/isp/billing-document-template"
import {
  BILLING_DOCUMENT_LAYOUT as L,
  billingContentAreaHeightMm,
} from "@/lib/isp/billing-document-layout"
import {
  planBillingDocumentPages,
  type BillingDocumentPageSlice,
} from "@/lib/isp/billing-document-pagination"
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
      className={cn("w-auto object-contain object-left", className)}
      style={{ height: L.logo.heightPx, maxWidth: L.logo.maxWidthPx }}
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
    <div
      className="min-w-0 text-left"
      style={{
        display: "flex",
        flexDirection: "column",
        rowGap: `${L.logo.gapBelowMm}mm`,
      }}
    >
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
      <div
        className="text-left"
        style={{
          display: "flex",
          flexDirection: "column",
          rowGap: `${L.rhythm.issuerStackMm}mm`,
        }}
      >
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
    <div
      className="grid items-start"
      style={{
        gridTemplateColumns: `minmax(0, ${L.header.metaLabelPercent}fr) minmax(0, ${L.header.metaValuePercent}fr)`,
        columnGap: L.header.metaGapPx,
      }}
    >
      <dt className="text-[10.5px] leading-snug text-neutral-500">{label}</dt>
      <dd className="text-right text-[11px] leading-snug font-semibold text-neutral-900">
        {value}
      </dd>
    </div>
  )
}

function IdentificationBlock({ model }: { model: BillingDocumentTemplateModel }) {
  const letter = model.identification.letter
  const showKindLabel = letter !== "X"

  return (
    <div
      className="shrink-0 border-l border-neutral-200"
      style={{
        width: `min(${L.header.identMaxPercent}%, ${L.header.identWidthPx}px)`,
        paddingLeft: L.header.identPadLeftPx,
      }}
    >
      <div
        className="ml-auto border border-neutral-200 text-center"
        style={{
          width: L.header.cardWidthPx,
          padding: `${L.header.cardPadYMm}mm ${L.header.cardPadXMm}mm`,
        }}
      >
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
              "mx-auto flex items-center justify-center bg-primary",
              !showKindLabel && "mt-0"
            )}
            style={{
              width: L.header.letterSizePx,
              height: L.header.letterSizePx,
              marginTop: showKindLabel ? L.header.kindToLetterMm + "mm" : 0,
            }}
          >
            <span className="text-[28px] leading-none font-semibold text-white">
              {letter}
            </span>
          </div>
        ) : null}
      </div>
      <dl
        className="space-y-2"
        style={{ marginTop: `${L.header.afterCardMm}mm` }}
      >
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

function DocumentHeader({ model }: { model: BillingDocumentTemplateModel }) {
  return (
    <>
      <header
        className="flex items-start justify-between"
        style={{ gap: L.header.columnGapPx }}
      >
        <div className="min-w-0 flex-1">
          <IssuerBlock model={model} />
        </div>
        <IdentificationBlock model={model} />
      </header>
      <div style={{ marginTop: `${L.header.afterHeaderMm}mm` }}>
        <Hairline />
      </div>
    </>
  )
}

function CustomerSection({ model }: { model: BillingDocumentTemplateModel }) {
  return (
    <section style={{ marginTop: `${L.rhythm.afterHairlineMm}mm` }}>
      <SectionLabel>Cliente</SectionLabel>
      <div
        className="space-y-1.5 text-[11px] leading-[1.55]"
        style={{
          marginTop: `${L.rhythm.afterSectionLabelMm}mm`,
          maxWidth: L.customer.widthPx,
        }}
      >
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
  )
}

function ConceptsTable({
  model,
  itemIndices,
  showSectionLabel,
  sectionMarginTop,
}: {
  model: BillingDocumentTemplateModel
  itemIndices: number[]
  showSectionLabel: boolean
  sectionMarginTop: number
}) {
  const items = itemIndices.map((index) => model.items[index])

  return (
    <section
      style={{
        marginTop: sectionMarginTop > 0 ? `${sectionMarginTop}mm` : 0,
      }}
    >
      {showSectionLabel ? <SectionLabel>Conceptos</SectionLabel> : null}
      <div
        className="overflow-hidden"
        style={{
          marginTop: showSectionLabel
            ? `${L.rhythm.afterSectionLabelMm}mm`
            : 0,
        }}
      >
        <table className="w-full table-fixed border-collapse text-[10.5px]">
          <colgroup>
            {L.table.columns.map((width, index) => (
              <col key={index} style={{ width: `${width}%` }} />
            ))}
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
            {items.map((item, index) => (
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
  )
}

function TotalsSection({ model }: { model: BillingDocumentTemplateModel }) {
  return (
    <dl
      className="ml-auto w-full space-y-2.5 text-[11px]"
      style={{
        marginTop: `${L.rhythm.afterTableMm}mm`,
        maxWidth: L.totals.widthPx,
      }}
    >
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
  )
}

function ObservationsSection({ model }: { model: BillingDocumentTemplateModel }) {
  if (!model.observations) return null
  return (
    <section style={{ marginTop: `${L.rhythm.afterTotalsMm}mm` }}>
      <SectionLabel>Observaciones</SectionLabel>
      <p
        className="text-[11px] leading-[1.6] text-neutral-600"
        style={{
          marginTop: `${L.rhythm.afterSectionLabelMm}mm`,
          maxWidth: L.observations.widthPx,
        }}
      >
        {model.observations}
      </p>
    </section>
  )
}

function FiscalFooter({ model }: { model: BillingDocumentTemplateModel }) {
  return (
    <footer
      className="border-t border-neutral-200"
      style={{
        paddingTop: `${L.rhythm.footerPadTopMm}mm`,
        height: `${L.footer.heightMm}mm`,
        boxSizing: "border-box",
      }}
    >
      <div
        className="grid items-start"
        style={{
          gridTemplateColumns: `1fr auto ${L.footer.qrSizePx}px`,
          gap: `${L.footer.columnGapMm}mm`,
        }}
      >
        <div className="min-w-0 space-y-2 text-[9px] leading-relaxed text-neutral-400">
          {model.nonFiscalNotice ? (
            <p className="font-medium tracking-[0.08em] text-neutral-600 uppercase">
              {model.nonFiscalNotice}
            </p>
          ) : null}
          {model.footerLegend ? <p>{model.footerLegend}</p> : null}
        </div>
        <div
          className="space-y-1.5 text-[10px] text-neutral-500"
          style={{ minWidth: L.footer.caeWidthPx }}
        >
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
            className="flex items-center justify-center border border-dashed border-neutral-300 text-[8px] tracking-[0.14em] text-neutral-400 uppercase"
            style={{ width: L.footer.qrSizePx, height: L.footer.qrSizePx }}
          >
            {BILLING_DOCUMENT_QR_ZONE_LABEL}
          </div>
        </div>
      </div>
    </footer>
  )
}

function BillingDocumentPage({
  model,
  slice,
}: {
  model: BillingDocumentTemplateModel
  slice: BillingDocumentPageSlice
}) {
  return (
    <article
      data-billing-document-sheet="true"
      data-billing-document-page={slice.pageIndex + 1}
      className="bg-white text-[#1c2028] shadow-[0_12px_40px_rgba(15,23,42,0.10)]"
      style={{
        width: "100%",
        aspectRatio: `${L.page.widthMm} / ${L.page.heightMm}`,
        boxSizing: "border-box",
        padding: `${L.margin.topMm}mm ${L.margin.xMm}mm ${L.margin.bottomMm}mm`,
        position: "relative",
      }}
    >
      <div
        style={{
          maxHeight: `${billingContentAreaHeightMm()}mm`,
          overflow: "hidden",
        }}
      >
        {slice.showDocumentHeader ? <DocumentHeader model={model} /> : null}
        {slice.showCustomer ? <CustomerSection model={model} /> : null}
        {slice.itemIndices.length > 0 || slice.showTableHeader ? (
          <ConceptsTable
            model={model}
            itemIndices={slice.itemIndices}
            showSectionLabel={
              slice.showDocumentHeader && slice.itemIndices.length > 0
            }
            sectionMarginTop={
              slice.showDocumentHeader ? L.rhythm.afterCustomerMm : 0
            }
          />
        ) : null}
        {slice.showTotals ? <TotalsSection model={model} /> : null}
        {slice.showObservations ? <ObservationsSection model={model} /> : null}
      </div>
      <div
        style={{
          position: "absolute",
          left: `${L.margin.xMm}mm`,
          right: `${L.margin.xMm}mm`,
          bottom: `${L.margin.bottomMm}mm`,
          width: `calc(100% - ${L.margin.xMm * 2}mm)`,
        }}
      >
        <FiscalFooter model={model} />
      </div>
    </article>
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
      <div className="mx-auto w-full max-w-[210mm]">
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  )
}

export function IspBillingDocumentSheet({
  model,
}: {
  model: BillingDocumentTemplateModel
}) {
  const plan = planBillingDocumentPages(model)

  return (
    <>
      {plan.pages.map((slice) => (
        <BillingDocumentPage key={slice.pageIndex} model={model} slice={slice} />
      ))}
    </>
  )
}
