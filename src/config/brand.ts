/**
 * Brand Configuration — MAKY.STORE
 */

export const brandConfig = {
  siteName: "MAKY.STORE",
  copyrightHolder: "MAKY.STORE",
  organizationName: "MAKY.STORE",
  defaultBrand: "MAKY.STORE",
  tagline: "Strešné nosiče, ťažné zariadenia a príslušenstvo pre vaše auto",
  description: "MAKY.STORE — automobilový aftermarket e-shop. Strešné boxy, nosiče bicyklov, ťažné zariadenia, elektrické sady. 10 európskych trhov.",
  logoAriaLabel: "MAKY.STORE",
  titleTemplate: "%s | MAKY.STORE",
  social: {
    twitter: null as string | null,
    instagram: null as string | null,
    facebook: null as string | null,
  },
} as const;

export function formatPageTitle(title: string): string {
  return brandConfig.titleTemplate.replace("%s", title);
}

export function getCopyrightText(year: number = new Date().getFullYear()): string {
  return "\u00A9 " + year + " " + brandConfig.copyrightHolder + ". All rights reserved.";
}
