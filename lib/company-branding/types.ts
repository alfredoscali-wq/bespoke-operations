export type CompanyBranding = {
  companyId: string
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  createdAt: string
  updatedAt: string
}

export type CompanyBrandingDraft = {
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
}

export type CompanyBrandingSaveInput = {
  companyId: string
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}
