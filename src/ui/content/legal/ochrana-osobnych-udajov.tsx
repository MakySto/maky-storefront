import Link from "next/link";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { AUSTRIA, GERMANY, SLOVAKIA_DE, type GermanMarket } from "./german-market";
import { SLOVAKIA_ES, SLOVAKIA_FR, SLOVAKIA_HU, SLOVAKIA_IT, SLOVAKIA_PL, SLOVAKIA_RO } from "./slovakia";

const Mail = () => <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;

/**
 * The recipients table.
 *
 * Every row is a service `.env` and the code that reads it show us talking to. Saleor and
 * Payload are MAKY's own instances on MAKY's own subdomains, which is why they are
 * described as such rather than as third-party providers.
 *
 * What is deliberately NOT here: contracting legal entities and per-transfer safeguards.
 * Those are contract facts, not configuration facts — this file cannot verify them, and a
 * plausible-looking guess in a GDPR disclosure is worse than an honest pointer to the
 * request route the statute already provides (Art. 15(2)).
 */
const RECIPIENTS = [
	{
		service: "Saleor (api.maky.store)",
		purpose: {
			sk: "Katalóg, košík, objednávky a zákaznícky účet. Vlastná inštancia.",
			cs: "Katalog, košík, objednávky a zákaznický účet. Vlastní instance.",
			de: "Katalog, Warenkorb, Bestellungen und Kundenkonto. Eigene Instanz.",
			pl: "Katalog, koszyk, zamówienia i konto klienta. Instancja własna.",
			hu: "Katalógus, kosár, rendelések és vásárlói fiók. Saját példány.",
			it: "Sistema del negozio per catalogo, carrello, ordini e account; dati necessari al servizio",
			fr: "Catalogue, panier, commandes et compte ; données nécessaires au fonctionnement du service",
			es: "Catálogo, cesta, pedidos y cuenta de cliente en nuestra instalación de comercio electrónico.",
			ro: "Catalog, coș, comenzi și contul de client în propria noastră instalare de comerț electronic.",
		},
		basis: {
			sk: "Nevyhnutné pre zmluvu",
			cs: "Nezbytné pro smlouvu",
			de: "Für den Vertrag erforderlich",
			pl: "Niezbędne do wykonania umowy",
			hu: "A szerződés teljesítéséhez szükséges",
			it: "Contratto e obblighi legali secondo l’operazione",
			fr: "Contrat et obligations légales selon l’opération",
		},
	},
	{
		service: "Payload CMS (cms.maky.store)",
		purpose: {
			sk: "Redakčný obsah, záznam o odstúpení od zmluvy a jeho potvrdenie. Vlastná inštancia.",
			cs: "Redakční obsah, záznam o odstoupení od smlouvy a jeho potvrzení. Vlastní instance.",
			de: "Redaktionelle Inhalte, Aufzeichnung des Widerrufs und dessen Bestätigung. Eigene Instanz.",
			pl: "Treści redakcyjne, zapis oświadczenia o odstąpieniu i jego potwierdzenie. Instancja własna.",
			hu: "Szerkesztői tartalom, az elállási nyilatkozat rögzítése és visszaigazolása. Saját példány.",
			it: "Contenuti del sito; richieste e conferme nei processi effettivamente supportati",
			fr: "Contenus du site ; demandes et confirmations dans les procédures effectivement prises en charge",
			es: "Contenido y gestión de los formularios y comunicaciones que estén efectivamente habilitados.",
			ro: "Conținutul și gestionarea formularelor și comunicărilor care sunt efectiv activate.",
		},
		basis: {
			sk: "Zmluva a zákonná povinnosť",
			cs: "Smlouva a zákonná povinnost",
			de: "Vertrag und rechtliche Verpflichtung",
			pl: "Umowa i obowiązek prawny",
			hu: "Szerződés és jogi kötelezettség",
			it: "Contratto, obblighi legali e tutela dei diritti",
			fr: "Contrat, obligations légales et défense des droits",
		},
	},
	{
		service: "Stripe",
		purpose: {
			sk: "Spracovanie online platby, vrátenie platby a kontrola podvodov.",
			cs: "Zpracování online platby, vrácení platby a kontrola podvodů.",
			de: "Abwicklung der Online-Zahlung, Erstattungen und Betrugsprüfung.",
			pl: "Obsługa płatności online, zwrotów płatności i kontrola nadużyć.",
			hu: "Az online fizetés, a visszatérítések lebonyolítása és csalásellenőrzés.",
			it: "Pagamenti, rimborsi e prevenzione delle frodi; informazioni necessarie alla transazione",
			fr: "Paiement, remboursement et prévention de la fraude ; données nécessaires à la transaction",
			es: "Pagos, reembolsos y controles de seguridad de las operaciones.",
			ro: "Plăți, rambursări și verificări de securitate ale operațiunilor.",
		},
		basis: {
			sk: "Nevyhnutné pre zmluvu",
			cs: "Nezbytné pro smlouvu",
			de: "Für den Vertrag erforderlich",
			pl: "Niezbędne do wykonania umowy",
			hu: "A szerződés teljesítéséhez szükséges",
			it: "Contratto, obblighi del prestatore e basi pertinenti alla finalità",
			fr: "Contrat, obligations du prestataire et bases propres à la finalité",
		},
	},
	{
		service: "FedEx, Slovenská pošta",
		purpose: {
			sk: "Doručenie zásielky a kontaktovanie príjemcu.",
			cs: "Doručení zásilky a kontaktování příjemce.",
			de: "Zustellung der Sendung und Kontakt zum Empfänger.",
			pl: "Doręczenie przesyłki i kontakt z odbiorcą.",
			hu: "A küldemény kézbesítése és a címzett elérése.",
			it: "Consegna, comunicazioni sul trasporto e recapiti del destinatario",
			fr: "Livraison, suivi opérationnel du transport et coordonnées du destinataire",
			es: "Transporte y entrega, según el servicio elegido.",
			ro: "Transportul și livrarea, în funcție de serviciul ales.",
		},
		basis: {
			sk: "Nevyhnutné pre zmluvu",
			cs: "Nezbytné pro smlouvu",
			de: "Für den Vertrag erforderlich",
			pl: "Niezbędne do wykonania umowy",
			hu: "A szerződés teljesítéséhez szükséges",
			it: "Esecuzione del contratto",
			fr: "Exécution du contrat",
		},
	},
	{
		service: "Cloudflare",
		purpose: {
			sk: "Doručovanie a ochrana webu; Cloudflare Web Analytics meria návštevnosť bez cookies.",
			cs: "Doručování a ochrana webu; Cloudflare Web Analytics měří návštěvnost bez cookies.",
			de: "Auslieferung und Schutz der Website; Cloudflare Web Analytics misst Zugriffe ohne Cookies.",
			pl: "Dostarczanie i ochrona strony; Cloudflare Web Analytics mierzy ruch bez cookies.",
			hu: "A webhely kiszolgálása és védelme; a Cloudflare Web Analytics sütik nélkül méri a forgalmat.",
			it: "Erogazione e sicurezza del sito; servizio Web Analytics descritto nella pagina cookie",
			fr: "Diffusion et sécurité du site ; Web Analytics présenté dans la page cookies",
			es: "Entrega y protección de la web; Web Analytics para la medición descrita en la página de cookies.",
			ro: "Livrarea și protejarea site-ului; Web Analytics pentru măsurarea descrisă în pagina de cookie-uri.",
		},
		basis: {
			sk: "Oprávnený záujem",
			cs: "Oprávněný zájem",
			de: "Berechtigtes Interesse",
			pl: "Prawnie uzasadniony interes",
			hu: "Jogos érdek",
			it: "Legittimo interesse per le finalità indicate, con verifica delle regole applicabili",
			fr: "Intérêt légitime pour les finalités indiquées, sous réserve des règles applicables",
		},
	},
	{
		service: "Google (Tag Manager, Analytics)",
		purpose: {
			sk: "Voliteľná analytika a meranie reklamy. Bez súhlasu neukladá ani nečíta údaje v prehliadači.",
			cs: "Volitelná analytika a měření reklamy. Bez souhlasu neukládá ani nečte údaje v prohlížeči.",
			de: "Optionale Analyse und Werbemessung. Ohne Einwilligung werden im Browser weder Daten gespeichert noch gelesen.",
			pl: "Opcjonalna analityka i pomiar reklam, z przekazywaniem ustawień zgody przez Consent Mode.",
			hu: "Opcionális analitika és hirdetésmérés, a hozzájárulási beállítások Consent Mode általi továbbításával.",
			it: "Gestione dei tag e, secondo le scelte, misurazione e finalità pubblicitarie",
			fr: "Gestion des balises et, selon vos choix, mesure et finalités publicitaires",
			es: "Gestión de etiquetas, medición y funciones de marketing según su configuración y las preferencias aplicables.",
			ro: "Administrarea etichetelor, măsurare și funcții de marketing în funcție de configurare și preferințele aplicabile.",
		},
		basis: {
			sk: "Súhlas",
			cs: "Souhlas",
			de: "Einwilligung",
			pl: "Zgoda w zakresie opcjonalnych celów",
			hu: "Hozzájárulás az opcionális célokhoz",
			it: "Consenso per le finalità facoltative che lo richiedono",
			fr: "Consentement pour les finalités facultatives qui l’exigent",
		},
	},
] as const;

const HEADS = {
	sk: ["Služba", "Na čo ju používame", "Právny základ"],
	cs: ["Služba", "K čemu ji používáme", "Právní základ"],
	de: ["Dienst", "Wofür wir ihn nutzen", "Rechtsgrundlage"],
	pl: ["Usługa", "Do czego jej używamy", "Podstawa prawna"],
	hu: ["Szolgáltatás", "Mire használjuk", "Jogalap"],
	it: ["Sistema o servizio", "Finalità e ambito", "Base pertinente"],
	fr: ["Système ou service", "Finalité et périmètre", "Base pertinente"],
	// Two columns, not three. The delivered Spanish and Romanian tables list systems and
	// purposes only, and their prose says so explicitly — the table identifies services,
	// not a legal entity and basis per row. Inventing a basis column to match the older
	// languages would be writing legal text nobody approved.
	es: ["Sistema o servicio", "Para qué se utiliza"],
	ro: ["Sistem sau serviciu", "Pentru ce îl folosim"],
} as const;

/** The languages whose delivered recipients table carries a legal-basis column. */
const BASIS_LANGS = ["sk", "cs", "de", "pl", "hu", "it", "fr"] as const;
type BasisLang = (typeof BASIS_LANGS)[number];
type RecipientLang = BasisLang | "es" | "ro";

const hasBasisColumn = (lang: RecipientLang): lang is BasisLang =>
	(BASIS_LANGS as readonly string[]).includes(lang);

