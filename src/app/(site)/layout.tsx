import "../globals.css";
import { type ReactNode } from "react";
import { DocumentShell } from "@/ui/components/document-shell";
import { rootMetadata } from "@/lib/seo";
import { DEFAULT_LOCALE, LOCALE_MAP } from "@/config/locale";

export const metadata = rootMetadata;

/**
 * The document for every route that has no market: `/`, `/checkout`, the global 404 and
 * the global error boundary.
 *
 * The store default is the honest answer for these. `/` only redirects, and the checkout
 * is reached from inside a market and localizes its own content once the channel is known
 * — see the note in `checkout/layout.tsx` about why its static shell cannot read the
 * request. The market documents live in `app/[channel]/layout.tsx`.
 */
export default function SiteRootLayout({ children }: { children: ReactNode }) {
	return <DocumentShell lang={LOCALE_MAP[DEFAULT_LOCALE].locale}>{children}</DocumentShell>;
}
