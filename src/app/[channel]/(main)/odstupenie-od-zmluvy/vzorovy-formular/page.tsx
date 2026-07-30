import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPageTitle } from "@/config/brand";
import { companyInfo } from "@/config/company";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { LegalPage } from "@/ui/components/legal/legal-page";
import { ModelFormActions } from "@/ui/components/withdrawal/model-form-actions";

/**
 * The statutory model withdrawal form, on its own printable route.
 *
 * Deliberately separate from the online function. They serve different purposes and
 * one does not replace the other: since 19 June 2026 a downloadable form on its own no
 * longer satisfies the online-function requirement, and equally the online function
 * does not remove the obligation to make the model form available. A consumer who
 * prefers paper, or who wants to post it, must still be able to get it.
 *
 * The wording below is carried over verbatim from the previous
 * `/sk/odstupenie-od-zmluvy` page. It is NOT rewritten here — legal copy comes from the
 * review thread, and the two items this form asks for that the online function
 * deliberately does not require (postal address, IBAN) are flagged there rather than
 * quietly edited out of a document that is meant to be the statutory model.
 */

export const metadata: Metadata = {
	title: formatPageTitle("Vzorový formulár na odstúpenie od zmluvy"),
	description:
		"Vzorový formulár na odstúpenie od zmluvy na vytlačenie alebo stiahnutie. Odstúpiť môžete aj online.",
};

/** The plain-text copy offered for download, so print and download cannot drift. */
const MODEL_FORM_TEXT = [
	"VZOROVÝ FORMULÁR NA ODSTÚPENIE OD ZMLUVY",
	"(Vyplňte a zašlite tento formulár len v prípade, že si želáte odstúpiť od zmluvy.)",
	"",
	`Komu: ${companyInfo.legalName}, ${companyInfo.returnAddress}, e-mail: ${companyInfo.email}`,
	"",
	"Týmto oznamujem/oznamujeme, že odstupujem/odstupujeme od zmluvy na tento tovar:",
	"",
	"Tovar a číslo objednávky: ..............................................................",
	"Dátum objednania alebo prijatia tovaru: ................................................",
	"Meno a priezvisko spotrebiteľa: ........................................................",
	"Adresa spotrebiteľa: ...................................................................",
	"IBAN na vrátenie platby (ak žiadate vrátenie na účet): .................................",
	"Dátum: .................................................................................",
	"Podpis spotrebiteľa (iba ak sa formulár podáva v listinnej podobe): ....................",
].join("\n");

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();

	return (
		<LegalPage title="Vzorový formulár na odstúpenie od zmluvy">
			<p className="print:hidden">
				Tento formulár môžete vytlačiť alebo stiahnuť. Rovnaké oznámenie viete podať aj{" "}
				<a href={marketHref(channel, "/odstupenie-od-zmluvy")}>online formulárom</a>, ktorý vám potvrdenie
				vystaví okamžite.
			</p>

			<ModelFormActions text={MODEL_FORM_TEXT} />

			<p>(Vyplňte a zašlite tento formulár len v prípade, že si želáte odstúpiť od zmluvy.)</p>
			<p>
				Komu: {companyInfo.legalName}, {companyInfo.returnAddress}, e-mail: {companyInfo.email}
			</p>
			<p>Týmto oznamujem/oznamujeme, že odstupujem/odstupujeme od zmluvy na tento tovar:</p>
			<ul>
				<li>Tovar a číslo objednávky: ............................................................</li>
				<li>Dátum objednania alebo prijatia tovaru: ...........................................</li>
				<li>Meno a priezvisko spotrebiteľa: ...........................................</li>
				<li>Adresa spotrebiteľa: ............................................................</li>
				<li>IBAN na vrátenie platby (ak žiadate vrátenie na účet): ...............</li>
				<li>Dátum: ........................................</li>
				<li>Podpis spotrebiteľa (iba ak sa formulár podáva v listinnej podobe): ...............</li>
			</ul>
		</LegalPage>
	);
}