function RecipientsTable({ lang }: { lang: RecipientLang }) {
	// The cell is emitted only where the language actually has one, so the seven older
	// tables render exactly the three columns they always did and the two new ones render
	// the two their copy supplies. A `<td>` more than there are `<th>` would be an invalid
	// table that no type and no build would complain about.
	const withBasis = hasBasisColumn(lang);
	return (
		<div className="overflow-x-auto">
			<table>
				<thead>
					<tr>
						{HEADS[lang].map((h) => (
							<th key={h}>{h}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{RECIPIENTS.map((row) => (
						<tr key={row.service}>
							<td>{row.service}</td>
							<td>{row.purpose[lang]}</td>
							{withBasis ? <td>{row.basis[lang]}</td> : null}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function DpaAuthority({
	lang,
	country,
}: {
	lang: "sk" | "cs" | "pl" | "hu" | "it" | "fr" | "es" | "ro";
	country?: string;
}) {
	return (
		<p>
			<strong>Úrad na ochranu osobných údajov Slovenskej republiky</strong>
			<br />
			Galvaniho Business Centrum II
			<br />
			Galvaniho 7/B
			<br />
			821 04 Bratislava
			{country ? (
				<>
					<br />
					{country}
				</>
			) : null}
			<br />
			<a href="https://dataprotection.gov.sk/sk/" rel="noopener noreferrer" target="_blank">
				dataprotection.gov.sk
			</a>
			{lang === "cs" ? (
				<>
					<br />
					<br />
					Jako spotřebitel v České republice se můžete obrátit také na Úřad pro ochranu osobních údajů, Pplk.
					Sochora 27, 170 00 Praha 7,{" "}
					<a href="https://uoou.gov.cz" rel="noopener noreferrer" target="_blank">
						uoou.gov.cz
					</a>
					.
				</>
			) : null}
		</p>
	);
}

export function Sk({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Pri nákupe a návšteve webu nám zverujete osobné údaje. Tu vysvetľujeme, ktoré používame, prečo ich
				potrebujeme, komu ich poskytujeme a ako môžete uplatniť svoje práva.
			</p>

			<h2>1. Kto za spracúvanie zodpovedá</h2>
			<p>
				Prevádzkovateľom je <strong>{companyInfo.legalName}</strong>, {companyInfo.street}, {companyInfo.city}
				, Slovenská republika, IČO {companyInfo.ico}.
			</p>
			<p>
				Vo veciach ochrany osobných údajov nás kontaktujte na <Mail /> alebo písomne na adrese sídla.
			</p>

			<h2>2. Aké údaje používame a na aký účel</h2>
			<h3>Objednávky, doručenie a zákaznícka podpora</h3>
			<p>
				Používame meno a priezvisko, kontaktné údaje, fakturačnú a doručovaciu adresu, údaje o objednávke a
				platbe a súvisiacu komunikáciu. Pri firemnej objednávke aj poskytnuté firemné údaje. Ak sa pýtate na
				vhodnosť príslušenstva, môžeme spracovať údaje o vozidle alebo fotografie, ktoré nám pošlete.
			</p>
			<p>
				Údaje potrebujeme na prípravu a plnenie zmluvy: prijatie objednávky, platbu, doručenie, odpovede k
				nákupu a súvisiacu podporu. Právnym základom je <strong>čl. 6 ods. 1 písm. b) GDPR</strong>. Pri
				komunikácii s kontaktnou osobou firemného zákazníka môže byť základom oprávnený záujem na vybavení
				obchodného vzťahu podľa <strong>čl. 6 ods. 1 písm. f) GDPR</strong>.
			</p>
			<p>
				Úplné číslo platobnej karty ani jej bezpečnostný kód neukladáme a nemáme k nim prístup. Platbu
				spracúva Stripe; my dostávame údaje potrebné na priradenie a overenie platby, prípadne jej vrátenie.
			</p>

			<h3>Faktúry a zákonné povinnosti</h3>
			<p>
				Identifikačné, objednávkové a platobné údaje spracúvame aj na vedenie účtovníctva, plnenie daňových
				povinností a povinností voči príslušným orgánom. Právnym základom je{" "}
				<strong>zákonná povinnosť podľa čl. 6 ods. 1 písm. c) GDPR</strong>.
			</p>

			<h3>Reklamácie, odstúpenia a žiadosti o uplatnenie práv</h3>
			<p>
				Spracúvame vaše identifikačné a kontaktné údaje, označenie objednávky a výrobku, obsah oznámenia,
				potrebné dôkazy a priebeh vybavenia. Pri online odstúpení aj dátum a čas odoslania, identifikátor
				podania a údaje potrebné na preukázanie doručenia potvrdenia.
			</p>
			<p>
				Tieto údaje používame na splnenie zákonných povinností podľa{" "}
				<strong>čl. 6 ods. 1 písm. c) GDPR</strong>, na príslušné plnenie zmluvy a podľa potreby na uplatnenie
				alebo obranu právnych nárokov na základe <strong>čl. 6 ods. 1 písm. f) GDPR</strong>. Na prijatie
				reklamácie alebo odstúpenia nepotrebujeme súhlas s marketingom ani samostatný súhlas so spracúvaním
				údajov potrebných na ich vybavenie.
			</p>

			<h3>Zákaznícky účet</h3>
			<p>
				Ak si vytvoríte účet, spracúvame údaje potrebné na jeho vedenie, prihlásenie a zobrazenie vašich
				objednávok. Právnym základom je poskytovanie vyžiadanej služby podľa{" "}
				<strong>čl. 6 ods. 1 písm. b) GDPR</strong>. Účet nie je podmienkou nákupu ani odoslania odstúpenia.
			</p>

			<h3>Novinky a obchodné ponuky</h3>
			<p>
				Ak sa prihlásite na odber, používame váš e-mail a údaje o udelenom súhlase na zasielanie noviniek.
				Právnym základom je <strong>súhlas podľa čl. 6 ods. 1 písm. a) GDPR</strong>. Súhlas je dobrovoľný a
				môžete ho kedykoľvek odvolať odkazom v správe alebo e-mailom na <Mail />.
			</p>

			<h3>Bezpečnosť webu a ochrana nárokov</h3>
			<p>
				V nevyhnutnom rozsahu môžeme spracúvať technické záznamy o prístupoch a chybách, údaje potrebné na
				predchádzanie zneužitiu a podvodom a dôkazy súvisiace s právnymi nárokmi. Základom je{" "}
				<strong>oprávnený záujem podľa čl. 6 ods. 1 písm. f) GDPR</strong> na bezpečnej prevádzke a ochrane
				práv. Pri jeho uplatnení posudzujeme primeranosť a dopad na vaše súkromie.
			</p>
			<p>
				Tento základ nepoužívame ako všeobecné povolenie na reklamné sledovanie. Pravidlá voliteľnej analytiky
				a marketingových technológií sú uvedené v časti{" "}
				<Link href={marketHref(channel, "/cookies")}>Cookies</Link>.
			</p>

			<h2>3. Odkiaľ údaje získavame a či ich musíte poskytnúť</h2>
			<p>
				Údaje získavame najmä od vás — pri objednávke, vytvorení účtu, vyplnení formulára alebo komunikácii.
				Údaje o výsledku platby môžeme dostať od platobnej služby a o priebehu doručenia od dopravcu.
				Technické údaje vznikajú pri používaní webu.
			</p>
			<p>
				Údaje označené ako povinné pri objednávke potrebujeme na jej uzavretie a splnenie. Bez doručovacej
				adresy napríklad nevieme zabezpečiť doručenie. Pri formulároch požadujeme iba údaje primerané danému
				účelu. Dobrovoľné údaje a marketingový súhlas poskytnúť nemusíte.
			</p>

			<h2>4. Komu údaje poskytujeme</h2>
			<p>
				Údaje neposkytujeme každému dodávateľovi automaticky. Rozhoduje služba, ktorú pre vašu objednávku
				alebo pri prevádzke webu skutočne používame.
			</p>
			<p>
				V potrebnom rozsahu majú k údajom prístup aj poskytovatelia technickej prevádzky, e-mailových služieb,
				účtovníctva alebo odbornej právnej pomoci. Údaje môžeme poskytnúť tiež orgánom verejnej moci, ak nám
				to ukladá zákon.
			</p>
			<p>
				Niektorí príjemcovia konajú ako naši sprostredkovatelia, iní ako samostatní prevádzkovatelia podľa
				povahy služby. Toto sú služby, ktoré náš obchod skutočne používa:
			</p>
			<RecipientsTable lang="sk" />
			<p>
				Informáciu o tom, ktorá spoločnosť konkrétnu službu poskytuje, v akom postavení a s akými zárukami pri
				prenose údajov, vám na požiadanie poskytneme na <Mail />.
			</p>

			<h2>5. Prenosy mimo Európskeho hospodárskeho priestoru</h2>
			<p>
				Pri niektorých službách môže dochádzať k sprístupneniu údajov aj mimo Európskeho hospodárskeho
				priestoru. Pri takom prenose musí existovať príslušný právny mechanizmus, napríklad platné rozhodnutie
				o primeranosti alebo štandardné zmluvné doložky spolu s potrebnými doplňujúcimi opatreniami.
			</p>
			<p>
				Samotné uloženie údajov na serveri v EÚ nevylučuje prístup z inej krajiny. Informácie o mechanizme,
				ktorý sa uplatňuje na konkrétny prenos, o použitých zárukách a o možnosti získať ich kópiu vám
				poskytneme na <Mail />, s primeranou ochranou dôverných údajov.
			</p>

			<h2>6. Ako dlho údaje uchovávame</h2>
			<p>Údaje neuchovávame všetky rovnako dlho. Rozhoduje ich účel a zákonné povinnosti.</p>
			<p>
				<strong>Objednávky a komunikáciu k nim</strong> uchovávame počas vybavovania a následne v rozsahu
				potrebnom na zákonné povinnosti, reklamácie a uplatnenie alebo obranu nárokov. Pri právnych nárokoch
				zohľadňujeme príslušné premlčacie lehoty, ich prípadné prerušenie a trvanie konania.
			</p>
			<p>
				<strong>Účtovné doklady</strong> uchovávame podľa zákona o účtovníctve spravidla desať rokov
				nasledujúcich po roku, ktorého sa týkajú. Táto lehota neznamená, že desať rokov uchovávame všetky
				technické alebo marketingové údaje.
			</p>
			<p>
				<strong>Reklamácie a odstúpenia</strong> uchovávame počas ich vybavovania a ďalej v rozsahu potrebnom
				na preukázanie splnenia povinností a ochranu nárokov podľa vyššie uvedených kritérií.
			</p>
			<p>
				<strong>Údaje účtu</strong> používame počas jeho trvania. Po zrušení odstránime alebo obmedzíme údaje,
				ktoré už na tento účel nepotrebujeme; údaje potrebné na účtovníctvo alebo ochranu nárokov môžu zostať
				uchované oddelene.
			</p>
			<p>
				<strong>E-mail na zasielanie noviniek</strong> používame do odvolania súhlasu alebo ukončenia odberu.
				Nevyhnutný záznam o udelení či odvolaní súhlasu môžeme ďalej uchovať na preukázanie zákonnosti a
				rešpektovanie vašej voľby, nie na pokračovanie v marketingu.
			</p>
			<p>
				<strong>Technické záznamy, analytické údaje a cookies</strong> majú lehoty podľa jednotlivých služieb
				a účelov uvedených vyššie a v <Link href={marketHref(channel, "/cookies")}>prehľade cookies</Link>.
			</p>

			<h2>7. Aké máte práva</h2>
			<p>
				V rozsahu a za podmienok GDPR môžete požiadať o <strong>prístup k údajom</strong>, ich{" "}
				<strong>opravu</strong>, <strong>vymazanie</strong> alebo <strong>obmedzenie spracúvania</strong>. Pri
				automatizovanom spracúvaní založenom na súhlase alebo zmluve môžete uplatniť aj{" "}
				<strong>právo na prenosnosť</strong> príslušných údajov.
			</p>
			<p>
				Ak údaje spracúvame na základe oprávneného záujmu, môžete <strong>namietať</strong> z dôvodov
				týkajúcich sa vašej konkrétnej situácie. Proti spracúvaniu na priamy marketing môžete namietať
				kedykoľvek; údaje potom na tento účel ďalej nepoužijeme.
			</p>
			<p>
				Súhlas môžete odvolať rovnako jednoducho, ako ste ho udelili. Odvolanie nemení zákonnosť spracúvania
				uskutočneného pred odvolaním. Pri cookies použite <strong>„Nastavenia súkromia“</strong> v pätičke;
				pri newsletteri odhlasovací odkaz v e-maile alebo nám napíšte. Ide o dve samostatné voľby.
			</p>
			<p>
				Žiadosť pošlite na <Mail />. Ak máme odôvodnené pochybnosti o totožnosti, môžeme požiadať o primerané
				doplnenie, nie automaticky o kópiu dokladu totožnosti.
			</p>
			<p>
				O prijatých opatreniach vás informujeme bez zbytočného odkladu, najneskôr do{" "}
				<strong>jedného mesiaca</strong>. Pri odôvodnene zložitej žiadosti alebo väčšom počte žiadostí možno
				lehotu predĺžiť o ďalšie dva mesiace; o predĺžení a dôvodoch vás informujeme v prvom mesiaci. Ak
				žiadosti nemôžeme vyhovieť, vysvetlíme prečo.
			</p>

			<h2>8. Sťažnosť dozornému úradu</h2>
			<p>
				Máte právo podať sťažnosť príslušnému dozornému orgánu, najmä v štáte obvyklého pobytu, pracoviska
				alebo údajného porušenia GDPR. Na Slovensku je ním:
			</p>
			<DpaAuthority lang="sk" />

			<h2>9. Automatizované rozhodovanie</h2>
			<p>
				Nepoužívame automatizované rozhodovanie ani profilovanie, ktoré by voči vám malo právne účinky alebo
				vás podobne významne ovplyvňovalo pri prijímaní objednávky, vybavovaní reklamácie či posudzovaní
				odstúpenia od zmluvy. O týchto veciach rozhoduje človek.
			</p>
			<p>
				Poskytovateľ platobnej služby pri online platbe automatizovane vyhodnocuje riziko podvodu a na základe
				toho môže platbu odmietnuť alebo vyžiadať dodatočné overenie. Toto vyhodnotenie je súčasťou platobnej
				služby a nie je naším rozhodnutím o vašej objednávke. Ak vám platba neprejde, ozvite sa nám na{" "}
				<Mail /> a dohodneme sa na ďalšom postupe.
			</p>

			<h2>10. Zmeny informácií</h2>
			<p>
				Tento dokument aktualizujeme, keď sa zmení spôsob spracúvania alebo používané služby. Ak zmena
				vyžaduje nový súhlas, samotnou úpravou dokumentu ho nenahrádzame.
			</p>
		</>
	);
}

export function Cs({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Při nákupu a návštěvě webu nám svěřujete osobní údaje. Zde vysvětlujeme, které používáme, proč je
				potřebujeme, komu je poskytujeme a jak můžete uplatnit svá práva.
			</p>

			<h2>1. Kdo za zpracování odpovídá</h2>
			<p>
				Správcem je <strong>{companyInfo.legalName}</strong>, {companyInfo.street}, {companyInfo.city},
				Slovenská republika, IČO {companyInfo.ico}.
			</p>
			<p>
				Ve věcech ochrany osobních údajů nás kontaktujte na <Mail /> nebo písemně na adrese sídla.
			</p>

			<h2>2. Jaké údaje používáme a za jakým účelem</h2>
			<h3>Objednávky, doručení a zákaznická podpora</h3>
			<p>
				Používáme jméno a příjmení, kontaktní údaje, fakturační a doručovací adresu, údaje o objednávce a
				platbě a související komunikaci. U firemní objednávky také poskytnuté firemní údaje. Pokud se ptáte na
				vhodnost příslušenství, můžeme zpracovat údaje o vozidle nebo fotografie, které nám pošlete.
			</p>
			<p>
				Údaje potřebujeme k přípravě a plnění smlouvy: přijetí objednávky, platbě, doručení, zodpovězení
				dotazů k nákupu a související podpoře. Právním základem je{" "}
				<strong>čl. 6 odst. 1 písm. b) GDPR</strong>. Při komunikaci s kontaktní osobou firemního zákazníka
				může být základem oprávněný zájem na zajištění obchodního vztahu podle{" "}
				<strong>čl. 6 odst. 1 písm. f) GDPR</strong>.
			</p>
			<p>
				Úplné číslo platební karty ani její bezpečnostní kód neukládáme a nemáme k nim přístup. Platbu
				zpracovává Stripe; my dostáváme údaje potřebné k přiřazení a ověření platby, případně k jejímu
				vrácení.
			</p>

			<h3>Faktury a zákonné povinnosti</h3>
			<p>
				Identifikační, objednávkové a platební údaje zpracováváme také pro vedení účetnictví, plnění daňových
				povinností a povinností vůči příslušným orgánům. Právním základem je{" "}
				<strong>zákonná povinnost podle čl. 6 odst. 1 písm. c) GDPR</strong>.
			</p>

			<h3>Reklamace, odstoupení a žádosti o uplatnění práv</h3>
			<p>
				Zpracováváme vaše identifikační a kontaktní údaje, označení objednávky a výrobku, obsah oznámení,
				potřebné důkazy a průběh vyřízení. U online odstoupení také datum a čas odeslání, identifikátor podání
				a údaje potřebné k prokázání doručení potvrzení.
			</p>
			<p>
				Tyto údaje používáme ke splnění zákonných povinností podle{" "}
				<strong>čl. 6 odst. 1 písm. c) GDPR</strong>, k příslušnému plnění smlouvy a podle potřeby k uplatnění
				nebo obhajobě právních nároků na základě <strong>čl. 6 odst. 1 písm. f) GDPR</strong>. K přijetí
				reklamace nebo odstoupení nepotřebujeme souhlas s marketingem ani samostatný souhlas se zpracováním
				údajů potřebných k jejich vyřízení.
			</p>

			<h3>Zákaznický účet</h3>
			<p>
				Pokud si vytvoříte účet, zpracováváme údaje potřebné k jeho vedení, přihlášení a zobrazení vašich
				objednávek. Právním základem je poskytování vyžádané služby podle{" "}
				<strong>čl. 6 odst. 1 písm. b) GDPR</strong>. Účet není podmínkou nákupu ani odeslání odstoupení.
			</p>

			<h3>Novinky a obchodní nabídky</h3>
			<p>
				Pokud se přihlásíte k odběru, používáme váš e-mail a údaje o uděleném souhlasu k zasílání novinek.
				Právním základem je <strong>souhlas podle čl. 6 odst. 1 písm. a) GDPR</strong>. Souhlas je dobrovolný
				a můžete ho kdykoli odvolat odkazem ve zprávě nebo e-mailem na <Mail />.
			</p>

			<h3>Bezpečnost webu a ochrana nároků</h3>
			<p>
				V nezbytném rozsahu můžeme zpracovávat technické záznamy o přístupech a chybách, údaje potřebné k
				předcházení zneužití a podvodům a důkazy související s právními nároky. Základem je{" "}
				<strong>oprávněný zájem podle čl. 6 odst. 1 písm. f) GDPR</strong> na bezpečném provozu a ochraně
				práv. Při jeho uplatnění posuzujeme přiměřenost a dopad na vaše soukromí.
			</p>
			<p>
				Tento základ nepoužíváme jako obecné povolení k reklamnímu sledování. Pravidla volitelné analytiky a
				marketingových technologií jsou uvedena v části{" "}
				<Link href={marketHref(channel, "/cookies")}>Cookies</Link>.
			</p>

			<h2>3. Odkud údaje získáváme a zda je musíte poskytnout</h2>
			<p>
				Údaje získáváme zejména od vás — při objednávce, vytvoření účtu, vyplnění formuláře nebo komunikaci.
				Údaje o výsledku platby můžeme dostat od platební služby a o průběhu doručení od dopravce. Technické
				údaje vznikají při používání webu.
			</p>
			<p>
				Údaje označené jako povinné při objednávce potřebujeme k jejímu uzavření a splnění. Bez doručovací
				adresy například nedokážeme zajistit doručení. U formulářů požadujeme pouze údaje přiměřené danému
				účelu. Dobrovolné údaje a marketingový souhlas poskytnout nemusíte.
			</p>

			<h2>4. Komu údaje poskytujeme</h2>
			<p>
				Údaje neposkytujeme každému dodavateli automaticky. Rozhoduje služba, kterou pro vaši objednávku nebo
				při provozu webu skutečně používáme.
			</p>
			<p>
				V potřebném rozsahu mají k údajům přístup také poskytovatelé technického provozu, e-mailových služeb,
				účetnictví nebo odborné právní pomoci. Údaje můžeme poskytnout také orgánům veřejné moci, pokud nám to
				ukládá zákon.
			</p>
			<p>
				Někteří příjemci jednají jako naši zpracovatelé, jiní jako samostatní správci podle povahy služby.
				Toto jsou služby, které náš obchod skutečně používá:
			</p>
			<RecipientsTable lang="cs" />
			<p>
				Informaci o tom, která společnost konkrétní službu poskytuje, v jakém postavení a s jakými zárukami
				při předávání údajů, vám na požádání poskytneme na <Mail />.
			</p>

			<h2>5. Předávání údajů mimo Evropský hospodářský prostor</h2>
			<p>
				U některých služeb může docházet ke zpřístupnění údajů i mimo Evropský hospodářský prostor. Pro takové
				předávání musí existovat příslušný právní mechanismus, například platné rozhodnutí o odpovídající
				ochraně nebo standardní smluvní doložky spolu s potřebnými doplňujícími opatřeními.
			</p>
			<p>
				Samotné uložení údajů na serveru v EU nevylučuje přístup z jiné země. Informace o mechanismu, který se
				uplatňuje na konkrétní předávání, o použitých zárukách a o možnosti získat jejich kopii vám poskytneme
				na <Mail />, s přiměřenou ochranou důvěrných údajů.
			</p>

			<h2>6. Jak dlouho údaje uchováváme</h2>
			<p>Všechny údaje neuchováváme stejně dlouho. Rozhoduje jejich účel a zákonné povinnosti.</p>
			<p>
				<strong>Objednávky a komunikaci k nim</strong> uchováváme po dobu vyřizování a následně v rozsahu
				potřebném ke splnění zákonných povinností, řešení reklamací a uplatnění nebo obhajobě nároků. U
				právních nároků zohledňujeme příslušné promlčecí lhůty, jejich případné přerušení a trvání řízení.
			</p>
			<p>
				<strong>Účetní doklady</strong> uchováváme podle zákona o účetnictví zpravidla deset let následujících
				po roce, kterého se týkají. Tato lhůta neznamená, že deset let uchováváme všechny technické nebo
				marketingové údaje.
			</p>
			<p>
				<strong>Reklamace a odstoupení</strong> uchováváme po dobu jejich vyřizování a dále v rozsahu
				potřebném k prokázání splnění povinností a ochraně nároků podle výše uvedených kritérií.
			</p>
			<p>
				<strong>Údaje účtu</strong> používáme po dobu jeho trvání. Po zrušení odstraníme nebo omezíme údaje,
				které už k tomuto účelu nepotřebujeme; údaje potřebné pro účetnictví nebo ochranu nároků mohou zůstat
				uchovány odděleně.
			</p>
			<p>
				<strong>E-mail pro zasílání novinek</strong> používáme do odvolání souhlasu nebo ukončení odběru.
				Nezbytný záznam o udělení či odvolání souhlasu můžeme dále uchovat k prokázání zákonnosti a
				respektování vaší volby, nikoli k pokračování v marketingu.
			</p>
			<p>
				<strong>Technické záznamy, analytické údaje a cookies</strong> mají lhůty podle jednotlivých služeb a
				účelů uvedených výše a v <Link href={marketHref(channel, "/cookies")}>přehledu cookies</Link>.
			</p>

			<h2>7. Jaká máte práva</h2>
			<p>
				V rozsahu a za podmínek GDPR můžete požádat o <strong>přístup k údajům</strong>, jejich{" "}
				<strong>opravu</strong>, <strong>výmaz</strong> nebo <strong>omezení zpracování</strong>. Při
				automatizovaném zpracování založeném na souhlasu nebo smlouvě můžete uplatnit také{" "}
				<strong>právo na přenositelnost</strong> příslušných údajů.
			</p>
			<p>
				Pokud údaje zpracováváme na základě oprávněného zájmu, můžete <strong>vznést námitku</strong> z důvodů
				týkajících se vaší konkrétní situace. Proti zpracování pro přímý marketing můžete vznést námitku
				kdykoli; údaje potom k tomuto účelu dále nepoužijeme.
			</p>
			<p>
				Souhlas můžete odvolat stejně snadno, jako jste ho udělili. Odvolání nemění zákonnost zpracování
				uskutečněného před odvoláním. U cookies použijte <strong>„Nastavení soukromí“</strong> v zápatí; u
				newsletteru odhlašovací odkaz v e-mailu nebo nám napište. Jde o dvě samostatné volby.
			</p>
			<p>
				Žádost pošlete na <Mail />. Pokud máme odůvodněné pochybnosti o totožnosti, můžeme požádat o přiměřené
				doplnění, nikoli automaticky o kopii dokladu totožnosti.
			</p>
			<p>
				O přijatých opatřeních vás informujeme bez zbytečného odkladu, nejpozději do{" "}
				<strong>jednoho měsíce</strong>. U odůvodněně složité žádosti nebo většího počtu žádostí lze lhůtu
				prodloužit o další dva měsíce; o prodloužení a důvodech vás informujeme v prvním měsíci. Pokud žádosti
				nemůžeme vyhovět, vysvětlíme proč.
			</p>

			<h2>8. Stížnost dozorovému úřadu</h2>
			<p>
				Máte právo podat stížnost příslušnému dozorovému orgánu, zejména ve státě obvyklého pobytu, pracoviště
				nebo údajného porušení GDPR.
			</p>
			<DpaAuthority lang="cs" />

			<h2>9. Automatizované rozhodování</h2>
			<p>
				Nepoužíváme automatizované rozhodování ani profilování, které by vůči vám mělo právní účinky nebo vás
				podobně významně ovlivňovalo při přijímání objednávky, vyřizování reklamace či posuzování odstoupení
				od smlouvy. O těchto věcech rozhoduje člověk.
			</p>
			<p>
				Poskytovatel platební služby při online platbě automatizovaně vyhodnocuje riziko podvodu a na základě
				toho může platbu odmítnout nebo vyžádat dodatečné ověření. Toto vyhodnocení je součástí platební
				služby a není naším rozhodnutím o vaší objednávce. Pokud vám platba neprojde, ozvěte se nám na{" "}
				<Mail /> a dohodneme se na dalším postupu.
			</p>

			<h2>10. Změny informací</h2>
			<p>
				Tento dokument aktualizujeme, když se změní způsob zpracování nebo používané služby. Pokud změna
				vyžaduje nový souhlas, samotnou úpravou dokumentu ho nenahrazujeme.
			</p>
		</>
	);
}

