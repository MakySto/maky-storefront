import Link from "next/link";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";

const Mail = () => <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;

export function Sk({ channel }: { channel: string }) {
	return (
		<>
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
				alebo niečo chýba, ozvite sa nám na <Mail />.
			</p>
			<p>
				Fotografie a záznam od dopravcu nám pomôžu situáciu vyriešiť. Ich chýbanie však samo osebe neznamená,
				že strácate právo na reklamáciu.
			</p>
		</>
	);
}

export function Cs({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Zboží doručujeme prostřednictvím <strong>FedEx a Slovenské pošty</strong>. Dostupný způsob dopravy a
				jeho cenu uvidíte v pokladně před odesláním objednávky.
			</p>

			<h2>Jak doručujeme</h2>
			<p>
				Možnosti dopravy závisí na doručovací adrese, rozměrech a hmotnosti zásilky. Dostupnost dopravců a
				jejich služeb se může u jednotlivých výrobků lišit. U většího zboží, například střešního boxu, se
				proto nabídka dopravy může lišit od menších balíků.
			</p>
			<p>
				Pokud se pro vaši adresu nezobrazí žádná možnost doručení,{" "}
				<Link href={marketHref(channel, "/kontakt")}>kontaktujte nás</Link>. Ověříme, zda dokážeme dopravu
				zajistit.
			</p>

			<h2>Kolik stojí doprava</h2>
			<p>
				Cenu vypočítáme podle obsahu objednávky a místa doručení.{" "}
				<strong>Celkovou částku za zboží i dopravu znáte ještě před potvrzením objednávky.</strong> Další
				placenou službu vám nepřidáme bez vašeho souhlasu.
			</p>

			<h2>Kdy objednávka dorazí</h2>
			<p>
				Termín závisí na dostupnosti výrobků a zvolené dopravě. Zboží označené jako „na objednávku“
				zajišťujeme od dodavatele; toto označení neznamená, že je u nás skladem.
			</p>
			<p>
				Informaci o dodání vám poskytneme před dokončením objednávky. Pokud se později objeví překážka, ozveme
				se vám a navrhneme další postup. Vaše práva při nedodržení dohodnutého termínu tím nejsou dotčena.
			</p>
			<p>
				Potřebujete výbavu do konkrétního data? Před objednáním nám napište. Ověříme možnosti dodání, abyste
				věděli, s čím počítat.
			</p>

			<h2>Jak můžete zaplatit</h2>
			<p>
				Online platby zpracovává platební brána <strong>Stripe</strong>. V pokladně se zobrazí platební metody
				dostupné pro vaši objednávku.
			</p>
			<p>
				Úplné údaje o platební kartě neukládáme ani k nim nemáme přístup. Zpracovává je poskytovatel platební
				služby.
			</p>

			<h2>Když zásilka dorazí</h2>
			<p>
				Doporučujeme zkontrolovat obal a při viditelném poškození ho vyfotografovat. Pokud je poškozené i
				zboží nebo něco chybí, ozvěte se nám na <Mail />.
			</p>
			<p>
				Fotografie a záznam od dopravce nám pomohou situaci vyřešit. Jejich absence však sama o sobě
				neznamená, že ztrácíte právo na reklamaci.
			</p>
		</>
	);
}
