import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Odstúpenie od zmluvy"),
	description: "Ako odstúpiť od zmluvy v MAKY.STORE — lehoty, postup a vzorový formulár na stiahnutie.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="Odstúpenie od zmluvy">
			<p>
				Ak ste spotrebiteľ, môžete od zmluvy odstúpiť bez uvedenia dôvodu do 14 dní od prevzatia tovaru.
				Registrovaným zákazníkom, ktorí objednávku vytvorili po prihlásení do svojho zákazníckeho účtu,
				poskytujeme predĺženú lehotu 30 dní.
			</p>
			<p>
				Odstúpenie nám oznámte e-mailom na info@maky.store alebo zaslaním vyplneného vzorového formulára
				(nižšie) e-mailom či poštou na adresu Stará Vajnorská 11, 831 04 Bratislava. Po prijatí oznámenia vám
				potvrdíme jeho prijatie.
			</p>
			<p>
				Tovar nám zašlite najneskôr do 14 dní od odstúpenia. Vrátenie platby prebehne po splnení podmienok
				uvedených vo Všeobecných obchodných podmienkach.
			</p>
			<h3>Vzorový formulár na odstúpenie od zmluvy</h3>
			<p>(Vyplňte a zašlite tento formulár len v prípade, že si želáte odstúpiť od zmluvy.)</p>
			<p>Komu: MAKY.STORE s. r. o., Stará Vajnorská 11, 831 04 Bratislava, e-mail: info@maky.store</p>
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
