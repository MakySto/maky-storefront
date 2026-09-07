import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { companyInfo, companyPhoneHref } from "@/config/company";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Kontakt"),
	description:
		"Potrebujete poradiť s výberom alebo objednávkou? Kontaktujte MAKY.STORE. Nájdete tu e-mail, telefón, fakturačné údaje aj adresu na vrátenie tovaru.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="Kontakt">
			<p>
				Potrebujete poradiť s výberom, overiť vhodnosť príslušenstva alebo sa opýtať na objednávku? Napíšte
				nám alebo zavolajte.
			</p>
			<p>
				<strong>E-mail:</strong> <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>
				<br />
				<strong>Telefón:</strong> <a href={companyPhoneHref}>{companyInfo.phone}</a>
			</p>
			<p>
				Na správy odpovedáme počas pracovných dní. Pri otázke k objednávke nám pomôže jej číslo. Ak vyberáte
				príslušenstvo na auto, uveďte značku, model, rok výroby a pri strešných nosičoch aj typ strechy.
				Fotografia často uľahčí overenie.
			</p>

			<h2>Vrátenie tovaru a reklamácie</h2>
			<p>Zásielky s vráteným alebo reklamovaným tovarom posielajte na adresu:</p>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				Stará Vajnorská 11
				<br />
				831 04 Bratislava
				<br />
				{companyInfo.country}
			</p>
			<p>
				Táto adresa sa líši od sídla spoločnosti. Pri vrátení tovaru postupujte podľa stránky{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstúpenie od zmluvy</Link>. Pri vadnom
				alebo poškodenom výrobku nájdete postup v časti{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamácie a vrátenie tovaru</Link>.
			</p>

			<h2>Prevádzkovateľ a fakturačné údaje</h2>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				{companyInfo.street}
				<br />
				{companyInfo.city}
				<br />
				{companyInfo.country}
			</p>
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
			<p>
				{companyInfo.supervisoryAuthority.name.replace(" (SOI)", "")}
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
		</LegalPage>
	);
}
