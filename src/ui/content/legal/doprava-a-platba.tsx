import Link from "next/link";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { AUSTRIA, GERMANY, type GermanMarket } from "./german-market";

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

/**
 * The German body, shared by both German-speaking markets.
 *
 * Two things about this page are worth not losing to a later tidy-up.
 *
 * **The 35 kg threshold is absent on purpose.** It is a Slovak operational fact tied to
 * the `sk-eur` weight bands, it does not agree with its own 30–45 kg band, and nobody
 * has checked what the German and Austrian services actually do above it. Carrying it
 * across would have been a fabricated promise (`docs/design/market-rollout/01-de-at.md` §3).
 *
 * **Payment is stated as prepayment, and cash on delivery is ruled out.** That is the
 * 2026-09-08 business decision for every market outside Slovakia. The delivered German
 * copy named Stripe but said neither, so both sentences are added here rather than
 * silently implied. Note what the wording deliberately does NOT say: nothing about
 * same-day or immediate dispatch. It ties dispatch to payment arriving AND to the
 * stated availability, because "Auf Bestellung" items are procured from a supplier.
 */
function German({ channel, market }: { channel: string; market: GermanMarket }) {
	return (
		<>
			<p>
				Für den Versand arbeiten wir mit <strong>FedEx und Slovenská pošta (Slowakische Post)</strong>{" "}
				zusammen. Welche Versandarten für Ihre Bestellung nach {market.countryName} verfügbar sind und was sie
				kosten, sehen Sie im Bestellprozess, bevor Sie die Bestellung verbindlich abschicken.
			</p>

			<h2>So liefern wir</h2>
			<p>
				Die Versandmöglichkeiten hängen von der Lieferadresse sowie von Größe und Gewicht der Sendung ab.
				Nicht jeder Versanddienstleister und nicht jede Versandart eignen sich für jedes Produkt. Für größere
				Artikel, etwa Dachboxen, können deshalb andere Versandmöglichkeiten gelten als für kleine Pakete.
			</p>
			<p>
				Wird für Ihren Warenkorb und Ihre Lieferadresse keine Versandart angezeigt,{" "}
				<Link href={marketHref(channel, "/kontakt")}>kontaktieren Sie uns</Link>. Wir prüfen, ob wir eine
				passende Lieferung anbieten können.
			</p>

			<h2>Was der Versand kostet</h2>
			<p>
				Die Versandkosten richten sich nach den bestellten Artikeln und der Lieferadresse.{" "}
				<strong>
					Den Gesamtbetrag für Ware und Versand sehen Sie vor dem verbindlichen Bestellabschluss.
				</strong>{" "}
				Kostenpflichtige Zusatzleistungen buchen wir nicht ohne Ihre Zustimmung.
			</p>

			<h2>Wann Ihre Bestellung ankommt</h2>
			<p>
				Der Liefertermin hängt von der Verfügbarkeit der Artikel und der gewählten Versandart ab. Produkte mit
				dem Hinweis „Auf Bestellung“ beschaffen wir beim Lieferanten. Der Hinweis bedeutet nicht, dass die
				Ware bereits bei uns auf Lager ist.
			</p>
			<p>
				Wir informieren Sie vor Vertragsabschluss über die Lieferung. Sollte später eine Verzögerung
				auftreten, melden wir uns und besprechen das weitere Vorgehen mit Ihnen. Ihre Rechte bei
				Nichteinhaltung eines vereinbarten Liefertermins bleiben bestehen.
			</p>
			<p>
				Sie benötigen die Ausrüstung bis zu einem bestimmten Datum? Schreiben Sie uns bitte vor der
				Bestellung. Wir prüfen die Liefermöglichkeiten, damit Sie planen können.
			</p>

			<h2>So können Sie bezahlen</h2>
			<p>
				Bestellungen mit Lieferung nach {market.countryName} bezahlen Sie im Voraus über{" "}
				<strong>Stripe</strong>. Die verfügbaren Zahlungsarten sehen Sie im Bestellprozess. Eine Zahlung per
				Nachnahme bieten wir nicht an. Wir versenden Ihre Bestellung nach Eingang der Zahlung und entsprechend
				der angegebenen Warenverfügbarkeit.
			</p>
			<p>
				Die Preise für {market.countryName} werden in <strong>Euro (EUR)</strong> angegeben.
			</p>
			<p>
				Wir speichern weder die vollständige Kartennummer noch den Sicherheitscode Ihrer Zahlungskarte und
				haben darauf keinen Zugriff. Diese Daten verarbeitet der Zahlungsdienstleister.
			</p>

			<h2>Wenn die Sendung ankommt</h2>
			<p>
				Prüfen Sie nach Möglichkeit die Verpackung und fotografieren Sie sichtbare Transportschäden. Ist auch
				die Ware beschädigt oder fehlt etwas, schreiben Sie uns an <Mail />.
			</p>
			<p>
				Fotos und ein Schadensvermerk des Versanddienstleisters helfen bei der Klärung. Fehlen diese
				Unterlagen, verlieren Sie dadurch allein keine gesetzlichen Mängelrechte.
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

export function Pl({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Zamówienia wysyłamy ze Słowacji za pośrednictwem{" "}
				<strong>FedEx i Slovenská pošta (Poczty Słowackiej)</strong>. Dostępne sposoby dostawy do Polski oraz
				ich cenę zobaczą Państwo podczas składania zamówienia, przed jego wiążącym zatwierdzeniem.
			</p>

			<h2>Jak dostarczamy zamówienia</h2>
			<p>
				Możliwości dostawy zależą od adresu, wymiarów i masy przesyłki. Nie każdy przewoźnik i nie każda
				usługa są dostępne dla każdego produktu. Dlatego dostawa większych produktów, na przykład boksu
				dachowego, może różnić się od dostawy małej paczki.
			</p>
			<p>
				Jeżeli dla podanego adresu i zawartości koszyka nie pojawi się żadna opcja dostawy, prosimy o{" "}
				<Link href={marketHref(channel, "/kontakt")}>kontakt</Link>. Sprawdzimy, czy możemy zorganizować
				odpowiedni transport.
			</p>

			<h2>Ile kosztuje dostawa</h2>
			<p>
				Koszt zależy od zamówionych produktów i miejsca dostawy.{" "}
				<strong>Łączną cenę towaru i dostawy poznają Państwo przed zatwierdzeniem zamówienia.</strong> Nie
				dodajemy płatnych usług bez Państwa zgody.
			</p>

			<h2>Kiedy zamówienie dotrze</h2>
			<p>
				Termin zależy od dostępności produktów i wybranego sposobu dostawy. Towar oznaczony jako{" "}
				<strong>„Na zamówienie”</strong> sprowadzamy od dostawcy. To oznaczenie nie oznacza, że produkt jest
				już w naszym magazynie.
			</p>
			<p>
				Informację o dostawie przekazujemy przed zawarciem umowy. Jeżeli później pojawi się przeszkoda,
				skontaktujemy się z Państwem i zaproponujemy dalsze postępowanie. Nie ogranicza to Państwa praw w
				razie niedotrzymania uzgodnionego terminu.
			</p>
			<p>
				Potrzebują Państwo wyposażenia na konkretny dzień? Warto napisać do nas przed zakupem. Sprawdzimy
				możliwości dostawy, aby ułatwić planowanie.
			</p>

			<h2>Jak można zapłacić</h2>
			<p>
				Za zamówienia z dostawą do Polski płacą Państwo <strong>z góry, przez Stripe</strong>. Dostępne metody
				płatności pojawiają się podczas składania zamówienia.{" "}
				<strong>Nie oferujemy płatności za pobraniem.</strong> Zamówienie wysyłamy po otrzymaniu płatności i
				zgodnie z podaną dostępnością towaru.
			</p>
			<p>
				Ceny w polskiej wersji sklepu są podawane w <strong>złotych polskich (PLN)</strong>.
			</p>
			<p>
				Nie przechowujemy pełnego numeru karty ani jej kodu zabezpieczającego i nie mamy do nich dostępu. Dane
				te przetwarza dostawca usługi płatniczej.
			</p>

			<h2>Przy odbiorze przesyłki</h2>
			<p>
				Warto sprawdzić opakowanie i sfotografować widoczne uszkodzenia. Jeżeli uszkodzony jest również towar
				albo czegoś brakuje, prosimy napisać na <Mail />.
			</p>
			<p>
				Zdjęcia i protokół przewoźnika mogą pomóc wyjaśnić sprawę. Ich brak sam w sobie nie oznacza jednak
				utraty prawa do reklamacji.
			</p>
		</>
	);
}

export function Hu({ channel }: { channel: string }) {
	return (
		<>
			<p>
				A csomagok szállításában a <strong>FedEx és a Slovenská pošta (Szlovák Posta)</strong> a partnerünk. A
				magyarországi címére és az adott rendelésre elérhető szállítási módokat és díjakat még a kötelező
				érvényű megrendelés elküldése előtt megmutatjuk.
			</p>

			<h2>Hogyan szállítunk</h2>
			<p>
				A szállítási lehetőségek a kézbesítési címtől, valamint a csomag méretétől és tömegétől függenek. Nem
				minden fuvarozó és szállítási mód alkalmas minden termékhez. Nagyobb termékeknél, például tetőboxoknál
				ezért eltérhetnek a lehetőségek a kis csomagokhoz képest.
			</p>
			<p>
				Ha a kosár tartalmához és a megadott címhez nem jelenik meg szállítási mód,{" "}
				<Link href={marketHref(channel, "/kontakt")}>lépjen kapcsolatba velünk</Link>. Ellenőrizzük, tudunk-e
				megfelelő szállítást biztosítani.
			</p>

			<h2>Mennyibe kerül a szállítás</h2>
			<p>
				A szállítás díja a rendelt termékektől és a kézbesítési címtől függ.{" "}
				<strong>A termékek és a szállítás teljes összegét a megrendelés véglegesítése előtt látja.</strong>{" "}
				Fizetős kiegészítő szolgáltatást nem rendelünk meg az Ön hozzájárulása nélkül.
			</p>

			<h2>Mikor érkezik meg a rendelés</h2>
			<p>
				A kézbesítés ideje a termék elérhetőségétől és a választott szállítási módtól függ. A{" "}
				<strong>„Rendelésre”</strong> jelzéssel ellátott termékeket a beszállítótól szerezzük be. Ez a jelzés
				nem azt jelenti, hogy a termék már a saját raktárunkban van.
			</p>
			<p>
				A szállítás feltételeiről a szerződéskötés előtt tájékoztatjuk. Ha később késedelem merül fel,
				felvesszük Önnel a kapcsolatot, és egyeztetjük a továbbiakat. A megállapodott szállítási határidő
				elmulasztásából eredő jogait ez nem érinti.
			</p>
			<p>
				Meghatározott időpontra van szüksége a felszerelésre? Kérjük, rendelés előtt írjon nekünk. Megnézzük a
				lehetőségeket, hogy tervezni tudjon.
			</p>

			<h2>Hogyan fizethet</h2>
			<p>
				A magyarországi címre szóló rendeléseket <strong>előre, a Stripe rendszerén keresztül</strong> kell
				kifizetni. Az elérhető fizetési módokat a rendelési folyamatban látja.{" "}
				<strong>Utánvétes fizetést nem kínálunk.</strong> A rendelést a fizetés beérkezése után, a
				feltüntetett termékelérhetőségnek megfelelően adjuk fel.
			</p>
			<p>
				A magyarországi árakat <strong>magyar forintban (HUF)</strong> tüntetjük fel.
			</p>
			<p>
				A teljes bankkártyaszámot és a kártya biztonsági kódját nem tároljuk, és azokhoz nem férünk hozzá.
				Ezeket az adatokat a fizetési szolgáltató kezeli.
			</p>

			<h2>A csomag átvételekor</h2>
			<p>
				Lehetőség szerint ellenőrizze a csomagolást, és fényképezze le a látható szállítási sérüléseket. Ha a
				termék is sérült, vagy valami hiányzik, írjon az <Mail /> címre.
			</p>
			<p>
				A fényképek és a fuvarozó kárjegyzőkönyve segíthetik a tisztázást. Hiányuk azonban önmagában nem
				fosztja meg Önt a hibás teljesítésből eredő jogaitól.
			</p>
		</>
	);
}
