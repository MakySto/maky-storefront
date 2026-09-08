import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPageTitle } from "@/config/brand";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { legalLocaleFor, type LegalLocale } from "@/lib/legal/locale";
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
 * The Slovak wording is carried over verbatim from the previous
 * `/sk/odstupenie-od-zmluvy` page. It is NOT rewritten here — legal copy comes from the
 * review thread, and the two items this form asks for that the online function
 * deliberately does not require (postal address, IBAN) are flagged there rather than
 * quietly edited out of a document that is meant to be the statutory model.
 *
 * ## Why this route is not gated on the online function
 *
 * It used to be gated on the Slovak market alone (`REVERSE_MAP[channel] !== "sk"`),
 * which meant the German pages linked to a 404. That link is not decorative: the
 * withdrawal page tells the reader the form exists and offers it as the paper route,
 * and for `de`/`at` — where the online function is NOT served — it is currently the
 * only prepared artefact besides a free-text e-mail. So the gate is now the same one
 * every other legal page uses: a market gets the form when its legal copy is approved.
 * The printable form has no backend and therefore does not wait on Returns V2.
 */

const COPY = {
	sk: {
		title: "Vzorový formulár na odstúpenie od zmluvy",
		description:
			"Vzorový formulár na odstúpenie od zmluvy na vytlačenie alebo stiahnutie. Odstúpiť môžete aj online.",
		fileName: "vzorovy-formular-odstupenie-od-zmluvy.txt",
		printLabel: "Vytlačiť formulár",
		downloadLabel: "Stiahnuť formulár (.txt)",
	},
	cs: {
		title: "Vzorový formulář pro odstoupení od smlouvy",
		description:
			"Vzorový formulář pro odstoupení od smlouvy k vytištění nebo stažení. Odstoupení můžete poslat e-mailem nebo poštou.",
		fileName: "vzorovy-formular-odstoupeni-od-smlouvy.txt",
		printLabel: "Vytisknout formulář",
		downloadLabel: "Stáhnout formulář (.txt)",
	},
	de: {
		title: "Muster-Widerrufsformular",
		description:
			"Muster-Widerrufsformular zum Ausdrucken oder Herunterladen. Die Verwendung ist freiwillig — eine andere eindeutige Erklärung genügt ebenfalls.",
		fileName: "muster-widerrufsformular.txt",
		printLabel: "Formular drucken",
		downloadLabel: "Formular herunterladen (.txt)",
	},
	deAt: {
		title: "Muster-Widerrufsformular",
		description:
			"Muster-Widerrufsformular zum Ausdrucken oder Herunterladen. Die Verwendung ist freiwillig — eine andere eindeutige Erklärung genügt ebenfalls.",
		fileName: "muster-widerrufsformular.txt",
		printLabel: "Formular drucken",
		downloadLabel: "Formular herunterladen (.txt)",
	},
} as const satisfies Record<LegalLocale, unknown>;

/** The plain-text copy offered for download, so print and download cannot drift. */
const SLOVAK_TEXT = [
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

const CZECH_TEXT = [
	"VZOROVÝ FORMULÁŘ PRO ODSTOUPENÍ OD SMLOUVY",
	"(Vyplňte a zašlete tento formulář jen v případě, že si přejete odstoupit od smlouvy.)",
	"",
	`Komu: ${companyInfo.legalName}, ${companyInfo.returnAddress}, e-mail: ${companyInfo.email}`,
	"",
	"Tímto oznamuji/oznamujeme, že odstupuji/odstupujeme od smlouvy na toto zboží:",
	"",
	"Zboží a číslo objednávky: ..............................................................",
	"Datum objednání nebo převzetí zboží: ...................................................",
	"Jméno a příjmení spotřebitele: .........................................................",
	"Adresa spotřebitele: ...................................................................",
	"IBAN pro vrácení platby (pokud žádáte vrácení na účet): ................................",
	"Datum: .................................................................................",
	"Podpis spotřebitele (pouze pokud se formulář podává v listinné podobě): ................",
].join("\n");

/**
 * The German text, identical for Germany and Austria.
 *
 * Taken from the delivered package (`formulare/vzor-odstupenia.de-DE.txt`, byte-identical
 * to the `de-AT` file). Two sentences at the end are load-bearing and were in the
 * delivered copy on purpose: the form is voluntary, and neither an IBAN nor a reason is
 * a condition of withdrawing. They must not be trimmed as boilerplate.
 */
const GERMAN_TEXT = [
	"MUSTER-WIDERRUFSFORMULAR",
	"",
	"Füllen Sie dieses Formular nur aus und senden Sie es zurück, wenn Sie den Vertrag widerrufen möchten.",
	"Die Verwendung ist freiwillig. Sie können auch eine andere eindeutige Erklärung übermitteln.",
	"",
	"An:",
	companyInfo.legalName,
	"Stará Vajnorská 11",
	"831 04 Bratislava",
	"Slowakei",
	`E-Mail: ${companyInfo.email}`,
	"",
	"Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren:",
	"",
	"................................................................................................",
	"................................................................................................",
	"",
	"Bestellnummer oder andere Angaben zum Vertrag:",
	"................................................................................................",
	"",
	"Umfang – gesamte Bestellung oder einzelne Artikel mit Stückzahl:",
	"................................................................................................",
	"................................................................................................",
	"",
	"Bestellt am / erhalten am (*):",
	"................................................................................................",
	"",
	"Name des/der Verbraucher(s):",
	"................................................................................................",
	"",
	"Anschrift des/der Verbraucher(s):",
	"................................................................................................",
	"................................................................................................",
	"",
	"E-Mail-Adresse für die Bestätigung (bei einer Erklärung auf Papier freiwillig):",
	"................................................................................................",
	"",
	"Datum:",
	"................................................................................................",
	"",
	"Unterschrift des/der Verbraucher(s) – nur bei einer Erklärung auf Papier:",
	"................................................................................................",
	"",
	"(*) Unzutreffendes streichen.",
	"",
	"Eine IBAN und eine Begründung sind für den Widerruf nicht erforderlich. Für eine Erstattung auf die ursprünglich verwendete Zahlungskarte benötigen wir keine Bankverbindung.",
].join("\n");

const TEXT: Record<LegalLocale, string> = {
	sk: SLOVAK_TEXT,
	cs: CZECH_TEXT,
	de: GERMAN_TEXT,
	deAt: GERMAN_TEXT,
};

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const locale = legalLocaleFor(channel);

	// A market with no approved copy 404s below; the metadata must agree, or the 404
	// acquires a canonical and an indexable title.
	if (!locale) return { robots: { index: false, follow: false } };

	return {
		title: formatPageTitle(COPY[locale].title),
		description: COPY[locale].description,
		alternates: { canonical: marketHref(channel, "/odstupenie-od-zmluvy/vzorovy-formular") },
	};
}

