import { companyInfo } from "@/config/company";
import { type PayloadNoticeSnapshot } from "./contract";

/**
 * Human-readable rendering of the notice Payload stored.
 *
 * ## Why this reads the stored snapshot and not the form input
 *
 * The storefront used to build this text from what the customer typed and send it along
 * with the submission. That was one copy too many. With the request, the database row
 * and the confirmation e-mail each assembling their own version, they only have to
 * drift once for nobody to be able to say what the customer actually confirmed — which
 * is the single thing this feature exists to produce.
 *
 * So Payload normalises the submission, stores the canonical structured snapshot, and
 * this function is a **pure projection of that stored object**. Same snapshot in, same
 * text out, on the receipt and in any later reprint. It has no access to the form
 * input and cannot disagree with the record even in principle.
 *
 * The snapshot itself is JSON, which is right for a database and wrong for a person: a
 * customer asked to keep proof of a legal notice should be handed sentences, not
 * `{"schemaVersion":1,…}`. Hence a rendering rather than a dump.
 *
 * ## Wording
 *
 * Nothing here is new legal prose. Every line is either a value the customer typed,
 * a company identifier from `@/config/company`, or the statutory model-form phrasing
 * already published on `/sk/odstupenie-od-zmluvy`. When the reviewed legal artifact
 * lands, the phrasing changes here and `LEGAL_NOTICE_VERSION` moves with it — which is
 * exactly why the version is stamped onto every record and printed at the bottom.
 */

function line(label: string, value: string): string {
	return `${label}: ${value}`;
}

/**
 * Deterministic: the same snapshot always produces the same text.
 *
 * Note what is absent — a timestamp. The submission time is assigned by the server and
 * is displayed alongside this text, not baked into it. A locally computed clock inside
 * the evidence would let the receipt and the record disagree about when the notice was
 * given.
 */
export function renderNoticeFromSnapshot(snapshot: PayloadNoticeSnapshot): string {
	const parts: string[] = [];

	parts.push("ODSTÚPENIE OD ZMLUVY");
	parts.push("");
	parts.push(`Komu: ${companyInfo.legalName}, ${companyInfo.returnAddress}, e-mail: ${companyInfo.email}`);
	parts.push("");
	parts.push("Týmto oznamujem, že odstupujem od zmluvy uzavretej na diaľku.");
	parts.push("");
	parts.push(line("Meno a priezvisko", snapshot.customer.name));
	parts.push(line("E-mail", snapshot.customer.email));
	// Only when Payload stored one. A line reading "Telefón: " on a document the customer
	// is told to keep as proof would suggest something was lost; and printing a number the
	// server did not keep would make the receipt disagree with the record.
	if (snapshot.customer.phone) parts.push(line("Telefón", snapshot.customer.phone));
	parts.push(line("Identifikácia zmluvy (číslo objednávky)", snapshot.contract.orderNumber));
	parts.push("");

	if (snapshot.scope === "wholeOrder") {
		parts.push("Rozsah odstúpenia: celá objednávka");
	} else {
		parts.push("Rozsah odstúpenia: vybrané položky");
		for (const item of snapshot.items) {
			const sku = item.sku ? ` (SKU ${item.sku})` : "";
			parts.push(`  - ${item.productName}${sku} — počet: ${item.quantity}`);
		}
	}

	if (snapshot.note) {
		parts.push("");
		parts.push("Poznámka spotrebiteľa:");
		parts.push(snapshot.note);
	}

	parts.push("");
	parts.push(`Verzia poučenia: ${snapshot.legalNoticeVersion}`);

	return parts.join("\n");
}
