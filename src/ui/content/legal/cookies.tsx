import Link from "next/link";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { PrivacySettingsLink } from "@/ui/components/privacy-settings-link";

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
		life: { sk: "1 rok", cs: "1 rok" },
		kind: { sk: "Cookie", cs: "Cookie" },
		purpose: {
			sk: "Pamätá si jazykovú a trhovú verziu obchodu, ktorú ste otvorili.",
			cs: "Pamatuje si jazykovou a tržní verzi obchodu, kterou jste otevřeli.",
		},
	},
	{
		name: "checkoutId-<kanál>",
		life: { sk: "Do zatvorenia prehliadača", cs: "Do zavření prohlížeče" },
		kind: { sk: "Cookie", cs: "Cookie" },
		purpose: {
			sk: "Spája váš prehliadač s obsahom košíka a s rozpracovanou objednávkou.",
			cs: "Spojuje váš prohlížeč s obsahem košíku a s rozpracovanou objednávkou.",
		},
	},
	{
		name: "saleor_auth_access_token / refresh_token",
		life: {
			sk: "Prístupový 15 minút, obnovovací 7 dní",
			cs: "Přístupový 15 minut, obnovovací 7 dní",
		},
		kind: { sk: "Cookie", cs: "Cookie" },
		purpose: {
			sk: "Udržiavajú vaše prihlásenie. Ukladajú sa až po prihlásení do účtu.",
			cs: "Udržují vaše přihlášení. Ukládají se až po přihlášení k účtu.",
		},
	},
	{
		name: "maky-consent",
		life: {
			sk: "Do vymazania údajov webu v prehliadači",
			cs: "Do vymazání údajů webu v prohlížeči",
		},
		kind: { sk: "Miestne úložisko (localStorage)", cs: "Místní úložiště (localStorage)" },
		purpose: {
			sk: "Uchováva vašu voľbu súkromia, aby sme sa nepýtali pri každej návšteve.",
			cs: "Uchovává vaši volbu soukromí, abychom se neptali při každé návštěvě.",
		},
	},
] as const;

const TABLE_HEADS = {
	sk: ["Názov", "Typ", "Účel", "Platnosť"],
	cs: ["Název", "Typ", "Účel", "Platnost"],
} as const;

function InventoryTable({ lang }: { lang: "sk" | "cs" }) {
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