/**
 * The German body, shared by both German-speaking markets.
 *
 * The two slots this page carried in the delivered copy are filled from what the
 * repository can actually verify, not from the package's placeholders:
 *
 * - `PRIVACY_PROVIDERS_AND_TRANSFERS` → `RecipientsTable`, which is read off `.env`
 *   and the code that talks to each service. Contracting legal entities and per-transfer
 *   safeguards are deliberately still absent — those are contract facts this file cannot
 *   check. Art. 13(1)(f) GDPR expressly allows naming "the means by which to obtain a
 *   copy" of the transfer safeguards rather than reproducing them, which is what the
 *   contact route does. (The note above `RECIPIENTS` cites Art. 15(2) for the same idea;
 *   that predates this thread and belongs to the owner of the shared surfaces.)
 * - `AUTOMATED_DECISION_MAKING` → the truthful statement that there is none. The
 *   storefront runs no profiling or automated decision with legal effect; Stripe's own
 *   fraud checks are the payment provider's processing, described as such.
 *
 * The supervisory-authority section differs per market and comes from
 * `market.dataProtectionAuthority`: Germany is federal, so it points at the Länder
 * overview rather than naming the BfDI as if it were competent for a private shop;
 * Austria has one DSB. The Slovak authority stays as the seller's own.
 */
