import Link from "next/link";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { AUSTRIA, GERMANY, SLOVAKIA_DE, type GermanMarket } from "./german-market";
import { SLOVAKIA_HU, SLOVAKIA_PL } from "./slovakia";

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
		},
		basis: {
			sk: "Nevyhnutné pre zmluvu",
			cs: "Nezbytné pro smlouvu",
			de: "Für den Vertrag erforderlich",
			pl: "Niezbędne do wykonania umowy",
			hu: "A szerződés teljesítéséhez szükséges",
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
		},
		basis: {
			sk: "Zmluva a zákonná povinnosť",
			cs: "Smlouva a zákonná povinnost",
			de: "Vertrag und rechtliche Verpflichtung",
			pl: "Umowa i obowiązek prawny",
			hu: "Szerződés és jogi kötelezettség",
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
		},
		basis: {
			sk: "Nevyhnutné pre zmluvu",
			cs: "Nezbytné pro smlouvu",
			de: "Für den Vertrag erforderlich",
			pl: "Niezbędne do wykonania umowy",
			hu: "A szerződés teljesítéséhez szükséges",
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
		},
		basis: {
			sk: "Nevyhnutné pre zmluvu",
			cs: "Nezbytné pro smlouvu",
			de: "Für den Vertrag erforderlich",
			pl: "Niezbędne do wykonania umowy",
			hu: "A szerződés teljesítéséhez szükséges",
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
		},
		basis: {
			sk: "Oprávnený záujem",
			cs: "Oprávněný zájem",
			de: "Berechtigtes Interesse",
			pl: "Prawnie uzasadniony interes",
			hu: "Jogos érdek",
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
		},
		basis: {
			sk: "Súhlas",
			cs: "Souhlas",
			de: "Einwilligung",
			pl: "Zgoda w zakresie opcjonalnych celów",
			hu: "Hozzájárulás az opcionális célokhoz",
		},
	},
] as const;

const HEADS = {
	sk: ["Služba", "Na čo ju používame", "Právny základ"],
	cs: ["Služba", "K čemu ji používáme", "Právní základ"],
	de: ["Dienst", "Wofür wir ihn nutzen", "Rechtsgrundlage"],
	pl: ["Usługa", "Do czego jej używamy", "Podstawa prawna"],
	hu: ["Szolgáltatás", "Mire használjuk", "Jogalap"],
} as const;

function RecipientsTable({ lang }: { lang: "sk" | "cs" | "de" | "pl" | "hu" }) {
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
							<td>{row.basis[lang]}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function DpaAuthority({ lang }: { lang: "sk" | "cs" | "pl" | "hu" }) {
	return (
		<p>
			<strong>Úrad na ochranu osobných údajov Slovenskej republiky</strong>
			<br />
			Galvaniho Business Centrum II
			<br />
			Galvaniho 7/B
			<br />
			821 04 Bratislava
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
