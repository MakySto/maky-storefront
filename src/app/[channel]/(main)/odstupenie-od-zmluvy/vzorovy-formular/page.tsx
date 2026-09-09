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
	pl: {
		title: "Wzór formularza odstąpienia od umowy",
		description:
			"Dobrowolny wzór oświadczenia o odstąpieniu od umowy do wydrukowania lub pobrania. Można także złożyć inne jednoznaczne oświadczenie.",
		fileName: "formularz-odstapienia-od-umowy.txt",
		printLabel: "Drukuj formularz",
		downloadLabel: "Pobierz formularz (.txt)",
	},
	hu: {
		title: "Elállási nyilatkozatminta",
		description:
			"Nyomtatható vagy letölthető elállási nyilatkozatminta. Használata önkéntes — bármely egyértelmű nyilatkozat megfelel.",
		fileName: "elallasi-nyilatkozatminta.txt",
		printLabel: "Nyilatkozat nyomtatása",
		downloadLabel: "Nyilatkozat letöltése (.txt)",
	},
	it: {
		title: "Modulo di recesso",
		description:
			"Modulo facoltativo di recesso da stampare o scaricare. Puoi inviare anche un’altra dichiarazione inequivocabile.",
		fileName: "modulo-di-recesso.txt",
		printLabel: "Stampa il modulo",
		downloadLabel: "Scarica il modulo (.txt)",
	},
	fr: {
		title: "Formulaire de rétractation",
		description:
			"Formulaire facultatif de rétractation à imprimer ou télécharger. Vous pouvez aussi transmettre une autre déclaration claire.",
		fileName: "formulaire-de-retractation.txt",
		printLabel: "Imprimer le formulaire",
		downloadLabel: "Télécharger le formulaire (.txt)",
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

/**
 * The Polish text.
 *
 * The statutory core is the model form in Annex 2 to the Polish consumer-rights act
 * (ustawa z 30 maja 2014 r. o prawach konsumenta), which is itself the Polish language
 * version of Annex I(B) to Directive 2011/83/EU. The additional fields — order number,
 * scope, e-mail for the acknowledgement — and the two closing sentences follow the
 * reviewed German form in this same file, because they describe MAKY's process rather
 * than the statute, and that process is the same in every market.
 *
 * ⚠️ Unlike the Slovak, Czech and German texts this one was NOT taken from a delivered
 * `formulare/` file: the PL/HU package reached the machine as the two page-copy Markdown
 * documents only, and those link to this route without containing it. Flagged in the
 * handoff so a reviewer knows which strings on this page a translator has not seen.
 */
const POLISH_TEXT = [
	"WZÓR FORMULARZA ODSTĄPIENIA OD UMOWY",
	"",
	"Formularz ten należy wypełnić i odesłać tylko w przypadku chęci odstąpienia od umowy.",
	"Skorzystanie z niego jest dobrowolne. Można też przesłać inne jednoznaczne oświadczenie.",
	"",
	"Adresat:",
	companyInfo.legalName,
	"Stará Vajnorská 11",
	"831 04 Bratislava",
	"Słowacja",
	`E-mail: ${companyInfo.email}`,
	"",
	"Ja/My (*) niniejszym informuję/informujemy (*) o moim/naszym odstąpieniu od umowy sprzedaży następujących rzeczy:",
	"",
	"................................................................................................",
	"................................................................................................",
	"",
	"Numer zamówienia lub inne dane umowy:",
	"................................................................................................",
	"",
	"Zakres — całe zamówienie albo poszczególne pozycje z liczbą sztuk:",
	"................................................................................................",
	"................................................................................................",
	"",
	"Data zawarcia umowy (*) / odbioru (*):",
	"................................................................................................",
	"",
	"Imię i nazwisko konsumenta(-ów):",
	"................................................................................................",
	"",
	"Adres konsumenta(-ów):",
	"................................................................................................",
	"................................................................................................",
	"",
	"Adres e-mail do potwierdzenia (przy oświadczeniu papierowym dobrowolny):",
	"................................................................................................",
	"",
	"Data:",
	"................................................................................................",
	"",
	"Podpis konsumenta(-ów) — tylko jeżeli formularz jest przesyłany w wersji papierowej:",
	"................................................................................................",
	"",
	"(*) Niepotrzebne skreślić.",
	"",
	"Numer IBAN ani podanie przyczyny nie są potrzebne do odstąpienia od umowy. Do zwrotu na pierwotnie użytą kartę płatniczą nie potrzebujemy danych bankowych.",
].join("\n");

/**
 * The Hungarian text.
 *
 * Statutory core: the nyilatkozatminta in Annex 2 to 45/2014. (II. 26.) Korm. rendelet.
 * The same additions as the Polish text above, and the same caveat about provenance.
 */
const HUNGARIAN_TEXT = [
	"ELÁLLÁSI NYILATKOZATMINTA",
	"",
	"Csak a szerződéstől való elállási szándék esetén töltse ki és juttassa vissza.",
	"Használata önkéntes. Bármely más egyértelmű nyilatkozatot is elküldhet.",
	"",
	"Címzett:",
	companyInfo.legalName,
	"Stará Vajnorská 11",
	"831 04 Bratislava",
	"Szlovákia",
	`E-mail: ${companyInfo.email}`,
	"",
	"Alulírott/ak kijelentem/kijelentjük, hogy gyakorlom/gyakoroljuk elállási jogomat/jogunkat az alábbi termék/ek adásvételére irányuló szerződés tekintetében:",
	"",
	"................................................................................................",
	"................................................................................................",
	"",
	"Rendelési szám vagy a szerződés egyéb azonosítója:",
	"................................................................................................",
	"",
	"Terjedelem — a teljes rendelés vagy az egyes tételek darabszámmal:",
	"................................................................................................",
	"................................................................................................",
	"",
	"Szerződéskötés időpontja / átvétel időpontja:",
	"................................................................................................",
	"",
	"A fogyasztó(k) neve:",
	"................................................................................................",
	"",
	"A fogyasztó(k) címe:",
	"................................................................................................",
	"................................................................................................",
	"",
	"E-mail-cím a visszaigazoláshoz (papíron tett nyilatkozatnál önkéntes):",
	"................................................................................................",
	"",
	"Kelt:",
	"................................................................................................",
	"",
	"A fogyasztó(k) aláírása — kizárólag papíron tett nyilatkozat esetén:",
	"................................................................................................",
	"",
	"Az elálláshoz nem szükséges IBAN-szám és indokolás. Az eredetileg használt bankkártyára történő visszatérítéshez nem kérünk bankszámlaadatot.",
].join("\n");

/**
 * The Italian text.
 *
 * Transcribed from the delivered `formulare/vzor-odstupenia.it-IT.txt` — unlike the
 * Polish and Hungarian texts above, which had to be built from the reviewed German form
 * because the PL/HU package contained no `formulare/` directory. A translator has seen
 * every line of this one.
 *
 * The statutory core is the model in Annex I(B) to Directive 2011/83/EU as transposed in
 * the Codice del consumo. The closing two sentences describe MAKY's process rather than
 * the statute, and must not be trimmed as boilerplate: they are what tells the reader
 * that neither a reason nor an IBAN is a condition of withdrawing.
 */
const ITALIAN_TEXT = [
	"MODULO DI RECESSO",
	"",
	"Compila e invia questo modulo solo se intendi recedere dal contratto.",
	"Il suo uso è facoltativo: puoi inviare anche un’altra dichiarazione inequivocabile.",
	"",
	"Destinatario:",
	companyInfo.legalName,
	"Stará Vajnorská 11",
	"831 04 Bratislava, Slovacchia",
	`E-mail: ${companyInfo.email}`,
	"",
	"Con la presente comunico/comunichiamo la decisione di recedere dal contratto",
	"di acquisto dei prodotti indicati di seguito:",
	"................................................................................",
	"................................................................................",
	"",
	"Numero d’ordine o altri riferimenti del contratto:",
	"................................................................................",
	"",
	"Ambito: intero ordine oppure singoli prodotti con le quantità:",
	"................................................................................",
	"................................................................................",
	"",
	"Data dell’ordine / data di ricezione (cancellare la voce non pertinente):",
	"................................................................................",
	"",
	"Nome e cognome del consumatore o dei consumatori:",
	"................................................................................",
	"",
	"Indirizzo del consumatore o dei consumatori:",
	"................................................................................",
	"................................................................................",
	"",
	"E-mail per la conferma (facoltativa per una dichiarazione su carta):",
	"................................................................................",
	"",
	"Data:",
	"................................................................................",
	"",
	"Firma del consumatore o dei consumatori — solo se il modulo è inviato su carta:",
	"................................................................................",
	"",
	"Il motivo del recesso e l’IBAN non sono richiesti per recedere.",
	"Non servono dati bancari per rimborsare sulla carta usata originariamente.",
].join("\n");

/**
 * The French text, from the delivered `formulare/vzor-odstupenia.fr-FR.txt`.
 *
 * Statutory core: the model form in Annexe to article R221-1 of the code de la
 * consommation, itself the French version of Annex I(B) to Directive 2011/83/EU. Note
 * that it says *rétractation* throughout: this is the consumer's withdrawal right, not
 * *résolution* (the remedy for a defect) and not *résiliation* (terminating a continuing
 * contract). Those three are distinct in French law and must not be swapped for variety.
 */
const FRENCH_TEXT = [
	"FORMULAIRE DE RÉTRACTATION",
	"",
	"À remplir et envoyer uniquement si vous souhaitez vous rétracter du contrat.",
	"Son utilisation est facultative : une autre déclaration claire convient aussi.",
	"",
	"Destinataire :",
	companyInfo.legalName,
	"Stará Vajnorská 11",
	"831 04 Bratislava, Slovaquie",
	`E-mail : ${companyInfo.email}`,
	"",
	"Je/Nous vous informe/informons de ma/notre décision de me/nous rétracter",
	"du contrat d’achat concernant les produits indiqués ci-dessous :",
	"................................................................................",
	"................................................................................",
	"",
	"Numéro de commande ou autres références du contrat :",
	"................................................................................",
	"",
	"Portée : toute la commande ou certains produits avec leurs quantités :",
	"................................................................................",
	"................................................................................",
	"",
	"Date de commande / date de réception (rayer la mention inutile) :",
	"................................................................................",
	"",
	"Prénom et nom du ou des consommateurs :",
	"................................................................................",
	"",
	"Adresse du ou des consommateurs :",
	"................................................................................",
	"................................................................................",
	"",
	"E-mail pour la confirmation (facultatif pour une déclaration sur papier) :",
	"................................................................................",
	"",
	"Date :",
	"................................................................................",
	"",
	"Signature du ou des consommateurs — uniquement pour un envoi sur papier :",
	"................................................................................",
	"",
	"Aucun motif ni IBAN n’est requis pour exercer la rétractation.",
	"Aucune donnée bancaire n’est nécessaire pour rembourser sur la carte initiale.",
].join("\n");

const TEXT: Record<LegalLocale, string> = {
	sk: SLOVAK_TEXT,
	cs: CZECH_TEXT,
	de: GERMAN_TEXT,
	deAt: GERMAN_TEXT,
	pl: POLISH_TEXT,
	hu: HUNGARIAN_TEXT,
	it: ITALIAN_TEXT,
	fr: FRENCH_TEXT,
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
				<li>Waren: ........................</li>
				<li>Bestellnummer oder andere Angaben zum Vertrag: ........................</li>
				<li>Umfang – gesamte Bestellung oder einzelne Artikel mit Stückzahl: ..................</li>
				<li>Bestellt am / erhalten am (*): ........................</li>
				<li>Name des/der Verbraucher(s): ........................</li>
				<li>Anschrift des/der Verbraucher(s): ........................</li>
				<li>E-Mail-Adresse für die Bestätigung (auf Papier freiwillig): .......................</li>
				<li>Datum: ........................</li>
				<li>Unterschrift des/der Verbraucher(s) – nur auf Papier: ........................</li>
			</ul>
			<p>(*) Unzutreffendes streichen.</p>
			<p>
				Eine IBAN und eine Begründung sind für den Widerruf nicht erforderlich. Für eine Erstattung auf die
				ursprünglich verwendete Zahlungskarte benötigen wir keine Bankverbindung.
			</p>
		</>
	);
}

