import Link from "next/link";
import { type ReactNode } from "react";
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
				A rendeléseket <strong>Szlovákiából</strong> adjuk fel, a{" "}
				<strong>FedEx és a Slovenská pošta (Szlovák Posta)</strong> közreműködésével. A magyarországi címére
				és az adott rendelésre elérhető szállítási módokat és díjakat még a kötelező érvényű megrendelés
				elküldése előtt megmutatjuk.
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

export function It({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Spediamo gli ordini dalla Slovacchia con <strong>FedEx e Slovenská pošta (Poste slovacche)</strong>.
				Le modalità disponibili per il tuo indirizzo in Italia e il relativo costo sono indicati durante
				l’ordine, prima della conferma che comporta l’obbligo di pagamento.
			</p>

			<h2>Come consegniamo gli ordini</h2>
			<p>
				Le possibilità di consegna dipendono dall’indirizzo, dalle dimensioni e dal peso del pacco. Non tutti
				i corrieri o servizi sono disponibili per ogni prodotto. Per gli articoli voluminosi, come un box da
				tetto, le opzioni possono quindi essere diverse da quelle di un piccolo pacco.
			</p>
			<p>
				Se non compare una modalità di consegna per il tuo indirizzo e il contenuto del carrello,{" "}
				<Link href={marketHref(channel, "/kontakt")}>contattaci</Link>. Verificheremo se possiamo organizzare
				un trasporto adatto.
			</p>

			<h2>Quanto costa la spedizione</h2>
			<p>
				Il costo dipende dai prodotti e dalla destinazione.{" "}
				<strong>
					Il totale dei prodotti e della spedizione è visibile prima della conferma dell’ordine.
				</strong>{" "}
				Non aggiungiamo servizi a pagamento senza il tuo consenso.
			</p>

			<h2>Quando arriva l’ordine</h2>
			<p>
				I tempi dipendono dalla disponibilità dei prodotti e dalla modalità di consegna scelta. Gli articoli
				indicati come <strong>«Su ordinazione»</strong> vengono procurati dal fornitore: questa dicitura non
				significa che siano già presenti nel nostro magazzino.
			</p>
			<p>
				Comunichiamo le condizioni di consegna prima della conclusione del contratto. Se in seguito si
				presenta un impedimento, ti contattiamo per concordare come procedere. Restano salvi i tuoi diritti in
				caso di mancato rispetto del termine concordato.
			</p>
			<p>
				Ti serve l’attrezzatura per una data precisa? Scrivici prima di acquistare: verificheremo le
				possibilità di consegna per aiutarti a organizzarti.
			</p>

			<h2>Come pagare</h2>
			<p>
				Gli ordini con consegna in Italia si pagano <strong>in anticipo tramite Stripe</strong>. I metodi
				disponibili sono mostrati durante l’ordine.{" "}
				<strong>Non offriamo il pagamento in contrassegno.</strong> Spediamo dopo aver ricevuto il pagamento,
				nel rispetto della disponibilità indicata per i prodotti.
			</p>
			<p>
				I prezzi nella versione italiana del negozio sono espressi in <strong>euro (EUR)</strong>.
			</p>
			<p>
				Non conserviamo il numero completo della carta né il codice di sicurezza e non possiamo accedervi.
				Questi dati vengono trattati dal prestatore del servizio di pagamento.
			</p>

			<h2>Alla consegna</h2>
			<p>
				È utile controllare l’imballaggio e fotografare eventuali danni visibili. Se anche il prodotto è
				danneggiato o manca qualcosa, scrivi a <Mail />.
			</p>
			<p>
				Le fotografie e il verbale del corriere possono aiutare a chiarire l’accaduto. La loro assenza, da
				sola, non comporta la perdita dei diritti relativi a un prodotto difettoso.
			</p>
		</>
	);
}