function SlovakBody({ channel }: { channel: string }) {
	return (
		<>
			<p className="print:hidden">
				Tento formulár môžete vytlačiť alebo stiahnuť. Rovnaké oznámenie viete podať aj{" "}
				<a href={marketHref(channel, "/odstupenie-od-zmluvy")}>online formulárom</a>, ktorý vám potvrdenie
				vystaví okamžite.
			</p>
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
		</>
	);
}

function CzechBody({ channel }: { channel: string }) {
	return (
		<>
			<p className="print:hidden">
				Tento formulář můžete vytisknout nebo stáhnout. Odstoupení nám můžete poslat e-mailem nebo poštou;
				postup najdete na stránce{" "}
				<a href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstoupení od smlouvy</a>.
			</p>
			<p>(Vyplňte a zašlete tento formulář jen v případě, že si přejete odstoupit od smlouvy.)</p>
			<p>
				Komu: {companyInfo.legalName}, {companyInfo.returnAddress}, e-mail: {companyInfo.email}
			</p>
			<p>Tímto oznamuji/oznamujeme, že odstupuji/odstupujeme od smlouvy na toto zboží:</p>
			<ul>
				<li>Zboží a číslo objednávky: ............................................................</li>
				<li>Datum objednání nebo převzetí zboží: ...........................................</li>
				<li>Jméno a příjmení spotřebitele: ...........................................</li>
				<li>Adresa spotřebitele: ............................................................</li>
				<li>IBAN pro vrácení platby (pokud žádáte vrácení na účet): ...............</li>
				<li>Datum: ........................................</li>
				<li>Podpis spotřebitele (pouze pokud se formulář podává v listinné podobě): ...............</li>
			</ul>
		</>
	);
}

function GermanBody({ channel }: { channel: string }) {
	return (
		<>
			<p className="print:hidden">
				Dieses Formular können Sie ausdrucken oder herunterladen. Seine Verwendung ist freiwillig — eine
				andere eindeutige Erklärung genügt ebenfalls. Die verfügbaren Wege beschreiben wir auf der Seite{" "}
				<a href={marketHref(channel, "/odstupenie-od-zmluvy")}>Widerruf</a>.
			</p>
			<p>
				Füllen Sie dieses Formular nur aus und senden Sie es zurück, wenn Sie den Vertrag widerrufen möchten.
			</p>
			<p>
				An: {companyInfo.legalName}, Stará Vajnorská 11, 831 04 Bratislava, Slowakei, E-Mail:{" "}
				{companyInfo.email}
			</p>
			<p>
				Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der
				folgenden Waren:
			</p>
			<ul>
				<li>Waren: ................................................................................</li>
				<li>Bestellnummer oder andere Angaben zum Vertrag: ....................................</li>
				<li>Umfang – gesamte Bestellung oder einzelne Artikel mit Stückzahl: ..................</li>
				<li>Bestellt am / erhalten am (*): ....................................................</li>
				<li>Name des/der Verbraucher(s): ......................................................</li>
				<li>Anschrift des/der Verbraucher(s): .................................................</li>
				<li>E-Mail-Adresse für die Bestätigung (auf Papier freiwillig): .......................</li>
				<li>Datum: ............................................................................</li>
				<li>Unterschrift des/der Verbraucher(s) – nur auf Papier: .............................</li>
			</ul>
			<p>(*) Unzutreffendes streichen.</p>
			<p>
				Eine IBAN und eine Begründung sind für den Widerruf nicht erforderlich. Für eine Erstattung auf die
				ursprünglich verwendete Zahlungskarte benötigen wir keine Bankverbindung.
			</p>
		</>
	);
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	const locale = legalLocaleFor(channel);
	if (!locale) notFound();

	const copy = COPY[locale];
	const Body = locale === "sk" ? SlovakBody : locale === "cs" ? CzechBody : GermanBody;

	return (
		<LegalPage title={copy.title}>
			<ModelFormActions
				text={TEXT[locale]}
				fileName={copy.fileName}
				printLabel={copy.printLabel}
				downloadLabel={copy.downloadLabel}
			/>
			<Body channel={channel} />
		</LegalPage>
	);
}