function PolishBody({ channel }: { channel: string }) {
	return (
		<>
			<p className="print:hidden">
				Ten formularz można wydrukować lub pobrać. Skorzystanie z niego jest dobrowolne — wystarczy każde inne
				jednoznaczne oświadczenie. Dostępne sposoby zgłoszenia opisujemy na stronie{" "}
				<a href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstąpienie od umowy</a>.
			</p>
			<p>Formularz ten należy wypełnić i odesłać tylko w przypadku chęci odstąpienia od umowy.</p>
			<p>
				Adresat: {companyInfo.legalName}, {companyInfo.returnAddress}, Słowacja, e-mail: {companyInfo.email}
			</p>
			<p>
				Ja/My (*) niniejszym informuję/informujemy (*) o moim/naszym odstąpieniu od umowy sprzedaży
				następujących rzeczy:
			</p>
			<ul>
				<li>Rzeczy: ........................</li>
				<li>Numer zamówienia lub inne dane umowy: ........................</li>
				<li>Zakres — całe zamówienie albo poszczególne pozycje z liczbą sztuk: ..................</li>
				<li>Data zawarcia umowy (*) / odbioru (*): ........................</li>
				<li>Imię i nazwisko konsumenta(-ów): ........................</li>
				<li>Adres konsumenta(-ów): ........................</li>
				<li>Adres e-mail do potwierdzenia (na papierze dobrowolny): .......................</li>
				<li>Data: ........................</li>
				<li>Podpis konsumenta(-ów) — tylko na papierze: ........................</li>
			</ul>
			<p>(*) Niepotrzebne skreślić.</p>
			<p>
				Numer IBAN ani podanie przyczyny nie są potrzebne do odstąpienia od umowy. Do zwrotu na pierwotnie
				użytą kartę płatniczą nie potrzebujemy danych bankowych.
			</p>
		</>
	);
}

