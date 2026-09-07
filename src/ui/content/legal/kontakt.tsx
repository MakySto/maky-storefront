import Link from "next/link";
import { companyInfo, companyPhoneHref } from "@/config/company";
import { marketHref } from "@/lib/channel-map";

const Mail = () => <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;
const Phone = () => <a href={companyPhoneHref}>{companyInfo.phone}</a>;

/** Shared by both languages — an address is not translated, and SOI's name is its name. */
function ReturnAddress() {
	return (
		<p>
			<strong>{companyInfo.legalName}</strong>
			<br />
			Stará Vajnorská 11
			<br />
			831 04 Bratislava
			<br />
			Slovenská republika
		</p>
	);
}

function SeatAddress() {
	return (
		<p>
			<strong>{companyInfo.legalName}</strong>
			<br />
			{companyInfo.street}
			<br />
			{companyInfo.city}
			<br />
			Slovenská republika
		</p>
	);
}

function SupervisoryAuthority() {
	return (
		<p>
			Slovenská obchodná inšpekcia
			<br />
			{companyInfo.supervisoryAuthority.department}
			<br />
			Bajkalská 21/A, P. O. BOX č. 5
			<br />
			820 07 Bratislava
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
