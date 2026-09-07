import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { companyInfo } from "@/config/company";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Ochrana osobných údajov"),
	description:
		"Ako MAKY.STORE spracúva osobné údaje pri objednávkach, zákazníckom účte, reklamáciách a návšteve webu. Účely, uchovávanie a vaše práva.",
};

/**
 * The recipients table.
 *
 * Every row is a service this storefront is actually configured to talk to — read off
 * `.env` and the code that consumes it, not off a vendor list somebody once wrote down.
 * Saleor and Payload are MAKY's own instances on MAKY's own subdomains, which is why
 * they are described as such rather than as third-party providers.
 *
 * What is deliberately NOT here: contracting legal entities and per-transfer safeguards.
 * Those are contract facts, not configuration facts — this file cannot verify them, and
 * a plausible-looking guess in a GDPR disclosure is worse than an honest pointer to the
 * request route the statute already provides (Art. 15(2), and §5 below).
 */
const RECIPIENTS: ReadonlyArray<{ service: string; purpose: string; basis: string }> = [
	{
		service: "Saleor (vlastná inštancia, api.maky.store)",
		purpose: "Katalóg, košík, objednávky a zákaznícky účet.",
		basis: "Nevyhnutné pre zmluvu",
	},
	{
		service: "Payload CMS (vlastná inštancia, cms.maky.store)",
		purpose: "Redakčný obsah, záznam o odstúpení od zmluvy a jeho potvrdenie.",
		basis: "Zmluva a zákonná povinnosť",
	},
	{
		service: "Stripe",
		purpose: "Spracovanie online platby, vrátenie platby a kontrola podvodov.",
		basis: "Nevyhnutné pre zmluvu",
	},
	{
		service: "FedEx a Slovenská pošta",
		purpose: "Doručenie zásielky a kontaktovanie príjemcu.",
		basis: "Nevyhnutné pre zmluvu",
	},
	{
		service: "Cloudflare",
		purpose:
			"Doručovanie a ochrana webu; Cloudflare Web Analytics meria návštevnosť bez cookies a bez identifikácie osoby.",
		basis: "Oprávnený záujem",
	},
	{
		service: "Google (Tag Manager, Google Analytics)",
		purpose:
			"Voliteľná analytika a meranie reklamy. Bez vášho súhlasu neukladá ani nečíta údaje v prehliadači.",
		basis: "Súhlas",
	},
];

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	const mail = <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;
	return (
		<LegalPage title="Ochrana osobných údajov">
			<p>
				Pri nákupe a návšteve webu nám zverujete osobné údaje. Tu vysvetľujeme, ktoré používame, prečo ich
				potrebujeme, komu ich poskytujeme a ako môžete uplatniť svoje práva.
			</p>

			<h2>1. Kto za spracúvanie zodpovedá</h2>
			<p>
				Prevádzkovateľom je <strong>{companyInfo.legalName}</strong>, {companyInfo.street}, {companyInfo.city}
				, {companyInfo.country}, IČO {companyInfo.ico}.
			</p>
			<p>Vo veciach ochrany osobných údajov nás kontaktujte na {mail} alebo písomne na adrese sídla.</p>

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
				môžete ho kedykoľvek odvolať odkazom v správe alebo e-mailom na {mail}.
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
				Technické údaje vznikajú pri používaní webu; podrobnosti o jednotlivých službách sú uvedené nižšie.
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
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Služba</th>
							<th>Na čo ju používame</th>
							<th>Právny základ</th>
						</tr>
					</thead>
					<tbody>
						{RECIPIENTS.map((row) => (
							<tr key={row.service}>
								<td>{row.service}</td>
								<td>{row.purpose}</td>
								<td>{row.basis}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p>
				Informáciu o tom, ktorá spoločnosť konkrétnu službu poskytuje, v akom postavení a s akými zárukami pri
				prenose údajov, vám na požiadanie poskytneme na {mail}.
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
				poskytneme na {mail}, s primeranou ochranou dôverných údajov.
			</p>

			<h2>6. Ako dlho údaje uchovávame</h2>
			<p>Údaje neuchovávame všetky rovnako dlho. Rozhoduje ich účel a zákonné povinnosti.</p>
			<p>
				<strong>Objednávky a komunikáciu k nim</strong> uchovávame počas vybavovania a následne v rozsahu
				potrebnom na zákonné povinnosti, reklamácie a uplatnenie alebo obranu nárokov. Pri právnych nárokoch
				zohľadňujeme príslušné premlčacie lehoty, ich prípadné prerušenie a trvanie konania; nevyhnutné
				podklady sa môžu uchovať do právoplatného skončenia sporu.
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
				Nevyhnutný záznam o udelení či odvolaní súhlasu a o odhlásení môžeme ďalej uchovať na preukázanie
				zákonnosti a rešpektovanie vašej voľby, nie na pokračovanie v marketingu.
			</p>
			<p>
				<strong>Technické záznamy, analytické údaje a cookies</strong> majú lehoty podľa jednotlivých služieb
				a účelov uvedených vyššie a v <Link href={marketHref(channel, "/cookies")}>prehľade cookies</Link>.
				Pri konkrétnom bezpečnostnom incidente sa nevyhnutné dôkazy môžu uchovať počas jeho riešenia a ochrany
				súvisiacich nárokov.
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
				Žiadosť pošlite na {mail}. Ak máme odôvodnené pochybnosti o totožnosti, môžeme požiadať o primerané
				doplnenie, nie automaticky o kópiu dokladu totožnosti.
			</p>
			<p>
				O prijatých opatreniach vás informujeme bez zbytočného odkladu, najneskôr do{" "}
				<strong>jedného mesiaca</strong>. Pri odôvodnene zložitej žiadosti alebo väčšom počte žiadostí možno
				lehotu predĺžiť o ďalšie dva mesiace; o predĺžení a dôvodoch vás informujeme v prvom mesiaci. Ak
				žiadosti nemôžeme vyhovieť, vysvetlíme prečo. Právo na vymazanie napríklad neznamená povinnosť zmazať
				doklad, ktorý musíme uchovávať zo zákona.
			</p>

			<h2>8. Sťažnosť dozornému úradu</h2>
			<p>
				Máte právo podať sťažnosť príslušnému dozornému orgánu, najmä v štáte obvyklého pobytu, pracoviska
				alebo údajného porušenia GDPR. Na Slovensku je ním:
			</p>
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
			</p>

			<h2>9. Automatizované rozhodovanie</h2>
			<p>
				Nepoužívame automatizované rozhodovanie ani profilovanie, ktoré by voči vám malo právne účinky alebo
				vás podobne významne ovplyvňovalo pri prijímaní objednávky, vybavovaní reklamácie či posudzovaní
				odstúpenia od zmluvy. O týchto veciach rozhoduje človek.
			</p>
			<p>
				Poskytovateľ platobnej služby pri online platbe automatizovane vyhodnocuje riziko podvodu a na základe
				toho môže platbu odmietnuť alebo vyžiadať dodatočné overenie. Toto vyhodnotenie je súčasťou platobnej
				služby a nie je naším rozhodnutím o vašej objednávke. Ak vám platba neprejde, ozvite sa nám na {mail}{" "}
				a dohodneme sa na ďalšom postupe.
			</p>

			<h2>10. Zmeny informácií</h2>
			<p>
				Tento dokument aktualizujeme, keď sa zmení spôsob spracúvania alebo používané služby. Ak zmena
				vyžaduje nový súhlas, samotnou úpravou dokumentu ho nenahrádzame.
			</p>
		</LegalPage>
	);
}
