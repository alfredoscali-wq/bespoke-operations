import { DemoLandingPage } from "@/components/demo/demo-landing-page"
import { getDemoPublicCredentials } from "@/lib/demo/public-credentials.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata = {
  title: "BESPOKE DEMO",
  description:
    "Probá Bespoke Operations y Bespoke Mobile con un entorno completamente ficticio.",
}

export default function DemoPage() {
  const credentials = getDemoPublicCredentials()

  return <DemoLandingPage credentials={credentials} />
}
