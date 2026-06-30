import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("O nás"),
	description:
		"MAKY.STORE — slovenský e-shop s auto-moto príslušenstvom: strešné nosiče, strešné boxy, nosiče bicyklov a lyží, snehové reťaze, ťažné zariadenia a ďalšie vybavenie pre auto a cestovanie.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="O nás">
			<p>
				MAKY.STORE je slovenský internetový obchod s praktickým auto-moto príslušenstvom pre každodenné
				používanie, cestovanie, šport a voľný čas.
			</p>
			<p>
				Zameriavame sa najmä na produkty, ktoré pomáhajú bezpečne a pohodlne prevážať vybavenie autom —
				strešné nosiče, strešné boxy, nosiče bicyklov, nosiče lyží, snehové reťaze, autochladničky, ťažné
				zariadenia a súvisiace príslušenstvo.
			</p>
			<p>
				Našou pridanou hodnotou je dôraz na správnu kompatibilitu. Pri produktoch sa snažíme čo
				najzrozumiteľnejšie uvádzať, pre ktoré vozidlá sú vhodné, aby si zákazník vedel vybrať riešenie, ktoré
				bude na jeho auto naozaj sedieť.
			</p>
			<p>
				Chceme ponúkať overené produkty, férový prístup a zrozumiteľné informácie bez zbytočne komplikovaného
				technického jazyka. Ak si zákazník nie je istý výberom, môže nás kontaktovať a radi mu pomôžeme nájsť
				vhodné riešenie.
			</p>
			<p>Internetový obchod prevádzkuje:</p>
			<p>
				<strong>MAKY.STORE s. r. o.</strong>
				<br />
				Lermontovova 911/3, 811 05 Bratislava-Staré Mesto, Slovenská republika
				<br />
				IČO: 57 704 627
				<br />
				Obchodný register Mestského súdu Bratislava III, oddiel: Sro, vložka č. 200804/B
				<br />
				E-mail: info@maky.store · Telefón: +421 901 730 066
			</p>
		</LegalPage>
	);
}
