import Link from "next/link";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { PrivacySettingsLink } from "@/ui/components/privacy-settings-link";
import { AUSTRIA, GERMANY, SLOVAKIA_DE, type GermanMarket } from "./german-market";
import { SLOVAKIA_FR, SLOVAKIA_HU, SLOVAKIA_IT, SLOVAKIA_PL } from "./slovakia";

const Mail = () => <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;

const SETTINGS_BUTTON_CLASS =
	"cursor-pointer font-semibold text-forest-700 underline underline-offset-2 transition-colors hover:text-forest-800";

/**
 * The storage inventory.
 *
 * Read off the code that actually writes each entry: `maky-market` from `src/proxy.ts`,
 * `checkoutId-<channel>` from `saveIdToCookie()` (no `maxAge`, so genuinely a session
 * cookie), the Saleor auth pair from `src/lib/auth/constants.ts`, and `maky-consent`
 * from `CookieConsent`, which is localStorage rather than a cookie and is listed as such
 * because the consent rules follow the purpose, not the storage technology.
 *
 * Purposes are per language; names, kinds and lifetimes are not translated because they
 * are what the reader will literally see in their browser's storage inspector.
 */
const NECESSARY = [
	{
		name: "maky-market",
		life: { sk: "1 rok", cs: "1 rok", de: "1 Jahr", pl: "1 rok", hu: "1 év", it: "1 anno", fr: "1 an" },
		kind: { sk: "Cookie", cs: "Cookie", de: "Cookie", pl: "Cookie", hu: "Süti", it: "Cookie", fr: "Cookie" },
		purpose: {
			sk: "Pamätá si jazykovú a trhovú verziu obchodu, ktorú ste otvorili.",
			cs: "Pamatuje si jazykovou a tržní verzi obchodu, kterou jste otevřeli.",
			de: "Merkt sich die Sprach- und Marktversion des Shops, die Sie geöffnet haben.",
			pl: "Zapamiętuje otwartą wersję językową i rynkową sklepu.",
			hu: "Megjegyzi a megnyitott nyelvi és piaci változatot.",
			it: "Ricorda il mercato e la lingua del negozio che hai aperto.",
			fr: "Mémorise le marché et la langue de la boutique que vous avez ouverte.",
		},
	},
	{
		name: "checkoutId-<kanál>",
		life: {
			sk: "Do zatvorenia prehliadača",
			cs: "Do zavření prohlížeče",
			de: "Bis zum Schließen des Browsers",
			pl: "Do zamknięcia przeglądarki",
			hu: "A böngésző bezárásáig",
			it: "Sessione del browser; il ripristino di una sessione dipende dal browser",
			fr: "Session du navigateur ; sa restauration dépend du navigateur",
		},
		kind: { sk: "Cookie", cs: "Cookie", de: "Cookie", pl: "Cookie", hu: "Süti", it: "Cookie", fr: "Cookie" },
		purpose: {
			sk: "Spája váš prehliadač s obsahom košíka a s rozpracovanou objednávkou.",
			cs: "Spojuje váš prohlížeč s obsahem košíku a s rozpracovanou objednávkou.",
			de: "Verbindet Ihren Browser mit dem Inhalt des Warenkorbs und einer laufenden Bestellung.",
			pl: "Łączy przeglądarkę z zawartością koszyka i rozpoczętym zamówieniem.",
			hu: "Összekapcsolja a böngészőt a kosár tartalmával és a megkezdett rendeléssel.",
			it: "Associa il carrello alla sessione di acquisto nel canale.",
			fr: "Associe le panier à la session d’achat du canal.",
		},
	},
	{
		name: "saleor_auth_access_token / refresh_token",
		life: {
			sk: "Prístupový 15 minút, obnovovací 7 dní",
			cs: "Přístupový 15 minut, obnovovací 7 dní",
			de: "Zugriff 15 Minuten, Erneuerung 7 Tage",
			pl: "Token dostępu 15 minut, token odświeżający 7 dni",
			hu: "Hozzáférési token 15 perc, megújító token 7 nap",
			it: "Token di accesso: 15 minuti; token di rinnovo: 7 giorni",
			fr: "Jeton d’accès : 15 minutes ; jeton de renouvellement : 7 jours",
		},
		kind: { sk: "Cookie", cs: "Cookie", de: "Cookie", pl: "Cookie", hu: "Süti", it: "Cookie", fr: "Cookie" },
		purpose: {
			sk: "Udržiavajú vaše prihlásenie. Ukladajú sa až po prihlásení do účtu.",
			cs: "Udržují vaše přihlášení. Ukládají se až po přihlášení k účtu.",
			de: "Halten Ihre Anmeldung aufrecht. Sie werden erst nach der Anmeldung gesetzt.",
			pl: "Utrzymują zalogowanie. Są ustawiane dopiero po zalogowaniu do konta.",
			hu: "Fenntartják a bejelentkezést. Csak a fiókba való belépés után jönnek létre.",
			it: "Mantengono l’accesso. Vengono impostati solo dopo l’accesso all’account.",
			fr: "Maintiennent votre connexion. Ils sont posés seulement après la connexion au compte.",
		},
	},
	{
		name: "maky-consent",
		life: {
			sk: "Do vymazania údajov webu v prehliadači",
			cs: "Do vymazání údajů webu v prohlížeči",
			de: "Bis zum Löschen der Website-Daten im Browser",
			pl: "Do usunięcia danych strony w przeglądarce",
			hu: "A webhely adatainak böngészőből való törléséig",
			it: "Fino alla cancellazione dei dati del browser o alla sostituzione della scelta",
			fr: "Jusqu’à la suppression des données du navigateur ou au remplacement du choix",
		},
		kind: {
			sk: "Miestne úložisko (localStorage)",
			cs: "Místní úložiště (localStorage)",
			de: "Lokaler Speicher (localStorage)",
			pl: "Pamięć lokalna (localStorage)",
			hu: "Helyi tároló (localStorage)",
			it: "Memoria locale (localStorage)",
			fr: "Stockage local (localStorage)",
		},
		purpose: {
			sk: "Uchováva vašu voľbu súkromia, aby sme sa nepýtali pri každej návšteve.",
			cs: "Uchovává vaši volbu soukromí, abychom se neptali při každé návštěvě.",
			de: "Bewahrt Ihre Datenschutzauswahl, damit wir nicht bei jedem Besuch erneut fragen.",
			pl: "Zachowuje Państwa wybór dotyczący prywatności, aby nie pytać przy każdej wizycie.",
			hu: "Megőrzi az adatvédelmi választását, hogy ne kelljen minden látogatáskor rákérdeznünk.",
			it: "Conserva la tua scelta sulla privacy, per non chiedertela a ogni visita.",
			fr: "Conserve votre choix de confidentialité, pour ne pas le redemander à chaque visite.",
		},
	},
] as const;