function German({ channel, market }: { channel: string; market: GermanMarket }) {
	return (
		<>
			<p>
				Bei einem Einkauf und beim Besuch unserer Website vertrauen Sie uns personenbezogene Daten an. Hier
				erfahren Sie, welche Daten wir verwenden, wofür wir sie benötigen, an wen wir sie weitergeben und wie
				Sie Ihre Rechte ausüben können.
			</p>

			<h2>1. Wer für die Verarbeitung verantwortlich ist</h2>
			<p>
				Verantwortlicher ist <strong>{companyInfo.legalName}</strong>, {companyInfo.street},{" "}
				{companyInfo.city}, {SLOVAKIA_DE}, Unternehmensidentifikationsnummer (IČO) {companyInfo.ico}.
			</p>
			<p>
				Bei Fragen zum Datenschutz schreiben Sie an <Mail /> oder an unseren Firmensitz.
			</p>

			<h2>2. Welche Daten wir zu welchen Zwecken verwenden</h2>
			<h3>Bestellungen, Lieferung und Kundenservice</h3>
			<p>
				Wir verarbeiten Ihren Namen, Kontaktdaten, Rechnungs- und Lieferadresse, Angaben zur Bestellung und
				Zahlung sowie die dazugehörige Kommunikation. Bei Firmenbestellungen gehören dazu auch die angegebenen
				Unternehmensdaten. Fragen Sie nach der Eignung von Zubehör, können wir auch die von Ihnen
				übermittelten Fahrzeugangaben oder Fotos verarbeiten.
			</p>
			<p>
				Diese Daten benötigen wir zur Vorbereitung und Erfüllung des Vertrags: zur Annahme der Bestellung, zur
				Zahlungsabwicklung, zur Lieferung und zur Beantwortung Ihrer Fragen zum Kauf. Rechtsgrundlage ist{" "}
				<strong>Artikel 6 Absatz 1 Buchstabe b DSGVO</strong>. Bei der Kommunikation mit einer Kontaktperson
				eines Firmenkunden kann unser berechtigtes Interesse an der Abwicklung der Geschäftsbeziehung nach{" "}
				<strong>Artikel 6 Absatz 1 Buchstabe f DSGVO</strong> die Grundlage sein.
			</p>
			<p>
				Vollständige Kartennummern und Kartenprüfnummern speichern wir nicht und haben darauf keinen Zugriff.
				Stripe verarbeitet die Zahlung. Wir erhalten die Angaben, die wir benötigen, um die Zahlung
				zuzuordnen, zu überprüfen oder gegebenenfalls zu erstatten.
			</p>

			<h3>Rechnungen und gesetzliche Pflichten</h3>
			<p>
				Identifikations-, Bestell- und Zahlungsdaten verwenden wir auch für unsere Buchhaltung, für
				steuerliche Pflichten und zur Erfüllung gesetzlicher Pflichten gegenüber zuständigen Behörden.
				Grundlage ist die{" "}
				<strong>Erfüllung einer rechtlichen Verpflichtung nach Artikel 6 Absatz 1 Buchstabe c DSGVO</strong>.
			</p>

			<h3>Reklamationen, Widerrufe und die Ausübung Ihrer Rechte</h3>
			<p>
				Wir verarbeiten Ihre Identifikations- und Kontaktdaten, Angaben zur Bestellung und zum Artikel, den
				Inhalt Ihrer Mitteilung, erforderliche Nachweise und den Bearbeitungsverlauf. Erklären Sie den
				Widerruf über eine Online-Funktion, erfassen wir zusätzlich den dokumentierten Zeitpunkt der
				Erklärung, die Vorgangsnummer sowie Angaben, mit denen sich die Übermittlung der Bestätigung
				nachweisen lässt.
			</p>
			<p>
				Die Verarbeitung dient der Erfüllung gesetzlicher Pflichten nach{" "}
				<strong>Artikel 6 Absatz 1 Buchstabe c DSGVO</strong>, der jeweiligen Vertragsabwicklung und bei
				Bedarf der Geltendmachung oder Verteidigung von Rechtsansprüchen aufgrund von{" "}
				<strong>Artikel 6 Absatz 1 Buchstabe f DSGVO</strong>. Für die Annahme einer Reklamation oder eines
				Widerrufs benötigen wir weder eine Marketingeinwilligung noch eine gesonderte Einwilligung zur
				Verarbeitung der hierfür erforderlichen Daten.
			</p>

			<h3>Kundenkonto</h3>
			<p>
				Wenn Sie ein Konto erstellen, verarbeiten wir die Angaben, die für dessen Verwaltung, die Anmeldung
				und die Anzeige Ihrer Bestellungen notwendig sind. Grundlage ist die Erbringung der von Ihnen
				angeforderten Leistung nach <strong>Artikel 6 Absatz 1 Buchstabe b DSGVO</strong>. Ein Konto ist weder
				für einen Einkauf noch für das Absenden eines Widerrufs erforderlich.
			</p>

			<h3>Neuigkeiten und Angebote</h3>
			<p>
				Melden Sie sich für unseren Newsletter an, verwenden wir Ihre E-Mail-Adresse und Angaben zu Ihrer
				Einwilligung für den Versand. Grundlage ist Ihre{" "}
				<strong>Einwilligung nach Artikel 6 Absatz 1 Buchstabe a DSGVO</strong>. Sie ist freiwillig und kann
				jederzeit über den Abmeldelink in der Nachricht oder per E-Mail an <Mail /> widerrufen werden.
			</p>

			<h3>Sicherheit der Website und Schutz von Rechtsansprüchen</h3>
			<p>
				Soweit erforderlich, verarbeiten wir technische Zugriffs- und Fehlerprotokolle, Angaben zur
				Verhinderung von Missbrauch und Betrug sowie Nachweise im Zusammenhang mit Rechtsansprüchen. Grundlage
				ist unser <strong>berechtigtes Interesse nach Artikel 6 Absatz 1 Buchstabe f DSGVO</strong> am
				sicheren Betrieb und am Schutz unserer Rechte. Dabei prüfen wir die Verhältnismäßigkeit und die
				Auswirkungen auf Ihre Privatsphäre.
			</p>
			<p>
				Diese Grundlage verstehen wir nicht als allgemeine Erlaubnis für Werbetracking. Hinweise zu optionaler
				Analyse und Marketingtechnologien finden Sie unter{" "}
				<Link href={marketHref(channel, "/cookies")}>Cookies</Link>.
			</p>

			<h2>3. Woher die Daten stammen und welche Angaben erforderlich sind</h2>
			<p>
				Die Daten erhalten wir überwiegend von Ihnen, etwa bei einer Bestellung, der Kontoerstellung, dem
				Ausfüllen eines Formulars oder Ihrer Kontaktaufnahme. Angaben zum Zahlungsergebnis erhalten wir
				gegebenenfalls vom Zahlungsdienstleister, Angaben zur Zustellung vom Versanddienstleister. Technische
				Daten entstehen bei der Nutzung der Website. Einzelheiten zu den jeweiligen Diensten finden Sie unten.
			</p>
			<p>
				Als erforderlich gekennzeichnete Bestellangaben benötigen wir für den Abschluss und die Erfüllung des
				Vertrags. Ohne Lieferadresse können wir beispielsweise keine Lieferung veranlassen. In Formularen
				verlangen wir nur Angaben, die dem jeweiligen Zweck angemessen sind. Freiwillige Angaben und eine
				Einwilligung in Marketing müssen Sie nicht erteilen.
			</p>

			<h2>4. An wen wir Daten weitergeben</h2>
			<p>
				Nicht jeder Dienstleister erhält automatisch Ihre Daten. Entscheidend ist, welche Leistung für Ihre
				Bestellung oder beim Betrieb der Website tatsächlich genutzt wird.
			</p>
			<p>
				Für den Versand arbeiten wir mit <strong>FedEx und Slovenská pošta (Slowakische Post)</strong>{" "}
				zusammen. Der eingesetzte Versanddienstleister erhält die Daten, die für Transport und
				Empfängerkontakt erforderlich sind. Zahlungen werden über <strong>Stripe</strong> abgewickelt. Im
				erforderlichen Umfang können außerdem Anbieter für den technischen Betrieb, E-Mail-Dienste,
				Buchhaltung oder rechtliche Beratung Zugriff erhalten. Eine Weitergabe an Behörden erfolgt, soweit
				eine gesetzliche Pflicht besteht.
			</p>
			<p>
				Je nach Leistung handeln Empfänger als unsere Auftragsverarbeiter oder als eigenständige
				Verantwortliche. Die konkreten Dienste und Zwecke finden Sie in dieser Übersicht:
			</p>
			<RecipientsTable lang="de" />
			<p>
				Welche Gesellschaft den jeweiligen Dienst erbringt, in welcher Rolle und mit welchen Garantien bei
				einer Übermittlung, teilen wir Ihnen auf Anfrage unter <Mail /> mit.
			</p>

			<h2>5. Übermittlungen außerhalb des Europäischen Wirtschaftsraums</h2>
			<p>
				Bei einzelnen Diensten können Daten auch Empfängern außerhalb des Europäischen Wirtschaftsraums
				zugänglich werden. Dafür muss eine geeignete rechtliche Grundlage bestehen, etwa ein geltender
				Angemessenheitsbeschluss oder Standardvertragsklauseln in Verbindung mit gegebenenfalls erforderlichen
				zusätzlichen Schutzmaßnahmen.
			</p>
			<p>
				Eine Speicherung auf einem Server in der EU schließt einen Zugriff aus einem anderen Land nicht
				automatisch aus. Informationen zu den verwendeten Garantien und dazu, wie Sie eine Kopie erhalten
				können, bekommen Sie unter <Mail />. Vertrauliche Angaben schützen wir dabei angemessen.
			</p>

			<h2>6. Wie lange wir Daten aufbewahren</h2>
			<p>
				Nicht alle Daten werden gleich lange gespeichert. Maßgeblich sind der jeweilige Zweck und die
				gesetzlichen Pflichten.
			</p>
			<p>
				<strong>Bestellungen und dazugehörige Kommunikation</strong> bewahren wir während der Abwicklung und
				anschließend in dem Umfang auf, der für gesetzliche Pflichten, Reklamationen und die Geltendmachung
				oder Verteidigung von Ansprüchen erforderlich ist. Bei Rechtsansprüchen berücksichtigen wir die
				geltenden Verjährungsfristen, eine mögliche Hemmung oder Unterbrechung und die Dauer eines Verfahrens.
				Erforderliche Unterlagen können bis zum rechtskräftigen Abschluss eines Rechtsstreits aufbewahrt
				werden.
			</p>
			<p>
				<strong>Buchhaltungsunterlagen</strong> bewahren wir nach dem für uns geltenden slowakischen
				Rechnungslegungsrecht grundsätzlich zehn Jahre nach Ablauf des Jahres auf, auf das sie sich beziehen.
				Das bedeutet nicht, dass wir auch sämtliche technischen Daten oder Marketingdaten zehn Jahre lang
				speichern.
			</p>
			<p>
				<strong>Reklamationen und Widerrufe</strong> speichern wir während der Bearbeitung und anschließend
				nach den oben genannten Kriterien, soweit dies zum Nachweis der Erfüllung unserer Pflichten oder zum
				Schutz von Rechtsansprüchen notwendig ist.
			</p>
			<p>
				<strong>Kontodaten</strong> verwenden wir während des Bestehens Ihres Kundenkontos. Nach dessen
				Schließung löschen wir Daten, die hierfür nicht mehr benötigt werden, oder schränken ihre Verarbeitung
				ein. Für die Buchhaltung oder den Schutz von Ansprüchen erforderliche Angaben können getrennt weiter
				aufbewahrt werden.
			</p>
			<p>
				<strong>Ihre E-Mail-Adresse für den Newsletter</strong> verwenden wir bis zum Widerruf Ihrer
				Einwilligung oder bis zur Abmeldung. Einen erforderlichen Nachweis über Erteilung und Widerruf der
				Einwilligung sowie die Abmeldung können wir weiter aufbewahren, um die Rechtmäßigkeit zu belegen und
				Ihre Entscheidung zu respektieren — nicht, um weitere Werbung zu versenden.
			</p>
			<p>
				<strong>Technische Protokolle, Analysedaten und Cookies</strong> unterliegen den dienst- und
				zweckbezogenen Fristen in der <Link href={marketHref(channel, "/cookies")}>Cookie-Übersicht</Link>.
				Bei einem konkreten Sicherheitsvorfall können erforderliche Nachweise für dessen Aufklärung und die
				Wahrung damit zusammenhängender Ansprüche länger aufbewahrt werden.
			</p>

			<h2>7. Ihre Rechte</h2>
			<p>
				Unter den Voraussetzungen der DSGVO können Sie <strong>Auskunft</strong>,{" "}
				<strong>Berichtigung</strong>, <strong>Löschung</strong> oder eine{" "}
				<strong>Einschränkung der Verarbeitung</strong> verlangen. Bei automatisierter Verarbeitung auf
				Grundlage einer Einwilligung oder eines Vertrags kann Ihnen auch das{" "}
				<strong>Recht auf Datenübertragbarkeit</strong> zustehen.
			</p>
			<p>
				Verarbeiten wir Daten aufgrund berechtigter Interessen, können Sie aus Gründen, die sich aus Ihrer
				besonderen Situation ergeben, <strong>Widerspruch</strong> einlegen. Gegen die Verarbeitung für
				Direktwerbung können Sie jederzeit widersprechen. Wir verwenden Ihre Daten dann nicht mehr für diesen
				Zweck.
			</p>
			<p>
				Eine Einwilligung können Sie so einfach widerrufen, wie Sie sie erteilt haben. Die Rechtmäßigkeit der
				Verarbeitung bis zum Widerruf bleibt davon unberührt. Für Cookies nutzen Sie{" "}
				<strong>„Datenschutzeinstellungen“</strong> im Seitenfuß. Vom Newsletter melden Sie sich über den Link
				in der E-Mail ab oder schreiben uns. Dies sind zwei voneinander unabhängige Entscheidungen.
			</p>
			<p>
				Senden Sie Ihre Anfrage an <Mail />. Bei begründeten Zweifeln an Ihrer Identität dürfen wir um
				angemessene zusätzliche Angaben bitten. Eine Kopie eines Ausweisdokuments verlangen wir nicht
				automatisch.
			</p>
			<p>
				Wir informieren Sie unverzüglich, spätestens innerhalb <strong>eines Monats</strong>, über die
				ergriffenen Maßnahmen. Bei begründet komplexen oder zahlreichen Anfragen kann diese Frist um zwei
				weitere Monate verlängert werden. Darüber und über die Gründe informieren wir Sie innerhalb des ersten
				Monats. Können wir Ihrer Anfrage nicht entsprechen, erläutern wir den Grund. Ein Löschungsanspruch
				verpflichtet uns beispielsweise nicht zur Löschung eines Belegs, den wir gesetzlich aufbewahren
				müssen.
			</p>

			<h2>8. Beschwerde bei einer Datenschutzaufsichtsbehörde</h2>
			<p>
				Sie können sich bei einer zuständigen Aufsichtsbehörde beschweren, insbesondere in dem Mitgliedstaat
				Ihres gewöhnlichen Aufenthalts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes gegen
				die DSGVO. Sie müssen sich hierfür nicht ausschließlich an eine slowakische Behörde wenden.
			</p>
			<p>{market.dataProtectionAuthority}</p>
			<p>Die Datenschutzaufsichtsbehörde in der Slowakei ist:</p>
			<p>
				<strong>Úrad na ochranu osobných údajov Slovenskej republiky</strong>
				<br />
				Galvaniho Business Centrum II
				<br />
				Galvaniho 7/B
				<br />
				821 04 Bratislava, {SLOVAKIA_DE}
				<br />
				<a href="https://dataprotection.gov.sk/sk/" rel="noopener noreferrer" target="_blank">
					dataprotection.gov.sk
				</a>
			</p>

			<h2>9. Automatisierte Entscheidungen</h2>
			<p>
				Wir treffen keine ausschließlich auf einer automatisierten Verarbeitung beruhenden Entscheidungen, die
				Ihnen gegenüber rechtliche Wirkung entfalten oder Sie in ähnlicher Weise erheblich beeinträchtigen.
				Wir betreiben kein Profiling zu diesem Zweck. Eine Bestellung wird weder automatisch abgelehnt noch
				automatisch bewertet.
			</p>
			<p>
				Bei der Zahlungsabwicklung führt <strong>Stripe</strong> als Zahlungsdienstleister eigene Prüfungen
				zur Betrugsvermeidung durch. Das ist eine Verarbeitung dieses Anbieters im Rahmen seiner eigenen
				Pflichten. Wird eine Zahlung dabei nicht ausgeführt, können Sie uns unter <Mail /> kontaktieren; wir
				sehen uns den Vorgang an und suchen gemeinsam eine Lösung.
			</p>

			<h2>10. Änderungen dieser Hinweise</h2>
			<p>
				Wir aktualisieren diese Hinweise, wenn sich die Verarbeitung oder die eingesetzten Dienste ändern. Ist
				eine neue Einwilligung erforderlich, wird sie nicht allein durch eine Änderung dieses Dokuments
				ersetzt.
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
				Podczas zakupów i korzystania ze strony powierzają nam Państwo dane osobowe. Tutaj wyjaśniamy, jakie
				dane wykorzystujemy, do czego są potrzebne, komu je przekazujemy i jak można skorzystać ze swoich
				praw.
			</p>

			<h2>1. Kto odpowiada za przetwarzanie danych</h2>
			<p>
				Administratorem danych jest <strong>{companyInfo.legalName}</strong>, {companyInfo.street},{" "}
				{companyInfo.city}, {SLOVAKIA_PL}, numer identyfikacyjny przedsiębiorstwa (IČO) {companyInfo.ico}.
			</p>
			<p>
				W sprawach ochrony danych prosimy pisać na <Mail /> lub na adres siedziby.
			</p>

			<h2>2. Jakie dane wykorzystujemy i w jakim celu</h2>

			<h3>Zamówienia, dostawa i obsługa klienta</h3>
			<p>
				Przetwarzamy imię i nazwisko, dane kontaktowe, adres do faktury i dostawy, informacje o zamówieniu i
				płatności oraz związaną z nimi korespondencję. Przy zakupach firmowych również przekazane dane
				przedsiębiorstwa. W pytaniach o dopasowanie akcesoriów mogą pojawić się dane samochodu lub zdjęcia,
				które nam Państwo przesyłają.
			</p>
			<p>
				Dane są potrzebne do przygotowania i wykonania umowy: przyjęcia zamówienia, płatności, dostawy,
				odpowiedzi na pytania i obsługi zakupu. Podstawą jest <strong>art. 6 ust. 1 lit. b RODO</strong>. Przy
				kontakcie z osobą reprezentującą klienta firmowego podstawą może być prawnie uzasadniony interes w
				obsłudze relacji handlowej zgodnie z <strong>art. 6 ust. 1 lit. f RODO</strong>.
			</p>
			<p>
				Nie przechowujemy pełnego numeru karty ani kodu zabezpieczającego i nie mamy do nich dostępu. Płatność
				przetwarza Stripe. Otrzymujemy informacje potrzebne do przypisania, sprawdzenia lub zwrotu płatności.
			</p>

			<h3>Faktury i obowiązki prawne</h3>
			<p>
				Dane identyfikacyjne, zamówień i płatności wykorzystujemy w księgowości, do rozliczeń podatkowych i
				wykonania obowiązków wobec właściwych organów. Podstawą jest{" "}
				<strong>obowiązek prawny — art. 6 ust. 1 lit. c RODO</strong>.
			</p>

			<h3>Reklamacje, odstąpienia i wykonywanie praw</h3>
			<p>
				Przetwarzamy dane identyfikacyjne i kontaktowe, informacje o zakupie i produkcie, treść zgłoszenia,
				potrzebne dowody oraz przebieg jego obsługi. W zakresie niezbędnym do udokumentowania sprawy
				zachowujemy również dane dotyczące złożenia i otrzymania zgłoszenia oraz wysłania potwierdzenia.
			</p>
			<p>
				Podstawą jest wykonanie obowiązków prawnych zgodnie z <strong>art. 6 ust. 1 lit. c RODO</strong>,
				obsługa umowy, a w razie potrzeby ustalenie, dochodzenie lub obrona roszczeń w ramach prawnie
				uzasadnionego interesu zgodnie z <strong>art. 6 ust. 1 lit. f RODO</strong>. Przyjęcie reklamacji lub
				odstąpienia nie wymaga zgody marketingowej ani dodatkowej zgody na przetwarzanie danych koniecznych do
				rozpatrzenia sprawy.
			</p>

			<h3>Konto klienta</h3>
			<p>
				Po utworzeniu konta przetwarzamy dane potrzebne do zarządzania nim, logowania i wyświetlania zamówień.
				Podstawą jest wykonanie zamówionej usługi zgodnie z <strong>art. 6 ust. 1 lit. b RODO</strong>. Konto
				nie jest warunkiem zakupu ani złożenia oświadczenia o odstąpieniu.
			</p>

			<h3>Wiadomości i oferty</h3>
			<p>
				Po zapisaniu się do newslettera wykorzystujemy adres e-mail i informacje o udzielonej zgodzie do
				wysyłki wiadomości. Podstawą jest <strong>zgoda — art. 6 ust. 1 lit. a RODO</strong>. Jest dobrowolna
				i można ją w każdej chwili wycofać przez link w wiadomości lub pisząc na <Mail />.
			</p>

			<h3>Bezpieczeństwo strony i ochrona roszczeń</h3>
			<p>
				W niezbędnym zakresie przetwarzamy techniczne dzienniki dostępu i błędów, informacje służące
				zapobieganiu nadużyciom i oszustwom oraz dokumenty potrzebne do ochrony roszczeń. Podstawą jest{" "}
				<strong>prawnie uzasadniony interes — art. 6 ust. 1 lit. f RODO</strong>, związany z bezpieczeństwem
				działania i ochroną praw. Bierzemy pod uwagę proporcjonalność oraz wpływ na prywatność.
			</p>
			<p>
				Nie traktujemy tej podstawy jako ogólnego zezwolenia na śledzenie reklamowe. Informacje o opcjonalnej
				analityce i marketingu są na stronie{" "}
				<Link href={marketHref(channel, "/cookies")}>Pliki cookies i ustawienia prywatności</Link>.
			</p>

			<h2>3. Skąd pochodzą dane i które są wymagane</h2>
			<p>
				Dane otrzymujemy przede wszystkim od Państwa, na przykład przy zakupie, zakładaniu konta, w formularzu
				lub korespondencji. Operator płatności przekazuje informacje o jej wyniku, a przewoźnik może przekazać
				informacje o doręczeniu. Dane techniczne powstają podczas korzystania ze strony.
			</p>
			<p>
				Dane oznaczone jako wymagane są potrzebne do zawarcia i wykonania umowy. Bez adresu dostawy nie możemy
				na przykład doręczyć przesyłki. W formularzach wymagamy danych odpowiednich do ich celu. Nie trzeba
				podawać informacji dobrowolnych ani zgadzać się na marketing.
			</p>

			<h2>4. Komu przekazujemy dane</h2>
			<p>
				Nie każdy usługodawca otrzymuje automatycznie Państwa dane. Zależy to od usług wykorzystywanych przy
				konkretnym zamówieniu i podczas korzystania ze strony.
			</p>
			<p>
				Przy wysyłce współpracujemy z <strong>FedEx i Slovenská pošta (Pocztą Słowacką)</strong>. Wybrany
				przewoźnik otrzymuje informacje potrzebne do transportu i kontaktu z odbiorcą. Płatności obsługuje{" "}
				<strong>Stripe</strong>. W niezbędnym zakresie dostęp mogą mieć także dostawcy usług technicznych,
				poczty elektronicznej, księgowości lub pomocy prawnej. Dane przekazujemy organom, gdy wymaga tego
				prawo.
			</p>
			<p>
				Zależnie od usługi odbiorcy działają jako podmioty przetwarzające na nasze zlecenie lub jako odrębni
				administratorzy. Poniższa tabela opisuje wykorzystywane systemy, usługi i cele. Nasze własne
				instalacje oprogramowania nie są odrębnymi zewnętrznymi administratorami tylko dlatego, że mają własną
				nazwę.
			</p>
			<RecipientsTable lang="pl" />
			<p>
				O informacje dotyczące konkretnych odbiorców danych mogą Państwo wystąpić na <Mail />.
			</p>

			<h2>5. Przekazywanie danych poza Europejski Obszar Gospodarczy</h2>
			<p>
				Przy niektórych usługach dane mogą być udostępniane odbiorcom poza Europejskim Obszarem Gospodarczym.
				Takie przekazanie wymaga odpowiedniej podstawy prawnej, na przykład obowiązującej decyzji
				stwierdzającej odpowiedni stopień ochrony lub standardowych klauzul umownych wraz z dodatkowymi
				zabezpieczeniami, gdy są potrzebne.
			</p>
			<p>
				Samo przechowywanie danych na serwerze w Unii Europejskiej nie wyklucza dostępu z innego państwa.
				Informacje o zabezpieczeniach zastosowanych do konkretnego przekazania i sposobie uzyskania ich kopii
				udostępniamy pod adresem <Mail />, z odpowiednią ochroną informacji poufnych.
			</p>

			<h2>6. Jak długo przechowujemy dane</h2>
			<p>
				Okres przechowywania zależy od celu i obowiązków prawnych; nie wszystkie dane są przechowywane równie
				długo.
			</p>
			<p>
				<strong>Zamówienia i związaną z nimi korespondencję</strong> zachowujemy w trakcie obsługi, a później
				w zakresie potrzebnym do wykonania obowiązków prawnych, reklamacji oraz ustalenia, dochodzenia lub
				obrony roszczeń. Uwzględniamy właściwe terminy przedawnienia, ich ewentualne zawieszenie lub
				przerwanie oraz czas trwania postępowania. Niezbędne dokumenty mogą pozostać do prawomocnego
				zakończenia sporu.
			</p>
			<p>
				<strong>Dokumenty księgowe</strong> przechowujemy zgodnie z obowiązującym nas prawem słowackim, co do
				zasady przez dziesięć lat po zakończeniu roku, którego dotyczą. Nie oznacza to przechowywania
				wszystkich danych technicznych lub marketingowych przez dziesięć lat.
			</p>
			<p>
				<strong>Reklamacje i odstąpienia</strong> zachowujemy podczas obsługi, a następnie zgodnie z
				powyższymi kryteriami, w zakresie potrzebnym do wykazania wykonania obowiązków i ochrony roszczeń.
			</p>
			<p>
				<strong>Dane konta</strong> wykorzystujemy przez czas jego istnienia. Po zamknięciu usuwamy dane,
				które nie są już potrzebne do prowadzenia konta, lub ograniczamy ich przetwarzanie. Informacje
				wymagane do rozliczeń i ochrony roszczeń mogą być przechowywane oddzielnie.
			</p>
			<p>
				<strong>Adres e-mail do newslettera</strong> wykorzystujemy do wycofania zgody lub rezygnacji z
				subskrypcji. Potrzebny dowód udzielenia i wycofania zgody oraz rezygnacji możemy zachować, aby wykazać
				zgodność działania z prawem i respektować Państwa decyzję — nie w celu dalszej wysyłki reklam.
			</p>
			<p>
				<strong>Dzienniki techniczne, dane analityczne i pliki cookies</strong> mają okresy związane z
				konkretną usługą i celem. Okresy przechowywania danych w przeglądarce przedstawiamy na stronie{" "}
				<Link href={marketHref(channel, "/cookies")}>Pliki cookies i ustawienia prywatności</Link>. Przy
				konkretnym incydencie bezpieczeństwa potrzebne dowody mogą być zachowane dłużej, aby go wyjaśnić i
				chronić związane z nim roszczenia.
			</p>

			<h2>7. Państwa prawa</h2>
			<p>
				Na warunkach określonych w RODO mają Państwo prawo do{" "}
				<strong>dostępu, sprostowania, usunięcia lub ograniczenia przetwarzania</strong> danych. W przypadku
				zautomatyzowanego przetwarzania na podstawie zgody lub umowy może przysługiwać także{" "}
				<strong>prawo do przenoszenia danych</strong>.
			</p>
			<p>
				Przy przetwarzaniu na podstawie prawnie uzasadnionego interesu mogą Państwo wnieść{" "}
				<strong>sprzeciw z przyczyn związanych ze szczególną sytuacją</strong>. Wobec marketingu
				bezpośredniego sprzeciw można wnieść w każdej chwili; zaprzestaniemy przetwarzania danych w tym celu.
			</p>
			<p>
				Zgodę można wycofać równie łatwo, jak ją udzielono. Nie wpływa to na zgodność z prawem wcześniejszego
				przetwarzania. Ustawienia cookies można zmienić przez <strong>„Ustawienia prywatności”</strong> w
				stopce, a z newslettera wypisać się przez link w wiadomości lub kontakt z nami. Są to odrębne decyzje.
			</p>
			<p>
				Wniosek prosimy wysłać na <Mail />. Przy uzasadnionych wątpliwościach dotyczących tożsamości możemy
				poprosić o odpowiednie dodatkowe informacje. Nie wymagamy automatycznie kopii dokumentu tożsamości.
			</p>
			<p>
				O podjętych działaniach informujemy bez zbędnej zwłoki, najpóźniej w ciągu <strong>miesiąca</strong>.
				Przy szczególnie skomplikowanych lub licznych wnioskach termin może zostać przedłużony o kolejne dwa
				miesiące. O przedłużeniu i jego przyczynach informujemy w pierwszym miesiącu. Jeżeli nie możemy
				spełnić żądania, wyjaśniamy przyczynę. Prawo do usunięcia danych nie oznacza na przykład konieczności
				usunięcia dokumentu, który musimy zachować na podstawie prawa.
			</p>

			<h2>8. Skarga do organu nadzorczego</h2>
			<p>
				Mogą Państwo złożyć skargę do właściwego organu, zwłaszcza w państwie zwykłego pobytu, pracy lub
				domniemanego naruszenia RODO. Nie muszą Państwo kierować skargi wyłącznie na Słowację.
			</p>
			<p>
				W Polsce organem jest <strong>Prezes Urzędu Ochrony Danych Osobowych</strong>, ul. Stanisława
				Moniuszki 1A, 00-014 Warszawa. Informacje o składaniu skarg i aktualne dane kontaktowe są na{" "}
				<a href="https://uodo.gov.pl/" rel="noopener noreferrer" target="_blank">
					uodo.gov.pl
				</a>
				.
			</p>
			<p>Słowacki organ ochrony danych:</p>
			<DpaAuthority lang="pl" />

			<h2>9. Zautomatyzowane podejmowanie decyzji</h2>
			<p>
				Przy przyjmowaniu zamówień, rozpatrywaniu reklamacji i odstąpień nie stosujemy wyłącznie
				zautomatyzowanego podejmowania decyzji ani profilowania wywołującego skutki prawne lub podobnie
				istotnie wpływającego na Państwa sytuację. W tych sprawach decyzje podejmuje człowiek.
			</p>
			<p>
				Operator płatności automatycznie ocenia ryzyko oszustwa i może odmówić płatności albo wymagać
				dodatkowego uwierzytelnienia. Jest to element obsługi płatności, odrębny od przyjęcia zamówienia przez
				nas. Jeżeli płatność nie powiedzie się, prosimy o kontakt na <Mail />, aby ustalić dalszy sposób
				postępowania.
			</p>

			<h2>10. Zmiany informacji</h2>
			<p>
				Aktualizujemy ten dokument, gdy zmienia się sposób przetwarzania lub wykorzystywane usługi. Jeżeli
				zmiana wymaga nowej zgody, sama aktualizacja dokumentu jej nie zastępuje.
			</p>
		</>
	);
}