export function Fr({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Nous expédions les commandes depuis la Slovaquie avec{" "}
				<strong>FedEx et Slovenská pošta (la Poste slovaque)</strong>. Les modes de livraison disponibles pour
				votre adresse en France et leurs tarifs sont indiqués pendant la commande, avant sa validation avec
				obligation de paiement.
			</p>

			<h2>Comment nous livrons</h2>
			<p>
				Les possibilités de livraison dépendent de l’adresse, des dimensions et du poids du colis. Chaque
				transporteur ou service ne convient pas à tous les produits. Pour un article volumineux, comme un
				coffre de toit, les options peuvent donc différer de celles proposées pour un petit colis.
			</p>
			<p>
				Si aucun mode de livraison n’apparaît pour votre adresse et le contenu de votre panier,{" "}
				<Link href={marketHref(channel, "/kontakt")}>contactez-nous</Link>. Nous vérifierons s’il est possible
				d’organiser un transport adapté.
			</p>

			<h2>Combien coûte la livraison</h2>
			<p>
				Le tarif dépend des produits commandés et de leur destination.{" "}
				<strong>
					Le prix total des produits et de la livraison est indiqué avant la validation de la commande.
				</strong>{" "}
				Nous n’ajoutons aucun service payant sans votre accord.
			</p>

			<h2>Quand arrive la commande</h2>
			<p>
				Le délai dépend de la disponibilité des produits et du mode de livraison choisi. Les articles portant
				la mention <strong>«Sur commande»</strong> sont approvisionnés auprès du fournisseur. Cette mention ne
				signifie pas qu’ils sont déjà dans notre stock.
			</p>
			<p>
				Nous indiquons les conditions de livraison avant la conclusion du contrat. Si un obstacle survient
				ensuite, nous vous contactons pour convenir de la suite. Vos droits en cas de non-respect du délai
				convenu restent inchangés.
			</p>
			<p>
				Vous avez besoin de votre équipement pour une date précise ? Écrivez-nous avant d’acheter. Nous
				vérifierons les possibilités de livraison pour vous aider à préparer votre départ.
			</p>

			<h2>Comment payer</h2>
			<p>
				Les commandes à destination de la France sont réglées{" "}
				<strong>à l’avance, par l’intermédiaire de Stripe</strong>. Les moyens de paiement disponibles sont
				affichés pendant la commande. <strong>Nous ne proposons pas de paiement contre remboursement.</strong>{" "}
				L’expédition intervient après réception du paiement, selon la disponibilité annoncée des produits.
			</p>
			<p>
				Les prix de la version française de la boutique sont exprimés en <strong>euros (EUR)</strong>.
			</p>
			<p>
				Nous ne conservons pas le numéro complet de votre carte ni son cryptogramme et n’y avons pas accès.
				Ces données sont traitées par le prestataire de paiement.
			</p>

			<h2>À la réception</h2>
			<p>
				Dans la mesure du possible, vérifiez l’emballage et photographiez les dommages visibles. Si le produit
				est également endommagé ou qu’un élément manque, écrivez à <Mail />.
			</p>
			<p>
				Les photos et le constat du transporteur peuvent faciliter le traitement du dossier. Leur absence ne
				vous prive pas, à elle seule, de vos droits en cas de défaut du produit.
			</p>
		</>
	);
}

export function Es({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Enviamos los pedidos{" "}
				<strong>desde Eslovaquia mediante FedEx y Slovenská pošta, el servicio postal eslovaco</strong>. Antes
				de confirmar el pedido con obligación de pago, verás las opciones de entrega disponibles para tu
				dirección y su precio.
			</p>

			<h2>Cómo enviamos los pedidos</h2>
			<p>
				Las opciones dependen de la dirección de entrega y del tamaño y peso del paquete. No todos los
				transportistas ni todos sus servicios están disponibles para cada producto. Por ejemplo, el transporte
				de un cofre de techo puede ser distinto del de un paquete pequeño.
			</p>
			<p>
				Si no aparece ninguna opción para tu dirección y los productos del carrito,{" "}
				<Link href={marketHref(channel, "/kontakt")}>contacta con nosotros</Link>. Comprobaremos si podemos
				organizar un transporte adecuado. Esta página no promete la disponibilidad de todos los servicios en
				cualquier destino.
			</p>

			<h2>Cuánto cuesta el envío</h2>
			<p>
				El coste depende de los productos y del destino.{" "}
				<strong>Conocerás el importe total de los productos y del envío antes de confirmar el pedido.</strong>{" "}
				No añadimos servicios de pago sin tu consentimiento expreso.
			</p>

			<h2>Cuándo llegará</h2>
			<p>
				El plazo depende de la disponibilidad de los productos y del servicio de transporte. Los artículos
				marcados <strong>«Bajo pedido»</strong> se solicitan al proveedor: esa indicación no significa que ya
				estén en nuestro almacén.
			</p>
			<p>
				Te informamos de las condiciones de entrega antes de contratar. Si después surge un problema, nos
				pondremos en contacto contigo y te propondremos cómo continuar. Esto no limita tus derechos si
				incumplimos el plazo acordado.
			</p>
			<p>
				¿Necesitas el equipo para una fecha concreta? Escríbenos antes de comprar. Revisaremos las
				posibilidades de entrega para que puedas planificar.
			</p>

			<h2>Cómo pagar</h2>
			<p>
				Los pedidos con entrega en España se pagan <strong>por adelantado mediante Stripe</strong>, utilizando
				uno de los métodos que se muestran al tramitar el pedido.{" "}
				<strong>No ofrecemos pago contrarreembolso.</strong> Enviamos una vez recibido el pago y de acuerdo
				con la disponibilidad indicada.
			</p>
			<p>
				Los precios de la versión española se muestran en <strong>euros (EUR)</strong>.
			</p>
			<p>
				No almacenamos el número completo de tu tarjeta ni su código de seguridad, ni tenemos acceso a ellos.
				Los procesa el proveedor del servicio de pago.
			</p>

			<h2>Al recibir el paquete</h2>
			<p>
				Recomendamos revisar el embalaje y fotografiar los daños visibles. Si el producto también está dañado
				o falta algo, escribe a <Mail />.
			</p>
			<p>
				Las fotografías y el parte del transportista pueden ayudar a aclarar lo ocurrido. Su ausencia, por sí
				sola, no te priva de los derechos que correspondan por un producto defectuoso.
			</p>
		</>
	);
}

