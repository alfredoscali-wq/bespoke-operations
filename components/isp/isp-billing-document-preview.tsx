import {
  IspBillingDocumentA4Stage,
  IspBillingDocumentSheet,
} from "@/components/isp/isp-billing-document-sheet"
import { buildBillingDocumentTemplateModelFromDocument } from "@/lib/isp/billing-document-template"
import type { IspBillingDocument } from "@/lib/isp/billing-document-types"
import type { IspBillingTemplateSettings } from "@/lib/isp/billing-template-settings"

export function IspBillingDocumentPreview({
  document,
  templateSettings,
}: {
  document: IspBillingDocument
  templateSettings?: IspBillingTemplateSettings | null
}) {
  const model = buildBillingDocumentTemplateModelFromDocument(
    document,
    templateSettings
  )

  return (
    <IspBillingDocumentA4Stage>
      <IspBillingDocumentSheet model={model} />
      {/* ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE is rendered by the shared sheet. */}
    </IspBillingDocumentA4Stage>
  )
}
