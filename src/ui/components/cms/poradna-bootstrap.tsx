import { type ReactNode } from "react";
import { companyInfo } from "@/config/company";

/**
 * The floor under `/sk/poradna` when the CMS cannot answer.
 *
 * Deliberately three lines. Poradňa is editorial content the CMS owns, so anything longer
 * here would be a second copy of an article nobody would remember to update — and a
 * fallback that looks like a real page is worse than one that plainly is not, because
 * nobody notices the CMS has been down for a week.
 *
 * It exists at all because the alternative was worse. Without it an upstream fault would
 * `notFound()`, and under `cacheComponents` that is not a 404 — it is HTTP 200 serving the
 * global English "Page Not Found" at a Slovak URL. A short honest Slovak page beats that
 * on every axis.
 *
 * Shown ONLY for upstream faults. An authoritative absence — `docs: []`, or a document
 * whose markets exclude SK — 404s instead, because overriding an editorial decision with
 * code is the one thing a bootstrap must never do.
 */
export function PoradnaBootstrap(): ReactNode {
	return (
		<p>
			Obsah poradne práve nie je dostupný. Skúste to prosím o chvíľu znova, alebo nám napíšte na{" "}
			<a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a> a poradíme vám s výberom.
		</p>
	);
}