export function Hu({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Vásárláskor és a weboldal használatakor személyes adatokat bíz ránk. Itt elmagyarázzuk, mely adatokat
				használjuk, miért van rájuk szükségünk, kinek továbbítjuk őket, és hogyan gyakorolhatja jogait.
			</p>

			<h2>1. Ki felel az adatkezelésért</h2>
			<p>
				Az adatkezelő a <strong>{companyInfo.legalName}</strong>, {companyInfo.street}, {companyInfo.city},{" "}
				{SLOVAKIA_HU}, cégazonosító szám (IČO): {companyInfo.ico}.
			</p>
			<p>
				Adatvédelmi kérdéssel az <Mail /> e-mail-címen vagy a székhelyünkre küldött levélben kereshet minket.
			</p>

			<h2>2. Milyen adatokat és milyen célból használunk</h2>

			<h3>Rendelések, szállítás és ügyfélszolgálat</h3>
			<p>
				Kezeljük a nevet, az elérhetőségeket, a számlázási és szállítási címet, a rendelési és fizetési
				adatokat, valamint a kapcsolódó levelezést. Céges vásárlásnál a megadott vállalkozási adatokat is. Ha
				egy tartozék megfelelőségéről érdeklődik, az Ön által elküldött járműadatokat és fényképeket is
				felhasználhatjuk a válaszhoz.
			</p>
			<p>
				Az adatok a szerződés előkészítéséhez és teljesítéséhez szükségesek: a rendeléshez, a fizetéshez, a
				kézbesítéshez és a vásárlással kapcsolatos segítségnyújtáshoz. A jogalap a{" "}
				<strong>GDPR 6. cikk (1) bekezdés b) pontja</strong>. Céges ügyfél kapcsolattartójával való
				kommunikációnál a jogalap lehet az üzleti kapcsolat kezeléséhez fűződő jogos érdek a{" "}
				<strong>GDPR 6. cikk (1) bekezdés f) pontja</strong> alapján.
			</p>
			<p>
				A teljes bankkártyaszámot és a biztonsági kódot nem tároljuk, és azokhoz nem férünk hozzá. A fizetést
				a Stripe kezeli. Mi a fizetés rendeléshez kapcsolásához, ellenőrzéséhez vagy visszatérítéséhez
				szükséges információkat kapjuk meg.
			</p>

			<h3>Számlák és jogi kötelezettségek</h3>
			<p>
				Az azonosító, rendelési és fizetési adatokat könyvelésre, adózási kötelezettségekre és az illetékes
				szervekkel szembeni jogi kötelezettségek teljesítésére használjuk. Jogalap a{" "}
				<strong>jogi kötelezettség teljesítése, a GDPR 6. cikk (1) bekezdés c) pontja</strong>.
			</p>

			<h3>Reklamációk, elállások és joggyakorlás</h3>
			<p>
				Kezeljük az azonosító és kapcsolattartási adatokat, a vásárlás és termék adatait, a bejelentés
				tartalmát, a szükséges bizonyítékokat és az ügyintézés menetét. Az ügy igazolásához szükséges
				mértékben megőrizzük a közlésre, annak beérkezésére és a visszaigazolás elküldésére vonatkozó adatokat
				is.
			</p>
			<p>
				A jogalap a jogszabályi kötelezettségek teljesítése a{" "}
				<strong>GDPR 6. cikk (1) bekezdés c) pontja</strong> szerint, a szerződés teljesítése, szükség esetén
				pedig jogi igények előterjesztése, érvényesítése vagy védelme a{" "}
				<strong>GDPR 6. cikk (1) bekezdés f) pontja</strong> szerinti jogos érdek alapján. A reklamáció vagy
				elállás befogadásához nem szükséges marketinghozzájárulás, és a szükséges adatkezeléshez külön
				hozzájárulást sem kérünk.
			</p>

			<h3>Vásárlói fiók</h3>
			<p>
				Fiók létrehozásakor az annak kezeléséhez, a bejelentkezéshez és a rendelések megjelenítéséhez
				szükséges adatokat használjuk. Jogalap a kért szolgáltatás teljesítése a{" "}
				<strong>GDPR 6. cikk (1) bekezdés b) pontja</strong> szerint. A fiók nem feltétele a vásárlásnak vagy
				az elállás közlésének.
			</p>

			<h3>Hírek és ajánlatok</h3>
			<p>
				Hírlevél-feliratkozáskor e-mail-címét és a hozzájárulás adatait a hírlevél elküldésére használjuk.
				Jogalap az <strong>Ön hozzájárulása, a GDPR 6. cikk (1) bekezdés a) pontja</strong>. A hozzájárulás
				önkéntes, és a levélben szereplő leiratkozási hivatkozással vagy az <Mail /> címre írt üzenettel
				bármikor visszavonható.
			</p>

			<h3>A weboldal biztonsága és a jogi igények védelme</h3>
			<p>
				Szükséges mértékben technikai hozzáférési és hibanaplókat, visszaélés- és csalásmegelőzési adatokat,
				valamint a jogi igényekhez kapcsolódó bizonyítékokat kezelünk. A jogalap a biztonságos működéshez és
				jogaink védelméhez fűződő <strong>jogos érdek a GDPR 6. cikk (1) bekezdés f) pontja alapján</strong>.
				Ennek során figyelembe vesszük az arányosságot és az Ön magánszférájára gyakorolt hatást.
			</p>
			<p>
				Ezt a jogalapot nem tekintjük általános engedélynek reklámcélú követésre. Az opcionális elemzésről és
				marketingről a <Link href={marketHref(channel, "/cookies")}>Sütik és adatvédelmi beállítások</Link>{" "}
				oldalon tájékoztatunk.
			</p>

			<h2>3. Honnan származnak az adatok, és mi kötelező</h2>
			<p>
				Az adatokat főként Öntől kapjuk: vásárláskor, fióknyitáskor, űrlapon vagy a velünk folytatott
				kommunikáció során. A fizetés eredményéről a fizetési szolgáltató, a kézbesítésről adott esetben a
				szállító tájékoztat. A technikai adatok a weboldal használata során keletkeznek.
			</p>
			<p>
				A kötelezőként jelölt rendelési adatokra a szerződés megkötéséhez és teljesítéséhez van szükségünk.
				Szállítási cím nélkül például nem tudjuk kézbesíteni a csomagot. Az űrlapokon csak a célnak megfelelő
				adatokat kérjük kötelezően. Önkéntes adat megadására vagy marketinghozzájárulásra nem köteles.
			</p>

			<h2>4. Kinek adunk át adatokat</h2>
			<p>
				Nem minden szolgáltató kapja meg automatikusan az Ön adatait. Az adatátadás attól függ, mely
				szolgáltatást használjuk a konkrét rendelés vagy a weboldal működtetése során.
			</p>
			<p>
				A szállításban a <strong>FedEx és a Slovenská pošta (Szlovák Posta)</strong> működik közre. A
				kiválasztott szállító a kézbesítéshez és a címzett eléréséhez szükséges adatokat kapja meg. A
				fizetéseket a <strong>Stripe</strong> kezeli. Szükséges mértékben technikai, e-mailes, könyvelési vagy
				jogi szolgáltatók is hozzáférhetnek adatokhoz. Hatóságnak akkor továbbítunk adatot, ha azt jogszabály
				írja elő.
			</p>
			<p>
				A szolgáltatás jellegétől függően a címzettek adatfeldolgozóként vagy önálló adatkezelőként járnak el.
				Az alábbi táblázat a használt rendszereket, szolgáltatásokat és célokat ismerteti. Saját
				szoftvertelepítéseink pusztán elnevezésük miatt nem válnak külön külső adatkezelővé.
			</p>
			<RecipientsTable lang="hu" />
			<p>
				A konkrét adatcímzettekről az <Mail /> címen kérhet tájékoztatást.
			</p>

			<h2>5. Adattovábbítás az Európai Gazdasági Térségen kívülre</h2>
			<p>
				Egyes szolgáltatásoknál az adatok az Európai Gazdasági Térségen kívüli címzettek számára is
				hozzáférhetővé válhatnak. Ehhez megfelelő jogalap szükséges, például hatályos megfelelőségi határozat,
				vagy az Európai Bizottság által elfogadott adattovábbítási szerződéses kikötések (SCC) szükség esetén
				további védelmi intézkedésekkel együtt.
			</p>
			<p>
				Az EU-ban működő szerveren való tárolás önmagában nem zárja ki a más országból történő hozzáférést. A
				konkrét továbbításhoz alkalmazott garanciákról és azok másolatának elérhetőségéről az <Mail /> címen
				adunk tájékoztatást, a bizalmas adatok megfelelő védelmével.
			</p>

			<h2>6. Meddig őrizzük meg az adatokat</h2>
			<p>
				Az adatmegőrzés időtartamát a cél és a jogi kötelezettségek határozzák meg. Nem minden adatot őrzünk
				meg ugyanannyi ideig.
			</p>
			<p>
				<strong>A rendeléseket és kapcsolódó levelezést</strong> az ügyintézés alatt, majd a jogi
				kötelezettségek, reklamációk és jogi igények miatt szükséges mértékben tartjuk meg. Figyelembe vesszük
				az elévülési időket, azok nyugvását vagy megszakítását, valamint az eljárás időtartamát. Szükséges
				dokumentumot a jogvita jogerős lezárásáig is megőrizhetünk.
			</p>
			<p>
				<strong>A számviteli bizonylatokat</strong> a ránk vonatkozó szlovák számviteli jog szerint főszabály
				szerint az érintett év végét követő tíz évig őrizzük meg. Ez nem jelenti valamennyi technikai vagy
				marketingadat tízéves tárolását.
			</p>
			<p>
				<strong>A reklamációk és elállások adatait</strong> az ügyintézés alatt, majd a fenti szempontok
				szerint addig őrizzük, ameddig a kötelezettségek teljesítésének igazolása vagy a jogi igények védelme
				szükségessé teszi.
			</p>
			<p>
				<strong>A fiókadatokat</strong> a fiók fennállása alatt használjuk. Megszüntetése után a fiókhoz már
				nem szükséges adatokat töröljük vagy kezelésüket korlátozzuk. A könyvelési vagy jogi igényekhez
				szükséges adatok elkülönítve megmaradhatnak.
			</p>
			<p>
				<strong>A hírlevélhez használt e-mail-címet</strong> a hozzájárulás visszavonásáig vagy leiratkozásig
				használjuk. A hozzájárulás, annak visszavonása és a leiratkozás szükséges bizonyítékát megtarthatjuk,
				hogy igazoljuk a jogszerűséget és tiszteletben tartsuk a döntését — nem további reklámküldés céljából.
			</p>
			<p>
				<strong>Technikai naplók, elemzési adatok és sütik</strong> esetében a szolgáltatáshoz és célhoz
				igazodó időtartamok érvényesek. A böngészőben történő tárolás időtartamát a{" "}
				<Link href={marketHref(channel, "/cookies")}>Sütik és adatvédelmi beállítások</Link> oldalon
				ismertetjük. Konkrét biztonsági eseménynél a tisztázáshoz és a jogi igényekhez szükséges
				bizonyítékokat hosszabb ideig is megőrizhetjük.
			</p>

			<h2>7. Az Ön jogai</h2>
			<p>
				A GDPR feltételei szerint kérheti az adatokhoz való{" "}
				<strong>hozzáférést, helyesbítést, törlést vagy az adatkezelés korlátozását</strong>. Hozzájáruláson
				vagy szerződésen alapuló automatizált adatkezelésnél <strong>adathordozhatósági jog</strong> is
				megilletheti.
			</p>
			<p>
				Jogos érdeken alapuló adatkezelés ellen a saját helyzetével kapcsolatos okból{" "}
				<strong>tiltakozhat</strong>. Közvetlen üzletszerzés ellen bármikor tiltakozhat; az adatokat e célból
				ezt követően nem használjuk.
			</p>
			<p>
				A hozzájárulás ugyanolyan egyszerűen visszavonható, mint ahogyan megadta. Ez a korábbi adatkezelés
				jogszerűségét nem érinti. A sütiknél a láblécben található <strong>„Adatvédelmi beállítások”</strong>{" "}
				lehetőséget használhatja; a hírlevélről a levélben szereplő hivatkozással vagy üzenetben iratkozhat
				le. A két választás egymástól független.
			</p>
			<p>
				Kérelmét az <Mail /> címre küldje. Személyazonosságával kapcsolatos észszerű kétség esetén arányos
				kiegészítő adatot kérhetünk. Személyazonosító okmány másolatát nem kérjük automatikusan.
			</p>
			<p>
				Az intézkedésekről indokolatlan késedelem nélkül, legkésőbb <strong>egy hónapon belül</strong>{" "}
				tájékoztatjuk. Összetett vagy nagyszámú kérelem esetén ez további két hónappal meghosszabbítható. A
				hosszabbításról és annak okáról az első hónapban tájékoztatást adunk. Ha a kérelmet nem
				teljesíthetjük, megindokoljuk. A törléshez való jog például nem kötelez olyan bizonylat törlésére,
				amelyet jogszabály szerint meg kell őriznünk.
			</p>

			<h2>8. Panasz a felügyeleti hatóságnál</h2>
			<p>
				Panaszt tehet az illetékes felügyeleti hatóságnál, különösen a szokásos tartózkodási helye, a
				munkahelye vagy a feltételezett jogsértés helye szerinti tagállamban. Nem kell kizárólag szlovák
				hatósághoz fordulnia.
			</p>
			<p>
				Magyarországon a <strong>Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)</strong> érhető el:
				1055 Budapest, Falk Miksa utca 9–11.; postacím: 1363 Budapest, Pf. 9. Az aktuális elérhetőségek és a
				panasztétel részletei a{" "}
				<a href="https://www.naih.hu/" rel="noopener noreferrer" target="_blank">
					naih.hu
				</a>{" "}
				oldalon találhatók.
			</p>
			<p>A szlovák adatvédelmi hatóság:</p>
			<DpaAuthority lang="hu" />

			<h2>9. Automatizált döntéshozatal</h2>
			<p>
				Rendelések elfogadásakor, reklamációk és elállások elbírálásakor nem alkalmazunk kizárólag
				automatizált döntést vagy profilalkotást, amely Önre joghatással vagy hasonlóan jelentős hatással
				járna. Ezekben az ügyekben ember dönt.
			</p>
			<p>
				A fizetési szolgáltató automatikusan értékeli a csalás kockázatát, és ennek alapján elutasíthatja a
				fizetést vagy további azonosítást kérhet. Ez a fizetési szolgáltatás része, nem a mi
				rendeléselfogadási döntésünk. Sikertelen fizetésnél írjon az <Mail /> címre, hogy egyeztethessük a
				továbbiakat.
			</p>

			<h2>10. A tájékoztató változásai</h2>
			<p>
				A tájékoztatót az adatkezelés vagy a használt szolgáltatások változásakor frissítjük. Ha új
				hozzájárulás szükséges, azt a dokumentum módosítása önmagában nem helyettesíti.
			</p>
		</>
	);
}

