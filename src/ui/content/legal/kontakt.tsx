import Link from "next/link";
import { companyInfo, companyPhoneHref } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { AUSTRIA, GERMANY, SLOVAKIA_DE, type GermanMarket } from "./german-market";

const Mail = () => <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;
const Phone = () => <a href={companyPhoneHref}>{companyInfo.phone}</a>;

/**
 * Shared by every language — an address is not translated, and SOI's name is its name.
 *
 * The country line is the exception, and it is the only one: it is prose, not part of
 * the postal address as the Slovak post office would read it. It takes a default so the
 * Slovak and Czech bodies render exactly what they rendered before German arrived.
 */
function ReturnAddress({ country = "Slovenská republika" }: { country?: string }) {
	return (
		<p>
			<strong>{companyInfo.legalName}</strong>
			<br />
			Stará Vajnorská 11
			<br />
			831 04 Bratislava
			<br />
			{country}
		</p>
	);
}

function SeatAddress({ country = "Slovenská republika" }: { country?: string }) {
	return (
		<p>
			<strong>{companyInfo.legalName}</strong>
			<br />
			{companyInfo.street}
			<br />
			{companyInfo.city}
			<br />
			{country}
		</p>
	);
}

function SupervisoryAuthority({
	gloss,
	country = "Slovenská republika",
}: {
	/** A translation of the authority's name, appended to it rather than replacing it. */
	gloss?: string;
	country?: string;
}) {
	return (
		<p>
			Slovenská obchodná inšpekcia
			{gloss ? ` — ${gloss}` : ""}
			<br />
			{companyInfo.supervisoryAuthority.department}
			<br />
			Bajkalská 21/A, P. O. BOX č. 5
			<br />
			820 07 Bratislava
			<br />
			{country}
			<br />
			<a href={companyInfo.supervisoryAuthority.url} rel="noopener noreferrer" target="_blank">
				www.soi.sk
			</a>
		</p>
	);
}

