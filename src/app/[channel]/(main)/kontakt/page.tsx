import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";
import { companyInfo } from "@/config/company";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Kontakt"),
	description:
		"Kontaktné a fakturačné údaje MAKY.STORE s. r. o. — e-mail, telefón, sídlo, IČO a orgán dozoru.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="Kontakt">
			<h3>Prevádzkovateľ internetového obchodu</h3>
			<p>
				<strong>MAKY.STORE s. r. o.</strong>
				<br />
				Lermontovova 911/3
				<br />
				811 05 Bratislava-Staré Mesto
				<br />
				Slovenská republika
			</p>
			<p>
				<strong>IČO:</strong> {companyInfo.ico}
				<br />
				<strong>DIČ:</strong> {companyInfo.dic}
				<br />
				<strong>IČ DPH:</strong> {companyInfo.icDph} (platiteľ DPH od {companyInfo.vatEffectiveFrom})
				<br />
				<strong>Právna forma:</strong> spoločnosť s ručením obmedzeným
				<br />
				<strong>Zápis v registri:</strong> Obchodný register Mestského súdu Bratislava III, oddiel: Sro,
				vložka č. 200804/B
				<br />
				<strong>Konateľ:</strong> Marek Kysucký
			</p>
			<h3>Adresa na vrátenie tovaru a reklamácie</h3>
			<p>
				Stará Vajnorská 11, 831 04 Bratislava
				<br />
				(Tovar pri vrátení alebo reklamácii zasielajte na túto adresu, nie na sídlo spoločnosti.)
			</p>
			<h3>Zákaznícka podpora</h3>
			<p>
				<strong>E-mail:</strong> info@maky.store
				<br />
				<strong>Telefón:</strong> +421 901 730 066
			</p>
			<p>
				Na otázky odpovedáme spravidla počas pracovných dní. Pri otázke k objednávke nám, prosím, uveďte číslo
				objednávky — pomôže nám to vybaviť vašu požiadavku rýchlejšie.
			</p>
			<h3>Fakturačné údaje</h3>
			<p>
				MAKY.STORE s. r. o.
				<br />
				Lermontovova 911/3, 811 05 Bratislava-Staré Mesto, Slovenská republika
				<br />
				IČO: {companyInfo.ico}, DIČ: {companyInfo.dic}, IČ DPH: {companyInfo.icDph}
			</p>
			<h3>Orgán dozoru</h3>
			<p>
				Slovenská obchodná inšpekcia (SOI)
				<br />
				Inšpektorát SOI pre Bratislavský kraj
				<br />
				Bajkalská 21/A, P. O. BOX č. 5, 820 07 Bratislava
				<br />
				<a href="https://www.soi.sk" target="_blank" rel="noopener noreferrer">
					www.soi.sk
				</a>
			</p>
		</LegalPage>
	);
}
