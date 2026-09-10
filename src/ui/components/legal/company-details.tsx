import { getTranslations } from "next-intl/server";
import { companyInfo } from "@/config/company";

/**
 * The operating entity's legal identification.
 *
 * Rendered from `@/config/company`, never from the CMS. Payload's `SiteSettings`
 * global carries the same fields (`legalName`, `companyId`, `taxId`, `vatId`,
 * `registeredAddress`), but those are NOT authoritative: statutory identifiers must
 * not be editable without a code review, and two editable copies of the same legal
 * fact eventually disagree.
 *
 * This also closes an existing drift. Before this component, `o-nas` and
 * `ochrana-osobnych-udajov` hardcoded the IČO as a JSX literal while `kontakt`,
 * `obchodne-podmienky` and the footer imported it — so `company.ts` was the single
 * source for three of five surfaces. `o-nas` now imports it too.
 *
 * ## Labels are translated, facts are not
 *
 * The block used to be Slovak prose around Slovak-sourced facts, which was correct
 * while `/o-nas` existed only on `sk`. Opening the route to a market whose CMS has a
 * document would otherwise have put "Internetový obchod prevádzkuje:" above a German
 * page. Only the four labels move; every value still comes from `companyInfo`, and
 * each label is the wording that market's own `/kontakt` already publishes, so the
 * two surfaces cannot name the same thing differently.
 *
 * `companyInfo.registry` stays as it is on purpose. "Obchodný register Mestského súdu
 * Bratislava III…" is the register's own name, not a sentence to translate — the same
 * reason the street and city are not translated either.
 */
export async function CompanyDetails() {
	const t = await getTranslations("company");

	return (
		<>
			<p>{t("operatedBy")}</p>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				{companyInfo.street}, {companyInfo.city}, {companyInfo.country}
				<br />
				{t("companyId")} {companyInfo.ico}
				<br />
				{companyInfo.registry}
				<br />
				{t("email")} <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a> · {t("phone")}{" "}
				{companyInfo.phone}
			</p>
		</>
	);
}