export function It({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Quando acquisti o utilizzi il sito ci affidi dati personali. Qui spieghiamo quali informazioni
				trattiamo, perché ci servono, chi può riceverle e come puoi esercitare i tuoi diritti.
			</p>

			<h2>1. Chi è il titolare del trattamento</h2>
			<p>
				Il titolare è <strong>{companyInfo.legalName}</strong>, {companyInfo.street}, {companyInfo.city},{" "}
				{SLOVAKIA_IT}, numero identificativo dell’impresa (IČO) <strong>{companyInfo.ico}</strong>.
			</p>
			<p>
				Per le questioni relative ai dati personali scrivi a <Mail /> o all’indirizzo della sede.
			</p>

			<h2>2. Quali dati trattiamo e per quali finalità</h2>

			<h3>Ordini, consegna e assistenza</h3>
			<p>
				Trattiamo nome, recapiti, indirizzi di fatturazione e consegna, informazioni sull’ordine e sul
				pagamento e la corrispondenza collegata. Per acquisti aziendali trattiamo anche i dati dell’impresa
				che ci comunichi. Una richiesta sulla compatibilità può includere dati del veicolo o fotografie
				inviate da te.
			</p>
			<p>
				Utilizziamo queste informazioni per preparare ed eseguire il contratto, gestire ordine, pagamento e
				consegna e rispondere alle richieste. La base è l’
				<strong>articolo 6, paragrafo 1, lettera b del GDPR</strong>. Per i contatti con una persona che
				rappresenta un cliente aziendale può applicarsi il legittimo interesse alla gestione del rapporto
				commerciale, ai sensi della <strong>lettera f</strong>.
			</p>
			<p>
				Non conserviamo né possiamo consultare il numero completo della carta o il codice di sicurezza. Stripe
				gestisce il pagamento; riceviamo le informazioni necessarie per identificarlo, verificarlo o
				rimborsarlo.
			</p>

			<h3>Fatturazione e obblighi legali</h3>
			<p>
				I dati identificativi, dell’ordine e del pagamento servono alla contabilità, agli adempimenti fiscali
				e agli obblighi verso le autorità competenti. La base è un{" "}
				<strong>obbligo legale, articolo 6, paragrafo 1, lettera c del GDPR</strong>.
			</p>

			<h3>Reclami, recesso ed esercizio dei diritti</h3>
			<p>
				Trattiamo dati identificativi e di contatto, riferimenti dell’acquisto e del prodotto, contenuto della
				richiesta, prove necessarie e informazioni sulla gestione. Conserviamo quanto necessario a documentare
				la dichiarazione, la sua ricezione e le conferme inviate, secondo il processo effettivamente
				utilizzato.
			</p>
			<p>
				Le basi sono gli obblighi legali, l’esecuzione del contratto e, quando necessario, il legittimo
				interesse ad accertare, esercitare o difendere un diritto.{" "}
				<strong>
					Non occorre un consenso al marketing o un consenso aggiuntivo per i dati necessari a gestire un
					reclamo o un recesso.
				</strong>
			</p>

			<h3>Account cliente</h3>
			<p>
				Se crei un account, trattiamo i dati necessari per amministrarlo, consentire l’accesso e mostrare gli
				ordini. La base è l’esecuzione del servizio richiesto, articolo 6, paragrafo 1, lettera b. L’account
				non è obbligatorio per acquistare o recedere.
			</p>

			<h3>Newsletter e comunicazioni promozionali</h3>
			<p>
				Se ti iscrivi alla newsletter, utilizziamo l’indirizzo e-mail e le informazioni sul consenso per
				inviarti comunicazioni. La base è il <strong>consenso, articolo 6, paragrafo 1, lettera a</strong>. È
				facoltativo e puoi revocarlo tramite il collegamento nella comunicazione o scrivendo a <Mail />.
			</p>

			<h3>Sicurezza e tutela dei diritti</h3>
			<p>
				Nella misura necessaria, trattiamo registri tecnici di accesso e degli errori, informazioni per
				prevenire abusi e frodi e documenti utili a tutelare i diritti. La base è il{" "}
				<strong>legittimo interesse, articolo 6, paragrafo 1, lettera f</strong>, tenendo conto di
				proporzionalità e impatto sulla privacy.
			</p>
			<p>
				Questa base non costituisce un’autorizzazione generale al tracciamento pubblicitario. L’analisi
				facoltativa e il marketing sono descritti nella pagina{" "}
				<Link href={marketHref(channel, "/cookies")}>Cookie e preferenze</Link>.
			</p>

			<h2>3. Origine dei dati e informazioni necessarie</h2>
			<p>
				Riceviamo i dati principalmente da te, durante l’acquisto, l’iscrizione, l’uso di un modulo o la
				corrispondenza. Il prestatore di pagamento comunica l’esito del pagamento; il corriere può fornire
				informazioni sulla consegna. I dati tecnici sono generati dall’utilizzo del sito.
			</p>
			<p>
				I dati obbligatori sono quelli necessari alla relativa finalità: senza un indirizzo di consegna, ad
				esempio, non possiamo recapitare un ordine. Non devi fornire dati facoltativi né acconsentire al
				marketing. Nei moduli chiediamo informazioni proporzionate alla richiesta da gestire.
			</p>

			<h2>4. Destinatari e servizi utilizzati</h2>
			<p>
				Non tutti i fornitori ricevono automaticamente i tuoi dati. Dipende dai servizi effettivamente
				utilizzati nell’ordine o durante la visita. Il corriere scelto riceve i dati necessari al trasporto e
				al contatto con il destinatario. Nella misura necessaria possono avere accesso anche fornitori
				tecnici, servizi e-mail, contabili o consulenti legali; comunichiamo dati alle autorità quando la
				legge lo richiede.
			</p>
			<p>
				A seconda del servizio, i destinatari operano come responsabili per nostro conto oppure come titolari
				autonomi. I nostri software installati autonomamente non diventano titolari esterni soltanto perché
				hanno un nome diverso.
			</p>
			<RecipientsTable lang="it" />
			<p>
				Puoi chiedere informazioni sui destinatari specifici scrivendo a <Mail />.
			</p>

			<h2>5. Trattamenti fuori dallo Spazio economico europeo</h2>
			<p>
				Alcuni servizi possono comportare un trasferimento o un accesso ai dati da paesi fuori dallo Spazio
				economico europeo. La sede di un server nell’Unione europea non esclude, da sola, altri accessi o
				trattamenti.
			</p>
			<p>
				Quando avviene un trasferimento, deve basarsi sul meccanismo previsto dal GDPR per il caso concreto,
				ad esempio una decisione di adeguatezza oppure clausole contrattuali standard e, se necessarie,
				garanzie supplementari. Non tutti i destinatari utilizzano lo stesso meccanismo. Puoi richiedere
				informazioni sulle garanzie applicabili e una copia pertinente a <Mail />.
			</p>

			<h2>6. Per quanto tempo conserviamo i dati</h2>
			<p>
				Conserviamo soltanto quanto necessario alla finalità e agli obblighi applicabili. La durata non è
				identica per tutte le informazioni:
			</p>
			<ul>
				<li>
					<strong>Ordini e documenti contrattuali:</strong> per l’esecuzione del contratto, gli obblighi
					legali e il periodo necessario a far valere o difendere i diritti, anche in caso di controversia.
				</li>
				<li>
					<strong>Documenti contabili:</strong> quelli soggetti al termine slovacco pertinente sono conservati
					per 10 anni successivi all’anno cui si riferiscono. Questo non significa conservare per 10 anni
					tutti i dati tecnici del sito.
				</li>
				<li>
					<strong>Reclami e recessi:</strong> per gestire la richiesta e documentarne il trattamento, per i
					termini legali pertinenti e l’eventuale tutela in una controversia.
				</li>
				<li>
					<strong>Account:</strong> durante la sua esistenza, poi cancelliamo o limitiamo i dati non più
					necessari. La chiusura dell’account non impone di cancellare documenti che dobbiamo conservare per
					legge.
				</li>
				<li>
					<strong>Newsletter:</strong> fino alla revoca o alla cessazione della finalità; eventuali dati
					minimi sulla prova del consenso o sulla scelta di non ricevere messaggi possono restare per tutelare
					i diritti e rispettare la scelta, non per continuare la pubblicità.
				</li>
				<li>
					<strong>Registri tecnici e analisi:</strong> per il tempo proporzionato alla sicurezza e alla
					finalità di misurazione, con eventuale conservazione mirata in caso di incidente. I tempi dei
					meccanismi nel browser sono descritti nella pagina cookie.
				</li>
			</ul>

			<h2>7. I tuoi diritti</h2>
			<p>
				Alle condizioni previste dal GDPR puoi chiedere accesso, rettifica, cancellazione o limitazione del
				trattamento. Quando il trattamento si basa su consenso o contratto ed è automatizzato, puoi avere
				diritto alla portabilità.
			</p>
			<p>
				Puoi opporti a un trattamento fondato sul legittimo interesse per motivi connessi alla tua situazione.{" "}
				<strong>All’uso dei dati per marketing diretto puoi opporti in qualsiasi momento</strong>; per tale
				finalità non saranno più trattati. Puoi revocare il consenso senza pregiudicare la liceità del
				trattamento precedente.
			</p>
			<p>
				Invia la richiesta a <Mail />. Se vi sono dubbi ragionevoli sulla tua identità, possiamo chiedere
				soltanto le informazioni necessarie a verificarla. Rispondiamo normalmente entro un mese. Nei casi
				previsti, per complessità o numero di richieste, il termine può essere esteso di altri due mesi; ti
				informiamo entro il primo mese e spieghiamo il motivo.
			</p>
			<p>
				Le preferenze per le tecnologie del sito si modificano nelle{" "}
				<Link href={marketHref(channel, "/cookies")}>impostazioni sulla privacy</Link>. Disiscriversi dalla
				newsletter e modificare i cookie sono due scelte distinte.
			</p>

			<h2>8. Reclamo all’autorità di controllo</h2>
			<p>
				Puoi proporre un reclamo all’autorità competente, in particolare nel paese della tua residenza
				abituale, del tuo luogo di lavoro o della presunta violazione. In Italia puoi rivolgerti al{" "}
				<strong>Garante per la protezione dei dati personali</strong>:{" "}
				<a
					href="https://www.garanteprivacy.it/home/footer/contatti"
					rel="noopener noreferrer"
					target="_blank"
				>
					informazioni e contatti ufficiali
				</a>
				.
			</p>
			<p>Nel paese della nostra sede opera l’autorità slovacca:</p>
			<DpaAuthority lang="it" country={SLOVAKIA_IT} />
			<p>
				La possibilità di contattarla non limita il diritto di rivolgerti al Garante o a un’altra autorità
				competente.
			</p>

			<h2>9. Decisioni automatizzate</h2>
			<p>
				Per la gestione di ordini, reclami e recessi non adottiamo decisioni basate esclusivamente su
				trattamenti automatizzati che producano effetti giuridici o analogamente significativi sulla persona.
				Non svolgiamo profilazione a tale scopo.
			</p>
			<p>
				Stripe effettua propri controlli antifrode nell’ambito del servizio di pagamento. Un pagamento può
				richiedere verifiche o non essere eseguito. Se succede, scrivi a <Mail />: esamineremo la situazione.
				L’esito di un controllo del prestatore di pagamento non è, da solo, la nostra decisione di accettare
				il contratto.
			</p>

			<h2>10. Aggiornamenti</h2>
			<p>
				Aggiorniamo questa informativa quando cambiano i trattamenti o i servizi. Una modifica del documento
				non sostituisce un nuovo consenso quando è richiesto.
			</p>
		</>
	);
}