function HungarianBody({ channel }: { channel: string }) {
	return (
		<>
			<p className="print:hidden">
				Ezt a nyilatkozatmintát kinyomtathatja vagy letöltheti. Használata önkéntes — bármely más egyértelmű
				nyilatkozat is megfelel. A választható módokat az{" "}
				<a href={marketHref(channel, "/odstupenie-od-zmluvy")}>Elállási jog</a> oldalon ismertetjük.
			</p>
			<p>Csak a szerződéstől való elállási szándék esetén töltse ki és juttassa vissza.</p>
			<p>
				Címzett: {companyInfo.legalName}, {companyInfo.returnAddress}, Szlovákia, e-mail: {companyInfo.email}
			</p>
			<p>
				Alulírott/ak kijelentem/kijelentjük, hogy gyakorlom/gyakoroljuk elállási jogomat/jogunkat az alábbi
				termék/ek adásvételére irányuló szerződés tekintetében:
			</p>
			<ul>
				<li>Termék(ek): ........................</li>
				<li>Rendelési szám vagy a szerződés egyéb azonosítója: ........................</li>
				<li>Terjedelem — a teljes rendelés vagy az egyes tételek darabszámmal: ..................</li>
				<li>Szerződéskötés időpontja / átvétel időpontja: ........................</li>
				<li>A fogyasztó(k) neve: ........................</li>
				<li>A fogyasztó(k) címe: ........................</li>
				<li>E-mail-cím a visszaigazoláshoz (papíron önkéntes): .......................</li>
				<li>Kelt: ........................</li>
				<li>A fogyasztó(k) aláírása — kizárólag papíron: ........................</li>
			</ul>
			<p>
				Az elálláshoz nem szükséges IBAN-szám és indokolás. Az eredetileg használt bankkártyára történő
				visszatérítéshez nem kérünk bankszámlaadatot.
			</p>
		</>
	);
}

