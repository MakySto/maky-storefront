import { FRIENDLY_SLUGS } from "@/lib/channel-map";

/**
 * Which markets may be OFFERED the contact form.
 *
 * Not whether `/kontakt` may be served — that page is a legally required disclosure and
 * is live in all twelve markets. Only the form is behind this, and when a market is not
 * listed the page still renders the address, the e-mail, the phone number and the
 * statutory identifiers exactly as before.
 *
 * ## Default off, in every environment
 *
 * An unset or empty variable offers the form nowhere. There is deliberately no
 * development exemption: `isWithdrawalFormServable()` returns true whenever
 * `NODE_ENV !== "production"`, which means a staging build offers a live form without
 * anyone choosing to, and that is a trap this should not copy. Turning the form on is a
 * decision, so it has to be written down somewhere.
 *
 * Read per call rather than captured at module load, so a restart is enough to change it
 * and nothing is baked into a build.
 */
const ENV_VAR = "MAKY_CONTACT_FORM_MARKETS";

export function contactFormMarkets(): ReadonlySet<string> {
	const raw = process.env[ENV_VAR]?.trim();
	if (!raw) return new Set();
	const markets = raw
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter((entry) => FRIENDLY_SLUGS.has(entry));
	return new Set(markets);
}

export function isContactFormServable(market: string): boolean {
	return contactFormMarkets().has(market);
}

/** Why the form is not offered here, for the log line. `null` when it is. */
export function contactFormBlockReason(market: string): string | null {
	if (isContactFormServable(market)) return null;
	const configured = contactFormMarkets();
	if (configured.size === 0) return `${ENV_VAR} is unset — the contact form is offered nowhere`;
	return `${market} is not in ${ENV_VAR}`;
}