export function Fr({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Quand vous achetez ou utilisez le site, vous nous confiez des données personnelles. Nous expliquons
				ici les informations utilisées, leurs finalités, leurs destinataires et les moyens d’exercer vos
				droits.
			</p>

			<h2>1. Responsable du traitement</h2>
			<p>
				Le responsable du traitement est <strong>{companyInfo.legalName}</strong>, {companyInfo.street},{" "}
				{companyInfo.city}, {SLOVAKIA_FR}, numéro d’identification de l’entreprise (IČO){" "}
				<strong>{companyInfo.ico}</strong>.
			</p>
			<p>
				Pour toute question sur vos données, écrivez à <Mail /> ou à l’adresse du siège.
			</p>

			<h2>2. Données traitées et finalités</h2>

			<h3>Commandes, livraison et assistance</h3>
			<p>
				Nous utilisons votre nom, vos coordonnées, les adresses de facturation et de livraison, les
				informations sur l’achat et le paiement et la correspondance associée. Pour un achat professionnel,
				cela comprend les données de l’entreprise transmises. Une demande de compatibilité peut comporter des
				informations sur le véhicule ou des photos que vous nous envoyez.
			</p>
			<p>
				Ces données servent à préparer et exécuter le contrat, gérer la commande, le paiement et la livraison
				et répondre aux questions. La base légale est l’
				<strong>article 6, paragraphe 1, point b du RGPD</strong>. Pour une personne représentant un client
				professionnel, l’intérêt légitime à gérer la relation commerciale peut s’appliquer, selon le{" "}
				<strong>point f</strong>.
			</p>
			<p>
				Nous ne conservons pas le numéro complet de carte ou le cryptogramme et n’y avons pas accès. Stripe
				traite le paiement ; nous recevons les informations nécessaires à son identification, sa vérification
				ou son remboursement.
			</p>

			<h3>Facturation et obligations légales</h3>
			<p>
				Les données d’identification, de commande et de paiement servent à la comptabilité, aux obligations
				fiscales et aux demandes légales des autorités. La base est une{" "}
				<strong>obligation légale, article 6, paragraphe 1, point c du RGPD</strong>.
			</p>

			<h3>Réclamations, rétractations et exercice des droits</h3>
			<p>
				Nous traitons les coordonnées et données d’identification, les références d’achat et du produit, le
				contenu de la demande, les preuves nécessaires et les informations sur son traitement. Nous conservons
				ce qui est nécessaire pour documenter la déclaration, sa réception et les confirmations transmises,
				selon la procédure réellement utilisée.
			</p>
			<p>
				Les bases sont les obligations légales, l’exécution du contrat et, si nécessaire, l’intérêt légitime à
				constater, exercer ou défendre un droit.{" "}
				<strong>
					La réception d’une réclamation ou d’une rétractation ne nécessite ni accord marketing ni
					consentement supplémentaire pour les données nécessaires au traitement.
				</strong>
			</p>

			<h3>Compte client</h3>
			<p>
				À la création d’un compte, nous utilisons les informations nécessaires pour le gérer, vous
				authentifier et afficher les commandes. Il s’agit de l’exécution du service demandé, article 6,
				paragraphe 1, point b. Le compte n’est pas obligatoire pour acheter ou se rétracter.
			</p>

			<h3>Newsletter et offres</h3>
			<p>
				Après inscription à la newsletter, votre adresse e-mail et les informations de consentement servent à
				vous envoyer des messages. La base est le{" "}
				<strong>consentement, article 6, paragraphe 1, point a</strong>. Il est facultatif et peut être retiré
				par le lien du message ou en écrivant à <Mail />.
			</p>

			<h3>Sécurité et défense des droits</h3>
			<p>
				Dans la mesure nécessaire, nous utilisons des journaux techniques d’accès et d’erreurs, des
				informations de prévention des abus ou de la fraude et les documents utiles à la défense des droits.
				La base est l’<strong>intérêt légitime, article 6, paragraphe 1, point f</strong>, en tenant compte de
				la proportionnalité et de l’impact sur la vie privée.
			</p>
			<p>
				Cette base ne vaut pas autorisation générale de suivi publicitaire. Les mesures facultatives et le
				marketing sont présentés dans{" "}
				<Link href={marketHref(channel, "/cookies")}>Cookies et préférences</Link>.
			</p>

			<h2>3. Origine des données et caractère obligatoire</h2>
			<p>
				Les données proviennent principalement de vous, lors d’un achat, de la création d’un compte, d’un
				formulaire ou d’un échange. Le prestataire de paiement communique le résultat du paiement et le
				transporteur peut fournir des informations de livraison. Les données techniques résultent de
				l’utilisation du site.
			</p>
			<p>
				Les informations obligatoires sont celles nécessaires à la finalité concernée : sans adresse, par
				exemple, nous ne pouvons pas livrer. Les champs des formulaires doivent rester proportionnés à leur
				objet. Les informations facultatives et l’accord marketing ne sont pas imposés.
			</p>

			<h2>4. Destinataires et services</h2>
			<p>
				Chaque fournisseur ne reçoit pas automatiquement vos données. Cela dépend des services effectivement
				utilisés pour la commande ou la visite. Le transporteur choisi reçoit les informations nécessaires à
				la livraison et au contact du destinataire. Les prestataires techniques, d’e-mail, de comptabilité ou
				d’assistance juridique peuvent accéder aux données nécessaires à leur mission. Nous les transmettons
				aux autorités lorsque la loi l’impose.
			</p>
			<p>
				Selon le service, les destinataires agissent comme sous-traitants pour notre compte ou comme
				responsables de traitement distincts. Un logiciel que nous exploitons nous-mêmes n’est pas un
				responsable externe du seul fait qu’il porte un nom particulier.
			</p>
			<RecipientsTable lang="fr" />
			<p>
				Vous pouvez demander des informations sur les destinataires précis à <Mail />.
			</p>

			<h2>5. Transferts hors de l’Espace économique européen</h2>
			<p>
				Certains services peuvent impliquer un transfert de données ou un accès depuis un pays situé hors de
				l’Espace économique européen. Un serveur situé dans l’Union européenne ne suffit pas, à lui seul, à
				exclure tout accès ou traitement extérieur.
			</p>
			<p>
				Un transfert doit reposer sur le mécanisme prévu par le RGPD pour la situation concernée : par exemple
				une décision d’adéquation ou des clauses contractuelles types avec, si nécessaire, des mesures
				supplémentaires. Le mécanisme n’est pas forcément identique pour chaque destinataire. Vous pouvez
				demander des précisions et une copie pertinente des garanties à <Mail />.
			</p>

			<h2>6. Durées de conservation</h2>
			<p>
				Nous conservons les données nécessaires à leurs finalités et à nos obligations. Une durée unique ne
				s’applique pas à toutes les catégories :
			</p>
			<ul>
				<li>
					<strong>Commandes et documents contractuels :</strong> pendant l’exécution, les obligations légales
					et les délais nécessaires à la défense des droits, y compris en cas de litige.
				</li>
				<li>
					<strong>Pièces comptables :</strong> les documents concernés par le délai slovaque applicable sont
					conservés pendant les 10 années suivant l’année à laquelle ils se rapportent. Cela ne signifie pas
					conserver toutes les données techniques pendant 10 ans.
				</li>
				<li>
					<strong>Réclamations et rétractations :</strong> pendant leur traitement et la durée nécessaire à sa
					preuve, selon les délais légaux et les besoins de défense dans un litige.
				</li>
				<li>
					<strong>Compte :</strong> pendant son existence, puis suppression ou limitation des données devenues
					inutiles. La clôture du compte ne supprime pas les obligations de conservation des pièces
					comptables.
				</li>
				<li>
					<strong>Newsletter :</strong> jusqu’au retrait du consentement ou à la fin de la finalité ; une
					preuve minimale du consentement ou du refus peut rester pour défendre les droits et respecter le
					choix, sans poursuivre la publicité.
				</li>
				<li>
					<strong>Journaux techniques et mesure :</strong> pendant une durée proportionnée à la sécurité et à
					la finalité, avec une conservation ciblée possible en cas d’incident. Les durées des mécanismes du
					navigateur sont précisées dans la page cookies.
				</li>
			</ul>

			<h2>7. Vos droits</h2>
			<p>
				Dans les conditions du RGPD, vous pouvez demander l’accès, la rectification, l’effacement ou la
				limitation du traitement. Pour un traitement automatisé fondé sur le consentement ou le contrat, vous
				pouvez bénéficier du droit à la portabilité.
			</p>
			<p>
				Vous pouvez vous opposer à un traitement fondé sur l’intérêt légitime pour des raisons tenant à votre
				situation. <strong>L’opposition à la prospection directe est possible à tout moment</strong> ; les
				données ne seront plus traitées à cette fin. Le retrait du consentement n’affecte pas la licéité des
				traitements antérieurs.
			</p>
			<p>
				Adressez votre demande à <Mail />. Si votre identité suscite un doute raisonnable, nous pouvons
				demander uniquement les informations nécessaires à sa vérification. Nous répondons normalement dans un
				mois. En cas de complexité ou de demandes nombreuses, un délai supplémentaire de deux mois peut
				s’appliquer dans les conditions légales ; nous vous en informons pendant le premier mois en expliquant
				pourquoi.
			</p>
			<p>
				Les préférences de traçage se modifient dans les{" "}
				<Link href={marketHref(channel, "/cookies")}>paramètres de confidentialité</Link>. Le retrait de
				l’inscription à la newsletter et le choix des cookies sont deux démarches distinctes.
			</p>

			<h2>8. Réclamation auprès d’une autorité</h2>
			<p>
				Vous pouvez saisir l’autorité compétente, notamment dans le pays de votre résidence habituelle, de
				votre travail ou de la violation supposée. En France, vous pouvez vous adresser à la{" "}
				<strong>Commission nationale de l’informatique et des libertés (CNIL)</strong> :{" "}
				<a href="https://www.cnil.fr/" rel="noopener noreferrer" target="_blank">
					site officiel de la CNIL
				</a>
				.
			</p>
			<p>Dans le pays de notre siège, l’autorité est :</p>
			<DpaAuthority lang="fr" country={SLOVAKIA_FR} />
			<p>Cette indication ne limite pas votre droit de saisir la CNIL ou une autre autorité compétente.</p>

			<h2>9. Décisions automatisées</h2>
			<p>
				Pour la gestion des commandes, réclamations et rétractations, nous ne prenons pas de décision fondée
				uniquement sur un traitement automatisé produisant des effets juridiques ou des effets similaires
				significatifs sur une personne. Nous n’effectuons pas de profilage à cette fin.
			</p>
			<p>
				Stripe réalise ses propres contrôles antifraude dans le cadre du paiement. Un paiement peut nécessiter
				une vérification ou ne pas aboutir. Écrivez alors à <Mail /> : nous examinerons la situation. Le
				résultat d’un contrôle du prestataire de paiement ne constitue pas, à lui seul, notre décision
				d’accepter le contrat.
			</p>

			<h2>10. Mises à jour</h2>
			<p>
				Nous actualisons cette politique lorsque les traitements ou les services changent. Une modification du
				document ne remplace pas un nouveau consentement lorsqu’il est nécessaire.
			</p>
		</>
	);
}

export function Es({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Al comprar o utilizar esta web nos facilitas datos personales. Aquí explicamos qué datos tratamos,
				para qué los necesitamos, con quién los compartimos y cómo ejercer tus derechos.
			</p>

			<h2>1. Responsable del tratamiento</h2>
			<p>
				El responsable es <strong>{companyInfo.legalName}</strong>, {companyInfo.street}, {companyInfo.city},{" "}
				{SLOVAKIA_ES}, número de identificación de empresa (IČO) <strong>{companyInfo.ico}</strong>.
			</p>
			<p>
				Para cuestiones de protección de datos escribe a <Mail /> o a nuestro domicilio social.
			</p>

			<h2>2. Datos, fines y bases jurídicas</h2>

			<h3>Pedidos, entrega y atención al cliente</h3>
			<p>
				Tratamos el nombre, los datos de contacto, las direcciones de facturación y entrega, los productos
				comprados, la información sobre el pedido y el pago y la correspondencia relacionada. En compras
				empresariales también tratamos los datos de empresa facilitados. Para consultar la compatibilidad de
				un accesorio puedes enviarnos datos del vehículo o fotografías.
			</p>
			<p>
				Utilizamos estos datos para preparar y ejecutar el contrato: tramitar el pedido, el pago, la entrega y
				las consultas. La base es la{" "}
				<strong>
					ejecución del contrato o las medidas precontractuales solicitadas — artículo 6.1.b del RGPD
				</strong>
				. Para relacionarnos con la persona que representa a un cliente empresarial puede ser aplicable el
				interés legítimo en gestionar esa relación, conforme al <strong>artículo 6.1.f</strong>.
			</p>
			<p>
				Stripe procesa el pago. No almacenamos el número completo de la tarjeta ni su código de seguridad y no
				tenemos acceso a ellos. Recibimos los datos necesarios para identificar, comprobar o reembolsar una
				operación.
			</p>

			<h3>Contabilidad y obligaciones legales</h3>
			<p>
				Utilizamos los datos de identificación, del pedido y del pago para llevar la contabilidad, cumplir las
				obligaciones tributarias y atender a las autoridades competentes. La base es el{" "}
				<strong>cumplimiento de obligaciones legales — artículo 6.1.c del RGPD</strong>.
			</p>

			<h3>Reclamaciones, desistimiento y ejercicio de derechos</h3>
			<p>
				Tratamos los datos de contacto, de la compra y del producto, el contenido de la comunicación, las
				pruebas necesarias y las actuaciones realizadas. En lo necesario para documentar el asunto conservamos
				también la información sobre la presentación de la comunicación y su confirmación.
			</p>
			<p>
				La base es el cumplimiento de obligaciones legales, la gestión del contrato y, cuando corresponda, el
				interés legítimo en formular, ejercer o defender reclamaciones, conforme a los{" "}
				<strong>artículos 6.1.c, 6.1.b y 6.1.f del RGPD</strong>. Tramitar una reclamación o un desistimiento
				no depende de que aceptes publicidad ni exige un consentimiento adicional para utilizar los datos
				necesarios.
			</p>

			<h3>Cuenta de cliente</h3>
			<p>
				Si creas una cuenta, tratamos los datos necesarios para administrarla, permitir el acceso y mostrar
				tus pedidos. La base es la prestación del servicio solicitado, conforme al{" "}
				<strong>artículo 6.1.b del RGPD</strong>. La cuenta no es un requisito para comprar o desistir.
			</p>

			<h3>Boletín y comunicaciones comerciales</h3>
			<p>
				Si te suscribes al boletín, utilizamos tu correo y la información sobre tu consentimiento para
				enviarte las comunicaciones solicitadas. La base es el{" "}
				<strong>consentimiento — artículo 6.1.a del RGPD</strong>. Es voluntario y puedes retirarlo mediante
				el enlace de baja del mensaje o escribiendo a <Mail />.
			</p>

			<h3>Seguridad y protección de derechos</h3>
			<p>
				Tratamos, en la medida necesaria, registros técnicos de acceso y errores, información para prevenir
				abusos o fraude y documentos para proteger nuestros derechos. La base es el{" "}
				<strong>interés legítimo — artículo 6.1.f del RGPD</strong> en la seguridad y la defensa de
				reclamaciones, teniendo en cuenta la proporcionalidad y tu privacidad.
			</p>
			<p>
				Esa base no es una autorización general para el seguimiento publicitario. La analítica opcional, la
				publicidad y las tecnologías del navegador se explican en{" "}
				<Link href={marketHref(channel, "/cookies")}>Cookies y privacidad</Link>.
			</p>

			<h2>3. Origen de los datos y datos necesarios</h2>
			<p>
				Recibimos los datos principalmente de ti, al comprar, crear una cuenta, utilizar un formulario o
				escribirnos. El proveedor de pagos informa del resultado de la operación y el transportista puede
				comunicar el estado de la entrega. Los datos técnicos se generan al utilizar la web.
			</p>
			<p>
				Los datos marcados como necesarios responden al fin de cada trámite. Por ejemplo, necesitamos una
				dirección para entregar un pedido. No tienes que facilitar datos opcionales ni consentir publicidad
				para utilizar nuestros servicios principales.
			</p>

			<h2>4. Destinatarios y servicios utilizados</h2>
			<p>
				No todos los proveedores reciben datos en todas las visitas o pedidos. Depende de los servicios que
				utilices y de lo necesario para cada operación.
			</p>
			<p>
				El transportista elegido, <strong>FedEx o Slovenská pošta</strong>, recibe los datos necesarios para
				el envío y el contacto con el destinatario. <strong>Stripe</strong> procesa el pago. También pueden
				acceder a los datos, cuando sea necesario, proveedores técnicos, de correo electrónico, contabilidad o
				asesoramiento jurídico. Comunicamos datos a las autoridades cuando lo exige la ley.
			</p>
			<p>
				Los proveedores actúan como encargados del tratamiento o como responsables independientes según el
				servicio y su función. La siguiente tabla identifica sistemas, servicios y finalidades, no una lista
				de entidades jurídicas diferentes para cada programa que usamos.
			</p>
			<RecipientsTable lang="es" />
			<p>
				Nuestras propias instalaciones de Saleor y Payload no son terceros independientes solo por tener un
				nombre. Puedes pedir información sobre los destinatarios concretos y su función en <Mail />.
			</p>

			<h2>5. Transferencias fuera del Espacio Económico Europeo</h2>
			<p>
				Algunos proveedores pueden tratar datos fuera del Espacio Económico Europeo o permitir su acceso desde
				otros países. El mecanismo aplicable depende del destinatario, del servicio y del destino real.
			</p>
			<p>
				Cuando existe una transferencia, aplicamos las condiciones del capítulo V del RGPD: por ejemplo, una
				decisión de adecuación aplicable al destinatario o garantías adecuadas como las cláusulas
				contractuales tipo, con las medidas adicionales que correspondan. No afirmamos que todos los servicios
				o destinatarios estén cubiertos por el mismo mecanismo.
			</p>
			<p>
				Para conocer las garantías de una transferencia concreta o solicitar información sobre cómo obtener
				una copia, escribe a <Mail />.
			</p>

			<h2>6. Conservación de los datos</h2>
			<p>
				Conservamos los datos durante el tiempo necesario para su finalidad y las obligaciones aplicables, no
				todos durante un único plazo.
			</p>
			<p>
				Los pedidos se conservan durante su gestión y, posteriormente, según las obligaciones legales y los
				plazos relevantes para reclamaciones. Los documentos contables sujetos a la normativa eslovaca se
				conservan, por regla general,{" "}
				<strong>diez años desde el final del ejercicio al que corresponden</strong>; esto no significa que
				todos los datos de navegación se guarden diez años.
			</p>
			<p>
				Los expedientes de reclamación o desistimiento se conservan para tramitar y acreditar el asunto
				durante los plazos aplicables. Los datos de cuenta se mantienen mientras se presta ese servicio y,
				después, solo en la medida necesaria para otras obligaciones o derechos.
			</p>
			<p>
				Para el boletín, conservamos los datos hasta la retirada del consentimiento o el cese de la finalidad,
				sin perjuicio de la información mínima necesaria para acreditar el consentimiento o respetar la baja.
				Los registros técnicos tienen una conservación proporcionada a la seguridad y al diagnóstico. Las
				duraciones del almacenamiento en el navegador se indican en la página de cookies.
			</p>

			<h2>7. Tus derechos</h2>
			<p>
				En las condiciones del RGPD, puedes solicitar acceso, rectificación, supresión o limitación del
				tratamiento. Puedes obtener la portabilidad cuando el tratamiento automatizado se base en
				consentimiento o contrato y se cumplan sus requisitos.
			</p>
			<p>
				Puedes oponerte, por tu situación particular, a tratamientos basados en interés legítimo.{" "}
				<strong>Para el marketing directo, puedes oponerte en cualquier momento</strong>, incluido el
				perfilado relacionado. Dejaremos de tratar los datos para ese fin.
			</p>
			<p>
				Puedes retirar el consentimiento en cualquier momento sin afectar a la licitud del tratamiento
				anterior. Retirarlo no exige cancelar una compra ni renunciar a una reclamación. Algunos datos pueden
				seguir siendo necesarios por obligaciones legales u otra base válida.
			</p>
			<p>
				Escribe a <Mail />. Respondemos normalmente en <strong>un mes</strong>. Si la complejidad o el número
				de solicitudes lo requiere, el plazo puede ampliarse hasta dos meses adicionales; te informaremos
				dentro del primer mes y explicaremos el motivo. Si existen dudas razonables sobre tu identidad,
				podemos pedir la información proporcionada y necesaria para comprobarla, no documentación excesiva por
				sistema.
			</p>

			<h2>8. Autoridades de protección de datos</h2>
			<p>
				Puedes reclamar ante una autoridad de control, en particular la de tu residencia habitual, trabajo o
				lugar de la posible infracción. En España puedes acudir a la{" "}
				<strong>Agencia Española de Protección de Datos — AEPD</strong>, a través de su{" "}
				<a href="https://www.aepd.es/" rel="noopener noreferrer" target="_blank">
					sitio oficial
				</a>
				.
			</p>
			<p>
				Por nuestro establecimiento en Eslovaquia también puedes acudir al{" "}
				<strong>Úrad na ochranu osobných údajov Slovenskej republiky</strong>, según las reglas de
				competencia. No tienes que limitarte a una autoridad únicamente porque el vendedor esté en otro Estado
				de la UE.
			</p>
			<DpaAuthority country={SLOVAKIA_ES} lang="es" />

			<h2>9. Decisiones automatizadas</h2>
			<p>
				No utilizamos, para decidir por nuestra cuenta sobre tus pedidos, reclamaciones o desistimientos,
				decisiones basadas únicamente en tratamiento automatizado que produzcan efectos jurídicos o te afecten
				de modo similar y significativo.
			</p>
			<p>
				Stripe realiza sus propios controles de prevención del fraude en la gestión de pagos. Esa actividad
				del proveedor es distinta de nuestra tramitación del pedido. Si una operación no se completa, contacta
				con <Mail /> para que revisemos la situación y busquemos una solución.
			</p>

			<h2>10. Cambios en esta información</h2>
			<p>
				Actualizamos esta política cuando cambian los tratamientos o servicios. Una modificación del documento
				no sustituye un consentimiento nuevo cuando sea necesario. Puedes escribirnos para aclarar el
				tratamiento relacionado con tu compra.
			</p>
		</>
	);
}