function ItalianBody({ channel }: { channel: string }) {
	return (
		<>
			<p className="print:hidden">
				Puoi stampare o scaricare questo modulo. Il suo uso è facoltativo — è sufficiente qualsiasi altra
				dichiarazione inequivocabile. Le modalità disponibili sono descritte nella pagina{" "}
				<a href={marketHref(channel, "/odstupenie-od-zmluvy")}>Diritto di recesso</a>.
			</p>
			<p>Compila e invia questo modulo solo se intendi recedere dal contratto.</p>
			<p>
				Destinatario: {companyInfo.legalName}, {companyInfo.returnAddress}, Slovacchia, e-mail:{" "}
				{companyInfo.email}
			</p>
			<p>
				Con la presente comunico/comunichiamo la decisione di recedere dal contratto di acquisto dei prodotti
				indicati di seguito:
			</p>
			<ul>
				<li>Prodotti: ........................</li>
				<li>Numero d’ordine o altri riferimenti del contratto: ........................</li>
				<li>Ambito: intero ordine oppure singoli prodotti con le quantità: ..................</li>
				<li>Data dell’ordine / data di ricezione: ........................</li>
				<li>Nome e cognome del consumatore o dei consumatori: ........................</li>
				<li>Indirizzo del consumatore o dei consumatori: ........................</li>
				<li>E-mail per la conferma (facoltativa su carta): .......................</li>
				<li>Data: ........................</li>
				<li>Firma del consumatore o dei consumatori — solo su carta: ........................</li>
			</ul>
			<p>
				Il motivo del recesso e l’IBAN non sono richiesti per recedere. Non servono dati bancari per
				rimborsare sulla carta usata originariamente.
			</p>
		</>
	);
}

