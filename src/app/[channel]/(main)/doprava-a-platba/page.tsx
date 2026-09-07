import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { companyInfo } from "@/config/company";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Doprava a platba"),
	description:
		"Tovar doručujeme cez FedEx a Slovenskú poštu. Pozrite si informácie o cene dopravy, dodaní objednávky a online platbe cez Stripe.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="Doprava a platba">
			<p>
				Tovar doručujeme prostredníctvom <strong>FedEx a Slovenskej pošty</strong>. Dostupný spôsob dopravy a
				jeho cenu uvidíte v pokladni pred odoslaním objednávky.
			</p>

			<h2>Ako doručujeme</h2>
			<p>
				Možnosti dopravy závisia od adresy doručenia, rozmerov a hmotnosti zásielky. Nie každý dopravca alebo
				služba sú dostupné pre každý výrobok. Pri väčšom tovare, napríklad strešnom boxe, sa preto ponuka
				dopravy môže líšiť od menších balíkov.
			</p>
			<p>
				<strong>Pri zásielkach nad 35 kg dojednávame dopravu individuálne.</strong> Takúto objednávku nemusí
				pokladňa ponúknuť automaticky — napíšte nám pred objednaním a pripravíme vám ponuku dopravy.
			</p>
			<p>
				Ak sa pre vašu adresu nezobrazí žiadna možnosť doručenia,{" "}
				<Link href={marketHref(channel, "/kontakt")}>kontaktujte nás</Link>. Overíme, či vieme dopravu
				zabezpečiť.
			</p>

			<h2>Koľko stojí doprava</h2>
			<p>
				Cenu vypočítame podľa obsahu objednávky a miesta doručenia.{" "}
				<strong>Celkovú sumu za tovar aj dopravu poznáte ešte pred potvrdením objednávky.</strong> Ďalšiu
				platenú službu vám nepridáme bez vášho súhlasu.
			</p>

			<h2>Kedy objednávka príde</h2>
			<p>
				Termín závisí od dostupnosti výrobkov a zvolenej dopravy. Tovar označený ako „na objednávku“
				zabezpečujeme od dodávateľa; toto označenie neznamená, že je u nás skladom.
			</p>
			<p>
				Informáciu o dodaní vám poskytneme pred uzavretím objednávky. Ak sa neskôr objaví prekážka, ozveme sa
				vám a navrhneme ďalší postup. Vaše práva pri nedodržaní dohodnutého termínu tým nie sú dotknuté.
			</p>
			<p>
				Potrebujete výbavu do konkrétneho dátumu? Pred objednaním nám napíšte. Overíme možnosti dodania, aby
				ste vedeli, s čím počítať.
			</p>

			<h2>Ako môžete zaplatiť</h2>
			<p>
				Online platby spracúva platobná brána <strong>Stripe</strong>. V pokladni sa zobrazia platobné metódy
				dostupné pre vašu objednávku.
			</p>
			<p>
				Úplné údaje o platobnej karte neukladáme ani k nim nemáme prístup. Spracúva ich poskytovateľ platobnej
				služby.
			</p>

			<h2>Keď zásielka dorazí</h2>
			<p>
				Odporúčame skontrolovať obal a pri viditeľnom poškodení ho odfotografovať. Ak je poškodený aj tovar
				alebo niečo chýba, ozvite sa nám na <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>.
			</p>
			<p>
				Fotografie a záznam od dopravcu nám pomôžu situáciu vyriešiť. Ich chýbanie však samo osebe neznamená,
				že strácate právo na reklamáciu.
			</p>
		</LegalPage>
	);
}
