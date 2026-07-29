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
 */
export function CompanyDetails() {
	return (
		<>
			<p>Internetový obchod prevádzkuje:</p>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				{companyInfo.street}, {companyInfo.city}, {companyInfo.country}
				<br />
				IČO: {companyInfo.ico}
				<br />
				{companyInfo.registry}
				<br />
				E-mail: <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a> · Telefón: {companyInfo.phone}
			</p>
		</>
	);
}
