import Link from "next/link";
import { companyInfo, companyPhoneHref } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { AUSTRIA, GERMANY, SLOVAKIA_DE, type GermanMarket } from "./german-market";
import {
	SLOVAKIA_EN,
	SLOVAKIA_ES,
	SLOVAKIA_FR,
	SLOVAKIA_HU,
	SLOVAKIA_IT,
	SLOVAKIA_PL,
	SLOVAKIA_RO,
} from "./slovakia";

const Mail = () => <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;
const Phone = () => <a href={companyPhoneHref}>{companyInfo.phone}</a>;

/**
 * Shared by every language — an address is not translated, and SOI's name is its name.
 *
 * The country line is the exception, and it is the only one: it is prose, not part of
 * the postal address as the Slovak post office would read it. It takes a default so the
 * Slovak and Czech bodies render exactly what they rendered before German arrived.
 */
function ReturnAddress({ country = "Slovenská republika" }: { country?: string }) {
	return (
		<p>
			<strong>{companyInfo.legalName}</strong>
			<br />
			Stará Vajnorská 11
			<br />
			831 04 Bratislava
			<br />
			{country}
		</p>
	);
}

function SeatAddress({ country = "Slovenská republika" }: { country?: string }) {
	return (
		<p>
			<strong>{companyInfo.legalName}</strong>
			<br />
			{companyInfo.street}
			<br />
			{companyInfo.city}
			<br />
			{country}
		</p>
	);
}

function SupervisoryAuthority({
	gloss,
	country = "Slovenská republika",
}: {
	/** A translation of the authority's name, appended to it rather than replacing it. */
	gloss?: string;
	country?: string;
}) {
	return (
		<p>
			Slovenská obchodná inšpekcia
			{gloss ? ` — ${gloss}` : ""}
			<br />
			{companyInfo.supervisoryAuthority.department}
			<br />
			Bajkalská 21/A, P. O. BOX č. 5
			<br />
			820 07 Bratislava
			<br />
			{country}
			<br />
			<a href={companyInfo.supervisoryAuthority.url} rel="noopener noreferrer" target="_blank">
				www.soi.sk
			</a>
		</p>
	);
}

