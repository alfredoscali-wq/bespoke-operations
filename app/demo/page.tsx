import { DemoLandingPage } from "@/components/demo/demo-landing-page"
import { getDemoPublicCredentials } from "@/lib/demo/public-credentials.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Probá Bespoke",
  description:
    "Conocé cómo funciona la gestión de operaciones y el trabajo en campo desde una misma plataforma.",
}

export default function DemoPage() {
  const credentials = getDemoPublicCredentials()

  return <DemoLandingPage credentials={credentials} />
}
