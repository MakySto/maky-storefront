"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { quoteReferenceFromFragment } from "@/lib/contact/quote-request";

/**
 * The product a visitor asked a quote for, read from the URL fragment (`/kontakt#quote=…`,
 * `lib/contact/quote-request`).
 *
 * The fragment exists only in the browser, so the server render and the first client render both
 * answer null (`getServerSnapshot`) and the page is byte-identical for everyone. Once the page is in
 * the browser the real fragment is read. That covers a link opened in a new tab and a click from a
 * product page through the router, where the address changes after the new page has first rendered:
 * React reads the store again once the page is committed and renders again if the answer changed.
 */
const subscribe = (onChange: () => void): (() => void) => {
	window.addEventListener("hashchange", onChange);
	return () => window.removeEventListener("hashchange", onChange);
};
const fragmentNow = (): string => window.location.hash;
const noFragment = (): string => "";

export function useQuoteReference(): string | null {
	return quoteReferenceFromFragment(useSyncExternalStore(subscribe, fragmentNow, noFragment));
}

/**
 * What stands above the approved contact copy when a visitor arrives from a product's "request a quote"
 * button: which product, and what to do. Nothing for any other visit.
 *
 * It does not depend on the contact form, which is offered in some markets only (`MAKY_CONTACT_FORM_MARKETS`):
 * the e-mail address and the phone number the visitor needs are on the page whether the form is or not, and
 * the sentence asks for neither a form nor a field.
 */
export function QuoteRequestNotice() {
	const t = useTranslations("contact");
	const reference = useQuoteReference();
	if (!reference) return null;

	return (
		// A note, not a landmark: it is ancillary to the page, and an unnamed `aside` would add a region to the
		// page's outline for a sentence.
		<div
			role="note"
			className="not-prose border-border-default bg-surface-muted mt-2 mb-8 rounded-md border p-5"
		>
			<p className="text-text-primary text-base font-semibold break-words">
				{t("quoteFor", { product: reference })}
			</p>
			<p className="text-text-secondary mt-1 text-sm">{t("quoteHelp")}</p>
		</div>
	);
}
