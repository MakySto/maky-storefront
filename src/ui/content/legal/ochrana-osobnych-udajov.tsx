import Link from "next/link";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";

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
		},
		basis: { sk: "Nevyhnutné pre zmluvu", cs: "Nezbytné pro smlouvu" },
	},
	{
		service: "Payload CMS (cms.maky.store)",
		purpose: {
			sk: "Redakčný obsah, záznam o odstúpení od zmluvy a jeho potvrdenie. Vlastná inštancia.",
			cs: "Redakční obsah, záznam o odstoupení od smlouvy a jeho potvrzení. Vlastní instance.",
		},
		basis: { sk: "Zmluva a zákonná povinnosť", cs: "Smlouva a zákonná povinnost" },
	},
	{
		service: "Stripe",
		purpose: {
			sk: "Spracovanie online platby, vrátenie platby a kontrola podvodov.",
			cs: "Zpracování online platby, vrácení platby a kontrola podvodů.",
		},
		basis: { sk: "Nevyhnutné pre zmluvu", cs: "Nezbytné pro smlouvu" },
	},
	{
		service: "FedEx, Slovenská pošta",
		purpose: {
			sk: "Doručenie zásielky a kontaktovanie príjemcu.",
			cs: "Doručení zásilky a kontaktování příjemce.",
		},
		basis: { sk: "Nevyhnutné pre zmluvu", cs: "Nezbytné pro smlouvu" },
	},
	{
		service: "Cloudflare",
		purpose: {
			sk: "Doručovanie a ochrana webu; Cloudflare Web Analytics meria návštevnosť bez cookies.",
			cs: "Doručování a ochrana webu; Cloudflare Web Analytics měří návštěvnost bez cookies.",
		},
		basis: { sk: "Oprávnený záujem", cs: "Oprávněný zájem" },
	},
	{
		service: "Google (Tag Manager, Analytics)",
		purpose: {
			sk: "Voliteľná analytika a meranie reklamy. Bez súhlasu neukladá ani nečíta údaje v prehliadači.",
			cs: "Volitelná analytika a měření reklamy. Bez souhlasu neukládá ani nečte údaje v prohlížeči.",
		},
		basis: { sk: "Súhlas", cs: "Souhlas" },
	},
] as const;

const HEADS = {
	sk: ["Služba", "Na čo ju používame", "Právny základ"],
	cs: ["Služba", "K čemu ji používáme", "Právní základ"],
} as const;

function RecipientsTable({ lang }: { lang: "sk" | "cs" }) {
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

function DpaAuthority({ lang }: { lang: "sk" | "cs" }) {
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