export function Sk({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Potrebujete poradiť s výberom, overiť vhodnosť príslušenstva alebo sa opýtať na objednávku? Napíšte
				nám alebo zavolajte.
			</p>
			<p>
				<strong>E-mail:</strong> <Mail />
				<br />
				<strong>Telefón:</strong> <Phone />
			</p>
			<p>
				Na správy odpovedáme počas pracovných dní. Pri otázke k objednávke nám pomôže jej číslo. Ak vyberáte
				príslušenstvo na auto, uveďte značku, model, rok výroby a pri strešných nosičoch aj typ strechy.
				Fotografia často uľahčí overenie.
			</p>

			<h2>Vrátenie tovaru a reklamácie</h2>
			<p>Zásielky s vráteným alebo reklamovaným tovarom posielajte na adresu:</p>
			<ReturnAddress />
			<p>
				Táto adresa sa líši od sídla spoločnosti. Pri vrátení tovaru postupujte podľa stránky{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstúpenie od zmluvy</Link>. Pri vadnom
				alebo poškodenom výrobku nájdete postup v časti{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamácie a vrátenie tovaru</Link>.
			</p>

			<h2>Prevádzkovateľ a fakturačné údaje</h2>
			<SeatAddress />
			<p>
				<strong>IČO:</strong> {companyInfo.ico}
				<br />
				<strong>DIČ:</strong> {companyInfo.dic}
				<br />
				<strong>IČ DPH:</strong> {companyInfo.icDph}
			</p>
			<p>
				Spoločnosť je platiteľom DPH a je zapísaná v Obchodnom registri Mestského súdu Bratislava III, oddiel
				Sro, vložka č. 200804/B.
			</p>

			<h2>Orgán dozoru</h2>
			<SupervisoryAuthority />
		</>
	);
}

export function Cs({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Potřebujete poradit s výběrem, ověřit vhodnost příslušenství nebo se zeptat na objednávku? Napište nám
				nebo zavolejte.
			</p>
			<p>
				<strong>E-mail:</strong> <Mail />
				<br />
				<strong>Telefon:</strong> <Phone />
			</p>
			<p>
				Na zprávy odpovídáme v pracovní dny. U dotazu k objednávce nám pomůže její číslo. Pokud vybíráte
				příslušenství k autu, uveďte značku, model, rok výroby a u střešních nosičů také typ střechy.
				Fotografie často usnadní ověření.
			</p>

			<h2>Vrácení zboží a reklamace</h2>
			<p>Zásilky s vráceným nebo reklamovaným zbožím posílejte na adresu:</p>
			<ReturnAddress />
			<p>
				Tato adresa se liší od sídla společnosti. Při vrácení zboží postupujte podle stránky{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstoupení od smlouvy</Link>. U vadného nebo
				poškozeného výrobku najdete postup v části{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamace a vrácení zboží</Link>.
			</p>

			<h2>Provozovatel a fakturační údaje</h2>
			<SeatAddress />
			<p>
				<strong>IČO:</strong> {companyInfo.ico}
				<br />
				<strong>DIČ:</strong> {companyInfo.dic}
				<br />
				<strong>IČ DPH:</strong> {companyInfo.icDph}
			</p>
			<p>
				Společnost je plátcem DPH a je zapsána v obchodním rejstříku soudu Mestský súd Bratislava III, oddíl
				Sro, vložka č. 200804/B.
			</p>

			<h2>Orgán dozoru</h2>
			<SupervisoryAuthority />
		</>
	);
}

/**
 * The German body, shared by both German-speaking markets.
 *
 * Only the name of the right to withdraw differs on this page, and it differs twice —
 * in the link text. Everything else is one text, which is why `de` and `deAt` share a
 * component rather than duplicating four hundred words of identical German.
 */
function German({ channel, market }: { channel: string; market: GermanMarket }) {
	return (
		<>
			<p>
				Sie haben eine Frage zu einem Produkt, möchten die Eignung eines Zubehörteils prüfen oder brauchen
				Hilfe mit Ihrer Bestellung? Schreiben Sie uns oder rufen Sie an.
			</p>
			<p>
				<strong>E-Mail:</strong> <Mail />
				<br />
				<strong>Telefon:</strong> <Phone />
			</p>
			<p>
				Wir beantworten Nachrichten an unseren Arbeitstagen. Bei Fragen zu einer Bestellung hilft uns die
				Bestellnummer. Wenn Sie Zubehör für Ihr Auto suchen, nennen Sie bitte Marke, Modell und Baujahr, bei
				Dachträgern auch die Dachart. Ein Foto kann die Prüfung erleichtern.
			</p>

			<h2>Rücksendungen und Reklamationen</h2>
			<p>Zurückgesendete oder reklamierte Ware schicken Sie bitte an:</p>
			<ReturnAddress country={SLOVAKIA_DE} />
			<p>
				Diese Anschrift unterscheidet sich von unserem Firmensitz. Informationen zur Rückgabe ohne Angabe von
				Gründen finden Sie unter{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>{market.withdrawalTerm}</Link>. Bei einem
				mangelhaften oder beschädigten Produkt hilft Ihnen die Seite{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamationen und Rücksendungen</Link>.
			</p>

			<h2>Anbieter und Rechnungsangaben</h2>
			<SeatAddress country={SLOVAKIA_DE} />
			<p>
				<strong>Unternehmensidentifikationsnummer (IČO):</strong> {companyInfo.ico}
				<br />
				<strong>Slowakische Steuernummer (DIČ):</strong> {companyInfo.dic}
				<br />
				<strong>Umsatzsteuer-Identifikationsnummer:</strong> {companyInfo.icDph}
			</p>
			<p>
				Die Gesellschaft ist in der Slowakei umsatzsteuerlich registriert. Sie ist im Handelsregister des
				Stadtgerichts Bratislava III (Mestský súd Bratislava III), Abteilung Sro, unter der Eintragsnummer
				200804/B eingetragen.
			</p>

			<h2>Aufsicht am Sitz des Unternehmens</h2>
			<SupervisoryAuthority country={SLOVAKIA_DE} gloss="Slowakische Handelsinspektion" />
			<p>
				Informationen zur außergerichtlichen Streitbeilegung und zur Unterstützung bei grenzüberschreitenden
				Käufen finden Sie in unseren <Link href={marketHref(channel, "/obchodne-podmienky")}>AGB</Link>.
			</p>
		</>
	);
}

export function De({ channel }: { channel: string }) {
	return <German channel={channel} market={GERMANY} />;
}

export function DeAt({ channel }: { channel: string }) {
	return <German channel={channel} market={AUSTRIA} />;
}
