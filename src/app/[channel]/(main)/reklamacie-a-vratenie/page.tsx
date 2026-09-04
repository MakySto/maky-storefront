import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Reklamácie a vrátenie tovaru"),
	description:
		"Ako vrátiť tovar (14 dní, 30 dní pre registrovaných zákazníkov), dohodnúť zvoz a uplatniť reklamáciu v MAKY.STORE.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="Reklamácie a vrátenie tovaru">
			<h3>Vrátenie tovaru (odstúpenie od zmluvy)</h3>
			<p>
				Ako spotrebiteľ môžete od zmluvy odstúpiť bez uvedenia dôvodu do 14 dní od prevzatia tovaru.
				Registrovaným zákazníkom, ktorí objednávku vytvorili po prihlásení do svojho zákazníckeho účtu,
				poskytujeme predĺženú lehotu 30 dní.
			</p>
			<p>
				Odstúpenie od zmluvy môžete uplatniť online na stránke „Odstúpenie od zmluvy“, e-mailom na
				info@maky.store alebo písomne na adresu Stará Vajnorská 11, 831 04 Bratislava.
			</p>
			<p>
				Tovar zatiaľ neposielajte. Ozveme sa vám e-mailom s presnou cenou zvozu a navrhneme termín
				vyzdvihnutia. Náklady na spätnú prepravu znášate vy; presnú cenu vám oznámime vopred a zvoz objednáme
				až po vašom výslovnom súhlase.
			</p>
			<p>
				Ak potrebujete zabezpečiť dopravu vlastným spôsobom, kontaktujte nás pred odoslaním tovaru. Po dohode
				použite adresu MAKY.STORE s. r. o., Stará Vajnorská 11, 831 04 Bratislava.
			</p>
			<p>
				Platby v rozsahu vášho odstúpenia vám vrátime najneskôr do 14 dní odo dňa, keď nám bolo doručené vaše
				oznámenie o odstúpení. Vrátime ich rovnakým spôsobom, akým ste platili, ak sa spolu bez ďalších
				poplatkov nedohodneme inak.
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