export function Ro({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Expediem comenzile{" "}
				<strong>din Slovacia, prin FedEx și Slovenská pošta, serviciul poștal slovac</strong>. Metodele
				disponibile pentru adresa și comanda ta, împreună cu prețul lor, sunt afișate înainte de trimiterea
				comenzii cu obligație de plată.
			</p>

			<h2>Cum livrăm</h2>
			<p>
				Opțiunile depind de adresa de livrare, dimensiunile și greutatea coletului. Nu orice transportator sau
				serviciu poate fi folosit pentru fiecare produs. De exemplu, livrarea unei cutii portbagaj poate
				diferi de cea a unui colet mic.
			</p>
			<p>
				Dacă nu apare o metodă de livrare pentru adresa și produsele din coș,{" "}
				<Link href={marketHref(channel, "/kontakt")}>contactează-ne</Link>. Vom verifica dacă putem organiza
				un transport potrivit. Prezentarea unui transportator pe această pagină nu înseamnă că toate
				serviciile lui sunt disponibile la orice adresă.
			</p>

			<h2>Cât costă livrarea</h2>
			<p>
				Costul depinde de produsele comandate și de destinație.{" "}
				<strong>Vezi suma totală pentru produse și transport înainte de confirmarea comenzii.</strong> Nu
				adăugăm servicii contra cost fără acordul tău expres.
			</p>

			<h2>Când ajunge comanda</h2>
			<p>
				Termenul depinde de disponibilitatea produselor și de metoda de livrare. Produsele marcate{" "}
				<strong>„La comandă”</strong> sunt procurate de la furnizor. Această mențiune nu înseamnă că produsul
				se află deja în depozitul nostru.
			</p>
			<p>
				Îți comunicăm condițiile de livrare înainte de încheierea contractului. Dacă ulterior intervine o
				problemă, te contactăm și îți propunem pașii următori. Drepturile tale în cazul nerespectării
				termenului convenit rămân valabile.
			</p>
			<p>
				Ai nevoie de echipament până la o anumită dată? Scrie-ne înainte de a comanda. Verificăm
				posibilitățile de livrare, ca să îți poți face planurile.
			</p>

			<h2>Cum poți plăti</h2>
			<p>
				Comenzile cu livrare în România se achită <strong>în avans, prin Stripe</strong>, folosind una dintre
				metodele afișate la finalizarea comenzii. <strong>Nu oferim plata ramburs.</strong> Expediem după
				primirea plății și în funcție de disponibilitatea comunicată a produselor.
			</p>
			<p>
				Prețurile din versiunea pentru România sunt afișate în <strong>lei românești (RON)</strong>.
			</p>
			<p>
				Nu stocăm și nu avem acces la numărul complet al cardului sau la codul lui de securitate. Aceste date
				sunt prelucrate de furnizorul serviciului de plată.
			</p>

			<h2>La primirea coletului</h2>
			<p>
				Îți recomandăm să verifici ambalajul și să fotografiezi deteriorările vizibile. Dacă și produsul este
				deteriorat sau lipsește ceva, scrie la <Mail />.
			</p>
			<p>
				Fotografiile și documentul întocmit de transportator pot ajuta la clarificarea situației. Lipsa lor nu
				înseamnă, prin ea însăși, pierderea drepturilor pentru un produs neconform.
			</p>
		</>
	);
}

/**
 * The shared half of the two English shipping pages.
 *
 * Most of this page is one text for both markets: the carriers, the customs undertaking
 * and the damage advice do not change at the border. Two things do, and they are props
 * rather than branches — the currency, and the paragraph about when we must ship.
 *
 * That second one is a real legal delta, not a wording preference. The United States has
 * the FTC Mail, Internet, or Telephone Order Merchandise Rule with its default 30-day
 * shipment period and its notify-or-refund duty; Canada has provincial and territorial
 * cancellation rights attached to late delivery and missing contract information. Writing
 * one paragraph that gestured at both would state neither correctly, so the section is a
 * slot and each market fills it with its own text.
 */