export function Ro({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Când cumperi sau folosești site-ul, ne încredințezi date personale. Aici explicăm ce date folosim, de
				ce avem nevoie de ele, cui le transmitem și cum îți poți exercita drepturile.
			</p>

			<h2>1. Operatorul de date</h2>
			<p>
				Operatorul este <strong>{companyInfo.legalName}</strong>, {companyInfo.street}, {companyInfo.city},{" "}
				{SLOVAKIA_RO}, număr de identificare a societății (IČO) <strong>{companyInfo.ico}</strong>.
			</p>
			<p>
				Pentru întrebări privind datele personale, scrie la <Mail /> sau la sediul social.
			</p>

			<h2>2. Datele, scopurile și temeiurile prelucrării</h2>

			<h3>Comenzi, livrare și asistență</h3>
			<p>
				Folosim numele, datele de contact, adresele de facturare și livrare, produsele comandate, informațiile
				despre comandă și plată și corespondența aferentă. La cumpărături pentru firme folosim și datele de
				firmă furnizate. În întrebările despre compatibilitatea accesoriilor ne poți trimite date despre
				mașină sau fotografii.
			</p>
			<p>
				Datele sunt necesare pregătirii și executării contractului: comandă, plată, livrare și răspunsuri la
				solicitări. Temeiul este{" "}
				<strong>
					executarea contractului sau demersurile precontractuale solicitate — articolul 6 alineatul (1)
					litera (b) din RGPD
				</strong>
				. Pentru relația cu reprezentantul unui client comercial poate fi aplicabil interesul legitim de a
				gestiona relația, conform <strong>articolului 6 alineatul (1) litera (f)</strong>.
			</p>
			<p>
				Plata este procesată de Stripe. Nu stocăm numărul complet al cardului ori codul său de securitate și
				nu avem acces la ele. Primim informațiile necesare identificării, verificării sau restituirii plății.
			</p>

			<h3>Contabilitate și obligații legale</h3>
			<p>
				Datele de identificare, comandă și plată sunt folosite pentru contabilitate, obligații fiscale și
				comunicarea obligatorie cu autoritățile. Temeiul este{" "}
				<strong>obligația legală — articolul 6 alineatul (1) litera (c) din RGPD</strong>.
			</p>

			<h3>Reclamații, retrageri și exercitarea drepturilor</h3>
			<p>
				Prelucrăm datele de contact, cumpărătură și produs, conținutul sesizării, dovezile necesare și etapele
				soluționării. În măsura necesară documentării, păstrăm și informații despre transmiterea sesizării și
				confirmarea ei.
			</p>
			<p>
				Temeiurile sunt îndeplinirea obligațiilor legale, gestionarea contractului și, după caz, interesul
				legitim de a constata, exercita ori apăra un drept, conform{" "}
				<strong>articolului 6 alineatul (1) literele (c), (b) și (f)</strong>. Reclamația sau retragerea nu
				depinde de acordul pentru marketing și nu cere un consimțământ suplimentar pentru datele necesare
				soluționării.
			</p>

			<h3>Contul de client</h3>
			<p>
				Dacă îți creezi un cont, folosim datele necesare administrării, autentificării și afișării comenzilor.
				Temeiul este furnizarea serviciului solicitat, potrivit{" "}
				<strong>articolului 6 alineatul (1) litera (b)</strong>. Contul nu este obligatoriu pentru cumpărare
				sau retragere.
			</p>

			<h3>Newsletter și comunicări comerciale</h3>
			<p>
				Dacă te abonezi, utilizăm adresa de e-mail și informațiile despre consimțământ pentru mesajele
				solicitate. Temeiul este <strong>consimțământul — articolul 6 alineatul (1) litera (a)</strong>. Este
				opțional și îl poți retrage prin linkul de dezabonare din mesaj sau la <Mail />.
			</p>

			<h3>Securitate și apărarea drepturilor</h3>
			<p>
				În măsura necesară folosim jurnale tehnice de acces și erori, informații pentru prevenirea abuzului
				ori fraudei și documente necesare apărării drepturilor. Temeiul este{" "}
				<strong>interesul legitim — articolul 6 alineatul (1) litera (f)</strong> privind securitatea și
				apărarea pretențiilor, ținând cont de proporționalitate și de viața privată.
			</p>
			<p>
				Acest temei nu este o permisiune generală pentru urmărire publicitară. Analiza opțională, marketingul
				și tehnologiile browserului sunt explicate în{" "}
				<Link href={marketHref(channel, "/cookies")}>Cookie-uri și confidențialitate</Link>.
			</p>

			<h2>3. De unde provin datele și care sunt necesare</h2>
			<p>
				Datele provin în principal de la tine: cumpărături, cont, formulare sau corespondență. Furnizorul de
				plăți comunică rezultatul operațiunii, iar transportatorul poate comunica starea livrării. Datele
				tehnice apar în timpul folosirii site-ului.
			</p>
			<p>
				Câmpurile obligatorii corespund scopului procedurii. De exemplu, fără o adresă nu putem livra coletul.
				Nu trebuie să completezi câmpurile opționale sau să accepți publicitatea pentru serviciile de bază.
			</p>

			<h2>4. Destinatarii și serviciile utilizate</h2>
			<p>
				Nu toți furnizorii primesc automat date la fiecare vizită sau comandă. Depinde de serviciile folosite
				și de ceea ce este necesar pentru operațiunea respectivă.
			</p>
			<p>
				Transportatorul ales, <strong>FedEx sau Slovenská pošta</strong>, primește datele necesare livrării și
				contactării destinatarului. <strong>Stripe</strong> procesează plata. În măsura necesară pot avea
				acces furnizori tehnici, de e-mail, contabilitate sau asistență juridică. Transmitem date
				autorităților când legea o impune.
			</p>
			<p>
				În funcție de serviciu, destinatarii sunt persoane împuternicite de noi sau operatori independenți.
				Tabelul identifică sisteme, servicii și scopuri; numele unui program nu înseamnă că există automat o
				entitate juridică externă cu acel nume.
			</p>
			<RecipientsTable lang="ro" />
			<p>
				Instalările proprii Saleor și Payload nu sunt operatori externi independenți doar pentru că au
				denumiri separate. Poți cere informații despre destinatarii concreți și rolul lor la <Mail />.
			</p>

			<h2>5. Transferuri în afara Spațiului Economic European</h2>
			<p>
				Unii furnizori pot prelucra date în afara Spațiului Economic European sau permite accesul din alte
				țări. Mecanismul aplicabil depinde de destinatar, serviciu și destinația reală.
			</p>
			<p>
				Pentru transferuri respectăm capitolul V din RGPD: de exemplu, o decizie de adecvare aplicabilă
				destinatarului sau garanții adecvate, cum sunt clauzele contractuale standard, împreună cu măsurile
				suplimentare necesare. Nu susținem că toate serviciile sau toate entitățile sunt acoperite de același
				mecanism.
			</p>
			<p>
				Pentru informații despre garanțiile unui transfer concret și despre obținerea unei copii, scrie la{" "}
				<Mail />.
			</p>

			<h2>6. Cât timp păstrăm datele</h2>
			<p>
				Păstrăm datele atât cât este necesar scopului și obligațiilor aplicabile, nu toate pentru o singură
				perioadă.
			</p>
			<p>
				Datele comenzilor sunt păstrate pentru gestionarea lor și apoi potrivit obligațiilor legale și
				termenelor relevante pentru eventuale pretenții. Documentele contabile supuse legislației slovace se
				păstrează, de regulă, <strong>zece ani de la sfârșitul exercițiului la care se referă</strong>.
				Aceasta nu înseamnă că păstrăm toate datele de navigare zece ani.
			</p>
			<p>
				Datele reclamațiilor și retragerilor sunt păstrate pentru soluționare și dovadă, în limitele
				termenelor aplicabile. Datele contului sunt păstrate pe durata serviciului și, ulterior, numai în
				măsura în care există alte obligații sau drepturi care justifică păstrarea.
			</p>
			<p>
				Datele newsletterului sunt păstrate până la retragerea consimțământului ori încetarea scopului, fără a
				exclude dovada minimă necesară a consimțământului sau a dezabonării. Jurnalele tehnice au o durată
				proporțională cu securitatea și diagnosticarea. Perioadele de stocare în browser sunt descrise în
				pagina de cookie-uri.
			</p>

			<h2>7. Drepturile tale</h2>
			<p>
				În condițiile RGPD poți solicita acces, rectificare, ștergere sau restricționarea prelucrării. Poți
				beneficia de portabilitate dacă prelucrarea automatizată se bazează pe consimțământ sau contract și
				sunt îndeplinite condițiile legale.
			</p>
			<p>
				Te poți opune, din motive legate de situația ta particulară, prelucrărilor bazate pe interes legitim.{" "}
				<strong>Te poți opune în orice moment marketingului direct</strong>, inclusiv profilării legate de
				acesta; vom înceta folosirea datelor în acel scop.
			</p>
			<p>
				Poți retrage consimțământul oricând, fără să afectezi legalitatea prelucrării anterioare. Nu trebuie
				să anulezi o cumpărătură sau să renunți la o reclamație pentru aceasta. Unele date pot rămâne necesare
				unei obligații legale ori altui temei valabil.
			</p>
			<p>
				Trimite solicitarea la <Mail />. Răspundem, de regulă, în <strong>o lună</strong>. Complexitatea sau
				numărul solicitărilor poate justifica o prelungire cu până la două luni suplimentare; te informăm în
				prima lună și explicăm motivul. Dacă avem îndoieli rezonabile privind identitatea, cerem doar
				informațiile proporționale și necesare verificării, nu documente excesive în mod automat.
			</p>

			<h2>8. Autoritățile de protecție a datelor</h2>
			<p>
				Poți depune o plângere la o autoritate de supraveghere, în special în țara reședinței obișnuite, a
				locului de muncă sau a presupusei încălcări. În România te poți adresa{" "}
				<strong>
					Autorității Naționale de Supraveghere a Prelucrării Datelor cu Caracter Personal — ANSPDCP
				</strong>
				, prin{" "}
				<a
					href="https://www.dataprotection.ro/?page=contact&lang=ro"
					rel="noopener noreferrer"
					target="_blank"
				>
					datele sale oficiale de contact
				</a>
				.
			</p>
			<p>
				Având în vedere sediul nostru în Slovacia, poate fi competent și{" "}
				<strong>Úrad na ochranu osobných údajov Slovenskej republiky</strong>, potrivit regulilor aplicabile.
				Nu ești obligat să alegi numai o autoritate pentru că vânzătorul este stabilit în alt stat UE.
			</p>
			<DpaAuthority country={SLOVAKIA_RO} lang="ro" />

			<h2>9. Decizii automatizate</h2>
			<p>
				Nu luăm, în nume propriu, decizii bazate exclusiv pe prelucrare automatizată care să producă efecte
				juridice ori efecte similare semnificative asupra ta în gestionarea comenzilor, reclamațiilor sau
				retragerilor.
			</p>
			<p>
				Stripe face propriile verificări de prevenire a fraudei în procesarea plăților. Această activitate
				este distinctă de gestionarea comenzii de către noi. Dacă plata nu se finalizează, scrie la <Mail />;
				verificăm situația și căutăm o soluție.
			</p>

			<h2>10. Actualizarea politicii</h2>
			<p>
				Actualizăm informația când se schimbă prelucrările sau serviciile. Modificarea acestui document nu
				înlocuiește un consimțământ nou atunci când el este necesar. Ne poți contacta pentru clarificări
				privind datele aferente cumpărăturii tale.
			</p>
		</>
	);
}
