import { companyInfo } from "@/config/company";
import { type ValidatedInput } from "./validate";

/**
 * The canonical notice snapshot — the exact text the customer confirmed.
 *
 * This is the evidential core of the whole feature. § 20a requires the confirmation on
 * a durable medium to contain the notice that was submitted, so a record that stores
 * only structured fields is not enough: the fields could be re-rendered differently
 * later by a template change, and then nobody can say what the customer actually saw
 * and agreed to. A frozen block of text can.
 *
 * Built on the server from validated input, then sent with the submission and stored
 * immutably. It is deliberately NOT built in the browser — a snapshot the client could
 * author would prove nothing.
 *
 * ## Why the wording is not new
 *
 * Everything here is either a value the customer typed, a company identifier from
 * `@/config/company`, or the statutory model-form phrasing already published on
 * `/sk/odstupenie-od-zmluvy`. No new legal prose is written in this file. When the
 * reviewed legal artifact lands, the phrasing changes here and `LEGAL_NOTICE_VERSION`
 * moves with it, which is precisely why the version is stamped onto every record.
 */

function line(label: string, value: string): string {
	return `${label}: ${value}`;
}

export interface NoticeSnapshotInput extends ValidatedInput {
	readonly legalNoticeVersion: string;
}

/**
 * Deterministic: the same input always produces the same text.
 *
 * Note what is absent — a timestamp. The submission time is assigned by the server
 * that stores the record and is shown alongside the snapshot, not baked into it.
 * Putting a locally computed clock inside the evidence would mean the storefront and
 * the record could disagree about when the notice was given.
 */
export function buildNoticeSnapshot(input: NoticeSnapshotInput): string {
	const parts: string[] = [];

	parts.push("ODSTÚPENIE OD ZMLUVY");
	parts.push("");
	parts.push(`Komu: ${companyInfo.legalName}, ${companyInfo.returnAddress}, e-mail: ${companyInfo.email}`);
	parts.push("");
	parts.push("Týmto oznamujem, že odstupujem od zmluvy uzavretej na diaľku.");
	parts.push("");
	parts.push(line("Meno a priezvisko", input.name));
	parts.push(line("E-mail", input.email));
	if (input.phone) parts.push(line("Telefón", input.phone));
	parts.push(line("Identifikácia zmluvy (číslo objednávky)", input.orderNumber));
	parts.push("");

	if (input.scope === "wholeOrder") {
		parts.push("Rozsah odstúpenia: celá objednávka");
	} else {
		parts.push("Rozsah odstúpenia: vybrané položky");
		for (const item of input.items) {
			parts.push(`  - ${item.productName} — počet: ${item.quantity}`);
		}
	}

	if (input.note) {
		parts.push("");
		parts.push("Poznámka spotrebiteľa:");
		parts.push(input.note);
	}

	parts.push("");
	parts.push(`Verzia poučenia: ${input.legalNoticeVersion}`);

	return parts.join("\n");
}