function FrenchBody({ channel }: { channel: string }) {
	return (
		<>
			<p className="print:hidden">
				Vous pouvez imprimer ou télécharger ce formulaire. Son utilisation est facultative — une autre
				déclaration claire convient aussi. Les voies disponibles sont présentées sur la page{" "}
				<a href={marketHref(channel, "/odstupenie-od-zmluvy")}>Droit de rétractation</a>.
			</p>
			<p>À remplir et envoyer uniquement si vous souhaitez vous rétracter du contrat.</p>
			<p>
				Destinataire : {companyInfo.legalName}, {companyInfo.returnAddress}, Slovaquie, e-mail :{" "}
				{companyInfo.email}
			</p>
			<p>
				Je/Nous vous informe/informons de ma/notre décision de me/nous rétracter du contrat d’achat concernant
				les produits indiqués ci-dessous :
			</p>
			<ul>
				<li>Produits : ........................</li>
				<li>Numéro de commande ou autres références du contrat : ........................</li>
				<li>Portée : toute la commande ou certains produits avec leurs quantités : ..................</li>
				<li>Date de commande / date de réception : ........................</li>
				<li>Prénom et nom du ou des consommateurs : ........................</li>
				<li>Adresse du ou des consommateurs : ........................</li>
				<li>E-mail pour la confirmation (facultatif sur papier) : .......................</li>
				<li>Date : ........................</li>
				<li>Signature du ou des consommateurs — uniquement sur papier : ........................</li>
			</ul>
			<p>
				Aucun motif ni IBAN n’est requis pour exercer la rétractation. Aucune donnée bancaire n’est nécessaire
				pour rembourser sur la carte initiale.
			</p>
		</>
	);
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	const locale = legalLocaleFor(channel);
	if (!locale) notFound();

	const copy = COPY[locale];
	const BODIES = {
		sk: SlovakBody,
		cs: CzechBody,
		de: GermanBody,
		deAt: GermanBody,
		pl: PolishBody,
		hu: HungarianBody,
		it: ItalianBody,
		fr: FrenchBody,
	} as const satisfies Record<LegalLocale, unknown>;
	const Body = BODIES[locale];

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
