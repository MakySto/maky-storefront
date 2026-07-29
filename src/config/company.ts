/**
 * Company / legal-entity identification — MAKY.STORE s. r. o.
 *
 * Single source of truth for the operating entity's legal details (CLAUDE.md §9).
 * Locale-independent legal data, rendered in the footer (SK channel) and on the
 * Kontakt page.
 *
 * VAT: the company IS a registered VAT payer. `icDph` is the authoritative fact —
 * there is deliberately no separate `vatPayer` boolean, because two values that
 * mean the same thing eventually disagree. Registration was granted in July 2026
 * and takes effect on `vatEffectiveFrom`; no order is accepted before that date,
 * and the terms of sale carry the same effective date.
 */
export const companyInfo = {
	legalName: "MAKY.STORE s. r. o.",
	street: "Lermontovova 911/3",
	city: "811 05 Bratislava-Staré Mesto",
	country: "Slovenská republika",
	ico: "57 704 627",
	dic: "2122890660",
	icDph: "SK2122890660",
	/** Display form, Slovak convention. Keep in step with `termsEffectiveFrom`. */
	vatEffectiveFrom: "4. 8. 2026",
	/** Effective date of the current version of the terms of sale. */
	termsEffectiveFrom: "4. 8. 2026",
	registry: "Obchodný register Mestského súdu Bratislava III, oddiel: Sro, vložka č. 200804/B",
	director: "Marek Kysucký",
	email: "info@maky.store",
	phone: "+421 901 730 066",
	returnAddress: "Stará Vajnorská 11, 831 04 Bratislava",
	supervisoryAuthority: {
		name: "Slovenská obchodná inšpekcia (SOI)",
		department: "Inšpektorát SOI pre Bratislavský kraj",
		address: "Bajkalská 21/A, P. O. BOX č. 5, 820 07 Bratislava",
		url: "https://www.soi.sk",
	},
} as const;

/** Phone in a tel: href form (no spaces). */
export const companyPhoneHref = `tel:${companyInfo.phone.replace(/\s/g, "")}`;