function EnglishShipping({
	channel,
	market,
	currency,
	deliveryTerms,
}: {
	channel: string;
	/** How the market is named in prose: `the United States`, `Canada`. */
	market: string;
	/** The currency sentence's noun phrase, e.g. `US dollars (USD)`. */
	currency: string;
	/** The market's own shipment-timing paragraph. See the note above. */
	deliveryTerms: ReactNode;
}) {
	return (
		<>
			<p>
				We ship <strong>from Slovakia through FedEx and Slovenská pošta, the Slovak postal service</strong>.
				The services available for your address and the products in your cart are shown before you confirm
				your order.
			</p>

			<h2>Delivery options</h2>
			<p>
				Availability depends on the destination, product, package dimensions and weight. Not every carrier or
				service is suitable for every item. A roof box, for example, may need a different service from a small
				package. This page does not promise delivery of every product to every address.
			</p>
			<p>
				If checkout shows no suitable option, <Link href={marketHref(channel, "/kontakt")}>contact us</Link>.
				We will check whether delivery can be arranged. Do not select a different destination simply to get
				past checkout.
			</p>

			<h2>Shipping price and import costs</h2>
			<p>
				<strong>
					We arrange customs clearance and cover the import duties, import taxes and clearance charges for the
					delivery we offer to {market}. These costs are included in our quoted price, not collected from you
					unexpectedly at the door.
				</strong>{" "}
				The final total, including delivery and any applicable sales taxes, is shown before you place a
				binding order.
			</p>
			<p>
				If a carrier nevertheless asks you to pay an import charge covered by that price, send us the notice
				at <Mail /> so we can resolve it. We do not pass an undisclosed import bill on to you. We may ask for
				information needed to complete clearance, but a request for information is not a request for an extra
				payment.
			</p>

			<h2>Availability and delivery time</h2>
			<p>
				Items marked <strong>“Available to order”</strong> are sourced from a supplier. That label does not
				mean the product is already in our own warehouse. We ship after payment has been received and
				according to the stated availability.
			</p>
			{deliveryTerms}
			<p>
				Need your equipment for a particular trip? Write to us before buying so we can check the delivery
				options. We do not promise an arrival date that has not been confirmed.
			</p>

			<h2>Payment</h2>
			<p>
				Orders delivered to {market} are{" "}
				<strong>paid in advance through our Stripe payment integration</strong>, using a payment method
				offered at checkout. <strong>Cash on delivery is not available.</strong> Prices in this market are
				shown in <strong>{currency}</strong>. We show the amount and currency you will pay before
				confirmation.
			</p>
			<p>
				Stripe processes payment details. We do not store or have access to your full card number or security
				code. A payment-provider notification is not, by itself, our acceptance of an order.
			</p>

			<h2>When the package arrives</h2>
			<p>
				Check the packaging where practical and take photos of visible shipping damage. If an item is damaged,
				incorrect or missing, contact <Mail />. Photos and a carrier’s damage report can help us investigate,
				but their absence does not automatically remove your rights.
			</p>
			<p>
				The arrangements for a return shipment are different from those for your original delivery. See{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Cancellations and returns</Link> and{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Returns and product support</Link>.
			</p>
		</>
	);
}

export function Us({ channel }: { channel: string }) {
	return (
		<EnglishShipping
			channel={channel}
			market="the United States"
			currency="US dollars (USD)"
			deliveryTerms={
				<p>
					For US orders, we follow the applicable Mail, Internet, or Telephone Order Merchandise Rule. We must
					have a reasonable basis for the shipment time we give you. If no shipment time is stated, the rule
					generally uses 30 days from receipt of a properly completed order. If we cannot ship on time, we
					notify you and offer the choice required by the rule: agree to a delay or cancel for a prompt
					refund. We do not treat the words “available to order” as permission to keep your payment
					indefinitely. A shipping deadline and a delivery date are not the same thing.
				</p>
			}
		/>
	);
}

export function Ca({ channel }: { channel: string }) {
	return (
		<EnglishShipping
			channel={channel}
			market="Canada"
			currency="Canadian dollars (CAD)"
			deliveryTerms={
				<p>
					We give you the delivery terms before you buy and contact you if a delay arises. We do not treat the
					words “available to order” as permission to keep your payment indefinitely. Applicable provincial or
					territorial cancellation and refund rights remain available, including rights arising from late
					delivery or missing contract information. Our Terms of sale explain this separately from a
					change-of-mind return.
				</p>
			}
		/>
	);
}
