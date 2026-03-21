/**
 * Header navigation config.
 * Keys map to nav namespace in locale JSON files.
 * Hrefs will be prefixed with /[channel] at render time.
 * TODO: When localized slugs are ready, these hrefs will use slug resolver.
 */
export const HEADER_PRIMARY_NAV = [
  { key: "roofRacks", href: "/categories/stresne-nosice" },
  { key: "roofBoxes", href: "/categories/stresne-boxy" },
  { key: "bikeCarriers", href: "/categories/nosice-bicyklov" },
  { key: "skiCarriers", href: "/categories/nosice-lyzi" },
  { key: "advice", href: "/poradna" },
] as const;

export type NavItem = (typeof HEADER_PRIMARY_NAV)[number];
