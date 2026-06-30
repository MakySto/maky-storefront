"use client";

import { useTranslations } from "next-intl";
import { companyInfo } from "@/config/company";

/** Client component for the footer copyright line (needs the current year). */
export function CopyrightText() {
	const t = useTranslations("footer");
	const year = new Date().getFullYear();
	return (
		<>
			© {year} {companyInfo.legalName}. {t("allRightsReserved")}.
		</>
	);
}