export function Sk({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Potrebujete poradiť s výberom, overiť vhodnosť príslušenstva alebo sa opýtať na objednávku? Napíšte
				nám alebo zavolajte.
			</p>
			<p>
				<strong>E-mail:</strong> <Mail />
				<br />
				<strong>Telefón:</strong> <Phone />
			</p>
			<p>
				Na správy odpovedáme počas pracovných dní. Pri otázke k objednávke nám pomôže jej číslo. Ak vyberáte
				príslušenstvo na auto, uveďte značku, model, rok výroby a pri strešných nosičoch aj typ strechy.
				Fotografia často uľahčí overenie.
			</p>

			<h2>Vrátenie tovaru a reklamácie</h2>
			<p>Zásielky s vráteným alebo reklamovaným tovarom posielajte na adresu:</p>
			<ReturnAddress />
			<p>
				Táto adresa sa líši od sídla spoločnosti. Pri vrátení tovaru postupujte podľa stránky{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstúpenie od zmluvy</Link>. Pri vadnom
				alebo poškodenom výrobku nájdete postup v časti{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamácie a vrátenie tovaru</Link>.
			</p>

			<h2>Prevádzkovateľ a fakturačné údaje</h2>
			<SeatAddress />
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
			<SupervisoryAuthority />
		</>
	);
}

export function Cs({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Potřebujete poradit s výběrem, ověřit vhodnost příslušenství nebo se zeptat na objednávku? Napište nám
				nebo zavolejte.
			</p>
			<p>
				<strong>E-mail:</strong> <Mail />
				<br />
				<strong>Telefon:</strong> <Phone />
			</p>
			<p>
				Na zprávy odpovídáme v pracovní dny. U dotazu k objednávce nám pomůže její číslo. Pokud vybíráte
				příslušenství k autu, uveďte značku, model, rok výroby a u střešních nosičů také typ střechy.
				Fotografie často usnadní ověření.
			</p>

			<h2>Vrácení zboží a reklamace</h2>
			<p>Zásilky s vráceným nebo reklamovaným zbožím posílejte na adresu:</p>
			<ReturnAddress />
			<p>
				Tato adresa se liší od sídla společnosti. Při vrácení zboží postupujte podle stránky{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstoupení od smlouvy</Link>. U vadného nebo
				poškozeného výrobku najdete postup v části{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamace a vrácení zboží</Link>.
			</p>

			<h2>Provozovatel a fakturační údaje</h2>
			<SeatAddress />
			<p>
				<strong>IČO:</strong> {companyInfo.ico}
				<br />
				<strong>DIČ:</strong> {companyInfo.dic}
				<br />
				<strong>IČ DPH:</strong> {companyInfo.icDph}
			</p>
			<p>
				Společnost je plátcem DPH a je zapsána v obchodním rejstříku soudu Mestský súd Bratislava III, oddíl
				Sro, vložka č. 200804/B.
			</p>

			<h2>Orgán dozoru</h2>
			<SupervisoryAuthority />
		</>
	);
}

/**
 * The German body, shared by both German-speaking markets.
 *
 * Only the name of the right to withdraw differs on this page, and it differs twice —
 * in the link text. Everything else is one text, which is why `de` and `deAt` share a
 * component rather than duplicating four hundred words of identical German.
 */
function German({ channel, market }: { channel: string; market: GermanMarket }) {
	return (
		<>
			<p>
				Sie haben eine Frage zu einem Produkt, möchten die Eignung eines Zubehörteils prüfen oder brauchen
				Hilfe mit Ihrer Bestellung? Schreiben Sie uns oder rufen Sie an.
			</p>
			<p>
				<strong>E-Mail:</strong> <Mail />
				<br />
				<strong>Telefon:</strong> <Phone />
			</p>
			<p>
				Wir beantworten Nachrichten an unseren Arbeitstagen. Bei Fragen zu einer Bestellung hilft uns die
				Bestellnummer. Wenn Sie Zubehör für Ihr Auto suchen, nennen Sie bitte Marke, Modell und Baujahr, bei
				Dachträgern auch die Dachart. Ein Foto kann die Prüfung erleichtern.
			</p>

			<h2>Rücksendungen und Reklamationen</h2>
			<p>Zurückgesendete oder reklamierte Ware schicken Sie bitte an:</p>
			<ReturnAddress country={SLOVAKIA_DE} />
			<p>
				Diese Anschrift unterscheidet sich von unserem Firmensitz. Informationen zur Rückgabe ohne Angabe von
				Gründen finden Sie unter{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>{market.withdrawalTerm}</Link>. Bei einem
				mangelhaften oder beschädigten Produkt hilft Ihnen die Seite{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamationen und Rücksendungen</Link>.
			</p>

			<h2>Anbieter und Rechnungsangaben</h2>
			<SeatAddress country={SLOVAKIA_DE} />
			<p>
				<strong>Unternehmensidentifikationsnummer (IČO):</strong> {companyInfo.ico}
				<br />
				<strong>Slowakische Steuernummer (DIČ):</strong> {companyInfo.dic}
				<br />
				<strong>Umsatzsteuer-Identifikationsnummer:</strong> {companyInfo.icDph}
			</p>
			<p>
				Die Gesellschaft ist in der Slowakei umsatzsteuerlich registriert. Sie ist im Handelsregister des
				Stadtgerichts Bratislava III (Mestský súd Bratislava III), Abteilung Sro, unter der Eintragsnummer
				200804/B eingetragen.
			</p>

			<h2>Aufsicht am Sitz des Unternehmens</h2>
			<SupervisoryAuthority country={SLOVAKIA_DE} gloss="Slowakische Handelsinspektion" />
			<p>
				Informationen zur außergerichtlichen Streitbeilegung und zur Unterstützung bei grenzüberschreitenden
				Käufen finden Sie in unseren <Link href={marketHref(channel, "/obchodne-podmienky")}>AGB</Link>.
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
				Potrzebują Państwo pomocy w wyborze, chcą sprawdzić dopasowanie akcesoriów albo zapytać o zamówienie?
				Prosimy napisać do nas lub zadzwonić.
			</p>
			<p>
				<strong>E-mail:</strong> <Mail />
				<br />
				<strong>Telefon:</strong> <Phone />
			</p>
			<p>
				Na wiadomości odpowiadamy w dni robocze. Przy pytaniach o zamówienie pomocny będzie jego numer. Przy
				wyborze akcesoriów samochodowych prosimy podać markę, model i rok produkcji auta, a przy bagażnikach
				dachowych także rodzaj dachu. Zdjęcie często ułatwia sprawdzenie dopasowania.
			</p>

			<h2>Zwroty i reklamacje</h2>
			<p>Zwracane lub reklamowane produkty prosimy wysyłać na adres:</p>
			<ReturnAddress country={SLOVAKIA_PL} />
			<p>
				To inny adres niż siedziba spółki. Zasady zwrotu bez podania przyczyny opisujemy na stronie{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstąpienie od umowy</Link>. W przypadku
				wadliwego lub uszkodzonego produktu prosimy zapoznać się ze stroną{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamacje i zwroty</Link>.
			</p>

			<h2>Sprzedawca i dane do faktury</h2>
			<SeatAddress country={SLOVAKIA_PL} />
			<p>
				<strong>Numer identyfikacyjny przedsiębiorstwa (IČO):</strong> {companyInfo.ico}
				<br />
				<strong>Słowacki numer identyfikacji podatkowej (DIČ):</strong> {companyInfo.dic}
				<br />
				<strong>Numer VAT UE:</strong> {companyInfo.icDph}
			</p>
			<p>
				Spółka jest zarejestrowana jako podatnik VAT na Słowacji. Jest wpisana do rejestru handlowego Sądu
				Miejskiego Bratislava III (Mestský súd Bratislava III), dział Sro, numer wpisu 200804/B.
			</p>

			<h2>Organ nadzoru w kraju sprzedawcy</h2>
			<SupervisoryAuthority country={SLOVAKIA_PL} gloss="Słowacka Inspekcja Handlowa" />
			<p>
				Informacje o pozasądowym rozwiązywaniu sporów i pomocy w zakupach transgranicznych znajdują się w{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Regulaminie sklepu</Link>.
			</p>
		</>
	);
}

export function Hu({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Kérdése van egy termékkel kapcsolatban, szeretné ellenőrizni egy tartozék kompatibilitását, vagy
				segítségre van szüksége a rendeléséhez? Írjon nekünk, vagy hívjon fel minket.
			</p>
			<p>
				<strong>E-mail:</strong> <Mail />
				<br />
				<strong>Telefon:</strong> <Phone />
			</p>
			<p>
				Az üzenetekre munkanapjainkon válaszolunk. Rendeléssel kapcsolatos kérdésnél segít, ha megadja a
				rendelési számot. Autós kiegészítő kiválasztásához kérjük, írja meg az autó márkáját, modelljét és
				gyártási évét, tetőcsomagtartó esetén pedig a tető típusát is. Egy fénykép is megkönnyítheti az
				ellenőrzést.
			</p>

			<h2>Visszaküldés és reklamáció</h2>
			<p>A visszaküldött vagy reklamációval érintett termékeket erre a címre kérjük:</p>
			<ReturnAddress country={SLOVAKIA_HU} />
			<p>
				Ez a cím nem azonos a cég székhelyével. Az indokolás nélküli visszaküldésről az{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Elállási jog</Link> oldalon olvashat. Hibás
				vagy sérült termék esetén a{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamáció és visszaküldés</Link> oldal
				segít az ügyintézésben.
			</p>

			<h2>Az eladó és a számlázási adatok</h2>
			<SeatAddress country={SLOVAKIA_HU} />
			<p>
				<strong>Cégazonosító szám (IČO):</strong> {companyInfo.ico}
				<br />
				<strong>Szlovák adóazonosító szám (DIČ):</strong> {companyInfo.dic}
				<br />
				<strong>Közösségi adószám:</strong> {companyInfo.icDph}
			</p>
			<p>
				A társaság Szlovákiában nyilvántartott áfaalany. A Mestský súd Bratislava III által vezetett
				cégjegyzékben szerepel, Sro részleg, 200804/B bejegyzési szám alatt.
			</p>

			<h2>Az eladó székhelye szerinti felügyelet</h2>
			<SupervisoryAuthority country={SLOVAKIA_HU} gloss="Szlovák Kereskedelmi Felügyelet" />
			<p>
				A peren kívüli vitarendezésről és a határon átnyúló vásárlásokhoz igénybe vehető segítségről az{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Általános szerződési feltételekben</Link>{" "}
				talál további információt.
			</p>
		</>
	);
}

export function It({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Hai una domanda su un prodotto, vuoi verificare se un accessorio è adatto alla tua auto o ti serve
				aiuto con un ordine? Scrivici o chiamaci.
			</p>
			<p>
				<strong>E-mail:</strong> <Mail />
				<br />
				<strong>Telefono:</strong> <Phone />
			</p>
			<p>
				Rispondiamo ai messaggi nei nostri giorni lavorativi. Per una domanda su un ordine, indicane il
				numero. Per scegliere un accessorio, comunicaci marca, modello e anno di produzione dell’auto; per le
				barre portatutto, anche il tipo di tetto. Una foto può aiutarci a verificare la compatibilità.
			</p>

			<h2>Resi e reclami</h2>
			<p>Invia i prodotti da restituire o oggetto di un reclamo a:</p>
			<ReturnAddress country={SLOVAKIA_IT} />
			<p>
				Questo indirizzo è diverso dalla sede legale. Per restituire un acquisto senza indicarne il motivo,
				consulta il <Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Diritto di recesso</Link>. Per
				un prodotto difettoso o danneggiato, consulta{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reclami e resi</Link>.
			</p>

			<h2>Venditore e dati per la fatturazione</h2>
			<SeatAddress country={SLOVAKIA_IT} />
			<p>
				<strong>Numero identificativo dell’impresa (IČO):</strong> {companyInfo.ico}
				<br />
				<strong>Codice fiscale slovacco (DIČ):</strong> {companyInfo.dic}
				<br />
				<strong>Numero di identificazione IVA:</strong> {companyInfo.icDph}
			</p>
			<p>
				La società è registrata ai fini IVA in Slovacchia. È iscritta nel registro delle imprese tenuto dal
				Mestský súd Bratislava III, sezione Sro, numero 200804/B.
			</p>

			<h2>Autorità di vigilanza nel paese del venditore</h2>
			<SupervisoryAuthority country={SLOVAKIA_IT} gloss="Ispettorato slovacco del commercio" />
			<p>
				Le informazioni sulla risoluzione extragiudiziale delle controversie e sull’assistenza per gli
				acquisti transfrontalieri sono nelle{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Condizioni generali di vendita</Link>. Restano
				ferme le competenze delle altre autorità previste dalla legge.
			</p>
		</>
	);
}

export function Fr({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Vous avez une question sur un produit, souhaitez vérifier la compatibilité d’un accessoire ou avez
				besoin d’aide pour une commande ? Écrivez-nous ou appelez-nous.
			</p>
			<p>
				<strong>E-mail :</strong> <Mail />
				<br />
				<strong>Téléphone :</strong> <Phone />
			</p>
			<p>
				Nous répondons aux messages pendant nos jours ouvrés. Pour une question sur une commande, indiquez son
				numéro. Pour le choix d’un accessoire, précisez la marque, le modèle et l’année de fabrication du
				véhicule ; pour les barres de toit, ajoutez le type de toit. Une photo peut faciliter la vérification.
			</p>

			<h2>Retours et réclamations</h2>
			<p>Veuillez envoyer les produits retournés ou faisant l’objet d’une réclamation à :</p>
			<ReturnAddress country={SLOVAKIA_FR} />
			<p>
				Cette adresse est différente de notre siège social. Pour retourner un achat sans avoir à donner de
				motif, consultez le{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Droit de rétractation</Link>. Pour un
				produit défectueux ou endommagé, consultez{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Réclamations et retours</Link>.
			</p>

			<h2>Vendeur et informations de facturation</h2>
			<SeatAddress country={SLOVAKIA_FR} />
			<p>
				<strong>Numéro d’identification de l’entreprise (IČO) :</strong> {companyInfo.ico}
				<br />
				<strong>Numéro fiscal slovaque (DIČ) :</strong> {companyInfo.dic}
				<br />
				<strong>Numéro de TVA intracommunautaire :</strong> {companyInfo.icDph}
			</p>
			<p>
				La société est assujettie à la TVA en Slovaquie. Elle est inscrite au registre du commerce tenu par le
				Mestský súd Bratislava III, section Sro, sous le numéro 200804/B.
			</p>

			<h2>Autorité de contrôle dans le pays du vendeur</h2>
			<SupervisoryAuthority country={SLOVAKIA_FR} gloss="Inspection slovaque du commerce" />
			<p>
				Les <Link href={marketHref(channel, "/obchodne-podmienky")}>Conditions générales de vente</Link>{" "}
				présentent les voies de règlement extrajudiciaire et l’assistance pour les achats transfrontaliers.
				Les compétences des autres autorités prévues par la loi restent inchangées.
			</p>
		</>
	);
}

export function Es({ channel }: { channel: string }) {
	return (
		<>
			<p>
				¿Tienes una duda sobre un producto, quieres comprobar si un accesorio encaja en tu coche o necesitas
				ayuda con un pedido? Escríbenos o llámanos.
			</p>
			<p>
				<strong>E-mail:</strong> <Mail />
				<br />
				<strong>Teléfono:</strong> <Phone />
			</p>
			<p>
				Respondemos durante nuestros días laborables. Si consultas por un pedido, indica su número. Para
				elegir un accesorio, dinos la marca, el modelo y el año del coche; si buscas barras de techo, también
				el tipo de techo. Una foto puede ayudarnos a comprobar la compatibilidad.
			</p>

			<h2>Devoluciones y reclamaciones</h2>
			<p>Envía los productos que devuelvas o sobre los que presentes una reclamación a:</p>
			<ReturnAddress country={SLOVAKIA_ES} />
			<p>
				Esta dirección es distinta de nuestro domicilio social. Para devolver una compra sin indicar el
				motivo, consulta el{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Derecho de desistimiento</Link>. Si el
				producto es defectuoso o está dañado, encontrarás el procedimiento en{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reclamaciones y devoluciones</Link>.
			</p>

			<h2>Vendedor y datos de facturación</h2>
			<SeatAddress country={SLOVAKIA_ES} />
			<p>
				<strong>Número de identificación de la empresa (IČO):</strong> {companyInfo.ico}
				<br />
				<strong>Número de identificación fiscal eslovaco (DIČ):</strong> {companyInfo.dic}
				<br />
				<strong>Número de identificación a efectos del IVA:</strong> {companyInfo.icDph}
			</p>
			<p>
				La sociedad está registrada a efectos del IVA en Eslovaquia. Figura en el registro mercantil del
				Mestský súd Bratislava III, sección Sro, inscripción 200804/B. Estos son identificadores eslovacos, no
				un NIF español.
			</p>

			<h2>Autoridad de supervisión en el país del vendedor</h2>
			<SupervisoryAuthority country={SLOVAKIA_ES} gloss="Inspección Comercial Eslovaca" />
			<p>
				En las <Link href={marketHref(channel, "/obchodne-podmienky")}>Condiciones generales de venta</Link>{" "}
				explicamos las vías de resolución extrajudicial de conflictos y de ayuda en compras transfronterizas.
				La supervisión en Eslovaquia no excluye las competencias de otras autoridades que correspondan
				legalmente.
			</p>
		</>
	);
}

export function Ro({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Ai o întrebare despre un produs, vrei să verifici compatibilitatea unui accesoriu cu mașina ta sau ai
				nevoie de ajutor cu o comandă? Scrie-ne sau sună-ne.
			</p>
			<p>
				<strong>E-mail:</strong> <Mail />
				<br />
				<strong>Telefon:</strong> <Phone />
			</p>
			<p>
				Răspundem în zilele noastre lucrătoare. Pentru întrebări despre o comandă, ne ajută numărul ei. Dacă
				alegi un accesoriu auto, spune-ne marca, modelul și anul mașinii, iar pentru bare transversale, și
				tipul plafonului. O fotografie poate ușura verificarea compatibilității.
			</p>

			<h2>Retururi și reclamații</h2>
			<p>Produsele returnate sau cele pentru care formulezi o reclamație se trimit la:</p>
			<ReturnAddress country={SLOVAKIA_RO} />
			<p>
				Această adresă diferă de sediul social. Pentru un retur fără indicarea motivului, consultă{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Dreptul de retragere</Link>. Pentru un
				produs defect sau deteriorat, găsești pașii în pagina{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reclamații și retururi</Link>.
			</p>

			<h2>Vânzătorul și datele de facturare</h2>
			<SeatAddress country={SLOVAKIA_RO} />
			<p>
				<strong>Număr de identificare a societății (IČO):</strong> {companyInfo.ico}
				<br />
				<strong>Număr de identificare fiscală slovac (DIČ):</strong> {companyInfo.dic}
				<br />
				<strong>Cod de înregistrare în scopuri de TVA:</strong> {companyInfo.icDph}
			</p>
			<p>
				Societatea este înregistrată în scopuri de TVA în Slovacia și figurează în registrul comerțului ținut
				de Mestský súd Bratislava III, secțiunea Sro, numărul 200804/B. Datele de mai sus sunt identificatori
				slovaci, nu un CUI românesc.
			</p>

			<h2>Autoritatea de supraveghere din țara vânzătorului</h2>
			<SupervisoryAuthority country={SLOVAKIA_RO} gloss="Inspecția Comercială Slovacă" />
			<p>
				Informațiile despre soluționarea alternativă a litigiilor și sprijinul pentru cumpărături
				transfrontaliere sunt în{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Termenii și condițiile de vânzare</Link>.
				Competențele altor autorități prevăzute de lege rămân neafectate.
			</p>
		</>
	);
}

/**
 * The shared half of the two English contact pages.
 *
 * `Us` and `Ca` differ in exactly one sentence — which national tax registration these
 * Slovak identifiers are *not* — plus the market name in the returns paragraph. Everything
 * else is the same English, so it is written once here rather than copied and left to
 * drift. This is the shape the package asked for: shared English sentences are legitimate,
 * and the difference that matters is stated where it matters.
 */
function EnglishContact({
	channel,
	market,
	notTaxIds,
}: {
	channel: string;
	/** How the market is named in prose: `the United States`, `Canada`. */
	market: string;
	/** The local registrations these Slovak numbers must not be mistaken for. */
	notTaxIds: string;
}) {
	return (
		<>
			<p>
				Need help choosing an accessory, checking a fit or following up on an order? Send us a message or give
				us a call.
			</p>
			<p>
				<strong>Email:</strong> <Mail />
				<br />
				<strong>Phone:</strong> <Phone />
			</p>
			<p>
				We reply during our business days in Slovakia. For an order question, include your order number if you
				have it. For vehicle accessories, tell us the make, model, model year and body style; for roof racks,
				include the roof type. A photo can help. Tell us which market the vehicle was sold in so we can check
				the correct version.
			</p>

			<h2>Returns and product problems</h2>
			<p>Our return address is in Slovakia:</p>
			<ReturnAddress country={SLOVAKIA_EN} />
			<p>
				This is different from our registered office. For a change-of-mind return, see{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Cancellations and returns</Link>. For a
				defective, damaged or incorrect item, see{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Returns and product support</Link>.
			</p>
			<p>
				We do not currently offer routine pickup or a prepaid return label for change-of-mind returns from{" "}
				{market}. You may use your own carrier. This does not prevent you from returning an eligible purchase
				or making a claim about a defective product. If the product is defective, contact us so we can arrange
				the appropriate remedy and address the necessary shipping costs.
			</p>

			<h2>Seller and company details</h2>
			<SeatAddress country={SLOVAKIA_EN} />
			<p>
				<strong>Slovak company identification number (IČO):</strong> {companyInfo.ico}
				<br />
				<strong>Slovak tax identification number (DIČ):</strong> {companyInfo.dic}
				<br />
				<strong>Slovak VAT identification number:</strong> {companyInfo.icDph}
			</p>
			<p>
				We are registered for VAT in Slovakia. The company is entered in the Commercial Register maintained by
				Mestský súd Bratislava III, section Sro, entry 200804/B. These are Slovak identifiers; they are not{" "}
				{notTaxIds}.
			</p>

			<h2>Oversight in the seller’s home country</h2>
			<SupervisoryAuthority country={SLOVAKIA_EN} gloss="Slovak Trade Inspection" />
			<p>
				Our <Link href={marketHref(channel, "/obchodne-podmienky")}>Terms of sale</Link> explain complaints
				and dispute resolution. The Slovak authority is not the only authority you may contact where other
				consumer-protection rules apply.
			</p>
		</>
	);
}

export function Us({ channel }: { channel: string }) {
	return (
		<EnglishContact
			channel={channel}
			market="the United States"
			notTaxIds="a US employer identification number or state sales-tax registration"
		/>
	);
}

export function Ca({ channel }: { channel: string }) {
	return (
		<EnglishContact
			channel={channel}
			market="Canada"
			notTaxIds="a Canadian business number or GST/HST registration"
		/>
	);
}
