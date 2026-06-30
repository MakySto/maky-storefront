import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Reklamácie a vrátenie tovaru"),
	description:
		"Ako vrátiť tovar (14 dní, 30 dní pre registrovaných zákazníkov) a ako uplatniť reklamáciu v MAKY.STORE — postup, lehoty a kontakt.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="Reklamácie a vrátenie tovaru">
			<h3>Vrátenie tovaru (odstúpenie od zmluvy)</h3>
			<p>
				Tovar môžete ako spotrebiteľ vrátiť bez uvedenia dôvodu do 14 dní od prevzatia. Registrovaným
				zákazníkom, ktorí objednávku vytvorili po prihlásení do svojho zákazníckeho účtu, poskytujeme
				predĺženú lehotu na vrátenie 30 dní.
			</p>
			<p>
				Odstúpenie od zmluvy môžete uplatniť vyplnením vzorového formulára na stránke „Odstúpenie od zmluvy“,
				e-mailom na info@maky.store alebo písomne na adresu Stará Vajnorská 11, 831 04 Bratislava.
			</p>
			<p>
				Tovar pošlite späť najneskôr do 14 dní od odstúpenia od zmluvy. Náklady na spätné zaslanie tovaru
				znáša zákazník.
			</p>
			<p>
				Peniaze vrátime rovnakým spôsobom, akým bola objednávka zaplatená, najneskôr do 14 dní od doručenia
				oznámenia o odstúpení. Platbu môžeme zadržať, kým nám nebude tovar doručený alebo kým zákazník
				nepreukáže jeho odoslanie.
			</p>
			<p>
				Niektorý tovar vrátiť nemožno — napríklad tovar vyrobený na mieru. Podrobnosti nájdete vo Všeobecných
				obchodných podmienkach.
			</p>
			<h3>Reklamácia (vada tovaru)</h3>
			<p>
				Záručná doba je 24 mesiacov. Reklamáciu uplatníte e-mailom na info@maky.store alebo písomne na adrese
				Stará Vajnorská 11, 831 04 Bratislava; uveďte číslo objednávky a popis vady.
			</p>
			<p>
				O uplatnení reklamácie vám vydáme písomné potvrdenie a reklamáciu vybavíme najneskôr do 30 dní. Podľa
				povahy vady máte právo na opravu, výmenu, zľavu z ceny alebo na odstúpenie od zmluvy.
			</p>
		</LegalPage>
	);
}