const TABLE_HEADS = {
	sk: ["Názov", "Typ", "Účel", "Platnosť"],
	cs: ["Název", "Typ", "Účel", "Platnost"],
	de: ["Name", "Art", "Zweck", "Speicherdauer"],
	pl: ["Nazwa", "Rodzaj", "Cel", "Okres"],
	hu: ["Név", "Típus", "Cél", "Időtartam"],
	it: ["Nome", "Tipo", "Finalità", "Durata prevista"],
	fr: ["Nom", "Type", "Finalité", "Durée prévue"],
} as const;

function InventoryTable({ lang }: { lang: "sk" | "cs" | "de" | "pl" | "hu" | "it" | "fr" }) {
	return (
		<div className="overflow-x-auto">
			<table>
				<thead>
					<tr>
						{TABLE_HEADS[lang].map((h) => (
							<th key={h}>{h}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{NECESSARY.map((row) => (
						<tr key={row.name}>
							<td>{row.name}</td>
							<td>{row.kind[lang]}</td>
							<td>{row.purpose[lang]}</td>
							<td>{row.life[lang]}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function Sk({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Cookies a podobné technológie používame na fungovanie e-shopu a podľa vašej voľby aj na ďalšie účely.
				Voliteľné analytické a marketingové technológie môžete odmietnuť a naďalej nakupovať.
			</p>

			<h2>Čo sú cookies a podobné technológie</h2>
			<p>
				Cookies sú malé údaje, ktoré si web ukladá vo vašom prehliadači. Pomáhajú napríklad udržať obsah
				košíka alebo prihlásenie. Niektoré sa vymažú po ukončení návštevy, iné zostávajú do skončenia
				nastavenej platnosti.
			</p>
			<p>
				Web môže využívať aj miestne úložisko prehliadača, napríklad <strong>localStorage</strong>, alebo iné
				obdobné technológie. Pri pravidlách súhlasu nerozhoduje iba ich názov, ale skutočný účel. Tieto zásady
				sa preto netýkajú len súborov označovaných ako cookies.
			</p>

			<h2>Nevyhnutné funkcie</h2>
			<p>
				Technológie bezpodmienečne potrebné na službu, ktorú si výslovne vyžiadate, používame bez osobitného
				súhlasu. Môže ísť napríklad o košík, prihlásenie, uskutočnenie platby alebo uloženie vašej voľby
				súkromia.
			</p>
			<p>
				Rozsah obmedzujeme na to, čo je pre danú funkciu skutočne potrebné. Za nevyhnutné automaticky
				nepovažujeme každé meranie ani všetky nástroje toho istého dodávateľa.
			</p>

			<h2>Analytika a marketing</h2>
			<p>
				<strong>Voliteľná analytika</strong> slúži na vyhodnocovanie návštevnosti a používania obchodu.{" "}
				<strong>Marketingové technológie</strong> môžu slúžiť na meranie reklamy, vytváranie reklamných publík
				alebo prispôsobenie reklám.
			</p>
			<p>
				Na tieto účely používame službu <strong>Google Tag Manager</strong> spolu s meracími nástrojmi
				spoločnosti Google. Kým nedáte súhlas, sú ukladanie a čítanie údajov v prehliadači na analytické a
				reklamné účely <strong>vypnuté</strong> — web posiela službe Google výslovný pokyn „denied“ ešte
				predtým, než sa akékoľvek meranie spustí. Súhlasom sa tento pokyn zmení na „granted“; odvolaním sa
				vráti späť.
			</p>
			<p>
				Samotné pokračovanie v prehliadaní, zatvorenie lišty alebo nákup sa nepovažujú za súhlas. Voliteľné
				kategórie nie sú vopred zaškrtnuté.
			</p>
			<p>
				Na meranie návštevnosti používame aj <strong>Cloudflare Web Analytics</strong>. Táto služba{" "}
				<strong>neukladá cookies</strong>, nevytvára identifikátor návštevníka ani neprepája údaje naprieč
				webmi, preto beží aj bez súhlasu. Vyhodnocuje iba súhrnnú návštevnosť stránok.
			</p>
			<p>
				Použitie technológie, ktorá neukladá cookies, ešte samo osebe neznamená, že nespracúva osobné údaje.
				Účely, právne základy a poskytovatelia prípadných ďalších technických služieb sú uvedení aj v{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Ochrane osobných údajov</Link>.
			</p>

			<h2>Čo si môžete vybrať</h2>
			<p>
				V nastaveniach súkromia môžete <strong>prijať všetky voliteľné účely</strong>,{" "}
				<strong>odmietnuť všetky voliteľné účely</strong> alebo <strong>povoliť iba vybrané</strong>.
				Nevyhnutné funkcie zostávajú aktívne, pretože bez nich nemožno poskytnúť príslušnú vyžiadanú službu.
			</p>
			<p className="not-prose">
				<PrivacySettingsLink label="Otvoriť nastavenia súkromia" className={SETTINGS_BUTTON_CLASS} />
			</p>
			<p>
				Svoju voľbu môžete kedykoľvek zmeniť aj cez tlačidlo <strong>„Nastavenia súkromia“</strong> v pätičke.
				Odvolanie súhlasu sa uplatní na ďalšie používanie príslušných voliteľných technológií. Zastavíme ich
				ďalšie spúšťanie a odstránime príslušné voliteľné cookies, ktoré spravuje náš web, pokiaľ je to
				technicky možné. Odvolanie súhlasu samo osebe nevymaže všetky údaje, ktoré už spracoval samostatný
				poskytovateľ; na tie sa vzťahujú príslušné práva podľa GDPR.
			</p>
			<p>
				Nastavenie sa vzťahuje na daný prehliadač a zariadenie. Pri použití iného zariadenia alebo po vymazaní
				úložiska môže byť potrebné voľbu zopakovať. O novú voľbu požiadame aj vtedy, keď skončí platnosť
				uloženého súhlasu alebo sa podstatne zmenia účely vyžadujúce súhlas.
			</p>

			<h2>Prehľad používaných technológií</h2>
			<h3>Nevyhnutné — bez súhlasu</h3>
			<InventoryTable lang="sk" />
			<p>
				Všetky uvedené položky ukladá priamo náš web (maky.store). Pri platbe vás pokladňa odovzdá platobnej
				bráne Stripe, ktorá si pre spracovanie a bezpečnosť platby ukladá vlastné údaje podľa svojich zásad.
			</p>

			<h3>Voliteľné — až po vašom súhlase</h3>
			<p>
				Po udelení súhlasu s analytikou alebo marketingom môže Google Tag Manager spustiť meracie nástroje
				spoločnosti Google, ktoré si vo vašom prehliadači uložia vlastné cookies. Ich názvy a platnosť určuje
				Google podľa konkrétneho nastavenia merania; spravidla ide o cookies s platnosťou v mesiacoch až
				rokoch. Bez súhlasu sa neuložia. Aktuálny zoznam vám na požiadanie poskytneme na <Mail />.
			</p>

			<h2>Nastavenie v prehliadači</h2>
			<p>
				Cookies môžete vymazať alebo blokovať aj v prehliadači. Ak zablokujete aj nevyhnutné cookies, nemusí
				správne fungovať košík, prihlásenie alebo platba. Odmietnutie voliteľnej analytiky a marketingu v
				našej lište však nákup neblokuje.
			</p>
			<p>
				Vymazanie cookies nemusí zároveň vymazať iné miestne úložiská. Tie sa spravujú v nastaveniach údajov
				webu príslušného prehliadača.
			</p>

			<h2>Kontakt a ďalšie informácie</h2>
			<p>
				Prevádzkovateľom webu je <strong>{companyInfo.legalName}</strong>, {companyInfo.street},{" "}
				{companyInfo.city}, IČO {companyInfo.ico}. Otázky nám môžete poslať na <Mail />.
			</p>
			<p>
				Informácie o právach, príjemcoch údajov a kontaktnom mieste dozorného úradu nájdete na stránke{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Ochrana osobných údajov</Link>.
			</p>
		</>
	);
}

export function Cs({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Cookies a podobné technologie používáme pro fungování e-shopu a podle vaší volby i pro další účely.
				Volitelné analytické a marketingové technologie můžete odmítnout a nadále nakupovat.
			</p>

			<h2>Co jsou cookies a podobné technologie</h2>
			<p>
				Cookies jsou malé údaje, které si web ukládá do vašeho prohlížeče. Pomáhají například zachovat obsah
				košíku nebo přihlášení. Některé se vymažou po ukončení návštěvy, jiné zůstávají do konce nastavené
				platnosti.
			</p>
			<p>
				Web může využívat také místní úložiště prohlížeče, například <strong>localStorage</strong>, nebo jiné
				obdobné technologie. U pravidel souhlasu nerozhoduje pouze jejich název, ale skutečný účel. Tyto
				zásady se proto netýkají jen souborů označovaných jako cookies.
			</p>

			<h2>Nezbytné funkce</h2>
			<p>
				Technologie bezpodmínečně potřebné pro službu, kterou si výslovně vyžádáte, používáme bez zvláštního
				souhlasu. Může jít například o košík, přihlášení, provedení platby nebo uložení vaší volby soukromí.
			</p>
			<p>
				Rozsah omezujeme na to, co je pro danou funkci skutečně potřebné. Za nezbytné automaticky nepovažujeme
				každé měření ani všechny nástroje stejného dodavatele.
			</p>

			<h2>Analytika a marketing</h2>
			<p>
				<strong>Volitelná analytika</strong> slouží k vyhodnocování návštěvnosti a používání obchodu.{" "}
				<strong>Marketingové technologie</strong> mohou sloužit k měření reklamy, vytváření reklamních publik
				nebo přizpůsobování reklam.
			</p>
			<p>
				K těmto účelům používáme službu <strong>Google Tag Manager</strong> spolu s měřicími nástroji
				společnosti Google. Dokud nedáte souhlas, jsou ukládání a čtení údajů v prohlížeči pro analytické a
				reklamní účely <strong>vypnuté</strong> — web posílá službě Google výslovný pokyn „denied“ ještě
				předtím, než se jakékoli měření spustí. Souhlasem se tento pokyn změní na „granted“; odvoláním se
				vrátí zpět.
			</p>
			<p>
				Samotné pokračování v prohlížení, zavření lišty nebo nákup se nepovažují za souhlas. Volitelné
				kategorie nejsou předem zaškrtnuté.
			</p>
			<p>
				K měření návštěvnosti používáme také <strong>Cloudflare Web Analytics</strong>. Tato služba{" "}
				<strong>neukládá cookies</strong>, nevytváří identifikátor návštěvníka ani nepropojuje údaje napříč
				weby, proto běží i bez souhlasu. Vyhodnocuje pouze souhrnnou návštěvnost stránek.
			</p>
			<p>
				Použití technologie, která neukládá cookies, ještě samo o sobě neznamená, že nezpracovává osobní
				údaje. Účely, právní základy a poskytovatelé případných dalších technických služeb jsou uvedeni také v{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Ochraně osobních údajů</Link>.
			</p>

			<h2>Co si můžete vybrat</h2>
			<p>
				V nastavení soukromí můžete <strong>přijmout všechny volitelné účely</strong>,{" "}
				<strong>odmítnout všechny volitelné účely</strong> nebo <strong>povolit pouze vybrané</strong>.
				Nezbytné funkce zůstávají aktivní, protože bez nich nelze poskytnout příslušnou vyžádanou službu.
			</p>
			<p className="not-prose">
				<PrivacySettingsLink label="Otevřít nastavení soukromí" className={SETTINGS_BUTTON_CLASS} />
			</p>
			<p>
				Svou volbu můžete kdykoli změnit také tlačítkem <strong>„Nastavení soukromí“</strong> v zápatí.
				Odvolání souhlasu se uplatní na další používání příslušných volitelných technologií. Zastavíme jejich
				další spouštění a odstraníme příslušné volitelné cookies, které spravuje náš web, pokud je to
				technicky možné. Odvolání souhlasu samo o sobě nevymaže všechny údaje, které už zpracoval samostatný
				poskytovatel; na ty se vztahují příslušná práva podle GDPR.
			</p>
			<p>
				Nastavení se vztahuje na daný prohlížeč a zařízení. Při použití jiného zařízení nebo po vymazání
				úložiště může být potřeba volbu zopakovat. O novou volbu požádáme také tehdy, když skončí platnost
				uloženého souhlasu nebo se podstatně změní účely vyžadující souhlas.
			</p>

			<h2>Přehled používaných technologií</h2>
			<h3>Nezbytné — bez souhlasu</h3>
			<InventoryTable lang="cs" />
			<p>
				Všechny uvedené položky ukládá přímo náš web (maky.store). Při platbě vás pokladna předá platební
				bráně Stripe, která si pro zpracování a bezpečnost platby ukládá vlastní údaje podle svých zásad.
			</p>

			<h3>Volitelné — až po vašem souhlasu</h3>
			<p>
				Po udělení souhlasu s analytikou nebo marketingem může Google Tag Manager spustit měřicí nástroje
				společnosti Google, které si ve vašem prohlížeči uloží vlastní cookies. Jejich názvy a platnost určuje
				Google podle konkrétního nastavení měření; zpravidla jde o cookies s platností v měsících až letech.
				Bez souhlasu se neuloží. Aktuální seznam vám na požádání poskytneme na <Mail />.
			</p>

			<h2>Nastavení v prohlížeči</h2>
			<p>
				Cookies můžete vymazat nebo blokovat také v prohlížeči. Pokud zablokujete i nezbytné cookies, nemusí
				správně fungovat košík, přihlášení nebo platba. Odmítnutí volitelné analytiky a marketingu v naší
				liště však nákup neblokuje.
			</p>
			<p>
				Vymazání cookies nemusí zároveň vymazat jiná místní úložiště. Ta se spravují v nastavení údajů webu
				příslušného prohlížeče.
			</p>

			<h2>Kontakt a další informace</h2>
			<p>
				Provozovatelem webu je <strong>{companyInfo.legalName}</strong>, {companyInfo.street},{" "}
				{companyInfo.city}, IČO {companyInfo.ico}. Dotazy nám můžete poslat na <Mail />.
			</p>
			<p>
				Informace o právech, příjemcích údajů a kontaktním místě dozorového úřadu najdete na stránce{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Ochrana osobních údajů</Link>.
			</p>
		</>
	);
}

/**
 * The German body, shared by both German-speaking markets.
 *
 * The ePrivacy statute is the one genuinely divergent fact on this page and comes from
 * `market.ePrivacyStatute`: § 25 TDDDG in Germany, § 165(3) TKG 2021 in Austria. They
 * are different laws in different acts — do not "harmonise" them.
 *
 * `COOKIE_SETTINGS_BUTTON` renders the real `PrivacySettingsLink`, which opens the
 * existing consent manager. The package was explicit that this must be the working
 * control and not a decorative link, since the page promises the reader can change their
 * mind here. `COOKIE_INVENTORY` renders `InventoryTable`, read off the code that
 * actually writes each entry rather than off a vendor template.
 */
function German({ channel, market }: { channel: string; market: GermanMarket }) {
	return (
		<>
			<p>
				Wir verwenden Cookies und ähnliche Technologien für den Betrieb des Onlineshops und — je nach Ihrer
				Entscheidung — für weitere Zwecke.{" "}
				<strong>
					Optionale Analyse- und Marketingtechnologien können Sie ablehnen und trotzdem einkaufen.
				</strong>
			</p>

			<h2>Was Cookies und ähnliche Technologien sind</h2>
			<p>
				Cookies sind kleine Datensätze, die eine Website in Ihrem Browser speichert. Sie können zum Beispiel
				den Warenkorb oder eine Anmeldung aufrechterhalten. Einige werden am Ende der Sitzung gelöscht, andere
				bleiben bis zum Ablauf ihrer festgelegten Speicherdauer bestehen.
			</p>
			<p>
				Eine Website kann auch den lokalen Browserspeicher, etwa <strong>localStorage</strong>, oder
				vergleichbare Technologien verwenden. Ob eine Einwilligung erforderlich ist, richtet sich nicht nur
				nach der technischen Bezeichnung, sondern nach dem tatsächlichen Zweck. Diese Hinweise gelten deshalb
				nicht ausschließlich für klassische Cookies.
			</p>

			<h2>Unbedingt erforderliche Funktionen</h2>
			<p>
				Technologien, die für einen von Ihnen ausdrücklich angeforderten Dienst unbedingt erforderlich sind,
				setzen wir ohne gesonderte Einwilligung ein. Dazu können beispielsweise Warenkorb, Anmeldung,
				Zahlungsabwicklung oder das Speichern Ihrer Datenschutzauswahl gehören.
			</p>
			<p>
				Wir beschränken den Einsatz auf das für die jeweilige Funktion tatsächlich Notwendige. Nicht jede
				Messung und nicht jeder Dienst desselben Anbieters ist automatisch erforderlich. Für den Zugriff auf
				Endgeräte und das Speichern von Informationen beachten wir insbesondere die Einwilligungsregeln und
				gesetzlichen Ausnahmen des {market.ePrivacyStatute}.
			</p>

			<h2>Analyse und Marketing</h2>
			<p>
				<strong>Optionale Analyse</strong> hilft, Besuche und die Nutzung des Shops auszuwerten.{" "}
				<strong>Marketingtechnologien</strong> können der Erfolgsmessung von Werbung, der Bildung von
				Werbezielgruppen oder der Anpassung von Anzeigen dienen.
			</p>
			<p>
				Diese optionalen Technologien aktivieren wir erst, nachdem Sie dem jeweiligen Zweck zugestimmt haben.
				Bis dahin sind Analyse- und Werbezwecke im <strong>Google Tag Manager</strong> auf{" "}
				<strong>„denied“</strong> gesetzt — die Website sendet diesen Hinweis, bevor eine Messung startet. Mit
				Ihrer Einwilligung wird daraus „granted“, mit einem Widerruf wieder „denied“. Das bloße Weitersurfen,
				das Schließen des Hinweises oder ein Einkauf gelten nicht als Zustimmung.
			</p>
			<p>
				Zur Reichweitenmessung setzen wir außerdem <strong>Cloudflare Web Analytics</strong> ein. Der Dienst{" "}
				<strong>speichert keine Cookies</strong>, bildet keine Besucherkennung und verknüpft keine Daten über
				Websites hinweg; deshalb läuft er auch ohne Einwilligung. Ausgewertet wird nur die Zahl der
				Seitenaufrufe insgesamt.
			</p>
			<p>
				Ein Dienst verarbeitet nicht schon deshalb keine personenbezogenen Daten, weil er keine Cookies setzt.
				Über Zwecke, Rechtsgrundlagen und Anbieter weiterer technischer Dienste informieren wir auch in
				unseren <Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Datenschutzhinweisen</Link>.
			</p>

			<h2>Ihre Auswahl</h2>
			<p>
				In den Datenschutzeinstellungen können Sie <strong>allen optionalen Zwecken zustimmen</strong>,{" "}
				<strong>alle optionalen Zwecke ablehnen</strong> oder <strong>nur ausgewählte Zwecke erlauben</strong>
				. Optionale Kategorien sind nicht vorausgewählt. Unbedingt erforderliche Funktionen bleiben aktiv,
				weil der jeweilige angeforderte Dienst ohne sie nicht bereitgestellt werden kann.
			</p>
			<p>
				<PrivacySettingsLink label="Datenschutzeinstellungen öffnen" className={SETTINGS_BUTTON_CLASS} />
			</p>
			<p>
				Ihre Entscheidung können Sie jederzeit über <strong>„Datenschutzeinstellungen“</strong> im Seitenfuß
				ändern. Ein Widerruf gilt für die weitere Nutzung der betreffenden optionalen Technologien. Wir
				stoppen deren weitere Aktivierung und entfernen die entsprechenden vom Shop verwalteten optionalen
				Cookies, soweit dies technisch möglich ist. Der Widerruf löscht nicht automatisch sämtliche Daten, die
				ein eigenständig verantwortlicher Anbieter bereits verarbeitet hat. Für diese Daten gelten die
				jeweiligen Rechte nach der DSGVO.
			</p>
			<p>
				Die Auswahl bezieht sich auf den verwendeten Browser und das Gerät. Auf einem anderen Gerät oder nach
				dem Löschen des Browserspeichers kann eine neue Auswahl erforderlich sein. Wir fragen auch dann erneut
				nach, wenn die gespeicherte Einwilligung abläuft oder sich die einwilligungspflichtigen Zwecke
				wesentlich ändern.
			</p>

			<h2>Übersicht der eingesetzten Technologien</h2>
			<p>
				Die Übersicht nennt die Technologie oder den Speicher, den Anbieter, den Zweck, die Kategorie und die
				Speicherdauer. Bei Diensten, die personenbezogene Daten verarbeiten, finden Sie weitere Angaben in der{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Anbieterübersicht</Link>.
			</p>
			<h3>Unbedingt erforderlich — ohne Einwilligung</h3>
			<InventoryTable lang="de" />
			<p>
				Alle aufgeführten Einträge setzt unsere Website selbst (maky.store). Bei der Zahlung übergibt Sie der
				Bestellprozess an Stripe, das für Abwicklung und Sicherheit der Zahlung eigene Daten nach seinen
				eigenen Bestimmungen speichert.
			</p>
			<h3>Optional — erst nach Ihrer Einwilligung</h3>
			<p>
				Nach einer Einwilligung in Analyse oder Marketing kann der Google Tag Manager Messwerkzeuge von Google
				starten, die eigene Cookies in Ihrem Browser speichern. Namen und Speicherdauer legt Google je nach
				Messkonfiguration fest; üblich sind Laufzeiten von Monaten bis Jahren. Ohne Einwilligung werden sie
				nicht gespeichert. Eine aktuelle Aufstellung stellen wir Ihnen auf Anfrage unter <Mail /> zur
				Verfügung.
			</p>

			<h2>Einstellungen im Browser</h2>
			<p>
				Sie können Cookies auch direkt in Ihrem Browser löschen oder blockieren. Werden dabei unbedingt
				erforderliche Cookies blockiert, funktionieren Warenkorb, Anmeldung oder Zahlung möglicherweise nicht
				richtig.{" "}
				<strong>
					Das Ablehnen optionaler Analyse und Werbung in unserer Auswahl verhindert einen Einkauf hingegen
					nicht.
				</strong>
			</p>
			<p>
				Beim Löschen von Cookies werden andere lokale Speicher nicht unbedingt mitgelöscht. Diese können Sie
				über die Website-Daten Ihres Browsers verwalten.
			</p>

			<h2>Kontakt und weitere Informationen</h2>
			<p>
				Betreiber ist <strong>{companyInfo.legalName}</strong>, {companyInfo.street}, {companyInfo.city},{" "}
				{SLOVAKIA_DE}, Unternehmensidentifikationsnummer (IČO) {companyInfo.ico}. Fragen senden Sie bitte an{" "}
				<Mail />.
			</p>
			<p>
				Informationen über Ihre Rechte, Datenempfänger und zuständige Datenschutzaufsichtsbehörden finden Sie
				in unseren <Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Datenschutzhinweisen</Link>.
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
				Cookies i podobne technologie pomagają obsługiwać sklep oraz — zależnie od Państwa wyboru — dodatkowe
				funkcje. <strong>Można odmówić opcjonalnej analityki i marketingu, a mimo to dokonać zakupu.</strong>
			</p>

			<h2>Czym są cookies i podobne technologie</h2>
			<p>
				Cookies to niewielkie informacje zapisywane przez stronę w przeglądarce. Pozwalają na przykład
				zachować zawartość koszyka lub sesję logowania. Niektóre są usuwane po zakończeniu sesji, inne
				pozostają do końca ustalonego okresu.
			</p>
			<p>
				Strona może korzystać także z pamięci lokalnej przeglądarki, na przykład <strong>localStorage</strong>
				, lub innych podobnych rozwiązań. O wymaganej zgodzie decyduje rzeczywisty cel i sposób działania, nie
				sama nazwa technologii. Informacje na tej stronie nie dotyczą więc wyłącznie klasycznych plików
				cookies.
			</p>

			<h2>Funkcje niezbędne</h2>
			<p>
				Bez odrębnej zgody korzystamy z technologii ściśle koniecznych do dostarczenia wyraźnie zamówionej
				usługi, na przykład działania koszyka, logowania, płatności lub zapisania wyboru prywatności.
				Ograniczamy je do zakresu faktycznie niezbędnego do danej funkcji.
			</p>
			<p>
				Nie każde narzędzie pomiarowe ani każda usługa tego samego dostawcy jest automatycznie niezbędna. Przy
				zapisywaniu informacji w urządzeniu i uzyskiwaniu do nich dostępu uwzględniamy w szczególności zasady
				zgody i wyjątki określone w{" "}
				<strong>art. 399 ustawy z 12 lipca 2024 r. — Prawo komunikacji elektronicznej</strong>.
			</p>

			<h2>Analityka i marketing</h2>
			<p>
				<strong>Opcjonalna analityka</strong> służy ocenie ruchu i korzystania ze sklepu.{" "}
				<strong>Technologie marketingowe</strong> mogą służyć pomiarowi skuteczności reklam, tworzeniu grup
				odbiorców i dostosowaniu reklam.
			</p>
			<p>
				Korzystamy z Google Tag Manager i powiązanych narzędzi pomiarowych Google. Przed dokonaniem wyboru
				strona przekazuje ustawienia Consent Mode z wartością <strong>„denied”</strong> dla opcjonalnych celów
				analitycznych i reklamowych. Po wyrażeniu zgody odpowiednie ustawienia zmieniają się na „granted”, a
				po jej wycofaniu ponownie na „denied”.{" "}
				<strong>Załadowanie skryptu i zgoda na zapis lub odczyt danych to różne czynności</strong>; samo
				ustawienie „denied” nie oznacza, że żadne żądanie sieciowe nie zostanie wysłane.
			</p>
			<p>
				Do pomiaru ruchu korzystamy również z <strong>Cloudflare Web Analytics</strong>. W obecnym rozwiązaniu
				skrypt ładuje się także przed udzieleniem zgody. Usługa nie wykorzystuje cookies do tego pomiaru. Brak
				cookies sam w sobie nie oznacza jednak braku przetwarzania danych osobowych ani automatycznego
				zwolnienia każdej technologii z zasad zgody. Cele i podstawy przetwarzania opisujemy także w{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Polityce prywatności</Link>.
			</p>
			<p>
				Samo przeglądanie strony, zamknięcie banera lub dokonanie zakupu nie jest zgodą. Opcjonalne kategorie
				nie są domyślnie zaznaczone.
			</p>

			<h2>Ustawienia prywatności</h2>
			<p>
				Mogą Państwo zaakceptować wszystkie opcjonalne cele, odrzucić je wszystkie lub wybrać tylko określone.
				Funkcje niezbędne pozostają aktywne, ponieważ bez nich zamówiona usługa nie może działać.
			</p>
			<p>
				<PrivacySettingsLink label="Otwórz ustawienia prywatności" className={SETTINGS_BUTTON_CLASS} />
			</p>
			<p>
				Wybór można później zmienić przez <strong>„Ustawienia prywatności”</strong> w stopce. Wycofanie zgody
				dotyczy dalszego wykorzystywania opcjonalnych technologii. Nie oznacza automatycznego usunięcia
				wszystkich danych, które niezależny usługodawca przetworzył wcześniej; w ich odniesieniu przysługują
				prawa opisane w polityce prywatności.
			</p>
			<p>
				Ustawienia dotyczą konkretnej przeglądarki i urządzenia. Na innym urządzeniu lub po usunięciu danych
				strony może być potrzebny ponowny wybór. Zmiana dokumentu sama w sobie nie stanowi zgody na nowy cel
				przetwarzania.
			</p>

			<h2>Dane przechowywane w przeglądarce</h2>
			<InventoryTable lang="pl" />
			<p>
				W nazwach cookies logowania może występować prefiks identyfikujący adres usługi; tabela podaje ich
				rozpoznawalne końcówki.
			</p>
			<p>
				Tabela opisuje wymienione mechanizmy samego sklepu. Narzędzia Google i Cloudflare są opisane powyżej.
				Informacje o konkretnych usługach i ich celach znajdują się również w{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Polityce prywatności</Link>. Pytania o
				wykorzystywane technologie można przesłać na <Mail />.
			</p>

			<h2>Ustawienia przeglądarki</h2>
			<p>
				Cookies można także usuwać lub blokować w przeglądarce. Zablokowanie niezbędnych cookies może
				uniemożliwić działanie koszyka, logowania lub płatności.{" "}
				<strong>
					Odrzucenie opcjonalnej analityki i reklam w naszych ustawieniach nie uniemożliwia zakupu.
				</strong>
			</p>
			<p>
				Usunięcie cookies nie zawsze usuwa dane z innych rodzajów pamięci. Można nimi zarządzać w ustawieniach
				danych witryn w przeglądarce.
			</p>

			<h2>Kontakt</h2>
			<p>
				Stronę prowadzi <strong>{companyInfo.legalName}</strong>, {companyInfo.street}, {companyInfo.city},{" "}
				{SLOVAKIA_PL}, IČO {companyInfo.ico}. Pytania prosimy kierować na <Mail />.
			</p>
			<p>
				Prawa dotyczące danych osobowych, odbiorców danych i właściwe organy opisujemy w{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Polityce prywatności</Link>.
			</p>
		</>
	);
}

export function Hu({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Sütiket és hasonló technológiákat használunk a webáruház működéséhez, illetve az Ön választásától
				függően további célokra.{" "}
				<strong>Az opcionális elemzést és marketinget elutasíthatja, és ettől még vásárolhat.</strong>
			</p>

			<h2>Mik azok a sütik és hasonló technológiák</h2>
			<p>
				A sütik kis adatcsomagok, amelyeket a weboldal a böngészőben tárol. Például a kosár tartalmát vagy a
				bejelentkezést segítenek megőrizni. Egy részük a munkamenet végén törlődik, mások meghatározott ideig
				maradnak meg.
			</p>
			<p>
				A weboldal a böngésző helyi tárhelyét, például <strong>localStorage</strong>-ot, vagy más hasonló
				megoldást is használhat. A hozzájárulás szempontjából a tényleges cél és működés számít, nem csupán a
				technológia neve. Ez a tájékoztató ezért nem kizárólag a hagyományos sütikre vonatkozik.
			</p>

			<h2>Feltétlenül szükséges működés</h2>
			<p>
				Külön hozzájárulás nélkül használjuk az Ön által kifejezetten kért szolgáltatáshoz feltétlenül
				szükséges technológiákat. Ilyen lehet a kosár, a bejelentkezés, a fizetés vagy az adatvédelmi
				választás megőrzése. A használatot a funkcióhoz valóban szükséges mértékre korlátozzuk.
			</p>
			<p>
				Nem minden mérés és nem minden, azonos szolgáltatótól származó eszköz szükséges automatikusan. Az
				eszközön történő tárolásnál és az információkhoz való hozzáférésnél figyelembe vesszük különösen az{" "}
				<strong>elektronikus hírközlésről szóló 2003. évi C. törvény 155. § (4) bekezdését</strong>, valamint
				az alkalmazandó hozzájárulási és kivételi szabályokat.
			</p>

			<h2>Elemzés és marketing</h2>
			<p>
				Az <strong>opcionális elemzés</strong> a forgalom és a webáruház használatának megértését szolgálja. A{" "}
				<strong>marketingtechnológiák</strong> a reklámok eredményességének mérésére, célközönségek
				kialakítására vagy a hirdetések személyre szabására használhatók.
			</p>
			<p>
				Google Tag Managert és kapcsolódó Google mérési eszközöket használunk. A választás előtt a weboldal az
				opcionális elemzési és reklámcélokra <strong>„denied”</strong> értékű Consent Mode beállításokat
				továbbít. Hozzájárulás után az érintett beállítás „granted”, visszavonás után ismét „denied” lesz.{" "}
				<strong>
					A szkript betöltése és a böngészőben történő tárolás vagy olvasás engedélyezése nem ugyanaz
				</strong>
				; a „denied” beállítás önmagában nem jelenti azt, hogy semmilyen hálózati kérés nem történik.
			</p>
			<p>
				A forgalom mérésére <strong>Cloudflare Web Analytics</strong> szolgáltatást is használunk. A jelenlegi
				megoldásban a szkript a hozzájárulás megadása előtt is betöltődik. A szolgáltatás ehhez a méréshez nem
				használ sütiket. A sütik hiánya önmagában azonban nem bizonyítja a személyes adatok kezelésének
				hiányát, és nem jelent minden technológiára általános hozzájárulási kivételt. A célokat és jogalapokat
				az <Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Adatkezelési tájékoztató</Link> is
				ismerteti.
			</p>
			<p>
				A tovább böngészés, a tájékoztató bezárása vagy a vásárlás nem minősül hozzájárulásnak. Az opcionális
				kategóriák nincsenek előre bejelölve.
			</p>

			<h2>Adatvédelmi beállítások</h2>
			<p>
				Elfogadhatja az összes opcionális célt, elutasíthatja mindet, vagy csak a kiválasztottakat
				engedélyezheti. A szükséges funkciók aktívak maradnak, mert a kért szolgáltatás nélkülük nem működhet.
			</p>
			<p>
				<PrivacySettingsLink label="Adatvédelmi beállítások megnyitása" className={SETTINGS_BUTTON_CLASS} />
			</p>
			<p>
				Választását a láblécben található <strong>„Adatvédelmi beállítások”</strong> segítségével később is
				módosíthatja. A visszavonás az opcionális technológiák további használatára vonatkozik. Nem törli
				automatikusan mindazokat az adatokat, amelyeket egy önálló szolgáltató korábban kezelt; ezekre az
				adatkezelési tájékoztatóban ismertetett jogok érvényesek.
			</p>
			<p>
				A választás az adott böngészőre és eszközre vonatkozik. Másik eszközön vagy a webhelyadatok törlése
				után ismét szükség lehet a beállításra. A dokumentum változása önmagában nem jelent hozzájárulást új
				adatkezelési célhoz.
			</p>

			<h2>Tárolás a böngészőben</h2>
			<InventoryTable lang="hu" />
			<p>
				A bejelentkezési sütik neve a szolgáltatás címét azonosító előtagot is tartalmazhat; a táblázat a
				felismerhető névvégződéseket mutatja.
			</p>
			<p>
				A táblázat a webáruház felsorolt saját tárolási megoldásait mutatja. A Google és Cloudflare eszközeit
				fent ismertetjük. Az egyes szolgáltatásokról és célokról az{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Adatkezelési tájékoztatóban</Link> is
				olvashat. Kérdését az <Mail /> címre küldheti.
			</p>

			<h2>Böngészőbeállítások</h2>
			<p>
				A sütiket a böngészőben is törölheti vagy blokkolhatja. A szükséges sütik tiltása miatt a kosár, a
				bejelentkezés vagy a fizetés hibásan működhet.{" "}
				<strong>
					Az opcionális elemzés és reklám elutasítása a mi beállításainkban nem akadályozza a vásárlást.
				</strong>
			</p>
			<p>
				A sütik törlése nem minden esetben törli a más tárhelyeken tárolt adatokat. Ezeket a böngésző
				webhelyadatokra vonatkozó beállításaiban kezelheti.
			</p>

			<h2>Kapcsolat</h2>
			<p>
				A weboldal üzemeltetője a <strong>{companyInfo.legalName}</strong>, {companyInfo.street},{" "}
				{companyInfo.city}, {SLOVAKIA_HU}, IČO {companyInfo.ico}. Kérdését az <Mail /> címre várjuk.
			</p>
			<p>
				A személyes adatokhoz kapcsolódó jogokat, az adatcímzetteket és az illetékes felügyeleteket az{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Adatkezelési tájékoztató</Link>{" "}
				ismerteti.
			</p>
		</>
	);
}

export function It({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Cookie e tecnologie simili permettono di utilizzare il negozio e, secondo le tue scelte, funzioni
				aggiuntive.{" "}
				<strong>Puoi rifiutare analisi e marketing facoltativi e continuare ad acquistare.</strong>
			</p>

			<h2>Che cosa sono</h2>
			<p>
				I cookie sono piccole informazioni salvate dal sito nel browser, ad esempio per mantenere il carrello
				o la sessione di accesso. Alcuni terminano con la sessione, altri restano per il periodo previsto.
			</p>
			<p>
				Il sito può usare anche la memoria locale del browser, come <strong>localStorage</strong>, o
				tecnologie simili. Il nome dello strumento non determina da solo se occorre il consenso: contano
				finalità e funzionamento. Questa pagina non riguarda quindi soltanto i cookie tradizionali.
			</p>

			<h2>Funzioni strettamente necessarie</h2>
			<p>
				Senza un consenso separato utilizziamo le tecnologie strettamente necessarie per un servizio
				espressamente richiesto, come il carrello, l’accesso, il pagamento o la memorizzazione della scelta
				sulla privacy, nei limiti di ciò che serve effettivamente.
			</p>
			<p>
				Non ogni misurazione o servizio dello stesso fornitore è automaticamente necessario. Per
				l’archiviazione e l’accesso alle informazioni sul dispositivo consideriamo l’
				<strong>articolo 122 del Codice in materia di protezione dei dati personali</strong> e le indicazioni
				del Garante. L’eventuale esenzione deve corrispondere al concreto utilizzo dello strumento.
			</p>

			<h2>Analisi e marketing</h2>
			<p>
				L’analisi facoltativa aiuta a comprendere l’uso del negozio. Gli strumenti di marketing possono
				misurare le campagne, creare pubblici e personalizzare la pubblicità.
			</p>
			<p>
				Utilizziamo Google Tag Manager e strumenti di misurazione Google collegati. Prima della scelta, il
				sito imposta Consent Mode su <strong>«denied»</strong> per le finalità facoltative di analisi e
				pubblicità. Dopo il consenso le relative impostazioni passano a «granted» e tornano a «denied» in caso
				di revoca.{" "}
				<strong>
					Caricare uno script e consentire la scrittura o lettura dei dati sono operazioni diverse:
				</strong>{" "}
				«denied» non garantisce, da solo, l’assenza di ogni richiesta di rete.
			</p>
			<p>
				Utilizziamo anche <strong>Cloudflare Web Analytics</strong>. Nella configurazione descritta, lo script
				viene caricato anche prima del consenso e il servizio non usa cookie per tale misurazione. L’assenza
				di cookie non dimostra, da sola, l’assenza di dati personali o un’esenzione automatica dalle regole
				applicabili. L’
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Informativa sulla privacy</Link> descrive
				anche finalità e basi del trattamento.
			</p>
			<p>
				Visitare il sito, scorrere una pagina, chiudere il banner o acquistare non equivale ad acconsentire.
				Le categorie facoltative non sono preselezionate.
			</p>

			<h2>Le tue preferenze</h2>
			<p>
				Puoi accettare tutte le finalità facoltative, rifiutarle tutte o scegliere singole categorie. Le
				funzioni necessarie restano attive perché servono a erogare il servizio richiesto.
			</p>
			<p className="not-prose">
				<PrivacySettingsLink label="Apri le preferenze sulla privacy" className={SETTINGS_BUTTON_CLASS} />
			</p>
			<p>
				Puoi modificare la scelta in seguito attraverso <strong>«Preferenze sulla privacy»</strong> nel piè di
				pagina. La revoca riguarda l’ulteriore impiego delle tecnologie facoltative; non cancella
				automaticamente tutti i dati già trattati da un prestatore autonomo. Per questi dati valgono i diritti
				descritti nell’informativa.
			</p>
			<p>
				La scelta è relativa al browser e al dispositivo. Su un altro dispositivo o dopo la cancellazione dei
				dati del sito potresti doverla ripetere. Un aggiornamento di questo documento non costituisce consenso
				a una nuova finalità.
			</p>

			<h2>Dati memorizzati nel browser</h2>
			<InventoryTable lang="it" />
			<p>
				I cookie di autenticazione possono avere un prefisso riferito all’indirizzo del servizio; la tabella
				mostra le parti riconoscibili dei nomi. La tabella riguarda questi meccanismi del negozio, non
				costituisce un inventario completo di ogni tecnologia di terzi. I servizi Google e Cloudflare sono
				descritti sopra. Per altre informazioni scrivi a <Mail />.
			</p>

			<h2>Impostazioni del browser</h2>
			<p>
				Puoi cancellare o bloccare cookie anche dal browser. Bloccare quelli necessari può impedire carrello,
				accesso o pagamento.{" "}
				<strong>
					Rifiutare analisi e pubblicità facoltative nelle nostre preferenze non impedisce di acquistare.
				</strong>
			</p>
			<p>
				Cancellare i cookie non rimuove necessariamente le altre memorie: puoi gestirle nelle impostazioni dei
				dati dei siti del browser.
			</p>

			<h2>Contatti</h2>
			<p>
				Il sito è gestito da <strong>{companyInfo.legalName}</strong>, {companyInfo.street},{" "}
				{companyInfo.city}, {SLOVAKIA_IT}, IČO {companyInfo.ico}. Per domande: <Mail />.
			</p>
			<p>
				Diritti, destinatari e autorità competenti sono descritti nell’
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Informativa sulla privacy</Link>.
			</p>
		</>
	);
}

export function Fr({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Les cookies et technologies similaires permettent le fonctionnement du magasin et, selon votre choix,
				des usages supplémentaires.{" "}
				<strong>
					Vous pouvez refuser la mesure et le marketing facultatifs tout en continuant à acheter.
				</strong>
			</p>

			<h2>De quoi s’agit-il ?</h2>
			<p>
				Les cookies sont de petites informations enregistrées dans le navigateur, par exemple pour conserver
				le panier ou la connexion au compte. Certains prennent fin avec la session, d’autres subsistent
				pendant la durée prévue.
			</p>
			<p>
				Le site peut aussi utiliser le stockage local du navigateur, comme <strong>localStorage</strong>, et
				d’autres technologies. Leur nom ne détermine pas à lui seul si un consentement est nécessaire : la
				finalité et le fonctionnement comptent. Cette page ne concerne donc pas uniquement les cookies
				classiques.
			</p>

			<h2>Fonctions strictement nécessaires</h2>
			<p>
				Sans consentement distinct, nous utilisons les technologies strictement nécessaires au service
				expressément demandé, comme le panier, l’authentification, le paiement ou la conservation du choix de
				confidentialité, dans la limite des besoins réels.
			</p>
			<p>
				Tout outil de mesure ou service d’un même fournisseur n’est pas automatiquement nécessaire. Pour le
				stockage et l’accès aux informations du terminal, nous tenons compte de l’
				<strong>article 82 de la loi Informatique et Libertés</strong> et des règles de la CNIL. Une
				éventuelle exemption doit correspondre à l’usage réel du dispositif.
			</p>

			<h2>Mesure et marketing</h2>
			<p>
				La mesure facultative aide à comprendre la fréquentation et l’utilisation de la boutique. Les
				technologies marketing peuvent mesurer les campagnes, constituer des audiences ou adapter les
				publicités.
			</p>
			<p>
				Nous utilisons Google Tag Manager et des outils Google associés. Avant votre choix, le site transmet
				les paramètres Consent Mode <strong>«denied»</strong> pour les finalités facultatives de mesure et de
				publicité. Après accord, les paramètres concernés passent à «granted» et reviennent à «denied» en cas
				de retrait.{" "}
				<strong>
					Charger un script et autoriser l’écriture ou la lecture de données sont deux opérations différentes
					:
				</strong>{" "}
				la valeur «denied» ne prouve pas à elle seule l’absence de toute requête réseau.
			</p>
			<p>
				Nous utilisons également <strong>Cloudflare Web Analytics</strong>. Dans la configuration décrite, le
				script se charge avant le consentement et ce service n’utilise pas de cookies pour cette mesure.
				L’absence de cookie ne démontre pas, à elle seule, l’absence de traitement de données personnelles ni
				une exemption automatique des règles applicables. Les finalités et bases de traitement sont aussi
				présentées dans la{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Politique de confidentialité</Link>.
			</p>
			<p>
				Naviguer sur le site, faire défiler une page, fermer le bandeau ou acheter ne vaut pas consentement.
				Les catégories facultatives ne sont pas présélectionnées.
			</p>

			<h2>Vos préférences</h2>
			<p>
				Vous pouvez tout accepter, tout refuser pour les finalités facultatives ou choisir certaines
				catégories. Les fonctions nécessaires restent actives pour fournir le service demandé.
			</p>
			<p className="not-prose">
				<PrivacySettingsLink
					label="Ouvrir les paramètres de confidentialité"
					className={SETTINGS_BUTTON_CLASS}
				/>
			</p>
			<p>
				Vous pouvez ensuite modifier votre choix via <strong>«Paramètres de confidentialité»</strong> dans le
				pied de page. Le retrait s’applique aux utilisations futures des technologies facultatives. Il ne
				supprime pas automatiquement toutes les données déjà traitées par un prestataire autonome ; les droits
				décrits dans la politique de confidentialité restent applicables.
			</p>
			<p>
				Le choix concerne votre navigateur et votre appareil. Sur un autre appareil ou après suppression des
				données du site, il peut être nécessaire de le renouveler. Une modification de ce document ne vaut pas
				accord pour une nouvelle finalité.
			</p>

			<h2>Informations conservées dans le navigateur</h2>
			<InventoryTable lang="fr" />
			<p>
				Les cookies d’authentification peuvent comporter un préfixe lié à l’adresse du service ; la table
				indique les parties reconnaissables. Elle décrit ces mécanismes de la boutique, sans constituer un
				inventaire exhaustif des technologies de tiers. Les services Google et Cloudflare sont présentés plus
				haut. Pour toute autre information, écrivez à <Mail />.
			</p>

			<h2>Paramètres du navigateur</h2>
			<p>
				Vous pouvez aussi supprimer ou bloquer les cookies dans le navigateur. Le blocage des cookies
				nécessaires peut empêcher le panier, la connexion ou le paiement de fonctionner.{" "}
				<strong>
					Refuser les mesures et publicités facultatives dans nos paramètres n’empêche pas l’achat.
				</strong>
			</p>
			<p>
				Supprimer les cookies ne supprime pas forcément les autres espaces de stockage. Vous pouvez les gérer
				dans les paramètres de données des sites de votre navigateur.
			</p>

			<h2>Contact</h2>
			<p>
				Le site est exploité par <strong>{companyInfo.legalName}</strong>, {companyInfo.street},{" "}
				{companyInfo.city}, {SLOVAKIA_FR}, IČO {companyInfo.ico}. Questions : <Mail />.
			</p>
			<p>
				Les droits, destinataires et autorités compétentes sont présentés dans la{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Politique de confidentialité</Link>.
			</p>
		</>
	);
}
