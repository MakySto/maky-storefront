import Link from "next/link";
import { companyInfo, companyPhoneHref } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { AUSTRIA, GERMANY, SLOVAKIA_DE, type GermanMarket } from "./german-market";
import { SLOVAKIA_FR, SLOVAKIA_HU, SLOVAKIA_IT, SLOVAKIA_PL } from "./slovakia";

const Mail = () => <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;
const Phone = () => <a href={companyPhoneHref}>{companyInfo.phone}</a>;

const RETURN_ADDRESS = `${companyInfo.legalName}, ${companyInfo.returnAddress}, Slovenská republika`;
const RETURN_ADDRESS_DE = `${companyInfo.legalName}, ${companyInfo.returnAddress}, ${SLOVAKIA_DE}`;
const RETURN_ADDRESS_PL = `${companyInfo.legalName}, ${companyInfo.returnAddress}, ${SLOVAKIA_PL}`;
const RETURN_ADDRESS_HU = `${companyInfo.legalName}, ${companyInfo.returnAddress}, ${SLOVAKIA_HU}`;
const RETURN_ADDRESS_IT = `${companyInfo.legalName}, ${companyInfo.returnAddress}, ${SLOVAKIA_IT}`;
const RETURN_ADDRESS_FR = `${companyInfo.legalName}, ${companyInfo.returnAddress}, ${SLOVAKIA_FR}`;

/**
 * The Slovak ADR body, which stays the seller's ADR body in every market.
 *
 * A local scheme is added alongside it in the market bodies, never instead of it: the
 * trader's own ADR entity does not change because the buyer lives elsewhere.
 *
 * The three translated fragments are records rather than nested ternaries. With five
 * languages a chain of `?:` stops being readable, and — more to the point — a record
 * makes it impossible to change what `sk`, `cs` or `de` already render while adding a
 * language, which a rewritten ternary very easily does.
 */
function Adr({ lang, country }: { lang: "sk" | "cs" | "de" | "pl" | "hu" | "it" | "fr"; country?: string }) {
	const alternative = {
		sk: "alternatívne",
		cs: "alternativní",
		de: "alternative",
		pl: "alternatywne",
		hu: "alternatív",
		it: "risoluzione alternativa delle controversie",
		fr: "règlement extrajudiciaire des litiges",
	}[lang];
	const or = { sk: "alebo", cs: "nebo", de: "oder", pl: "lub", hu: "vagy", it: "oppure", fr: "ou" }[lang];
	const linkText = {
		sk: "Informácie a postup podania na stránke SOI",
		cs: "Informace a postup podání na stránce SOI",
		de: "Informationen zum Verfahren bei der SOI",
		pl: "Informacje i tryb złożenia wniosku na stronie SOI",
		hu: "Tájékoztatás az eljárásról és a beadványról a SOI oldalán",
		it: "Informazioni e procedura SOI",
		fr: "Informations et procédure SOI",
	}[lang];

	// `alternative` is a bare adjective in the five original languages and reads as a
	// whole phrase in Italian and French, so the heading is assembled per language rather
	// than by gluing one word in front of a shared noun.
	const heading =
		lang === "it" || lang === "fr"
			? `Slovenská obchodná inšpekcia — ${alternative}`
			: `Slovenská obchodná inšpekcia — ${alternative} riešenie sporov`;

	return (
		<p>
			<strong>{heading}</strong>
			<br />
			Ústredný inšpektorát, Odbor pre medzinárodné vzťahy a alternatívne riešenie spotrebiteľských sporov
			<br />
			Bajkalská 21/A, p. p. 29, 827 99 Bratislava 27
			{country ? `, ${country}` : ""}
			<br />
			E-mail: <a href="mailto:ars@soi.sk">ars@soi.sk</a> {or} <a href="mailto:adr@soi.sk">adr@soi.sk</a>
			<br />
			<a
				href="https://www.soi.sk/alternativne-riesenie-spotrebitelskych-sporov"
				rel="noopener noreferrer"
				target="_blank"
			>
				{linkText}
			</a>
		</p>
	);
}

export function Sk({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Tieto podmienky upravujú nákup tovaru v internetovom obchode MAKY.STORE. Pre konkrétnu objednávku
				platí znenie účinné v čase uzavretia zmluvy.
			</p>

			<h2>1. Kto je predávajúci</h2>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				Sídlo: {companyInfo.street}, {companyInfo.city}, Slovenská republika
				<br />
				IČO: {companyInfo.ico}
				<br />
				DIČ: {companyInfo.dic}
				<br />
				IČ DPH: {companyInfo.icDph}
			</p>
			<p>
				Spoločnosť je platiteľom DPH a je zapísaná v Obchodnom registri Mestského súdu Bratislava III, oddiel
				Sro, vložka č. 200804/B.
			</p>
			<p>
				E-mail: <Mail />
				<br />
				Telefón: <Phone />
			</p>
			<p>
				<strong>Adresa na vrátenie tovaru, reklamácie a súvisiace oznámenia:</strong> {RETURN_ADDRESS}.
			</p>
			<p>V texte sa ako „my“ označuje predávajúci a ako „zákazník“ alebo „vy“ kupujúci.</p>
			<p>
				Spotrebiteľom je fyzická osoba, ktorá pri uzatváraní a plnení zmluvy nekoná v rámci podnikania alebo
				povolania. Zákonné práva uvedené pre spotrebiteľa sa uplatňujú podľa skutočného postavenia kupujúceho
				a povahy nákupu.
			</p>

			<h2>2. Objednávka a vznik zmluvy</h2>
			<p>
				Nakupovať môžete aj bez registrácie. Vyberiete tovar, vložíte ho do košíka, doplníte kontaktné,
				fakturačné a doručovacie údaje a vyberiete z dostupnej dopravy a platby.
			</p>
			<p>
				Pred odoslaním objednávky môžete skontrolovať a opraviť jej obsah aj zadané údaje. Zobrazíme vám
				celkovú cenu vrátane dopravy a prípadných ďalších vopred oznámených nákladov.
			</p>
			<p>
				Objednávku odošlete tlačidlom <strong>„Objednávka s povinnosťou platby“</strong> alebo iným rovnako
				jednoznačným označením vyjadrujúcim povinnosť zaplatiť. Odoslaním objednávky sa zaväzujete uhradiť
				uvedenú cenu.
			</p>
			<p>
				Kúpna zmluva vzniká doručením nášho potvrdenia o prijatí objednávky na váš e-mail. Potvrdenie obsahuje
				zhrnutie objednávky, dohodnuté podmienky a znenie týchto obchodných podmienok na trvanlivom médiu.
				Samostatná notifikácia platobnej brány o platbe nie je potvrdením prijatia objednávky od
				predávajúceho.
			</p>
			<p>
				Pre slovenskú jazykovú verziu sa zmluva uzatvára v slovenčine. Údaje o zmluve uchovávame na účely jej
				plnenia a plnenia zákonných povinností. Potvrdenie objednávky a priložené dokumenty si môžete uložiť.
				Kópiu údajov k vlastnej objednávke si môžete vyžiadať na našom e-maile.
			</p>
			<p>
				Na komunikáciu používate bežné internetové alebo telefónne pripojenie podľa podmienok svojho
				poskytovateľa. Osobitný poplatok za uzavretie zmluvy na diaľku neúčtujeme.
			</p>

			<h2>3. Tovar a jeho určenie</h2>
			<p>
				Vlastnosti výrobku, obsah balenia, jeho určenie a prípadné obmedzenia sú uvedené pri produkte. Pri
				montážnych zostavách je dôležitá aj konfigurácia vozidla a obsah konkrétnej zostavy.
			</p>
			<p>
				Ak potrebujete overiť vhodnosť výrobku, kontaktujte nás pred objednaním. Toto odporúčanie neobmedzuje
				našu zodpovednosť za správnosť údajov v ponuke ani za súlad dodaného tovaru so zmluvou.
			</p>
			<p>
				Označenie <strong>„na objednávku“</strong> znamená, že tovar zabezpečujeme od dodávateľa. Samo osebe
				neznamená výrobu na mieru ani vylúčenie práva spotrebiteľa odstúpiť od zmluvy.
			</p>

			<h2>4. Cena a platba</h2>
			<p>
				Ceny zobrazené spotrebiteľovi sú konečné ceny vrátane DPH a ostatných daní. Cena dopravy sa uvádza
				osobitne; spolu s celkovou cenou objednávky ju uvidíte pred odoslaním objednávky. Platené doplnky
				alebo dodatočné služby nepridávame bez vášho výslovného súhlasu.
			</p>
			<p>
				Pri nákupe v slovenskej verzii sa cena uvádza v eurách. Záväzná je cena potvrdená pri uzavretí zmluvy;
				neskoršia zmena ceny na webe nemení cenu už uzavretej objednávky.
			</p>
			<p>
				Online platby spracúva platobná brána <strong>Stripe</strong>. Konkrétne dostupné platobné metódy sa
				zobrazujú v pokladni. Úplné údaje o platobnej karte spracúva poskytovateľ platobnej služby;
				predávajúci ich neukladá ani k nim nemá prístup.
			</p>
			<p>
				Ak objednávku nemožno prijať a platba už prebehla, bezodkladne vám vrátime prijatú sumu. Po vzniku
				zmluvy nemožno jej podmienky jednostranne meniť len preto, že dodávateľ zmenil cenu alebo dostupnosť.
			</p>

			<h2>5. Doručenie a prevzatie</h2>
			<p>
				Tovar doručujeme prostredníctvom <strong>FedEx a Slovenskej pošty</strong>. Dostupné služby závisia od
				obsahu objednávky, rozmerov a hmotnosti zásielky a adresy doručenia. Pre konkrétnu objednávku sa v
				pokladni zobrazujú dostupné spôsoby a ceny dopravy. Pri zásielkach nad 35 kg sa doprava dojednáva
				individuálne na základe vašej žiadosti; cenu oznámime pred uzavretím zmluvy.
			</p>
			<p>
				Informáciu o dodaní poskytneme pred uzavretím zmluvy. Tovar dodáme bez zbytočného odkladu, najneskôr
				do <strong>30 dní od uzavretia zmluvy</strong>, pokiaľ sa nedohodneme na inom termíne. Konkrétne
				dohodnutý termín má prednosť pred týmto všeobecným pravidlom.
			</p>
			<p>
				Ak dohodnutý termín nedodržíme, môžete nám poskytnúť dodatočnú primeranú lehotu na dodanie a po jej
				márnom uplynutí od zmluvy odstúpiť. Bez dodatočnej lehoty môžete odstúpiť najmä vtedy, ak dodanie
				odmietneme alebo ak bolo včasné dodanie vzhľadom na okolnosti mimoriadne dôležité, prípadne ste nás na
				túto dôležitosť upozornili pred uzavretím zmluvy.
			</p>
			<p>
				Pri doručení dopravcom z našej ponuky prechádza nebezpečenstvo náhodnej skazy, poškodenia alebo straty
				na spotrebiteľa prevzatím tovaru ním alebo ním určenou osobou. Osobitné zákonné pravidlo platí, ak si
				sám objedná dopravcu mimo nami ponúkaných možností. Vlastnícke právo prechádza na spotrebiteľa dodaním
				podľa Občianskeho zákonníka.
			</p>
			<p>
				Pri preberaní odporúčame skontrolovať zásielku a viditeľné poškodenie zdokumentovať. Nepodpísanie
				záznamu s dopravcom ani chýbajúca fotografia automaticky nevylučujú vaše práva zo zodpovednosti za
				vady. Vadu nám oznámte v zákonných lehotách.
			</p>

			<h2>6. Odstúpenie bez uvedenia dôvodu</h2>
			<h3>Lehota a jej začiatok</h3>
			<p>
				Spotrebiteľ môže od zmluvy uzavretej na diaľku odstúpiť bez uvedenia dôvodu do{" "}
				<strong>14 dní od prevzatia tovaru</strong>. Registrovaným zákazníkom, ktorí objednávku vytvorili po
				prihlásení do svojho zákazníckeho účtu, poskytujeme predĺženú lehotu <strong>30 dní</strong>. Pre
				uplatnenie tejto výhody platí rovnaký postup vrátenia uvedený v tejto časti; zákonné práva
				spotrebiteľa sa tým neobmedzujú.
			</p>
			<p>
				Lehota plynie odo dňa nasledujúceho po prevzatí tovaru zákazníkom alebo ním určenou osobou odlišnou od
				dopravcu. Ak sa viac výrobkov z jednej objednávky dodáva samostatne, rozhoduje prevzatie posledného
				výrobku; pri výrobku dodávanom po častiach prevzatie poslednej časti. Pri pravidelnom dodávaní tovaru
				počas vymedzeného obdobia sa zákonná lehota počíta od prevzatia prvej dodávky.
			</p>
			<p>
				Spotrebiteľ môže odstúpiť aj pred doručením a iba vo vzťahu ku konkrétnym položkám. Zákonné predĺženie
				lehoty pri nesplnení informačnej povinnosti tým nie je dotknuté: ak povinné poučenie nebolo
				poskytnuté, lehota sa predlžuje podľa § 20 zákona č. 108/2024 Z. z., najviac o 12 mesiacov nad riadnu
				zákonnú lehotu; ak poučenie v tejto dobe dodatočne poskytneme, plynie zákonná lehota od jeho
				doručenia.
			</p>

			<h3>Ako odstúpenie oznámiť</h3>
			<p>
				Odstúpenie môžete odoslať cez stránku{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstúpenie od zmluvy</Link>, e-mailom na{" "}
				<Mail /> alebo písomne na adresu {companyInfo.legalName}, {companyInfo.returnAddress}.
			</p>
			<p>
				Na tej istej stránke nájdete aj vzorový formulár. Jeho použitie nie je povinné; postačuje jednoznačné
				vyhlásenie umožňujúce identifikovať zákazníka, zmluvu a rozsah odstúpenia.
			</p>
			<p>
				Online funkcia je dostupná bez povinného prihlásenia. Po vyplnení oznámenia jeho odoslanie potvrdíte
				tlačidlom <strong>„Potvrdiť odstúpenie od zmluvy“</strong>. Bezodkladne vám pošleme potvrdenie na
				trvanlivom médiu, spravidla e-mailom, obsahujúce vaše oznámenie a dátum a čas jeho odoslania.
			</p>
			<p>
				Lehota je zachovaná, ak oznámenie odošlete najneskôr v jej posledný deň. Uplatnenie práva nie je
				podmienené naším predchádzajúcim schválením ani uvedením dôvodu.
			</p>

			<h3>Vrátenie výrobkov a spätná doprava</h3>
			<p>
				Ak sme vám neponúkli, že výrobky vyzdvihneme, odošlite alebo odovzdajte ich do{" "}
				<strong>14 dní od odstúpenia</strong> na adresu {companyInfo.returnAddress}. Lehota je zachovaná
				odoslaním v posledný deň. Ak sme vyzdvihnutie ponúkli, postupujte podľa dohody o prevzatí.
			</p>
			<p>
				Môžete použiť vlastného dopravcu bez nášho predchádzajúceho schválenia. Môžete nás tiež požiadať o
				ponuku spätného zvozu. Presnú cenu a navrhovaný termín vám oznámime vopred; platený zvoz objednáme až
				po vašom výslovnom súhlase.
			</p>
			<p>
				Priame náklady na vrátenie tovaru znáša spotrebiteľ, ak sme ho o tejto povinnosti riadne informovali
				pred uzavretím zmluvy. Pri tovare, ktorý vzhľadom na jeho povahu nemožno vrátiť bežnou poštou, sa pred
				uzavretím zmluvy poskytuje aj informácia o nákladoch na vrátenie. Ak informačnú povinnosť nesplníme
				alebo sa zaviažeme tieto náklady znášať sami, spotrebiteľ ich nehradí. Neskoršia ponuka zvozu
				nenahrádza chýbajúcu predzmluvnú informáciu.
			</p>
			<p>
				Vráťte príslušenstvo patriace k vracanému výrobku a zabaľte ho tak, aby sa pri preprave nepoškodil.
				Pôvodný obal, originál faktúry ani pridelenie čísla podania nie sú všeobecnými podmienkami platného
				odstúpenia.
			</p>

			<h3>Vrátenie platieb</h3>
			<p>
				Platby v rozsahu odstúpenia vrátime do <strong>14 dní od doručenia oznámenia</strong>. Pri odstúpení
				od celej zmluvy vrátime aj náklady na pôvodné doručenie, najviac vo výške najlacnejšieho bežného
				spôsobu dodania ponúkaného pre danú objednávku. Rozdiel za vami výslovne zvolené drahšie doručenie
				vracať nemusíme.
			</p>
			<p>
				Pri odstúpení iba od časti zmluvy vrátime platby v zodpovedajúcom rozsahu; nebudeme vám dodatočne
				doúčtovávať dopravu, dodanie, poštovné ani iné poplatky.
			</p>
			<p>
				Platbu vrátime rovnakým spôsobom, akým ste platili, pokiaľ výslovne nesúhlasíte s iným spôsobom bez
				poplatkov pre vás. Poukaz na ďalší nákup nie je povinnou náhradou vrátenia peňazí.
			</p>
			<p>
				Ak sme vám neponúkli vyzdvihnutie, môžeme s vrátením platieb počkať do doručenia tovaru alebo
				preukázania jeho odoslania, podľa toho, čo nastane skôr. Ak sme vyzdvihnutie ponúkli, toto oprávnenie
				na pozdržanie platieb sa neuplatní.
			</p>

			<h3>Zníženie hodnoty a výnimky</h3>
			<p>
				Spotrebiteľ zodpovedá za zníženie hodnoty spôsobené zaobchádzaním nad rozsah potrebný na zistenie
				vlastností a funkčnosti tovaru, ak bol riadne poučený o práve odstúpiť. Otvorenie obalu alebo
				primerané vyskúšanie samy osebe neznamenajú stratu práva odstúpiť.
			</p>
			<p>
				Paušálny poplatok za vrátenie alebo rozbalenie neúčtujeme. Prípadný nárok na náhradu zníženej hodnoty
				musí byť konkrétne odôvodnený. Pohľadávky vzniknuté odstúpením nebudeme jednostranne započítavať proti
				pohľadávkam spotrebiteľa.
			</p>
			<p>
				Právo odstúpiť sa nevzťahuje na tovar skutočne zhotovený podľa osobitných požiadaviek zákazníka alebo
				vyrobený na mieru. Zákonná výnimka sa môže vzťahovať tiež na tovar v ochrannom obale, ktorý nie je
				vhodné vrátiť z dôvodu ochrany zdravia alebo hygieny, ak bol tento obal po dodaní porušený. Výnimku
				uplatníme iba vtedy, keď sú splnené jej zákonné podmienky. Bežný výrobok objednávaný od dodávateľa ani
				štandardná zostava podľa vozidla nie sú len z tohto dôvodu výrobkom na mieru.
			</p>

			<h2>7. Zodpovednosť za vady a reklamácie</h2>
			<h3>Zákonná zodpovednosť</h3>
			<p>
				Pri spotrebiteľskej kúpe zodpovedáme za vady existujúce pri dodaní, ktoré sa prejavia do{" "}
				<strong>dvoch rokov od dodania</strong>. Pri veci s digitálnymi prvkami a dohodnutým nepretržitým
				dodávaním digitálneho obsahu alebo služby zodpovedáme za vady digitálnych prvkov počas celej
				dohodnutej doby, najmenej dva roky od dodania. Povinnosti týkajúce sa potrebných aktualizácií sa
				riadia Občianskym zákonníkom.
			</p>
			<p>
				Pri zmluvách uzavretých od <strong>31. júla 2026</strong> sa po prvom odstránení vady opravou doba
				zodpovednosti za vady predlžuje o <strong>12 mesiacov</strong>, a to len raz bez ohľadu na počet
				opráv. Na staršie zmluvy sa vzťahujú predpisy účinné pri ich uzavretí.
			</p>
			<p>
				Ak sa vada prejaví v zákonnej dobe, predpokladá sa, že existovala už pri dodaní, pokiaľ sa nepreukáže
				opak alebo to nie je nezlučiteľné s povahou tovaru alebo vady.
			</p>
			<p>
				Zodpovedáme aj za nesprávnu montáž, ak sme ju zabezpečovali ako súčasť zmluvy, alebo ak zákazník
				postupoval nesprávne v dôsledku nedostatkov nami poskytnutého návodu. Bežné opotrebovanie
				zodpovedajúce povahe výrobku alebo poškodenie spôsobené zákazníkom nie sú samy osebe vadou, za ktorú
				zodpovedáme; každý prípad sa posudzuje podľa okolností a zákona.
			</p>

			<h3>Oznámenie vady</h3>
			<p>
				Vadu oznámte do <strong>dvoch mesiacov od jej zistenia</strong>, najneskôr do uplynutia príslušnej
				doby zodpovednosti. Oznámenie môžete poslať e-mailom na <Mail />, písomne na adresu{" "}
				{companyInfo.returnAddress}, alebo uplatniť iným zákonom dovoleným spôsobom vrátane oznámenia v
				prevádzkarni predávajúceho.
			</p>
			<p>
				Popíšte výrobok a vadu, uveďte, kedy sa prejavila, a pridajte údaj umožňujúci overiť nákup u nás.
				Číslo objednávky, fotografia alebo video vybavenie uľahčia, nie sú však jediným prípustným dôkazom.
				Nevyžadujeme pôvodný obal ani výlučne originál faktúry.
			</p>
			<p>Bezodkladne vám poskytneme písomné potvrdenie o oznámení vady s lehotou na jej odstránenie.</p>

			<h3>Oprava alebo výmena</h3>
			<p>
				Máte právo vybrať si opravu alebo výmenu, pokiaľ zvolený spôsob nie je nemožný alebo v porovnaní s
				druhým spôsobom nevyžaduje neprimerané náklady. O vašom práve výberu a o príslušnom predĺžení doby
				zodpovednosti po oprave vás informujeme pred odstránením vady.
			</p>
			<p>
				Tovar opravíme alebo vymeníme bezplatne, v primeranej lehote a bez závažných ťažkostí pre vás. Lehota
				nesmie presiahnuť <strong>30 dní od oznámenia vady</strong>, pokiaľ dlhšiu lehotu neodôvodňuje
				objektívny dôvod, ktorý nemôžeme ovplyvniť; existenciu takého dôvodu musíme preukázať.
			</p>
			<p>
				Náklady potrebného prevzatia výrobku a doručenia opravenej alebo náhradnej veci znášame my. Ak náprava
				vyžaduje demontáž riadne nainštalovaného výrobku a následnú montáž, zabezpečíme ich alebo sa
				dohodneme, že ich zabezpečíte na naše náklady a nebezpečenstvo. Za bežné používanie výrobku pred
				výmenou nepožadujeme odplatu.
			</p>

			<h3>Zľava alebo odstúpenie pre vadu</h3>
			<p>
				Na primeranú zľavu alebo odstúpenie máte právo za podmienok § 624 Občianskeho zákonníka, najmä ak
				výrobok neopravíme ani nevymeníme, nápravu odmietneme, nesplníme zákonné povinnosti pri prevzatí alebo
				demontáži a montáži, rovnaká vada sa prejaví napriek oprave či výmene, vada je dostatočne závažná
				alebo je zrejmé, že ju neodstránime riadne a včas. Pri opakovanej alebo závažnej vade sa zohľadňujú
				všetky okolnosti prípadu.
			</p>
			<p>
				Zľava zodpovedá rozdielu medzi hodnotou výrobku s vadou a bez vady. Pre zanedbateľnú vadu alebo pri
				spolupodieľaní sa zákazníka na vzniku vady nemožno od zmluvy z tohto dôvodu odstúpiť; tieto
				skutočnosti preukazuje predávajúci.
			</p>
			<p>
				Ak je v objednávke viac výrobkov, odstúpenie pre vadu sa vzťahuje na vadný výrobok. Aj na ostatné sa
				môže vzťahovať vtedy, ak nemožno rozumne očakávať, že si ich ponecháte bez vadného výrobku.
			</p>
			<p>
				Pri odstúpení pre vadu sa výrobok vracia na naše náklady. Kúpnu cenu vrátime do{" "}
				<strong>14 dní od vrátenia výrobku alebo preukázania jeho odoslania</strong>, podľa toho, čo nastane
				skôr. Použijeme rovnaký spôsob platby, pokiaľ výslovne nesúhlasíte s iným, bez nákladov pre vás.
			</p>

			<h3>Odmietnutie reklamácie a záruka výrobcu</h3>
			<p>
				Ak zodpovednosť za vadu odmietneme, dôvody vám oznámime písomne. Ak následne znalecký posudok alebo
				odborné stanovisko akreditovanej osoby preukáže našu zodpovednosť, môžete vadu oznámiť opakovane a
				túto zodpovednosť už nemôžeme odmietnuť. Náhrada účelne vynaložených nákladov sa riadi zákonom.
			</p>
			<p>
				Prípadná spotrebiteľská záruka výrobcu alebo predávajúceho predstavuje práva navyše. Jej trvanie a
				podmienky nemôžu obmedziť vaše zákonné práva. Uplatnením reklamácie nie je dotknutý prípadný nárok na
				náhradu škody.
			</p>

			<h2>8. Žiadosť o nápravu a riešenie sporov</h2>
			<p>
				Ak nie ste spokojní s vybavením reklamácie alebo sa domnievate, že sme porušili vaše práva, môžete nás
				požiadať o nápravu na <Mail />.
			</p>
			<p>
				Ak žiadosť zamietneme alebo na ňu neodpovieme do <strong>30 dní</strong>, môžete podať návrh na
				alternatívne riešenie spotrebiteľského sporu. Obrátiť sa môžete na príslušný subjekt zo zoznamu
				Ministerstva hospodárstva SR; pre spory z nákupu tovaru je jedným z nich Slovenská obchodná inšpekcia.
			</p>
			<Adr lang="sk" />
			<p>
				Alternatívne riešenie spotrebiteľských sporov vedené SOI je bezplatné. Vaše právo obrátiť sa na súd
				zostáva zachované.
			</p>

			<h2>9. Osobné údaje</h2>
			<p>
				O účeloch a pravidlách spracúvania údajov informujeme na stránke{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Ochrana osobných údajov</Link>. O
				používaní cookies a podobných technológií na stránke{" "}
				<Link href={marketHref(channel, "/cookies")}>Zásady používania cookies</Link>.
			</p>
			<p>
				Nákup, reklamácia ani odstúpenie nie sú podmienené súhlasom s marketingom alebo s voliteľnými cookies.
			</p>

			<h2>10. Záverečné ustanovenia</h2>
			<p>
				Vzťahy sa riadia právnym poriadkom Slovenskej republiky, najmä Občianskym zákonníkom, zákonom č.
				108/2024 Z. z. o ochrane spotrebiteľa a zákonom č. 22/2004 Z. z. o elektronickom obchode. Voľba
				slovenského práva nesmie spotrebiteľa pripraviť o ochranu, ktorú mu za príslušných podmienok poskytujú
				kogentné predpisy štátu jeho obvyklého pobytu.
			</p>
			<p>
				Orgánom dozoru je{" "}
				<strong>
					Slovenská obchodná inšpekcia, {companyInfo.supervisoryAuthority.department},{" "}
					{companyInfo.supervisoryAuthority.address}
				</strong>
				.
			</p>
			<p>
				Zmeny podmienok sa uplatnia na zmluvy uzavreté po nadobudnutí ich účinnosti. Už uzavreté zmluvy sa
				naďalej riadia príslušným skorším znením a záväznými právnymi predpismi. Žiadne ustanovenie týchto
				podmienok neobmedzuje práva, ktoré spotrebiteľovi zaručuje zákon.
			</p>
		</>
	);
}

export function Cs({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Tyto podmínky upravují nákup zboží v internetovém obchodě MAKY.STORE. Pro konkrétní objednávku platí
				znění účinné v době uzavření smlouvy.
			</p>

			<h2>1. Kdo je prodávající</h2>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				Sídlo: {companyInfo.street}, {companyInfo.city}, Slovenská republika
				<br />
				IČO: {companyInfo.ico}
				<br />
				DIČ: {companyInfo.dic}
				<br />
				IČ DPH: {companyInfo.icDph}
			</p>
			<p>
				Společnost je plátcem DPH a je zapsána v obchodním rejstříku soudu Mestský súd Bratislava III, oddíl
				Sro, vložka č. 200804/B.
			</p>
			<p>
				E-mail: <Mail />
				<br />
				Telefon: <Phone />
			</p>
			<p>
				<strong>Adresa pro vrácení zboží, reklamace a související oznámení:</strong> {RETURN_ADDRESS}.
			</p>
			<p>V textu se jako „my“ označuje prodávající a jako „zákazník“ nebo „vy“ kupující.</p>
			<p>
				Spotřebitelem je fyzická osoba, která při uzavírání a plnění smlouvy nejedná v rámci podnikání nebo
				povolání. Zákonná práva uvedená pro spotřebitele se uplatňují podle skutečného postavení kupujícího a
				povahy nákupu.
			</p>

			<h2>2. Objednávka a vznik smlouvy</h2>
			<p>
				Nakupovat můžete i bez registrace. Vyberete zboží, vložíte ho do košíku, doplníte kontaktní,
				fakturační a doručovací údaje a vyberete si z dostupných způsobů dopravy a platby.
			</p>
			<p>
				Před odesláním objednávky můžete zkontrolovat a opravit její obsah i zadané údaje. Zobrazíme vám
				celkovou cenu včetně dopravy a případných dalších předem oznámených nákladů.
			</p>
			<p>
				Objednávku odešlete tlačítkem <strong>„Objednávka zavazující k platbě“</strong> nebo jiným stejně
				jednoznačným označením vyjadřujícím povinnost zaplatit. Odesláním objednávky se zavazujete uhradit
				uvedenou cenu.
			</p>
			<p>
				Kupní smlouva vzniká doručením našeho potvrzení o přijetí objednávky na váš e-mail. Potvrzení obsahuje
				shrnutí objednávky, dohodnuté podmínky a znění těchto obchodních podmínek na trvalém nosiči.
				Samostatná notifikace platební brány o platbě není potvrzením přijetí objednávky od prodávajícího.
			</p>
			<p>
				V české jazykové verzi se smlouva uzavírá v češtině. Údaje o smlouvě uchováváme pro účely jejího
				plnění a plnění zákonných povinností. Potvrzení objednávky a přiložené dokumenty si můžete uložit.
				Kopii údajů k vlastní objednávce si můžete vyžádat na našem e-mailu.
			</p>
			<p>
				Ke komunikaci používáte běžné internetové nebo telefonní připojení podle podmínek svého poskytovatele.
				Zvláštní poplatek za uzavření smlouvy na dálku neúčtujeme.
			</p>

			<h2>3. Zboží a jeho určení</h2>
			<p>
				Vlastnosti výrobku, obsah balení, jeho určení a případná omezení jsou uvedeny u produktu. U montážních
				sestav je důležitá také konfigurace vozidla a obsah konkrétní sestavy.
			</p>
			<p>
				Pokud potřebujete ověřit vhodnost výrobku, kontaktujte nás před objednáním. Toto doporučení neomezuje
				naši odpovědnost za správnost údajů v nabídce ani za soulad dodaného zboží se smlouvou.
			</p>
			<p>
				Označení <strong>„na objednávku“</strong> znamená, že zboží zajišťujeme od dodavatele. Samo o sobě
				neznamená výrobu na míru ani vyloučení práva spotřebitele odstoupit od smlouvy.
			</p>

			<h2>4. Cena a platba</h2>
			<p>
				Ceny zobrazené spotřebiteli jsou konečné ceny včetně DPH a ostatních daní. Cena dopravy se uvádí
				samostatně; spolu s celkovou cenou objednávky ji uvidíte před odesláním objednávky. Placené doplňky
				nebo dodatečné služby nepřidáváme bez vašeho výslovného souhlasu.
			</p>
			<p>
				Při nákupu v české verzi se cena uvádí v českých korunách. Závazná je cena potvrzená při uzavření
				smlouvy; pozdější změna ceny na webu nemění cenu již uzavřené objednávky.
			</p>
			<p>
				Online platby zpracovává platební brána <strong>Stripe</strong>. Konkrétní dostupné platební metody se
				zobrazují v pokladně. Úplné údaje o platební kartě zpracovává poskytovatel platební služby;
				prodávající je neukládá ani k nim nemá přístup.
			</p>
			<p>
				Pokud objednávku nelze přijmout a platba už proběhla, bezodkladně vám vrátíme přijatou částku. Po
				vzniku smlouvy nelze její podmínky jednostranně měnit jen proto, že dodavatel změnil cenu nebo
				dostupnost.
			</p>

			<h2>5. Doručení a převzetí</h2>
			<p>
				Zboží doručujeme prostřednictvím <strong>FedEx a Slovenské pošty</strong>. Dostupné služby závisí na
				obsahu objednávky, rozměrech a hmotnosti zásilky a doručovací adrese. Pro konkrétní objednávku se v
				pokladně zobrazují dostupné způsoby a ceny dopravy. U rozměrných nebo těžkých zásilek se doprava
				dojednává individuálně na základě vaší žádosti; cenu oznámíme před uzavřením smlouvy.
			</p>
			<p>
				Informaci o dodání poskytneme před uzavřením smlouvy. Zboží dodáme bez zbytečného odkladu, nejpozději
				do <strong>30 dnů od uzavření smlouvy</strong>, pokud se nedohodneme na jiném termínu. Konkrétně
				dohodnutý termín má přednost před tímto obecným pravidlem.
			</p>
			<p>
				Pokud dohodnutý termín nedodržíme, můžete nám poskytnout dodatečnou přiměřenou lhůtu pro dodání a po
				jejím marném uplynutí od smlouvy odstoupit. Bez dodatečné lhůty můžete odstoupit zejména tehdy, pokud
				dodání odmítneme nebo pokud bylo včasné dodání vzhledem k okolnostem mimořádně důležité, případně jste
				nás na tuto důležitost upozornili před uzavřením smlouvy.
			</p>
			<p>
				Při doručení dopravcem z naší nabídky přechází nebezpečí náhodné zkázy, poškození nebo ztráty na
				spotřebitele převzetím zboží jím nebo jím určenou osobou. Zvláštní zákonné pravidlo platí, pokud si
				sám objedná dopravce mimo námi nabízené možnosti. Vlastnické právo přechází na spotřebitele dodáním
				podle slovenského občanského zákoníku.
			</p>
			<p>
				Při převzetí doporučujeme zkontrolovat zásilku a viditelné poškození zdokumentovat. Nepodepsání
				záznamu s dopravcem ani chybějící fotografie automaticky nevylučují vaše práva z odpovědnosti za vady.
				Vadu nám oznamte v zákonných lhůtách.
			</p>

			<h2>6. Odstoupení bez uvedení důvodu</h2>
			<h3>Lhůta a její začátek</h3>
			<p>
				Spotřebitel může od smlouvy uzavřené na dálku odstoupit bez uvedení důvodu do{" "}
				<strong>14 dnů od převzetí zboží</strong>. Registrovaným zákazníkům, kteří objednávku vytvořili po
				přihlášení ke svému zákaznickému účtu, poskytujeme prodlouženou lhůtu <strong>30 dnů</strong>. Pro
				uplatnění této výhody platí stejný postup vrácení uvedený v této části; zákonná práva spotřebitele tím
				nejsou omezena.
			</p>
			<p>
				Lhůta běží ode dne následujícího po převzetí zboží zákazníkem nebo jím určenou osobou odlišnou od
				dopravce. Pokud se více výrobků z jedné objednávky dodává samostatně, rozhoduje převzetí posledního
				výrobku; u výrobku dodávaného po částech převzetí poslední části. Při pravidelném dodávání zboží po
				vymezenou dobu se zákonná lhůta počítá od převzetí první dodávky.
			</p>
			<p>
				Spotřebitel může odstoupit i před doručením a pouze ve vztahu ke konkrétním položkám. Zákonné
				prodloužení lhůty při nesplnění informační povinnosti tím není dotčeno: pokud povinné poučení nebylo
				poskytnuto, lhůta se prodlužuje podle § 20 zákona č. 108/2024 Z. z., nejvýše o 12 měsíců nad řádnou
				zákonnou lhůtu; pokud poučení v této době dodatečně poskytneme, běží zákonná lhůta od jeho doručení.
			</p>

			<h3>Jak odstoupení oznámit</h3>
			<p>
				Odstoupení můžete odeslat přes stránku{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstoupení od smlouvy</Link>, e-mailem na{" "}
				<Mail /> nebo písemně na adresu {companyInfo.legalName}, {companyInfo.returnAddress}.
			</p>
			<p>
				Na téže stránce najdete také vzorový formulář. Jeho použití není povinné; postačuje jednoznačné
				prohlášení umožňující identifikovat zákazníka, smlouvu a rozsah odstoupení.
			</p>
			<p>
				Lhůta je zachována, pokud oznámení odešlete nejpozději v její poslední den. Uplatnění práva není
				podmíněno naším předchozím schválením ani uvedením důvodu.
			</p>

			<h3>Vrácení výrobků a zpětná doprava</h3>
			<p>
				Pokud jsme vám nenabídli, že výrobky vyzvedneme, odešlete nebo předejte je do{" "}
				<strong>14 dnů od odstoupení</strong> na adresu {companyInfo.returnAddress}. Lhůta je zachována
				odesláním v poslední den. Pokud jsme vyzvednutí nabídli, postupujte podle dohody o převzetí.
			</p>
			<p>
				Můžete využít vlastního dopravce bez našeho předchozího schválení. Můžete nás také požádat o nabídku
				zpětného svozu. Přesnou cenu a navrhovaný termín vám sdělíme předem; placený svoz objednáme až po
				vašem výslovném souhlasu.
			</p>
			<p>
				Přímé náklady na vrácení zboží nese spotřebitel, pokud jsme ho o této povinnosti řádně informovali
				před uzavřením smlouvy. U zboží, které vzhledem k jeho povaze nelze vrátit běžnou poštou, se před
				uzavřením smlouvy poskytuje také informace o nákladech na vrácení. Pokud informační povinnost
				nesplníme nebo se zavážeme tyto náklady nést sami, spotřebitel je nehradí. Pozdější nabídka svozu
				nenahrazuje chybějící předsmluvní informaci.
			</p>
			<p>
				Vraťte příslušenství patřící k vracenému výrobku a zabalte ho tak, aby se při přepravě nepoškodil.
				Původní obal, originál faktury ani přidělení čísla podání nejsou obecnými podmínkami platného
				odstoupení.
			</p>

			<h3>Vrácení plateb</h3>
			<p>
				Platby v rozsahu odstoupení vrátíme do <strong>14 dnů od doručení oznámení</strong>. Při odstoupení od
				celé smlouvy vrátíme také náklady na původní doručení, nejvýše ve výši nejlevnějšího běžného způsobu
				dodání nabízeného pro danou objednávku. Rozdíl za vámi výslovně zvolené dražší doručení vracet
				nemusíme.
			</p>
			<p>
				Při odstoupení pouze od části smlouvy vrátíme platby v odpovídajícím rozsahu; nebudeme vám dodatečně
				doúčtovávat dopravu, dodání, poštovné ani jiné poplatky.
			</p>
			<p>
				Platbu vrátíme stejným způsobem, jakým jste platili, pokud výslovně nesouhlasíte s jiným způsobem bez
				poplatků pro vás. Poukaz na další nákup není povinnou náhradou vrácení peněz.
			</p>
			<p>
				Pokud jsme vám nenabídli vyzvednutí, můžeme s vrácením plateb počkat do doručení zboží nebo prokázání
				jeho odeslání, podle toho, co nastane dříve. Pokud jsme vyzvednutí nabídli, toto oprávnění k pozdržení
				plateb se neuplatní.
			</p>

			<h3>Snížení hodnoty a výjimky</h3>
			<p>
				Spotřebitel odpovídá za snížení hodnoty způsobené zacházením nad rozsah potřebný ke zjištění
				vlastností a funkčnosti zboží, pokud byl řádně poučen o právu odstoupit. Otevření obalu nebo přiměřené
				vyzkoušení samy o sobě neznamenají ztrátu práva odstoupit.
			</p>
			<p>
				Paušální poplatek za vrácení nebo rozbalení neúčtujeme. Případný nárok na náhradu snížené hodnoty musí
				být konkrétně odůvodněn. Pohledávky vzniklé odstoupením nebudeme jednostranně započítávat proti
				pohledávkám spotřebitele.
			</p>
			<p>
				Právo odstoupit se nevztahuje na zboží skutečně zhotovené podle zvláštních požadavků zákazníka nebo
				vyrobené na míru. Zákonná výjimka se může vztahovat také na zboží v ochranném obalu, které není vhodné
				vrátit z důvodu ochrany zdraví nebo hygieny, pokud byl tento obal po dodání porušen. Výjimku uplatníme
				pouze tehdy, když jsou splněny její zákonné podmínky. Běžný výrobek objednávaný od dodavatele ani
				standardní sestava podle vozidla nejsou jen z tohoto důvodu výrobkem na míru.
			</p>

			<h2>7. Odpovědnost za vady a reklamace</h2>
			<h3>Zákonná odpovědnost</h3>
			<p>
				Při spotřebitelské koupi odpovídáme za vady existující při dodání, které se projeví do{" "}
				<strong>dvou let od dodání</strong>. U věci s digitálními prvky a dohodnutým nepřetržitým dodáváním
				digitálního obsahu nebo služby odpovídáme za vady digitálních prvků po celou dohodnutou dobu, nejméně
				dva roky od dodání. Povinnosti týkající se potřebných aktualizací se řídí slovenským občanským
				zákoníkem.
			</p>
			<p>
				U smluv uzavřených od <strong>31. července 2026</strong> se po prvním odstranění vady opravou doba
				odpovědnosti za vady prodlužuje o <strong>12 měsíců</strong>, a to pouze jednou bez ohledu na počet
				oprav. Na starší smlouvy se vztahují předpisy účinné při jejich uzavření.
			</p>
			<p>
				Pokud se vada projeví v zákonné době, předpokládá se, že existovala už při dodání, pokud se neprokáže
				opak nebo to není neslučitelné s povahou zboží nebo vady.
			</p>
			<p>
				Odpovídáme také za nesprávnou montáž, pokud jsme ji zajišťovali jako součást smlouvy nebo pokud
				zákazník postupoval nesprávně v důsledku nedostatků námi poskytnutého návodu. Běžné opotřebení
				odpovídající povaze výrobku nebo poškození způsobené zákazníkem nejsou samy o sobě vadou, za kterou
				odpovídáme; každý případ se posuzuje podle okolností a zákona.
			</p>

			<h3>Oznámení vady</h3>
			<p>
				Vadu oznamte do <strong>dvou měsíců od jejího zjištění</strong>, nejpozději do uplynutí příslušné doby
				odpovědnosti. Oznámení můžete poslat e-mailem na <Mail />, písemně na adresu{" "}
				{companyInfo.returnAddress} nebo uplatnit jiným zákonem dovoleným způsobem včetně oznámení v
				provozovně prodávajícího.
			</p>
			<p>
				Popište výrobek a vadu, uveďte, kdy se projevila, a přidejte údaj umožňující ověřit nákup u nás. Číslo
				objednávky, fotografie nebo video vyřízení usnadní, nejsou však jediným přípustným důkazem.
				Nevyžadujeme původní obal ani výhradně originál faktury.
			</p>
			<p>Bezodkladně vám poskytneme písemné potvrzení o oznámení vady se lhůtou pro její odstranění.</p>

			<h3>Oprava nebo výměna</h3>
			<p>
				Máte právo zvolit opravu nebo výměnu, pokud zvolený způsob není nemožný nebo v porovnání s druhým
				způsobem nevyžaduje nepřiměřené náklady. O vašem právu volby a o příslušném prodloužení doby
				odpovědnosti po opravě vás informujeme před odstraněním vady.
			</p>
			<p>
				Zboží opravíme nebo vyměníme bezplatně, v přiměřené lhůtě a bez závažných obtíží pro vás. Lhůta nesmí
				přesáhnout <strong>30 dnů od oznámení vady</strong>, pokud delší lhůtu neodůvodňuje objektivní důvod,
				který nemůžeme ovlivnit; existenci takového důvodu musíme prokázat.
			</p>
			<p>
				Náklady potřebného převzetí výrobku a doručení opravené nebo náhradní věci neseme my. Pokud náprava
				vyžaduje demontáž řádně nainstalovaného výrobku a následnou montáž, zajistíme je nebo se dohodneme, že
				je zajistíte na naše náklady a nebezpečí. Za běžné používání výrobku před výměnou nepožadujeme úplatu.
			</p>

			<h3>Sleva nebo odstoupení kvůli vadě</h3>
			<p>
				Na přiměřenou slevu nebo odstoupení máte právo za podmínek § 624 slovenského občanského zákoníku,
				zejména pokud výrobek neopravíme ani nevyměníme, nápravu odmítneme, nesplníme zákonné povinnosti při
				převzetí nebo demontáži a montáži, stejná vada se projeví navzdory opravě či výměně, vada je
				dostatečně závažná nebo je zřejmé, že ji neodstraníme řádně a včas. U opakované nebo závažné vady se
				zohledňují všechny okolnosti případu.
			</p>
			<p>
				Sleva odpovídá rozdílu mezi hodnotou výrobku s vadou a bez vady. Kvůli zanedbatelné vadě nebo pokud se
				zákazník na vzniku vady spolupodílel, nelze od smlouvy z tohoto důvodu odstoupit; tyto skutečnosti
				prokazuje prodávající.
			</p>
			<p>
				Pokud je v objednávce více výrobků, odstoupení kvůli vadě se vztahuje na vadný výrobek. Na ostatní se
				může vztahovat tehdy, pokud nelze rozumně očekávat, že si je ponecháte bez vadného výrobku.
			</p>
			<p>
				Při odstoupení kvůli vadě se výrobek vrací na naše náklady. Kupní cenu vrátíme do{" "}
				<strong>14 dnů od vrácení výrobku nebo prokázání jeho odeslání</strong>, podle toho, co nastane dříve.
				Použijeme stejný způsob platby, pokud výslovně nesouhlasíte s jiným, bez nákladů pro vás.
			</p>

			<h3>Odmítnutí reklamace a záruka výrobce</h3>
			<p>
				Pokud odpovědnost za vadu odmítneme, důvody vám sdělíme písemně. Pokud následně znalecký posudek nebo
				odborné stanovisko akreditované osoby prokáže naši odpovědnost, můžete vadu oznámit opakovaně a tuto
				odpovědnost už nemůžeme odmítnout. Náhrada účelně vynaložených nákladů se řídí zákonem.
			</p>
			<p>
				Případná spotřebitelská záruka výrobce nebo prodávajícího představuje práva navíc. Její trvání a
				podmínky nemohou omezit vaše zákonná práva. Uplatněním reklamace není dotčen případný nárok na náhradu
				škody.
			</p>

			<h2>8. Žádost o nápravu a řešení sporů</h2>
			<p>
				Pokud nejste spokojeni s vyřízením reklamace nebo se domníváte, že jsme porušili vaše práva, můžete
				nás požádat o nápravu na <Mail />.
			</p>
			<p>
				Pokud žádost zamítneme nebo na ni neodpovíme do <strong>30 dnů</strong>, můžete podat návrh na
				alternativní řešení spotřebitelského sporu. Jako prodávající se sídlem na Slovensku jsme příslušní k
				subjektům ze seznamu Ministerstva hospodárstva SR; pro spory z nákupu zboží je jedním z nich Slovenská
				obchodná inšpekcia.
			</p>
			<Adr lang="cs" />
			<p>
				Alternativní řešení spotřebitelských sporů vedené SOI je bezplatné. Jako spotřebitel s bydlištěm v
				jiném státě Evropské unie se můžete obrátit také na subjekt mimosoudního řešení sporů ve své zemi.
				Vaše právo obrátit se na soud zůstává zachováno.
			</p>

			<h2>9. Osobní údaje</h2>
			<p>
				O účelech a pravidlech zpracování údajů informujeme na stránce{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Ochrana osobních údajů</Link>. O
				používání cookies a podobných technologií na stránce{" "}
				<Link href={marketHref(channel, "/cookies")}>Zásady používání cookies</Link>.
			</p>
			<p>
				Nákup, reklamace ani odstoupení nejsou podmíněny souhlasem s marketingem nebo s volitelnými cookies.
			</p>

			<h2>10. Závěrečná ustanovení</h2>
			<p>
				Vztahy se řídí právním řádem Slovenské republiky, zejména slovenským občanským zákoníkem, zákonem č.
				108/2024 Z. z. o ochraně spotřebitele a zákonem č. 22/2004 Z. z. o elektronickém obchodu.{" "}
				<strong>
					Volba slovenského práva vás nesmí připravit o ochranu, kterou vám poskytují kogentní předpisy státu
					vašeho obvyklého pobytu.
				</strong>{" "}
				Jako spotřebiteli s bydlištěm v České republice vám tedy zůstávají zachována práva podle českých
				kogentních předpisů, pokud jsou pro vás příznivější.
			</p>
			<p>
				Orgánem dozoru nad prodávajícím je{" "}
				<strong>
					Slovenská obchodná inšpekcia, {companyInfo.supervisoryAuthority.department},{" "}
					{companyInfo.supervisoryAuthority.address}
				</strong>
				.
			</p>
			<p>
				Změny podmínek se uplatní na smlouvy uzavřené po nabytí jejich účinnosti. Již uzavřené smlouvy se
				nadále řídí příslušným dřívějším zněním a závaznými právními předpisy. Žádné ustanovení těchto
				podmínek neomezuje práva, která spotřebiteli zaručuje zákon.
			</p>
		</>
	);
}

/**
 * The German body, shared by both German-speaking markets.
 *
 * Three things here are deliberate and should survive a later edit.
 *
 * **§ 4 states prepayment and rules out cash on delivery.** That is the 2026-09-08
 * decision for every market outside Slovakia, and it is stated in the terms as well as
 * on the shipping page because it is a term of the contract, not just an FYI.
 *
 * **The `WITHDRAWAL_TERMS_FUNCTION` slot renders its `previewNotActivated` variant.**
 * Returns V2 accepts `market: "SK"` only, so there is no online function on these
 * markets yet. The clause therefore describes the e-mail and postal routes and says the
 * preview is not an order surface for new consumer contracts. The `active` wording,
 * which describes the function and where to find it, belongs to the release that turns
 * the function on — writing it now would put a promise into terms that customers accept.
 *
 * **Everything about deadlines and the 12-month post-repair extension is attributed to
 * the agreed Slovak law**, not offered as local German or Austrian entitlement, with the
 * Art. 6 Rome I carve-out stated per market via `market.mandatoryLawSentence`.
 */
function German({ channel, market }: { channel: string; market: GermanMarket }) {
	return (
		<>
			<p>
				Diese Bedingungen gelten für den Kauf von Waren im Onlineshop MAKY.STORE. Für Ihre Bestellung ist die
				bei Vertragsabschluss geltende Fassung maßgeblich.
			</p>
			<p>
				<strong>
					Wir sind ein slowakischer Verkäufer. Die nachfolgende Wahl slowakischen Rechts nimmt Ihnen nicht den
					Schutz zwingender Verbraucherschutzbestimmungen an Ihrem gewöhnlichen Aufenthaltsort.
				</strong>{" "}
				Für Verbraucher mit gewöhnlichem Aufenthalt in {market.countryName} bleiben diese Schutzvorschriften
				unter den Voraussetzungen von Artikel 6 der Rom-I-Verordnung uneingeschränkt anwendbar.
			</p>

			<h2>1. Ihr Vertragspartner</h2>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				Firmensitz: {companyInfo.street}, {companyInfo.city}, {SLOVAKIA_DE}
				<br />
				Unternehmensidentifikationsnummer (IČO): {companyInfo.ico}
				<br />
				Slowakische Steuernummer (DIČ): {companyInfo.dic}
				<br />
				Umsatzsteuer-Identifikationsnummer: {companyInfo.icDph}
			</p>
			<p>
				Die Gesellschaft ist in der Slowakei umsatzsteuerlich registriert und im Handelsregister des
				Stadtgerichts Bratislava III (Mestský súd Bratislava III), Abteilung Sro, unter der Eintragsnummer
				200804/B eingetragen.
			</p>
			<p>
				E-Mail: <Mail />
				<br />
				Telefon: <Phone />
			</p>
			<p>
				<strong>Anschrift für Rücksendungen, Reklamationen und damit zusammenhängende Mitteilungen:</strong>{" "}
				{RETURN_ADDRESS_DE}.
			</p>
			<p>Mit „wir“ ist in diesen Bedingungen der Verkäufer gemeint, mit „Sie“ der Käufer.</p>
			<p>
				Verbraucher ist eine natürliche Person, die den Vertrag zu einem Zweck abschließt, der nicht ihrer
				gewerblichen oder beruflichen Tätigkeit zuzurechnen ist. Entscheidend sind die tatsächliche Stellung
				des Käufers und der Zweck des Kaufs. Die nachfolgend ausdrücklich für Verbraucher beschriebenen
				gesetzlichen Rechte richten sich danach.
			</p>

			<h2>2. Bestellung und Vertragsschluss</h2>
			<p>
				Sie können auch ohne Registrierung bestellen. Legen Sie die gewünschten Artikel in den Warenkorb,
				geben Sie Ihre Kontakt-, Rechnungs- und Lieferdaten ein und wählen Sie eine der angebotenen Versand-
				und Zahlungsarten.
			</p>
			<p>
				Vor dem verbindlichen Abschluss können Sie die Artikel und Ihre Angaben prüfen und korrigieren. Wir
				zeigen Ihnen den Gesamtbetrag einschließlich Versand und etwaiger weiterer, zuvor mitgeteilter Kosten.
			</p>
			<p>
				Mit einem Klick auf <strong>„Zahlungspflichtig bestellen“</strong> oder eine ebenso eindeutige
				Schaltfläche geben Sie eine zahlungspflichtige Bestellung ab.
			</p>
			<p>
				Der Kaufvertrag kommt zustande, wenn Ihnen unsere Bestätigung der Annahme Ihrer Bestellung per E-Mail
				zugeht. Sie enthält die Bestellübersicht, die vereinbarten Bedingungen und diese AGB auf einem
				dauerhaften Datenträger. Eine gesonderte Zahlungsmitteilung des Zahlungsdienstleisters ist für sich
				genommen keine Annahmebestätigung des Verkäufers.
			</p>
			<p>
				Für Bestellungen in der deutschen Sprachversion schließen wir den Vertrag in{" "}
				<strong>deutscher Sprache</strong>. Wir speichern die Vertragsdaten zur Abwicklung des Kaufs und zur
				Erfüllung gesetzlicher Pflichten. Sie können die Bestellbestätigung und die beigefügten Dokumente
				speichern. Eine Kopie der Angaben zu Ihrer eigenen Bestellung erhalten Sie auf Anfrage per E-Mail.
			</p>
			<p>
				Für die Kommunikation nutzen Sie Ihren Internet- oder Telefonanschluss zu den Bedingungen Ihres
				Anbieters. Für den Vertragsschluss im Fernabsatz berechnen wir keine besondere Kommunikationsgebühr.
			</p>

			<h2>3. Produkte und bestimmungsgemäße Verwendung</h2>
			<p>
				Eigenschaften, Lieferumfang, Verwendungszweck und mögliche Einschränkungen finden Sie beim jeweiligen
				Produkt. Bei Montagesets sind auch die Fahrzeugkonfiguration und die Zusammensetzung des konkreten
				Sets wichtig.
			</p>
			<p>
				Sie sind unsicher, ob ein Artikel geeignet ist? Fragen Sie uns bitte vor der Bestellung. Diese
				Empfehlung schränkt unsere Verantwortung für richtige Produktangaben und für die vertragsgemäße
				Beschaffenheit der gelieferten Ware nicht ein.
			</p>
			<p>
				Der Hinweis <strong>„Auf Bestellung“</strong> bedeutet, dass wir den Artikel beim Lieferanten
				beschaffen. Er bedeutet für sich genommen weder eine individuelle Anfertigung noch den Ausschluss des
				gesetzlichen Widerrufsrechts.
			</p>

			<h2>4. Preise und Zahlung</h2>
			<p>
				Die für Verbraucher angezeigten Preise sind Endpreise einschließlich der anwendbaren Umsatzsteuer und
				sonstiger Steuern. Versandkosten werden gesondert ausgewiesen. Sie sehen diese zusammen mit dem
				Gesamtbetrag, bevor Sie die Bestellung verbindlich abschicken. Kostenpflichtige Zusatzleistungen fügen
				wir nicht ohne Ihre ausdrückliche Zustimmung hinzu.
			</p>
			<p>
				Die Preise für {market.countryName} werden in <strong>Euro (EUR)</strong> angegeben. Maßgeblich ist
				der bei Vertragsschluss bestätigte Preis. Eine spätere Preisänderung im Shop ändert den Preis eines
				bereits geschlossenen Vertrags nicht.
			</p>
			<p>
				Bestellungen mit Lieferung nach {market.countryName} bezahlen Sie im Voraus über{" "}
				<strong>Stripe</strong>. Die verfügbaren Zahlungsarten sehen Sie im Bestellprozess. Eine Zahlung per
				Nachnahme bieten wir nicht an. Wir versenden Ihre Bestellung nach Eingang der Zahlung und entsprechend
				der angegebenen Warenverfügbarkeit. Vollständige Kartendaten verarbeitet der Zahlungsdienstleister;
				wir speichern diese nicht und haben darauf keinen Zugriff.
			</p>
			<p>
				Können wir eine Bestellung nicht annehmen, obwohl bereits eine Zahlung eingegangen ist, erstatten wir
				den erhaltenen Betrag unverzüglich. Nach Vertragsschluss dürfen wir die vereinbarten Bedingungen nicht
				allein deshalb einseitig ändern, weil unser Lieferant seine Preise oder die Verfügbarkeit geändert
				hat.
			</p>

			<h2>5. Lieferung und Annahme der Sendung</h2>
			<p>
				Für den Versand arbeiten wir mit <strong>FedEx und Slovenská pošta (Slowakische Post)</strong>{" "}
				zusammen. Verfügbare Versandarten hängen vom Inhalt der Bestellung, von Abmessungen und Gewicht der
				Sendung sowie von der Lieferadresse ab. Die für Ihre konkrete Bestellung verfügbaren Möglichkeiten und
				Kosten sehen Sie im Bestellprozess.
			</p>
			<p>
				Wir informieren Sie vor Vertragsabschluss über die Lieferung. Soweit wir keinen anderen Termin
				vereinbaren, liefern wir ohne unnötige Verzögerung, spätestens innerhalb von{" "}
				<strong>30 Tagen nach Vertragsschluss</strong>. Ein konkret vereinbarter Liefertermin geht dieser
				allgemeinen Regel vor.
			</p>
			<p>
				Halten wir den vereinbarten Termin nicht ein, können Sie uns eine angemessene zusätzliche Lieferfrist
				setzen und nach deren erfolglosem Ablauf vom Vertrag zurücktreten. Eine zusätzliche Frist ist
				insbesondere nicht erforderlich, wenn wir die Lieferung verweigern oder wenn eine rechtzeitige
				Lieferung aufgrund der Umstände wesentlich war oder Sie uns vor Vertragsschluss ausdrücklich auf diese
				Bedeutung hingewiesen haben.
			</p>
			<p>
				Bei einer Lieferung durch einen von uns angebotenen Versanddienstleister geht die Gefahr des
				zufälligen Verlusts oder der Beschädigung erst auf Sie als Verbraucher über, wenn Sie oder eine von
				Ihnen benannte Person die Ware erhalten. Eine gesetzliche Ausnahme gilt, wenn Sie selbst einen
				Beförderer beauftragen, den wir Ihnen nicht angeboten haben. Das Eigentum geht nach den anwendbaren
				Regeln des slowakischen Bürgerlichen Gesetzbuchs mit der Lieferung auf den Verbraucher über.
			</p>
			<p>
				Prüfen Sie die Sendung nach Möglichkeit bei der Annahme und dokumentieren Sie sichtbare Schäden. Ein
				fehlender Schadensvermerk des Beförderers oder ein fehlendes Foto schließen Ihre gesetzlichen
				Mängelrechte nicht automatisch aus. Es gelten die gesetzlichen Fristen für die Geltendmachung von
				Mängeln.
			</p>

			<h2>6. Widerruf ohne Angabe von Gründen</h2>
			<h3>Frist und Fristbeginn</h3>
			<p>
				Verbraucher können einen im Fernabsatz geschlossenen Kauf grundsätzlich innerhalb von{" "}
				<strong>14 Tagen nach Erhalt der Ware</strong> ohne Angabe von Gründen widerrufen. Für Kunden, die
				ihre Bestellung nach der Anmeldung in ihrem Kundenkonto aufgegeben haben, verlängern wir die Frist auf{" "}
				<strong>30 Tage</strong>. Für diese Verlängerung gelten derselbe Rückgabeablauf und dieselben
				nachfolgenden Bedingungen; Ihre gesetzlichen Rechte bleiben unberührt.
				{market.terminologyNote ? ` ${market.terminologyNote}` : ""}
			</p>
			<p>
				Die Frist beginnt am Tag nach dem Erhalt durch Sie oder eine von Ihnen benannte Person, die nicht der
				Beförderer ist. Werden mehrere Waren einer einheitlichen Bestellung getrennt geliefert, zählt der
				Erhalt der letzten Ware. Bei einer Lieferung in mehreren Teilsendungen oder Stücken zählt der Erhalt
				der letzten Teilsendung oder des letzten Stücks. Bei einer vereinbarten regelmäßigen Warenlieferung
				über einen festgelegten Zeitraum zählt die erste Lieferung.
			</p>
			<p>
				Sie können den Widerruf auch vor der Lieferung erklären oder auf einzelne Artikel beschränken.
				Gesetzliche Regeln zur Verlängerung der Frist bei fehlender Belehrung bleiben bestehen. Fehlt die
				vorgeschriebene Belehrung, verlängert sich die gesetzliche Frist nach den einschlägigen Vorschriften
				um bis zu zwölf Monate über die reguläre Frist hinaus. Holen wir die Belehrung in dieser Zeit nach,
				beginnt mit ihrem Zugang die gesetzliche 14-tägige Frist.
			</p>

			<h3>So erklären Sie den Widerruf</h3>
			<p>
				Sie können uns eine eindeutige Erklärung per E-Mail an <Mail /> oder per Post an {RETURN_ADDRESS_DE}{" "}
				übermitteln. Auf der Seite{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>{market.withdrawalTerm}</Link> finden Sie
				weitere Informationen und ein Musterformular.
			</p>
			<p>
				Die Nutzung des Musterformulars ist freiwillig. Ihre Erklärung muss erkennen lassen, wer widerruft,
				auf welchen Vertrag sie sich bezieht und welche Artikel sie umfasst. Eine Begründung und unsere
				vorherige Genehmigung sind nicht erforderlich.
			</p>
			<p>
				Die Online-Funktion dieser Ländervorschau ist noch nicht aktiviert. Hinweise zu den verfügbaren Wegen
				finden Sie auf der Seite{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>{market.withdrawalTerm}</Link>. Die Vorschau
				darf nicht als fertige Bestelloberfläche für neue Verbraucherverträge verwendet werden.
			</p>
			<p>Zur Wahrung der Frist genügt es, die Erklärung spätestens am letzten Tag der Frist abzusenden.</p>

			<h3>Rücksendung und Abholung</h3>
			<p>
				Haben wir Ihnen keine Abholung angeboten, senden Sie die Ware spätestens innerhalb von{" "}
				<strong>14 Tagen nach Ihrer Widerrufserklärung</strong> an {companyInfo.returnAddress}, {SLOVAKIA_DE},
				zurück oder übergeben Sie sie dort. Das rechtzeitige Absenden genügt. Haben wir eine Abholung
				angeboten, erfolgt die Bereitstellung nach der entsprechenden Vereinbarung.
			</p>
			<p>
				Sie dürfen einen eigenen Versanddienstleister beauftragen, ohne zuvor unsere Genehmigung einzuholen.
				Alternativ können Sie ein Angebot für eine Abholung anfragen. Den Preis und den vorgeschlagenen Ablauf
				teilen wir Ihnen vorab mit. Eine kostenpflichtige Abholung beauftragen wir erst nach Ihrer
				ausdrücklichen Zustimmung. Die bloße Anfrage nach einem Angebot ist weder ein Abholauftrag noch die
				Annahme eines kostenpflichtigen Angebots.
			</p>
			<p>
				Die unmittelbaren Rücksendekosten tragen Sie, sofern wir Sie darüber vor Vertragsabschluss
				ordnungsgemäß informiert haben. Kann die Ware aufgrund ihrer Beschaffenheit nicht auf dem normalen
				Postweg zurückgesendet werden, erhalten Sie vor Vertragsschluss auch die Information über die
				Rücksendekosten. Haben wir diese Informationspflicht nicht erfüllt oder übernehmen wir die Kosten
				selbst, müssen Sie diese nicht tragen. Ein späteres Abholangebot ersetzt eine fehlende vorvertragliche
				Information nicht.
			</p>
			<p>
				Senden Sie das zur Ware gehörende Zubehör mit zurück und verpacken Sie die Ware transportsicher.
				Originalverpackung, Originalrechnung und eine von uns vergebene Vorgangsnummer sind keine allgemeinen
				Voraussetzungen für einen wirksamen Widerruf.
			</p>

			<h3>Erstattung</h3>
			<p>
				Wir erstatten die vom Widerruf erfassten Zahlungen innerhalb von{" "}
				<strong>14 Tagen nach Eingang Ihrer Erklärung</strong>. Bei einem vollständigen Widerruf erstatten wir
				auch die ursprünglichen Lieferkosten, höchstens jedoch die Kosten der günstigsten Standardlieferung,
				die wir für diese Bestellung angeboten haben. Einen Aufpreis für eine von Ihnen ausdrücklich gewählte
				teurere Lieferung müssen wir nicht erstatten.
			</p>
			<p>
				Bei einem teilweisen Widerruf erfolgt die Erstattung im entsprechenden Umfang. Wir berechnen Ihnen
				wegen des teilweisen Widerrufs nicht nachträglich zusätzliche Versand-, Liefer- oder sonstige
				Gebühren.
			</p>
			<p>
				Wir verwenden dasselbe Zahlungsmittel wie beim Kauf, sofern Sie nicht ausdrücklich einer anderen, für
				Sie kostenfreien Lösung zustimmen. Einen Einkaufsgutschein müssen Sie nicht anstelle einer
				Geldrückzahlung akzeptieren.
			</p>
			<p>
				Haben wir keine Abholung angeboten, dürfen wir die Erstattung zurückhalten, bis wir die Ware erhalten
				haben oder Sie ihre Absendung nachgewiesen haben — je nachdem, was früher eintritt. Haben wir eine
				Abholung angeboten, gilt dieses Zurückbehaltungsrecht nicht.
			</p>

			<h3>Wertverlust und Ausnahmen</h3>
			<p>
				Sie können für einen Wertverlust verantwortlich sein, der auf einen Umgang mit der Ware zurückzuführen
				ist, der zur Prüfung ihrer Beschaffenheit, Eigenschaften und Funktionsweise nicht notwendig war.
				Voraussetzung ist eine ordnungsgemäße Belehrung über das Widerrufsrecht. Das Öffnen der Verpackung
				oder eine angemessene Prüfung führen für sich genommen nicht zum Verlust dieses Rechts.
			</p>
			<p>
				Wir berechnen keine pauschale Rückgabe- oder Auspackgebühr. Einen Anspruch wegen eines Wertverlusts
				müssen wir konkret begründen. Wir rechnen aus dem Widerruf entstandene Forderungen nicht einseitig
				gegen Ihre Erstattungsansprüche auf.
			</p>
			<p>
				Kein Widerrufsrecht besteht insbesondere bei Waren, die tatsächlich nach Ihren individuellen Vorgaben
				angefertigt oder eindeutig auf Ihre persönlichen Bedürfnisse zugeschnitten werden. Eine gesetzliche
				Ausnahme kann auch für versiegelte Waren gelten, die aus Gesundheits- oder Hygienegründen nicht zur
				Rückgabe geeignet sind, wenn die Versiegelung nach der Lieferung entfernt wurde. Wir wenden eine
				Ausnahme nur an, wenn ihre gesetzlichen Voraussetzungen erfüllt sind.
			</p>
			<p>
				<strong>
					Ein normaler Artikel, den wir beim Lieferanten bestellen, oder ein Standardset für ein bestimmtes
					Fahrzeug ist allein deshalb keine individuelle Anfertigung.
				</strong>
			</p>

			<h2>7. Gesetzliche Mängelrechte und Reklamationen</h2>
			<h3>Gesetzliche Haftung</h3>
			<p>
				Die folgenden Regeln beschreiben die Rechte aus dem vereinbarten slowakischen Recht.{" "}
				{market.mandatoryLawSentence}
			</p>
			<p>
				Bei Verbraucherkäufen haften wir für Mängel, die bei Lieferung vorhanden waren und sich innerhalb von{" "}
				<strong>zwei Jahren ab Lieferung</strong> zeigen. Bei Waren mit digitalen Elementen und einer
				vereinbarten fortlaufenden Bereitstellung digitaler Inhalte oder Dienste haften wir für deren
				Vertragsmäßigkeit während des gesamten vereinbarten Zeitraums, mindestens jedoch zwei Jahre ab
				Lieferung. Die Pflichten zur Bereitstellung notwendiger Aktualisierungen richten sich nach den
				anwendbaren gesetzlichen Bestimmungen.
			</p>
			<p>
				Bei ab dem <strong>31. Juli 2026</strong> geschlossenen Verträgen verlängert sich die Haftungsdauer
				nach der ersten Mangelbeseitigung durch Reparatur nach slowakischem Recht einmalig um{" "}
				<strong>zwölf Monate</strong>, unabhängig von der Zahl späterer Reparaturen. Für ältere Verträge
				gelten die bei ihrem Abschluss anwendbaren Vorschriften. Gesetzliche Regeln zur Hemmung, zum Neubeginn
				und zur Verlängerung von Fristen bleiben unberührt.
			</p>
			<p>
				Zeigt sich ein Mangel innerhalb der maßgeblichen Haftungsdauer, wird nach den slowakischen Regeln
				vermutet, dass er bereits bei Lieferung vorhanden war, sofern nicht das Gegenteil nachgewiesen wird
				oder die Vermutung mit der Art der Ware oder des Mangels unvereinbar ist.
			</p>
			<p>
				Wir haften auch für eine fehlerhafte Montage, die wir als Teil des Vertrags vorgenommen oder
				veranlasst haben, und für eine fehlerhafte Montage durch den Kunden, wenn sie auf Mängeln der von uns
				bereitgestellten Anleitung beruht. Ein der Ware entsprechender normaler Verschleiß oder ein vom Kunden
				verursachter Schaden ist für sich genommen kein von uns zu vertretender Mangel. Jeder Fall wird nach
				seinen tatsächlichen Umständen und den gesetzlichen Regeln beurteilt.
			</p>

			<h3>Einen Mangel melden</h3>
			<p>
				Bitte melden Sie einen Mangel möglichst bald nach seiner Entdeckung, zum Beispiel per E-Mail an{" "}
				<Mail /> oder schriftlich an {companyInfo.returnAddress}, {SLOVAKIA_DE}. Auch andere gesetzlich
				zulässige Wege bleiben möglich. Ihre zwingenden Verbraucherrechte machen wir nicht von einer
				sofortigen Warenprüfung oder einer zusätzlichen Mängelanzeige innerhalb von zwei Monaten abhängig. Es
				gelten die maßgeblichen gesetzlichen Fristen.
			</p>
			<p>
				Beschreiben Sie den Artikel, den Mangel und den Zeitpunkt, an dem er aufgetreten ist. Eine Angabe, mit
				der wir den Kauf zuordnen können, hilft uns. Bestellnummer, Fotos oder Videos erleichtern die
				Bearbeitung, sind aber nicht die einzig zulässigen Nachweise. Originalverpackung und ausschließlich
				die Originalrechnung verlangen wir nicht.
			</p>
			<p>
				Sie erhalten unverzüglich eine schriftliche Bestätigung der Mängelanzeige. Darin nennen wir die Frist
				für die Mangelbeseitigung.
			</p>

			<h3>Reparatur oder Ersatzlieferung</h3>
			<p>
				Grundsätzlich können Sie zwischen Reparatur und Ersatzlieferung wählen. Die gewählte Abhilfe darf
				abgelehnt werden, wenn sie unmöglich oder im Vergleich zur anderen Abhilfe mit unverhältnismäßigen
				Kosten verbunden ist. Über Ihre Wahlmöglichkeit und die einschlägige Verlängerung der Haftungsdauer
				nach einer Reparatur informieren wir Sie vor der Abhilfe.
			</p>
			<p>
				Die Reparatur oder Ersatzlieferung erfolgt kostenlos, innerhalb angemessener Zeit und ohne erhebliche
				Unannehmlichkeiten für Sie. Nach den hier zugrunde gelegten slowakischen Regeln darf die Frist{" "}
				<strong>30 Tage ab der Mängelanzeige</strong> nicht überschreiten, es sei denn, ein objektiver, von
				uns nicht beeinflussbarer Grund rechtfertigt eine längere Frist. Einen solchen Grund müssen wir
				nachweisen. Diese Regel erlaubt uns nicht, eine nach den Umständen gebotene frühere Abhilfe
				hinauszuschieben oder weitergehende zwingende Rechte einzuschränken.
			</p>
			<p>
				Wir tragen die notwendigen Kosten der Rücknahme und der Lieferung der reparierten oder neuen Ware.
				Müssen ordnungsgemäß eingebaute Waren zur Abhilfe ausgebaut und anschließend wieder eingebaut werden,
				übernehmen wir die erforderlichen Arbeiten oder vereinbaren, dass Sie diese auf unsere Kosten und
				unser Risiko veranlassen. Für die gewöhnliche Nutzung vor einer Ersatzlieferung verlangen wir keine
				Nutzungsentschädigung.
			</p>

			<h3>Preisminderung oder Vertragsauflösung wegen eines Mangels</h3>
			<p>
				Unter den gesetzlichen Voraussetzungen können Sie eine angemessene Preisminderung oder die Auflösung
				des Vertrags wegen des Mangels verlangen. Dies kommt insbesondere in Betracht, wenn die Abhilfe
				ausbleibt oder verweigert wird, gesetzliche Pflichten bei Rücknahme, Aus- oder Einbau nicht erfüllt
				werden, ein Mangel trotz Reparatur oder Ersatzlieferung erneut auftritt, der Mangel besonders
				schwerwiegend ist oder erkennbar keine ordnungsgemäße und rechtzeitige Abhilfe erfolgen wird. Die
				Umstände des Einzelfalls sind maßgeblich.
			</p>
			<p>
				Die Minderung richtet sich nach dem Wertunterschied zwischen mangelhafter und mangelfreier Ware. Ein
				nur geringfügiger Mangel berechtigt grundsätzlich nicht zur Auflösung des Vertrags; die
				Geringfügigkeit ist vom Verkäufer nachzuweisen. Ob ein vom Kunden verursachter Umstand einen Anspruch
				ausschließt, beurteilt sich nach den anwendbaren gesetzlichen Voraussetzungen. Eine bloße
				Mitverursachung führt nicht nach diesen AGB pauschal zum Verlust sämtlicher Rechte.
			</p>
			<p>
				Umfasst die Bestellung mehrere Artikel, betrifft die Vertragsauflösung grundsätzlich den mangelhaften
				Artikel. Sie kann weitere Artikel erfassen, wenn Ihnen nicht vernünftigerweise zugemutet werden kann,
				diese ohne den mangelhaften Artikel zu behalten.
			</p>
			<p>
				Bei einer berechtigten Vertragsauflösung wegen eines Mangels tragen wir die Rücksendekosten. Den
				Kaufpreis erstatten wir innerhalb von{" "}
				<strong>14 Tagen ab Rückerhalt oder ab dem Nachweis der Absendung</strong>, je nachdem, was früher
				eintritt. Wir verwenden dasselbe Zahlungsmittel, sofern Sie nicht ausdrücklich einer anderen, für Sie
				kostenfreien Lösung zustimmen. Für die gewöhnliche Nutzung oder Abnutzung bis zu dieser
				Vertragsauflösung verlangen wir keine Entschädigung.
			</p>

			<h3>Ablehnung einer Reklamation und Herstellergarantie</h3>
			<p>
				Lehnen wir die Haftung ab, teilen wir Ihnen die Gründe schriftlich mit. Ergibt sich anschließend aus
				einem Sachverständigengutachten oder der fachlichen Stellungnahme einer entsprechend akkreditierten
				Person unsere Verantwortung, können Sie den Mangel erneut geltend machen; nach den einschlägigen
				slowakischen Regeln können wir diese so nachgewiesene Verantwortung nicht erneut ablehnen. Die
				Erstattung notwendiger Aufwendungen richtet sich nach dem Gesetz. Andere zulässige Beweismittel und
				Ihre weiteren Rechte bleiben unberührt.
			</p>
			<p>
				Eine Garantie des Herstellers oder Verkäufers kann zusätzliche Rechte gewähren. Ihre Laufzeit und
				Bedingungen beschränken die gesetzlichen Mängelrechte nicht. Etwaige Schadensersatzansprüche bleiben
				ebenfalls bestehen.
			</p>

			<h2>8. Beschwerden und außergerichtliche Streitbeilegung</h2>
			<p>
				Sind Sie mit der Bearbeitung Ihrer Reklamation nicht zufrieden oder sehen Sie Ihre Rechte verletzt,
				schreiben Sie uns an <Mail /> und bitten Sie um Abhilfe.
			</p>
			<p>
				Lehnen wir die Abhilfe ab oder antworten wir innerhalb von <strong>30 Tagen</strong> nicht, können Sie
				sich nach den anwendbaren Regeln an eine zuständige Stelle zur alternativen Beilegung von
				Verbraucherstreitigkeiten wenden. Für Streitigkeiten aus Warenkäufen gehört dazu die Slowakische
				Handelsinspektion (SOI). Weitere zuständige Stellen führt das Wirtschaftsministerium der Slowakischen
				Republik in seinem Verzeichnis.
			</p>
			<Adr lang="de" />
			<p>
				Das von der SOI durchgeführte Verfahren ist für Verbraucher kostenlos. Soweit für uns eine gesetzliche
				Pflicht zur Mitwirkung besteht, erfüllen wir diese. Das Verfahren beschränkt Ihr Recht, ein Gericht
				anzurufen, nicht.
			</p>
			<p>{market.consumerCentre}</p>

			<h2>9. Personenbezogene Daten</h2>
			<p>
				Wie und zu welchen Zwecken wir personenbezogene Daten verarbeiten, erläutern wir in unseren{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Datenschutzhinweisen</Link>.
				Informationen über Cookies und ähnliche Technologien finden Sie unter{" "}
				<Link href={marketHref(channel, "/cookies")}>Cookie-Einstellungen und Hinweise</Link>.
			</p>
			<p>
				Weder Kauf noch Reklamation oder Widerruf setzen eine Einwilligung in Marketing oder optionale Cookies
				voraus.
			</p>

			<h2>10. Schlussbestimmungen</h2>
			<p>
				Es gilt das Recht der Slowakischen Republik, insbesondere das slowakische Bürgerliche Gesetzbuch sowie
				die Gesetze Nr. 108/2024 Z. z. über Verbraucherschutz und Nr. 22/2004 Z. z. über elektronischen
				Geschäftsverkehr.{" "}
				<strong>
					Diese Rechtswahl entzieht Ihnen nicht den Schutz zwingender Vorschriften des Staates Ihres
					gewöhnlichen Aufenthalts, soweit Artikel 6 der Rom-I-Verordnung diesen Schutz vorsieht.
				</strong>{" "}
				Sie begründet auch keinen ausschließlichen Gerichtsstand in Bratislava. Die gesetzlichen
				Zuständigkeitsregeln bleiben unberührt.
			</p>
			<p>
				Aufsichtsbehörde am Sitz des Verkäufers ist die{" "}
				<strong>
					Slovenská obchodná inšpekcia, {companyInfo.supervisoryAuthority.department},{" "}
					{companyInfo.supervisoryAuthority.address}, {SLOVAKIA_DE}
				</strong>
				. Befugnisse anderer gesetzlich zuständiger Stellen bleiben unberührt.
			</p>
			<p>
				Änderungen dieser Bedingungen gelten für Verträge, die nach ihrem Inkrafttreten geschlossen werden.
				Bereits geschlossene Verträge richten sich weiterhin nach der dafür maßgeblichen Fassung und
				zwingendem Recht. Keine Regelung dieser AGB schränkt Rechte ein, die Verbrauchern zwingend zustehen.
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
				Regulamin określa zasady zakupu towarów w sklepie internetowym MAKY.STORE. Do zamówienia stosuje się
				wersję obowiązującą w chwili zawarcia umowy.
			</p>
			<p>
				<strong>
					Jesteśmy słowackim sprzedawcą. Wybór prawa słowackiego nie pozbawia konsumenta ochrony wynikającej z
					bezwzględnie obowiązujących przepisów państwa jego zwykłego pobytu.
				</strong>{" "}
				W odniesieniu do konsumentów mieszkających w Polsce zachowujemy tę ochronę zgodnie z art. 6
				rozporządzenia Rzym I.
			</p>

			<h2>1. Sprzedawca i dane kontaktowe</h2>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				Siedziba: {companyInfo.street}, {companyInfo.city}, {SLOVAKIA_PL}
				<br />
				Numer identyfikacyjny przedsiębiorstwa (IČO): {companyInfo.ico}
				<br />
				Słowacki numer identyfikacji podatkowej (DIČ): {companyInfo.dic}
				<br />
				Numer identyfikacyjny VAT: {companyInfo.icDph}
			</p>
			<p>
				Spółka jest zarejestrowanym podatnikiem VAT na Słowacji. Jest wpisana do rejestru handlowego
				prowadzonego przez Mestský súd Bratislava III, dział Sro, numer wpisu 200804/B.
			</p>
			<p>
				E-mail: <Mail />
				<br />
				Telefon: <Phone />
			</p>
			<p>
				<strong>Adres do zwrotów, reklamacji i związanej z nimi korespondencji:</strong> {RETURN_ADDRESS_PL}.
			</p>
			<p>
				Określenia „my” i „sprzedawca” oznaczają {companyInfo.legalName}, a „Państwo” i „kupujący” — osobę
				dokonującą zakupu.
			</p>
			<p>
				Konsumentem jest osoba fizyczna zawierająca umowę w celu niezwiązanym z jej działalnością gospodarczą
				lub zawodową. O statusie kupującego decydują rzeczywisty cel zakupu i właściwe przepisy, a nie samo
				podanie danych do faktury. Nie wyłączamy praw, które właściwe przepisy przyznają osobie fizycznej
				prowadzącej działalność gospodarczą przy zakupie niemającym dla niej charakteru zawodowego, w
				szczególności w zakresie objętym art. 7aa polskiej ustawy o prawach konsumenta.
			</p>

			<h2>2. Zamówienie i zawarcie umowy</h2>
			<p>
				Zakupu można dokonać bez rejestracji. Należy dodać wybrane produkty do koszyka, podać dane kontaktowe,
				dane do faktury i adres dostawy oraz wybrać jedną z dostępnych metod dostawy i płatności.
			</p>
			<p>
				Przed złożeniem wiążącego zamówienia można sprawdzić i poprawić jego zawartość oraz podane dane.
				Pokazujemy łączną kwotę do zapłaty, w tym koszty dostawy i ewentualnych dodatkowych usług, o których
				wcześniej poinformowaliśmy.
			</p>
			<p>
				Kliknięcie przycisku <strong>„Zamówienie z obowiązkiem zapłaty”</strong> lub przycisku z innym równie
				jednoznacznym oznaczeniem oznacza złożenie zamówienia z obowiązkiem zapłaty.
			</p>
			<p>
				Umowa sprzedaży zostaje zawarta, gdy otrzymają Państwo naszą wiadomość e-mail potwierdzającą przyjęcie
				zamówienia. Wiadomość zawiera podsumowanie zamówienia, uzgodnione warunki i regulamin na trwałym
				nośniku. Samo powiadomienie o płatności wysłane przez operatora płatności nie jest potwierdzeniem
				przyjęcia zamówienia przez sprzedawcę.
			</p>
			<p>
				W polskiej wersji sklepu umowę zawieramy <strong>w języku polskim</strong>. Dane umowy przechowujemy w
				celu realizacji zamówienia i wykonania obowiązków prawnych. Potwierdzenie zamówienia i załączone
				dokumenty można zapisać. Kopię informacji dotyczących własnego zamówienia mogą Państwo uzyskać,
				kontaktując się z nami e-mailem.
			</p>
			<p>
				Koszty połączenia z internetem lub rozmowy telefonicznej wynikają z umowy z Państwa operatorem. Nie
				pobieramy dodatkowej opłaty za zawarcie umowy na odległość.
			</p>

			<h2>3. Produkty i ich przeznaczenie</h2>
			<p>
				Właściwości, zawartość zestawu, przeznaczenie i ograniczenia podajemy przy danym produkcie. W
				przypadku zestawów montażowych znaczenie ma również konkretna konfiguracja pojazdu i skład zestawu.
			</p>
			<p>
				W razie wątpliwości co do dopasowania produktu prosimy o kontakt przed zakupem. Zalecenie to nie
				ogranicza naszej odpowiedzialności za prawidłowe informacje o produkcie ani za zgodność dostarczonego
				towaru z umową.
			</p>
			<p>
				Oznaczenie <strong>„Na zamówienie”</strong> oznacza, że sprowadzamy produkt od dostawcy. Samo w sobie
				nie oznacza wykonania według indywidualnej specyfikacji ani wyłączenia prawa odstąpienia od umowy.
			</p>

			<h2>4. Ceny i płatność</h2>
			<p>
				Ceny prezentowane konsumentom są cenami końcowymi, obejmującymi należny VAT i inne podatki. Koszty
				dostawy podajemy oddzielnie. Przed złożeniem wiążącego zamówienia widzą Państwo wszystkie te kwoty
				oraz łączną cenę. Nie dodajemy płatnych usług bez wyraźnej zgody.
			</p>
			<p>
				Ceny w polskiej wersji sklepu podajemy w <strong>złotych polskich (PLN)</strong>. Obowiązuje cena
				potwierdzona przy zawarciu umowy. Późniejsza zmiana ceny w sklepie nie zmienia ceny już zawartej
				umowy.
			</p>
			<p>
				Zamówienia z dostawą do Polski opłaca się <strong>z góry za pośrednictwem Stripe</strong>. Dostępne
				metody płatności są widoczne podczas składania zamówienia.{" "}
				<strong>Nie oferujemy płatności za pobraniem.</strong> Zamówienie wysyłamy po otrzymaniu płatności, z
				uwzględnieniem podanej dostępności produktów. Pełne dane karty przetwarza operator płatności; nie
				przechowujemy numeru karty ani kodu zabezpieczającego i nie mamy do nich dostępu.
			</p>
			<p>
				Jeżeli nie możemy przyjąć zamówienia, a płatność została już otrzymana, zwracamy ją bez zbędnej
				zwłoki. Po zawarciu umowy sama zmiana ceny lub dostępności u naszego dostawcy nie uprawnia nas do
				jednostronnej zmiany uzgodnionych warunków.
			</p>

			<h2>5. Dostawa i odbiór przesyłki</h2>
			<p>
				Współpracujemy z <strong>FedEx i Slovenská pošta (Pocztą Słowacką)</strong>. Dostępne sposoby dostawy
				zależą od zawartości zamówienia, wymiarów i masy przesyłki oraz adresu doręczenia. Konkretne
				możliwości i koszty pokazujemy podczas składania zamówienia.
			</p>
			<p>
				O warunkach dostawy informujemy przed zawarciem umowy. Jeżeli nie uzgodnimy innego terminu,
				dostarczamy towar bez zbędnej zwłoki, najpóźniej w ciągu <strong>30 dni od zawarcia umowy</strong>.
				Uzgodniony indywidualnie termin ma pierwszeństwo przed tą ogólną zasadą.
			</p>
			<p>
				W razie niedotrzymania uzgodnionego terminu mogą Państwo wyznaczyć odpowiedni dodatkowy termin
				dostawy, a po jego bezskutecznym upływie odstąpić od umowy. Dodatkowy termin nie jest konieczny w
				szczególności wtedy, gdy odmawiamy dostawy albo terminowa dostawa miała istotne znaczenie ze względu
				na okoliczności lub Państwa wyraźną informację przekazaną przed zawarciem umowy.
			</p>
			<p>
				Przy dostawie przez przewoźnika oferowanego przez nas ryzyko przypadkowej utraty lub uszkodzenia
				towaru przechodzi na konsumenta dopiero przy odbiorze przez niego lub wskazaną przez niego osobę inną
				niż przewoźnik. Ustawowy wyjątek dotyczy samodzielnego wyboru przewoźnika, którego nie oferowaliśmy.
				Przejście własności następuje zgodnie z właściwymi przepisami słowackiego kodeksu cywilnego z chwilą
				dostarczenia towaru konsumentowi.
			</p>
			<p>
				W miarę możliwości prosimy sprawdzić przesyłkę i udokumentować widoczne uszkodzenia. Brak zdjęcia lub
				protokołu przewoźnika nie powoduje sam w sobie utraty ustawowych praw z tytułu wad. Obowiązują
				właściwe ustawowe terminy dochodzenia roszczeń.
			</p>

			<h2>6. Odstąpienie od umowy bez podania przyczyny</h2>

			<h3>Termin i jego początek</h3>
			<p>
				Konsument może co do zasady odstąpić od umowy zawartej na odległość w ciągu{" "}
				<strong>14 dni od otrzymania towaru</strong>, bez podania przyczyny. Dla zamówień złożonych po
				zalogowaniu na konto klienta wydłużamy ten termin do <strong>30 dni</strong>. Jest to dodatkowe
				uprawnienie MAKY.STORE; stosuje się do niego ten sam sposób zwrotu i poniższe warunki, bez
				ograniczania praw ustawowych.
			</p>
			<p>
				Dnia otrzymania towaru nie wlicza się do terminu. Przy jednej umowie obejmującej kilka towarów
				dostarczanych oddzielnie liczy się odbiór ostatniego towaru. Przy towarze dostarczanym partiami lub w
				częściach — odbiór ostatniej partii lub części. Przy regularnym dostarczaniu towarów przez oznaczony
				czas — odbiór pierwszej dostawy. Towar może odebrać również wskazana przez Państwa osoba inna niż
				przewoźnik.
			</p>
			<p>
				Odstąpienie można zgłosić jeszcze przed dostawą albo ograniczyć do wybranych produktów. Jeżeli nie
				przekażemy wymaganego pouczenia, ustawowy termin przedłuża się zgodnie z prawem, zasadniczo o
				maksymalnie 12 miesięcy po upływie zwykłego terminu. Jeżeli w tym czasie uzupełnimy pouczenie,
				ustawowy termin 14 dni biegnie od jego otrzymania.
			</p>

			<h3>Jak złożyć oświadczenie</h3>
			<p>
				Jednoznaczne oświadczenie można wysłać e-mailem na <Mail /> lub pocztą na adres {RETURN_ADDRESS_PL}.
				Na stronie <Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstąpienie od umowy</Link>{" "}
				opisujemy dostępne sposoby zgłoszenia i udostępniamy wzór formularza.
			</p>
			<p>
				Korzystanie ze wzoru jest dobrowolne. Oświadczenie powinno pozwalać ustalić, kto odstępuje od umowy,
				którego zakupu i jakich produktów dotyczy. Nie wymagamy przyczyny ani wcześniejszej zgody sprzedawcy.
			</p>
			<p>
				W tej wersji podglądowej sklepu formularz do wysłania oświadczenia online nie jest jeszcze
				uruchomiony. Mogą Państwo skorzystać z e-maila lub poczty. Samo wyświetlenie tej strony nie oznacza
				przyjęcia oświadczenia.
			</p>
			<p>
				Do zachowania terminu wystarczy wysłać oświadczenie najpóźniej ostatniego dnia terminu. Towar nie musi
				do tego dnia do nas dotrzeć.
			</p>

			<h3>Odesłanie towaru i odbiór przez przewoźnika</h3>
			<p>
				Jeżeli nie zaproponowaliśmy odbioru towaru, należy odesłać go lub nam przekazać bez zbędnej zwłoki,
				najpóźniej <strong>14 dni od złożenia oświadczenia o odstąpieniu</strong>, na adres{" "}
				{companyInfo.returnAddress}, {SLOVAKIA_PL}. Termin jest zachowany, jeżeli towar zostanie wysłany przed
				jego upływem. Gdy zaproponowaliśmy odbiór, przygotowują Państwo towar zgodnie z ustaleniami.
			</p>
			<p>
				Mogą Państwo wybrać własnego przewoźnika bez naszej uprzedniej zgody lub poprosić nas o wycenę
				odbioru. Cenę i proponowany przebieg podajemy wcześniej. Płatny odbiór zamawiamy dopiero po wyraźnym
				zaakceptowaniu ceny. Samo zapytanie o wycenę nie jest zleceniem odbioru ani przyjęciem płatnej oferty.
			</p>
			<p>
				Bezpośrednie koszty zwrotu ponoszą Państwo, jeżeli prawidłowo poinformowaliśmy o nich przed zawarciem
				umowy. Gdy ze względu na charakter towaru nie można odesłać go zwykłą przesyłką pocztową, przed
				zakupem przekazujemy również informację o kosztach takiego zwrotu. Jeżeli nie spełnimy tego obowiązku
				lub zobowiążemy się ponieść koszty, nie obciążamy nimi Państwa. Późniejsza oferta odbioru nie
				zastępuje brakującej informacji przed zakupem.
			</p>
			<p>
				Prosimy odesłać akcesoria należące do produktu i zabezpieczyć towar na czas transportu. Oryginalne
				opakowanie, oryginał faktury ani numer sprawy nadany przez nas nie są ogólnymi warunkami skutecznego
				odstąpienia.
			</p>

			<h3>Zwrot płatności</h3>
			<p>
				Płatności objęte odstąpieniem zwracamy bez zbędnej zwłoki, najpóźniej{" "}
				<strong>14 dni od otrzymania oświadczenia</strong>. Przy odstąpieniu od całej umowy zwracamy także
				pierwotne koszty dostawy, nie więcej jednak niż koszt najtańszej zwykłej dostawy oferowanej dla danego
				zamówienia. Nie musimy zwracać dopłaty za droższą dostawę wybraną wyraźnie przez Państwa.
			</p>
			<p>
				Przy częściowym odstąpieniu zwracamy odpowiednie kwoty. Nie doliczamy z tego powodu dodatkowych
				kosztów dostawy ani innych opłat z mocą wsteczną.
			</p>
			<p>
				Zwrot następuje tą samą metodą płatności, chyba że wyraźnie zgodzą się Państwo na inną, która nie
				wiąże się z dodatkowymi kosztami. Nie muszą Państwo przyjmować bonu zamiast zwrotu pieniędzy.
			</p>
			<p>
				Jeżeli nie zaproponowaliśmy odbioru, możemy wstrzymać zwrot do chwili otrzymania towaru lub dowodu
				jego odesłania — w zależności od tego, co nastąpi wcześniej. Jeżeli zaproponowaliśmy odbiór, nie
				korzystamy z tego prawa wstrzymania.
			</p>

			<h3>Zmniejszenie wartości i wyjątki</h3>
			<p>
				Mogą Państwo odpowiadać za zmniejszenie wartości towaru wynikające z obchodzenia się z nim w sposób
				wykraczający poza to, co konieczne do stwierdzenia jego charakteru, cech i działania. Warunkiem jest
				prawidłowe pouczenie o odstąpieniu. Samo otwarcie opakowania lub rozsądne sprawdzenie produktu nie
				pozbawia tego prawa.
			</p>
			<p>
				Nie pobieramy ryczałtowej opłaty za zwrot, rozpakowanie ani jego obsługę. Ewentualne roszczenie o
				zmniejszenie wartości uzasadniamy konkretnymi okolicznościami. Nie potrącamy jednostronnie roszczeń
				wynikających z odstąpienia z Państwa roszczeniem o zwrot płatności.
			</p>
			<p>
				Prawo odstąpienia nie przysługuje w szczególności przy towarach rzeczywiście wykonanych według
				indywidualnej specyfikacji lub służących zaspokojeniu zindywidualizowanych potrzeb. Ustawowy wyjątek
				może dotyczyć także zapieczętowanych towarów, których po otwarciu nie można zwrócić ze względów
				ochrony zdrowia lub higieny. Wyjątek stosujemy tylko po spełnieniu ustawowych warunków.
			</p>
			<p>
				<strong>
					Zwykły produkt sprowadzany od dostawcy lub standardowy zestaw dobrany do konkretnego samochodu nie
					staje się przez to produktem wykonanym na indywidualne zamówienie.
				</strong>
			</p>

			<h2>7. Zgodność towaru z umową i reklamacje</h2>

			<h3>Odpowiedzialność ustawowa</h3>
			<p>
				Poniższe zasady opisują ochronę wynikającą z uzgodnionego prawa słowackiego. Nie ograniczają
				bezwzględnie obowiązujących polskich przepisów, w szczególności o niezgodności towaru z umową,
				terminach i rozpatrywaniu reklamacji. Korzystniejsze uprawnienia pozostają zachowane.
			</p>
			<p>
				Przy sprzedaży konsumenckiej odpowiadamy za wady istniejące w chwili dostarczenia, które ujawnią się w
				ciągu <strong>dwóch lat od dostarczenia</strong>. W odniesieniu do towarów z elementami cyfrowymi, gdy
				uzgodniono ciągłe dostarczanie treści lub usług cyfrowych, odpowiedzialność za ich zgodność obejmuje
				uzgodniony okres, nie krótszy niż dwa lata od dostarczenia. Obowiązki dotyczące niezbędnych
				aktualizacji wynikają z właściwych przepisów. Dłuższy okres przydatności zadeklarowany dla towaru lub
				inne ustawowe podstawy ochrony nie są ograniczane samym wskazaniem dwóch lat.
			</p>
			<p>
				Dla umów zawartych od <strong>31 lipca 2026 r.</strong> po pierwszym usunięciu wady przez naprawę
				okres odpowiedzialności zgodnie z prawem słowackim wydłuża się jednorazowo o{" "}
				<strong>12 miesięcy</strong>, niezależnie od liczby kolejnych napraw. Do starszych umów stosuje się
				przepisy właściwe dla chwili ich zawarcia. Pozostają zachowane ustawowe zasady zawieszenia,
				rozpoczęcia na nowo i przedłużenia terminów.
			</p>
			<p>
				Jeżeli wada ujawni się w odpowiednim okresie odpowiedzialności, domniemywa się według tych zasad, że
				istniała już przy dostarczeniu, chyba że zostanie wykazane coś innego lub domniemanie jest niezgodne z
				charakterem towaru albo wady.
			</p>
			<p>
				Odpowiadamy również za wadliwy montaż wykonany przez nas lub na naszą odpowiedzialność oraz za montaż
				wykonany przez kupującego, jeżeli nieprawidłowość wynika z wad dostarczonej instrukcji. Zwykłe zużycie
				odpowiadające charakterowi produktu lub uszkodzenie spowodowane przez kupującego nie jest samo w sobie
				wadą, za którą odpowiadamy. Każdy przypadek oceniamy według jego okoliczności i prawa.
			</p>

			<h3>Zgłoszenie reklamacji i odpowiedź</h3>
			<p>
				Prosimy zgłosić wadę możliwie szybko po jej wykryciu, na przykład e-mailem na <Mail /> lub pisemnie na
				adres {companyInfo.returnAddress}, {SLOVAKIA_PL}. Inne ustawowo dopuszczalne sposoby zgłoszenia
				pozostają dostępne. Nie uzależniamy ustawowych praw polskiego konsumenta od natychmiastowego zbadania
				towaru ani od dodatkowego, dwumiesięcznego terminu zgłoszenia.
			</p>
			<p>
				Prosimy opisać produkt, wadę i moment jej ujawnienia oraz przekazać dane pozwalające powiązać
				zgłoszenie z zakupem. Numer zamówienia, zdjęcia lub film ułatwiają obsługę, ale nie są jedynymi
				dopuszczalnymi dowodami. Nie wymagamy oryginalnego opakowania ani wyłącznie oryginału faktury.
			</p>
			<p>
				Niezwłocznie przekazujemy pisemne potwierdzenie zgłoszenia wady i informację o terminie jej usunięcia.{" "}
				<strong>Na reklamację konsumenta odpowiadamy w ciągu 14 dni od jej otrzymania</strong>, chyba że
				przepis szczególny stanowi inaczej. Odpowiedź przekazujemy na papierze lub innym trwałym nośniku. W
				przypadkach objętych art. 7a polskiej ustawy o prawach konsumenta brak odpowiedzi w terminie oznacza
				uznanie reklamacji. Termin odpowiedzi nie jest tym samym co termin naprawy lub wymiany.
			</p>

			<h3>Naprawa lub wymiana</h3>
			<p>
				Co do zasady mogą Państwo żądać naprawy albo wymiany. Wybrany sposób może zostać zastąpiony drugim
				albo, w przypadkach przewidzianych prawem, odmówiony, jeśli jest niemożliwy lub powodowałby
				niewspółmierne koszty. Przyczynę wyjaśniamy. Przed usunięciem wady informujemy o możliwości wyboru
				oraz odpowiednim przedłużeniu okresu odpowiedzialności po naprawie.
			</p>
			<p>
				Naprawę lub wymianę wykonujemy bezpłatnie, w rozsądnym czasie i bez nadmiernych niedogodności. Według
				stosowanych tu zasad słowackich termin nie powinien przekroczyć{" "}
				<strong>30 dni od zgłoszenia wady</strong>, chyba że dłuższy termin uzasadnia obiektywna przyczyna, na
				którą nie mamy wpływu i którą musimy wykazać. Nie pozwala to odraczać naprawy, jeżeli okoliczności lub
				bezwzględnie obowiązujące przepisy wymagają szybszego działania.
			</p>
			<p>
				Ponosimy niezbędne koszty odbioru i ponownego dostarczenia naprawionego lub wymienionego towaru.
				Jeżeli konieczny jest demontaż prawidłowo zamontowanego produktu i jego ponowny montaż, wykonujemy te
				czynności albo uzgadniamy ich wykonanie na nasz koszt i ryzyko zgodnie z prawem. Nie żądamy opłaty za
				zwykłe korzystanie z produktu przed wymianą.
			</p>

			<h3>Obniżenie ceny lub odstąpienie z powodu niezgodności</h3>
			<p>
				W ustawowo określonych przypadkach mogą Państwo żądać obniżenia ceny lub odstąpić od umowy z powodu
				niezgodności towaru z umową. Dotyczy to w szczególności braku prawidłowej naprawy lub wymiany, odmowy
				doprowadzenia towaru do zgodności, niewykonania obowiązków związanych z odbiorem, demontażem lub
				montażem, ponownego wystąpienia wady, istotnej niezgodności albo sytuacji, gdy z okoliczności wynika,
				że nie nastąpi terminowe i prawidłowe rozwiązanie problemu.
			</p>
			<p>
				Obniżka odpowiada różnicy wartości towaru zgodnego i niezgodnego z umową. Niezgodność nieistotna co do
				zasady nie uprawnia do odstąpienia z tej przyczyny. W zakresie polskiej ustawy o prawach konsumenta
				domniemywa się, że niezgodność jest istotna. Okoliczności przypisywane kupującemu oceniamy według
				prawa; samo przyczynienie się do problemu nie oznacza automatycznej utraty wszystkich praw.
			</p>
			<p>
				Jeżeli zamówienie obejmuje kilka produktów, odstąpienie z powodu wady dotyczy zasadniczo produktu
				wadliwego. Może objąć także inne produkty, jeżeli nie można rozsądnie oczekiwać ich zatrzymania bez
				produktu wadliwego.
			</p>
			<p>
				Przy uzasadnionym odstąpieniu z powodu wady ponosimy koszty zwrotu. Cenę zwracamy w ciągu{" "}
				<strong>14 dni od otrzymania towaru lub dowodu jego odesłania</strong>, w zależności od tego, co
				nastąpi wcześniej. Korzystamy z pierwotnej metody płatności, chyba że wyraźnie uzgodnimy inne
				bezpłatne rozwiązanie. Nie pobieramy rekompensaty za zwykłe korzystanie z produktu ani normalne
				zużycie do chwili takiego odstąpienia.
			</p>

			<h3>Odmowa uznania reklamacji i gwarancja</h3>
			<p>
				Jeżeli odmawiamy odpowiedzialności, pisemnie podajemy uzasadnienie. Jeżeli opinia biegłego lub
				specjalistyczna opinia odpowiednio akredytowanej osoby następnie wykaże naszą odpowiedzialność, mogą
				Państwo ponownie zgłosić wadę; w zakresie właściwych przepisów słowackich nie możemy ponownie odmówić
				tak wykazanej odpowiedzialności. Zwrot celowo poniesionych kosztów podlega prawu. Nie są to jedyne
				dopuszczalne dowody; inne uprawnienia pozostają zachowane.
			</p>
			<p>
				Gwarancja producenta lub sprzedawcy może przyznawać dodatkowe prawa. Nie zastępuje ustawowej
				odpowiedzialności za niezgodność towaru z umową. Jej okres i warunki nie ograniczają ustawowych
				roszczeń wobec nas ani ewentualnych roszczeń odszkodowawczych.
			</p>

			<h2>8. Skargi i pozasądowe rozwiązywanie sporów</h2>
			<p>
				Jeżeli nie są Państwo zadowoleni ze sposobu rozpatrzenia reklamacji lub uważają, że naruszyliśmy
				Państwa prawa, prosimy napisać na <Mail />, wskazując żądanie rozwiązania problemu.
			</p>
			<p>
				Gdy odmówimy uwzględnienia takiego żądania lub nie odpowiemy w ciągu <strong>30 dni</strong>, mogą
				Państwo zwrócić się do właściwego podmiotu alternatywnego rozwiązywania sporów zgodnie z
				obowiązującymi zasadami. Dla sporów wynikających z zakupu towarów od słowackiego sprzedawcy takim
				podmiotem może być Slovenská obchodná inšpekcia (SOI). Inne właściwe podmioty są wskazane w wykazie
				słowackiego Ministerstwa Gospodarki. Ta ścieżka nie zmienia wcześniejszego, 14-dniowego terminu
				odpowiedzi na reklamację konsumenta wynikającego z polskich przepisów.
			</p>
			<Adr lang="pl" />
			<p>
				Postępowanie prowadzone przez SOI jest dla konsumenta bezpłatne. Wypełniamy ustawowe obowiązki
				współpracy. Postępowanie nie ogranicza prawa do sądu.
			</p>
			<p>
				Przy zakupie transgranicznym od słowackiego sprzedawcy mogą Państwo skorzystać z bezpłatnego wsparcia{" "}
				<a href="https://konsument.gov.pl/" rel="noopener noreferrer" target="_blank">
					Europejskiego Centrum Konsumenckiego w Polsce
				</a>
				. Centrum pomaga w polubownym rozwiązaniu sporu; nie jest sądem ani organem wydającym wiążące
				rozstrzygnięcie. Nie deklarujemy uczestnictwa w dowolnym polskim systemie ADR ani jego właściwości
				wyłącznie na podstawie miejsca zamieszkania kupującego.
			</p>

			<h2>9. Dane osobowe</h2>
			<p>
				Cele i zasady przetwarzania danych opisujemy w{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Polityce prywatności</Link>. Informacje o
				technologiach przechowywania danych i zgodach znajdują się na stronie{" "}
				<Link href={marketHref(channel, "/cookies")}>Pliki cookies i ustawienia prywatności</Link>.
			</p>
			<p>
				Zakup, reklamacja ani odstąpienie od umowy nie wymagają zgody na marketing lub opcjonalne pliki
				cookies.
			</p>

			<h2>10. Postanowienia końcowe</h2>
			<p>
				Stosuje się prawo Republiki Słowackiej, w szczególności słowacki kodeks cywilny, ustawę nr 108/2024 Z.
				z. o ochronie konsumentów i ustawę nr 22/2004 Z. z. o handlu elektronicznym.{" "}
				<strong>
					Wybór ten nie pozbawia konsumenta ochrony bezwzględnie obowiązujących przepisów państwa jego
					zwykłego pobytu, zgodnie z art. 6 rozporządzenia Rzym I.
				</strong>{" "}
				Nie ustanawia też wyłącznej właściwości sądów w Bratysławie. Właściwość sądu wynika z przepisów.
			</p>
			<p>
				Organem nadzoru w miejscu siedziby sprzedawcy jest{" "}
				<strong>
					Slovenská obchodná inšpekcia, {companyInfo.supervisoryAuthority.department}, Bajkalská 21/A, P. O.
					BOX č. 5, 820 07 Bratislava, {SLOVAKIA_PL}
				</strong>
				. Uprawnienia innych właściwych organów pozostają zachowane.
			</p>
			<p>
				Zmiany regulaminu dotyczą umów zawieranych po wejściu zmian w życie. Wcześniejsze umowy podlegają
				właściwej dla nich wersji i bezwzględnie obowiązującym przepisom. Żadne postanowienie nie ogranicza
				praw, których konsumenta nie można pozbawić.
			</p>
		</>
	);
}

export function Hu({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Ezek a feltételek a MAKY.STORE webáruházban történő termékvásárlásra vonatkoznak. Rendelésére a
				szerződés megkötésekor hatályos változat irányadó.
			</p>
			<p>
				<strong>
					Szlovák eladóként működünk. A szlovák jog választása nem fosztja meg Önt a szokásos tartózkodási
					helye szerinti állam kötelező fogyasztóvédelmi szabályainak védelmétől.
				</strong>{" "}
				A Magyarországon élő fogyasztók e védelmét a Róma I. rendelet 6. cikkének megfelelően megőrizzük.
			</p>

			<h2>1. Az eladó és az elérhetőségek</h2>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				Székhely: {companyInfo.street}, {companyInfo.city}, {SLOVAKIA_HU}
				<br />
				Cégazonosító szám (IČO): {companyInfo.ico}
				<br />
				Szlovák adóazonosító szám (DIČ): {companyInfo.dic}
				<br />
				Közösségi adószám: {companyInfo.icDph}
			</p>
			<p>
				A társaság Szlovákiában nyilvántartott áfaalany. A Mestský súd Bratislava III által vezetett
				cégjegyzékben szerepel, Sro részleg, 200804/B bejegyzési szám alatt.
			</p>
			<p>
				E-mail: <Mail />
				<br />
				Telefon: <Phone />
			</p>
			<p>
				<strong>Visszaküldési, reklamációs és kapcsolódó levelezési cím:</strong> {RETURN_ADDRESS_HU}.
			</p>
			<p>
				A „mi” és az „eladó” megjelölés a {companyInfo.legalName}-t, az „Ön” és a „vásárló” a vevőt jelenti.
			</p>
			<p>
				Fogyasztó az a természetes személy, aki a szakmája, önálló foglalkozása vagy üzleti tevékenysége körén
				kívül köt szerződést. Az egyes jogok szempontjából a vásárlás tényleges célja és az alkalmazandó
				jogszabály számít. A külön törvényben meghatározott jogosulti körök — így a kötelező jótállásra
				vonatkozó szabályok szerint adott esetben védelemben részesülő mikro-, kis- és középvállalkozások —
				jogait ez a meghatározás nem zárja ki.
			</p>

			<h2>2. Megrendelés és szerződéskötés</h2>
			<p>
				Regisztráció nélkül is vásárolhat. Tegye a kiválasztott termékeket a kosárba, adja meg
				kapcsolattartási, számlázási és szállítási adatait, majd válasszon a felkínált szállítási és fizetési
				módok közül.
			</p>
			<p>
				A megrendelés véglegesítése előtt ellenőrizheti és javíthatja a termékeket és az adatokat. Megmutatjuk
				a teljes fizetendő összeget, a szállítással és minden előzetesen közölt további díjjal együtt.
			</p>
			<p>
				A <strong>„Fizetési kötelezettséggel járó megrendelés”</strong> vagy más, e kötelezettséget ugyanolyan
				egyértelműen jelző gomb használatával fizetési kötelezettséggel járó megrendelést ad le.
			</p>
			<p>
				Az adásvételi szerződés akkor jön létre, amikor megérkezik Önhöz a megrendelés elfogadását tartalmazó
				e-mailünk. Ebben szerepel a rendelés összefoglalója, a megállapodott feltételek és az ÁSZF tartós
				adathordozón. A fizetési szolgáltató külön fizetési értesítése önmagában nem jelenti a megrendelés
				eladó általi elfogadását.
			</p>
			<p>
				A magyar nyelvű webáruházban a szerződést <strong>magyar nyelven</strong> kötjük. A szerződés adatait
				a vásárlás teljesítéséhez és jogi kötelezettségeinkhez őrizzük meg. A rendelés visszaigazolását és a
				hozzá csatolt dokumentumokat elmentheti. Saját rendelésének adatairól e-mailben másolatot kérhet.
			</p>
			<p>
				Az internetkapcsolat és a telefonhívás díja az Ön szolgáltatójával kötött szerződésétől függ. A
				távollévők közötti szerződéskötésért külön kommunikációs díjat nem számítunk fel.
			</p>

			<h2>3. Termékek és rendeltetésszerű használat</h2>
			<p>
				A jellemzőket, a csomag tartalmát, a rendeltetést és az esetleges korlátozásokat az adott terméknél
				ismertetjük. Szerelőkészleteknél az autó konkrét konfigurációja és a készlet összetétele is lényeges.
			</p>
			<p>
				Ha bizonytalan a termék megfelelőségében, kérjük, vásárlás előtt kérdezzen tőlünk. Ez az ajánlás nem
				csökkenti felelősségünket a helyes termékinformációért vagy a szerződésszerű teljesítésért.
			</p>
			<p>
				A <strong>„Rendelésre”</strong> jelzés azt jelenti, hogy a terméket a beszállítótól szerezzük be.
				Önmagában nem jelent egyedi gyártást, és nem zárja ki az elállási jogot.
			</p>

			<h2>4. Árak és fizetés</h2>
			<p>
				A fogyasztóknak feltüntetett árak végleges árak, és tartalmazzák az alkalmazandó áfát és egyéb adókat.
				A szállítás díját külön tüntetjük fel. A teljes összeget és összetevőit a kötelező érvényű megrendelés
				előtt látja. Fizetős kiegészítő szolgáltatást nem adunk hozzá kifejezett hozzájárulás nélkül.
			</p>
			<p>
				A magyarországi árakat <strong>magyar forintban (HUF)</strong> tüntetjük fel. A szerződéskötéskor
				visszaigazolt ár érvényes. A webáruház későbbi árváltozása a már megkötött szerződés árát nem
				módosítja.
			</p>
			<p>
				A magyarországi címre szóló rendeléseket <strong>előre, a Stripe rendszerén keresztül</strong> kell
				kifizetni. Az adott rendeléshez elérhető fizetési módokat a rendelési folyamat mutatja.{" "}
				<strong>Utánvétes fizetést nem kínálunk.</strong> A rendelést a fizetés beérkezése után, a megadott
				termékelérhetőség szerint adjuk fel. A teljes kártyaadatokat a fizetési szolgáltató kezeli; a
				kártyaszámot és a biztonsági kódot nem tároljuk, és azokhoz nem férünk hozzá.
			</p>
			<p>
				Ha a rendelést nem tudjuk elfogadni, de a fizetés már megtörtént, a kapott összeget késedelem nélkül
				visszatérítjük. A szerződéskötés után a beszállítónk árának vagy készletének változása önmagában nem
				jogosít fel a megállapodott feltételek egyoldalú módosítására.
			</p>

			<h2>5. Szállítás és a csomag átvétele</h2>
			<p>
				Szállítási partnereink a <strong>FedEx és a Slovenská pošta (Szlovák Posta)</strong>. A választható
				szállítási módok a rendelés tartalmától, a csomag méretétől és tömegétől, valamint a kézbesítési
				címtől függenek. Az adott rendeléshez elérhető lehetőségeket és díjakat a rendelési folyamatban
				mutatjuk meg.
			</p>
			<p>
				A szállítás feltételeiről a szerződéskötés előtt tájékoztatjuk. Eltérő megállapodás hiányában
				indokolatlan késedelem nélkül, legkésőbb a szerződés megkötésétől számított{" "}
				<strong>30 napon belül</strong> szállítunk. A konkrétan megállapodott szállítási határidő elsőbbséget
				élvez.
			</p>
			<p>
				Ha nem teljesítünk a megállapodott időben, megfelelő póthatáridőt szabhat, és annak eredménytelen
				elteltével elállhat. Nem szükséges póthatáridő különösen akkor, ha a szállítást megtagadjuk, vagy a
				határidő betartása a körülmények miatt alapvető fontosságú volt, illetve Ön erre a szerződéskötés
				előtt kifejezetten felhívta a figyelmünket.
			</p>
			<p>
				Az általunk kínált fuvarozóval történő kézbesítésnél az elveszés vagy sérülés kockázata csak akkor
				száll át a fogyasztóra, amikor ő vagy az általa megjelölt, a fuvarozótól eltérő személy átveszi az
				árut. Jogszabályi kivétel vonatkozik az Ön által önállóan megbízott, általunk nem kínált fuvarozóra. A
				tulajdonjog a szlovák polgári törvénykönyv irányadó szabályai szerint a fogyasztónak történő
				kézbesítéssel száll át.
			</p>
			<p>
				Lehetőség szerint átvételkor vizsgálja meg a csomagot, és dokumentálja a látható sérülést. A fuvarozó
				jegyzőkönyvének vagy a fényképnek a hiánya önmagában nem zárja ki a törvényes igényeket. A hibák
				bejelentésére és az igények érvényesítésére a jogszabályi határidők vonatkoznak.
			</p>

			<h2>6. Indokolás nélküli elállás</h2>

			<h3>Határidő és annak kezdete</h3>
			<p>
				Fogyasztóként a távollévők között kötött szerződéstől főszabály szerint a termék átvételétől számított{" "}
				<strong>14 napon belül</strong>, indokolás nélkül elállhat. Ha a rendelést a vásárlói fiókjába
				bejelentkezve adta le, a határidőt <strong>30 napra</strong> hosszabbítjuk meg. Ez a MAKY.STORE
				többletkedvezménye; ugyanaz a visszaküldési eljárás és az alábbi feltételek érvényesek rá, törvényes
				jogai sérelme nélkül.
			</p>
			<p>
				Az átvétel napja nem számít bele a határidőbe. Az Ön által megjelölt, a fuvarozótól eltérő személy
				átvétele is irányadó lehet. Egy rendelésben vásárolt, külön kézbesített termékeknél az utolsó termék,
				több tételből vagy darabból álló terméknél az utolsó tétel vagy darab átvétele számít. Meghatározott
				időn át tartó rendszeres termékszállításnál az első kézbesítés az irányadó.
			</p>
			<p>
				Az elállás a kézbesítés előtt is közölhető, illetve egyes termékekre korlátozható. A szükséges
				tájékoztatás hiányában a törvényes határidő a vonatkozó szabályok szerint, főszabály szerint további
				12 hónappal meghosszabbodik. Ha ezen idő alatt a tájékoztatást pótoljuk, a 14 napos törvényes határidő
				a pótlólagos tájékoztatás kézhezvételétől számítandó.
			</p>

			<h3>Az elállási nyilatkozat közlése</h3>
			<p>
				Egyértelmű nyilatkozatát elküldheti az <Mail /> e-mail-címre vagy postán a {RETURN_ADDRESS_HU} címre.
				Az <Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Elállási jog</Link> oldalon további
				tájékoztatást és nyilatkozatmintát talál.
			</p>
			<p>
				A minta használata önkéntes. A nyilatkozatból legyen azonosítható a nyilatkozó, az érintett vásárlás
				és a termékek köre. Indokolás és előzetes engedélyünk nem szükséges.
			</p>
			<p>
				A webáruház jelenlegi előnézeti változatában az online elállási funkció még nem aktív. Nyilatkozatát
				e-mailben vagy postán küldheti el. Az oldal megnyitása önmagában nem minősül elállási nyilatkozatnak.
			</p>
			<p>A határidő megtartásához elegendő a nyilatkozatot legkésőbb a határidő utolsó napján elküldeni.</p>

			<h3>Visszaküldés és elszállítás</h3>
			<p>
				Ha nem ajánlottuk fel az elszállítást, a terméket az elállási nyilatkozat után késedelem nélkül,
				legkésőbb <strong>14 napon belül</strong> küldje vissza vagy adja át a {companyInfo.returnAddress},{" "}
				{SLOVAKIA_HU} címen. A határidőn belüli feladás elegendő. Felajánlott elszállításnál a terméket a
				megállapodás szerint kell előkészíteni.
			</p>
			<p>
				Saját fuvarozó igénybevételéhez nem kell engedélyt kérnie. Tőlünk is kérhet elszállítási árajánlatot;
				az árat és a javasolt folyamatot előre közöljük. Fizetős szállítást csak az ár kifejezett elfogadása
				után rendelünk meg. Az érdeklődés önmagában nem szállítási megrendelés és nem fizetős ajánlat
				elfogadása.
			</p>
			<p>
				A közvetlen visszaküldési költséget Ön viseli, amennyiben arról a szerződéskötés előtt megfelelő
				tájékoztatást kapott. Ha a termék szokásos postai úton nem küldhető vissza, az ilyen visszaszállítás
				költségéről is előzetesen tájékoztatjuk. Ha az előzetes tájékoztatási kötelezettséget nem
				teljesítettük, vagy a költséget magunkra vállaltuk, azt nem kell viselnie. A későbbi elszállítási
				ajánlat a hiányzó előzetes tájékoztatást nem pótolja.
			</p>
			<p>
				Kérjük, a tartozékokat is küldje vissza, és a terméket a szállításhoz megfelelően csomagolja be. Az
				eredeti csomagolás, az eredeti számla vagy a nálunk kapott ügyszám nem általános feltétele a hatályos
				elállásnak.
			</p>

			<h3>Visszatérítés</h3>
			<p>
				Az elállással érintett összegeket a nyilatkozat beérkezésétől számított{" "}
				<strong>14 napon belül</strong> visszatérítjük. Teljes elállásnál az eredeti szállítási díjat is
				visszafizetjük, legfeljebb az adott rendeléshez kínált legolcsóbb szokásos szállítás költségéig. Az Ön
				által kifejezetten választott drágább szállítás felárát nem kell megtérítenünk.
			</p>
			<p>
				Részleges elállásnál az érintett összegeket térítjük vissza. Emiatt nem számolunk el utólagos
				szállítási vagy más többletdíjat.
			</p>
			<p>
				Az eredeti fizetési módot használjuk, kivéve, ha kifejezetten más, Önnek díjmentes megoldásban
				állapodunk meg. Pénz-visszatérítés helyett utalványt nem köteles elfogadni.
			</p>
			<p>
				Ha nem ajánlottuk fel az elszállítást, a visszatérítést a termék vagy az elküldést igazoló bizonylat
				átvételéig visszatarthatjuk, a korábbi eseményt figyelembe véve. Ha felajánlottuk az elszállítást, nem
				élünk ezzel a visszatartási joggal.
			</p>

			<h3>Értékcsökkenés és kivételek</h3>
			<p>
				Felelhet a termék olyan értékcsökkenéséért, amely a jelleg, a tulajdonságok és a működés
				megállapításához szükséges mértéket meghaladó használatból ered. Ennek feltétele a megfelelő elállási
				tájékoztatás. A csomagolás felbontása vagy a szükséges vizsgálat önmagában nem jelenti az elállási jog
				elvesztését.
			</p>
			<p>
				Átalányjellegű visszaküldési, kicsomagolási vagy ügyintézési díjat nem számítunk fel. Az
				értékcsökkenési igényt konkrétan megindokoljuk. Az elállásból eredő követelésünket nem számítjuk be
				egyoldalúan az Ön visszatérítési igényébe.
			</p>
			<p>
				Elállás különösen a valóban egyedi utasítás alapján gyártott vagy egyértelműen személyre szabott
				terméknél zárható ki. Kivétel vonatkozhat az olyan lezárt termékre is, amely egészségvédelmi vagy
				higiéniai okból a kézbesítés utáni felbontást követően nem küldhető vissza. Kivételt csak a
				jogszabályi feltételek fennállásakor alkalmazunk.
			</p>
			<p>
				<strong>
					Egy szokásos, beszállítótól beszerzett termék vagy a konkrét autóhoz kiválasztott standard készlet
					önmagában nem egyedi gyártású termék.
				</strong>
			</p>

			<h2>7. Hibás teljesítés, szavatosság és jótállás</h2>

			<h3>Az eladó törvényes felelőssége</h3>
			<p>
				Az alábbiak a választott szlovák jog szerinti jogokat ismertetik. A Róma I. rendelet 6. cikke alapján
				alkalmazandó, eltérést nem engedő magyar fogyasztóvédelmi előírások — különösen a kellékszavatosság és
				a kötelező jótállás szabályai — továbbra is érvényesek. Az itt ismertetett kedvezőbb jogokat ezek nem
				rövidítik le.
			</p>
			<p>
				Fogyasztói vásárlásnál a kézbesítéskor fennálló, a kézbesítéstől számított{" "}
				<strong>két éven belül</strong> jelentkező hibákért felelünk. Digitális elemeket tartalmazó terméknél,
				folyamatos digitális tartalom vagy szolgáltatás biztosítására vonatkozó megállapodás esetén, annak
				szerződésszerűségéért a megállapodott időszakban, de legalább a kézbesítéstől számított két évig
				felelünk. A szükséges frissítési kötelezettségekre az irányadó jogszabályok vonatkoznak.
			</p>
			<p>
				A <strong>2026. július 31-étől kötött szerződéseknél</strong> a hiba első kijavítását követően a
				felelősségi idő a szlovák jog alapján egyszer, <strong>12 hónappal</strong> meghosszabbodik,
				függetlenül a későbbi javítások számától. Korábbi szerződésnél a megkötésekor alkalmazandó szabályok
				irányadók. A határidők nyugvására, újrakezdődésére és hosszabbítására vonatkozó törvényes szabályok
				érvényben maradnak.
			</p>
			<p>
				Az irányadó felelősségi időn belül felismert hibáról e szlovák szabályok alapján vélelmezni kell, hogy
				már a kézbesítéskor fennállt, kivéve, ha az ellenkezőjét bizonyítják, vagy a vélelem a termék vagy a
				hiba jellegével összeegyeztethetetlen.
			</p>
			<p>
				Felelünk a szerződés részeként általunk vagy a mi felelősségünkre végzett hibás szerelésért, továbbá
				az Ön által végzett hibás szerelésért is, ha azt az általunk adott útmutató hiányossága okozta. A
				terméknek megfelelő természetes elhasználódás vagy az Ön által okozott sérülés önmagában nem általunk
				viselendő hiba. Az egyedi körülmények és a jogszabályok alapján járunk el.
			</p>

			<h3>Hiba bejelentése és nyilvántartása</h3>
			<p>
				A hibát kérjük, felfedezése után mielőbb jelezze, például az <Mail /> e-mail-címen vagy a{" "}
				{companyInfo.returnAddress}, {SLOVAKIA_HU} postacímen. Más jogszerű közlési módokat sem zárunk ki.
			</p>
			<p>
				A magyar kellékszavatossági szabályok szerint a felfedezéstől számított két hónapon belüli hibaközlést
				késedelem nélkülinek kell tekinteni. Ez nem önálló, minden jogot megszüntető kéthónapos határidő. A
				közlésre, az igény érvényesítésére és a késedelem következményeire a vonatkozó jogszabályok irányadók.
			</p>
			<p>
				Írja le a terméket, a hibát és észlelésének idejét, és adjon meg a vásárlást azonosító adatot. A
				rendelési szám, fénykép vagy videó segíthet, de nem kizárólagos bizonyíték. Eredeti csomagolást vagy
				kizárólag eredeti számlát nem követelünk.
			</p>
			<p>
				A hibabejelentésről késedelem nélkül írásos igazolást adunk, feltüntetve a hiba megszüntetésének
				határidejét. Az alkalmazandó magyar szabályok szerinti jegyzőkönyvezési és válaszadási
				kötelezettségeket is teljesítjük.
			</p>
			<p>
				A vonatkozó magyar szavatossági és jótállási eljárási szabályok szerint az igényről jegyzőkönyvet
				veszünk fel, és annak másolatát haladéktalanul átadjuk. Ha a teljesíthetőségről a bejelentéskor nem
				tudunk nyilatkozni, álláspontunkról főszabály szerint <strong>8 napon belül</strong> igazolható módon
				értesítjük; javítószolgálat bevonásakor annak jogszabály szerinti értesítése után haladéktalanul
				tájékoztatjuk. Törekszünk a javítás vagy csere <strong>15 napon belüli</strong> elvégzésére. Ha ennél
				hosszabb idő szükséges, tájékoztatjuk a várható időtartamról. A 15 napos törekvési kötelezettség nem
				azonos minden esetre szóló, feltétlen javítási határidővel.
			</p>

			<h3>Kijavítás vagy kicserélés</h3>
			<p>
				Elsősorban kijavítást vagy kicserélést kérhet. A választott megoldás elutasítható, ha lehetetlen vagy
				a másik megoldással összevetve aránytalan költséget jelentene. Döntésünket megindokoljuk. A kijavítás
				előtt tájékoztatjuk a választási jogról és a felelősségi idő alkalmazandó meghosszabbításáról.
			</p>
			<p>
				A kijavítás vagy kicserélés ingyenes, észszerű időn belül és jelentős kényelmetlenség nélkül történik.
				A szlovák alap szerint a határidő <strong>30 napnál nem lehet hosszabb a hiba bejelentésétől</strong>,
				kivéve, ha tőlünk független objektív ok hosszabb határidőt indokol; ezt igazolnunk kell. Ez nem
				jogosít fel az indokoltan korábbi teljesítés elhalasztására, és nem írja felül a kötelező magyar
				jótállás szerinti csere- vagy visszatérítési határidőket.
			</p>
			<p>
				A visszavétel és a javított vagy új termék kiszállításának szükséges költségét mi fizetjük. Ha a
				megfelelően beépített terméket ki kell szerelni, majd visszaszerelni, ezt elvégezzük, vagy
				megállapodunk annak a mi költségünkre és kockázatunkra történő elvégzéséről. A csere előtti rendes
				használatért használati díjat nem kérünk.
			</p>

			<h3>Árleszállítás és a szerződés megszüntetése</h3>
			<p>
				Törvényi feltételek mellett megfelelő árleszállítást vagy a szerződés hibás teljesítés miatti
				megszüntetését kérheti. Ilyen lehet különösen a kijavítás vagy csere elmaradása vagy megtagadása, a
				visszavételi és szerelési kötelezettségek megsértése, ismételt hiba, súlyos hiba vagy olyan körülmény,
				amelyből nyilvánvaló, hogy nem lesz megfelelő és határidőben történő rendezés.
			</p>
			<p>
				Az árleszállítás a hibátlan és hibás termék értéke közötti különbséghez igazodik. Jelentéktelen hiba
				főszabály szerint nem teszi lehetővé a szerződés megszüntetését; a jelentéktelenséget az eladónak kell
				bizonyítania. A vásárlónak felróható körülményt az irányadó jog szerint értékeljük. A közrehatás
				önmagában nem vezet automatikusan minden igény elvesztéséhez.
			</p>
			<p>
				Több termékből álló rendelésnél a megszüntetés főszabály szerint a hibás terméket érinti. Más
				termékekre is kiterjedhet, ha azok megtartása a hibás termék nélkül észszerűen nem várható el Öntől.
			</p>
			<p>
				Megalapozott, hibás teljesítés miatti megszüntetésnél a visszaküldést mi fizetjük. A vételárat{" "}
				<strong>14 napon belül</strong> visszatérítjük a termék vagy az elküldést igazoló bizonylat
				átvételétől, a korábbi esemény szerint. Az eredeti fizetési módot használjuk, hacsak Ön kifejezetten
				nem fogad el más, díjmentes megoldást. Az addigi szokásos használatért vagy természetes
				elhasználódásért nem kérünk térítést.
			</p>

			<h3>A reklamáció elutasítása</h3>
			<p>
				Az elutasítást írásban indokoljuk. Ha később szakértői vélemény vagy megfelelően akkreditált személy
				szakvéleménye megállapítja felelősségünket, ismét érvényesítheti az igényt. Az így bizonyított
				felelősséget a vonatkozó szlovák szabályok szerint nem utasíthatjuk el újból. A célszerűen felmerült
				költségek megtérítésére a jogszabályok irányadók. Más megengedett bizonyítékok és további jogok is
				érvényesíthetők.
			</p>

			<h3>Termékszavatosság, kötelező és önkéntes jótállás</h3>
			<p>
				A kellékszavatosság az eladó hibás teljesítésért fennálló törvényes felelőssége. A magyar jog szerint
				alkalmazandó termékszavatosság ettől különböző, a gyártóval szemben érvényesíthető jog. A jótállás
				pedig jogszabályból vagy külön vállalásból eredhet. Ezeket a lehetőségeket nem tekintjük egymás
				helyettesítőinek.
			</p>
			<p>
				Ha az új termék az alkalmazandó magyar rendelkezések szerint a kötelező jótállás körébe tartozik, a{" "}
				<strong>151/2003. (IX. 22.) Korm. rendelet</strong> és a termékköröket meghatározó{" "}
				<strong>10/2024. (VI. 28.) IM rendelet</strong> szerint járunk el. A jótállási idő{" "}
				<strong>10 000 forinttól 250 000 forintig két év, 250 000 forint felett három év</strong>. A termékkör
				és az ár egyaránt számít. Nem állítjuk, hogy minden autós tartozék automatikusan kötelező jótállás alá
				esik.
			</p>
			<p>
				Az érintett termékhez az előírt magyar nyelvű tájékoztatást, és amikor a jogszabály megköveteli,
				jótállási jegyet adunk. A dokumentum hiánya nem zárja ki a jogszabály alapján fennálló jogokat, ha a
				vásárlás megfelelően igazolható. A kötelező jótállás javítási idő alatti hosszabbítására, valamint a
				kötelező cserére és visszatérítésre vonatkozó szabályai megmaradnak; az általános harmincnapos
				feltétel ezek alól nem ad felmentést.
			</p>
			<p>
				Az önkéntes gyártói vagy eladói jótállás további jogokat adhat. Annak ideje és feltételei nem
				korlátozzák a törvényes igényeket. Az esetleges kártérítési jogok is megmaradnak.
			</p>

			<h2>8. Panasz és peren kívüli vitarendezés</h2>
			<p>
				Ha nem elégedett az ügyintézéssel, vagy úgy véli, hogy jogait megsértettük, írjon az <Mail /> címre,
				és kérje a probléma rendezését.
			</p>
			<p>
				Ha a rendezési kérelmet elutasítjuk, vagy <strong>30 napon belül</strong> nem válaszolunk, a vonatkozó
				szabályok szerint az illetékes alternatív vitarendezési szervhez fordulhat. Szlovák eladótól történő
				termékvásárlásnál ilyen szerv lehet a Slovenská obchodná inšpekcia (SOI). A további szlovák szervek
				jegyzékét a Szlovák Gazdasági Minisztérium vezeti. Ez nem írja felül az egyes panaszokra vagy
				igényekre alkalmazandó rövidebb törvényi határidőket.
			</p>
			<Adr lang="hu" />
			<p>
				A SOI eljárása a fogyasztónak díjmentes. A ránk vonatkozó együttműködési kötelezettséget teljesítjük.
				A vitarendezés a bírósághoz fordulás jogát nem korlátozza.
			</p>
			<p>
				Magyarországról történő, határon átnyúló vásárlásnál az{" "}
				<a href="https://nkfh.gov.hu/europai-fogyasztoi-kozpont" rel="noopener noreferrer" target="_blank">
					Európai Fogyasztói Központ Magyarország
				</a>{" "}
				ingyenes segítségét kérheti. A központ a békés megoldás elérésében segít; nem bíróság, és nem hoz
				kötelező döntést.
			</p>
			<p>
				A magyar békéltető testülethez fordulás törvényes lehetőségét sem zárjuk ki, ha az adott ügyben
				fennáll annak hatásköre és illetékessége. Nem állítjuk, hogy valamelyik magyar testület kizárólag a
				vásárló lakóhelye alapján minden, velünk kapcsolatos ügyben automatikusan illetékes.
			</p>

			<h2>9. Személyes adatok</h2>
			<p>
				Az adatkezelés céljait és szabályait az{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Adatkezelési tájékoztató</Link>{" "}
				ismerteti. A böngészőben használt technológiákról és a választási lehetőségekről a{" "}
				<Link href={marketHref(channel, "/cookies")}>Sütik és adatvédelmi beállítások</Link> oldalon olvashat.
			</p>
			<p>
				A vásárlás, reklamáció vagy elállás nem igényel marketinghez vagy opcionális sütikhez adott
				hozzájárulást.
			</p>

			<h2>10. Záró rendelkezések</h2>
			<p>
				A szerződésre a Szlovák Köztársaság joga irányadó, különösen a szlovák polgári törvénykönyv, a
				108/2024 Z. z. fogyasztóvédelmi törvény és a 22/2004 Z. z. elektronikus kereskedelmi törvény.{" "}
				<strong>
					A jogválasztás nem fosztja meg Önt a szokásos tartózkodási helye szerinti állam kötelező szabályai
					által biztosított védelemtől a Róma I. rendelet 6. cikke szerint.
				</strong>{" "}
				Kizárólagos pozsonyi bírósági illetékességet sem állapít meg. A jogszabályi joghatósági és
				illetékességi szabályok irányadók.
			</p>
			<p>
				Az eladó székhelye szerinti felügyelet a{" "}
				<strong>
					Slovenská obchodná inšpekcia, {companyInfo.supervisoryAuthority.department}, Bajkalská 21/A, P. O.
					BOX č. 5, 820 07 Bratislava, {SLOVAKIA_HU}
				</strong>
				. Más illetékes szervek jogköreit nem korlátozzuk.
			</p>
			<p>
				A feltételek módosítása a hatálybalépésük után kötött szerződésekre vonatkozik. A korábbi
				szerződésekre az azokhoz tartozó változat és a kötelező jogszabályok érvényesek. Egyetlen rendelkezés
				sem korlátoz olyan jogot, amely a fogyasztót kötelezően megilleti.
			</p>
		</>
	);
}

export function It({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Queste condizioni regolano l’acquisto di prodotti nel negozio online MAKY.STORE. All’ordine si applica
				la versione in vigore al momento della conclusione del contratto.
			</p>
			<p>
				<strong>
					Siamo un venditore slovacco. La scelta della legge slovacca non priva il consumatore della
					protezione delle norme inderogabili del paese in cui risiede abitualmente
				</strong>
				, alle condizioni dell’articolo 6 del regolamento Roma I. Per i consumatori residenti in Italia
				restano quindi salvi i diritti inderogabili applicabili.
			</p>

			<h2>1. Venditore e contatti</h2>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				Sede: {companyInfo.street}, {companyInfo.city}, {SLOVAKIA_IT}
				<br />
				Numero identificativo dell’impresa (IČO): <strong>{companyInfo.ico}</strong>
				<br />
				Codice fiscale slovacco (DIČ): <strong>{companyInfo.dic}</strong>
				<br />
				Numero IVA: <strong>{companyInfo.icDph}</strong>
			</p>
			<p>
				La società è registrata ai fini IVA in Slovacchia ed è iscritta nel registro delle imprese tenuto dal
				Mestský súd Bratislava III, sezione Sro, numero 200804/B.
			</p>
			<p>
				E-mail: <Mail />
				<br />
				Telefono: <Phone />
			</p>
			<p>
				<strong>Indirizzo per resi, reclami e relativa corrispondenza:</strong> {RETURN_ADDRESS_IT}.
			</p>
			<p>
				«Noi» e «venditore» indicano {companyInfo.legalName}; «acquirente» indica chi effettua l’acquisto. È
				consumatore la persona fisica che agisce per finalità estranee alla propria attività imprenditoriale o
				professionale. Lo status dipende dalla finalità effettiva dell’acquisto e dalla legge, non soltanto
				dalla compilazione dei dati di fatturazione.
			</p>

			<h2>2. Ordine e conclusione del contratto</h2>
			<p>
				Puoi acquistare senza registrarti. Aggiungi i prodotti al carrello, compila i dati di contatto,
				fatturazione e consegna e scegli tra le modalità di trasporto e pagamento disponibili.
			</p>
			<p>
				Prima di inviare l’ordine vincolante puoi verificare e correggere i prodotti e i dati inseriti.
				Mostriamo il totale da pagare, incluse la spedizione e le eventuali prestazioni aggiuntive comunicate
				in anticipo. Il pulsante <strong>«Ordine con obbligo di pagare»</strong>, o un’altra dicitura
				altrettanto chiara, identifica l’invio di un ordine che comporta l’obbligo di pagamento.
			</p>
			<p>
				Il contratto si conclude quando ricevi la nostra e-mail che conferma l’accettazione dell’ordine. Essa
				contiene il riepilogo, le condizioni concordate e le condizioni di vendita su un supporto durevole.
				Una comunicazione del prestatore di pagamento relativa al pagamento non costituisce, da sola,
				accettazione dell’ordine da parte nostra.
			</p>
			<p>
				Nella versione italiana del negozio il contratto è concluso <strong>in italiano</strong>. Conserviamo
				i dati contrattuali per eseguire l’ordine e adempiere agli obblighi legali. Puoi salvare la conferma e
				i documenti ricevuti e richiedere una copia dei dati del tuo ordine via e-mail. Non applichiamo un
				costo aggiuntivo per concludere il contratto a distanza; i costi di connessione o chiamata dipendono
				dal tuo operatore.
			</p>

			<h2>3. Prodotti e impiego</h2>
			<p>
				Le caratteristiche, il contenuto della confezione, l’impiego previsto e le limitazioni sono indicati
				nella scheda del prodotto. Per un kit di montaggio contano anche la configurazione del veicolo e i
				componenti inclusi.
			</p>
			<p>
				Se hai dubbi sulla compatibilità, contattaci prima dell’acquisto. Questo consiglio non limita la
				nostra responsabilità per informazioni corrette e per la conformità dei prodotti consegnati.
			</p>
			<p>
				<strong>«Su ordinazione»</strong> significa che procuriamo il prodotto dal fornitore. Non significa,
				di per sé, che il prodotto sia personalizzato o escluso dal diritto di recesso.
			</p>

			<h2>4. Prezzi e pagamento</h2>
			<p>
				I prezzi destinati ai consumatori sono finali e comprendono l’IVA dovuta e le altre imposte. La
				spedizione viene indicata separatamente. Prima dell’ordine vincolante sono visibili tutti gli importi
				e il totale. Non aggiungiamo prestazioni a pagamento senza un consenso espresso.
			</p>
			<p>
				Nella versione italiana i prezzi sono espressi in <strong>euro (EUR)</strong>. Vale il prezzo
				concordato al momento della conclusione del contratto; una successiva variazione nel negozio non
				modifica un contratto già concluso.
			</p>
			<p>
				Gli ordini per l’Italia si pagano <strong>in anticipo tramite Stripe</strong>, con i metodi
				disponibili durante l’ordine. <strong>Non offriamo il contrassegno.</strong> Spediamo dopo la
				ricezione del pagamento, secondo la disponibilità comunicata. I dati completi della carta sono
				trattati dal prestatore di pagamento: non conserviamo né possiamo consultare il numero completo o il
				codice di sicurezza.
			</p>
			<p>
				Se non possiamo accettare l’ordine ma abbiamo già ricevuto il pagamento, lo restituiamo senza ritardo.
				Dopo la conclusione del contratto, una variazione del prezzo o della disponibilità presso il nostro
				fornitore non ci autorizza, da sola, a cambiare unilateralmente quanto concordato.
			</p>

			<h2>5. Consegna e ricezione</h2>
			<p>
				Spediamo dalla Slovacchia con <strong>FedEx e Slovenská pošta (Poste slovacche)</strong>. Le opzioni
				dipendono dai prodotti, dal peso e dalle dimensioni del pacco e dall’indirizzo. Modalità e costi
				disponibili sono indicati durante l’ordine.
			</p>
			<p>
				Comunichiamo le condizioni di consegna prima della conclusione del contratto. Salvo un diverso termine
				concordato, consegniamo senza ritardo e comunque entro{" "}
				<strong>30 giorni dalla conclusione del contratto</strong>. Prevale un termine specificamente
				concordato.
			</p>
			<p>
				Se non rispettiamo il termine, puoi assegnarci un ulteriore periodo adeguato e, se la consegna non
				avviene, risolvere il contratto. Il termine supplementare non è necessario, in particolare, se
				rifiutiamo la consegna o se la puntualità era essenziale per le circostanze o per una tua indicazione
				espressa comunicata prima dell’acquisto.
			</p>
			<p>
				Quando utilizzi un corriere da noi proposto, il rischio di perdita o danneggiamento passa a te
				soltanto con la ricezione da parte tua o del terzo designato, diverso dal corriere. Resta l’eccezione
				legale per un corriere da te incaricato e non proposto da noi. Il trasferimento della proprietà
				avviene secondo il codice civile slovacco con la consegna al consumatore.
			</p>
			<p>
				È utile controllare il pacco e documentare i danni visibili. L’assenza di fotografie o del verbale del
				corriere non fa perdere, da sola, i diritti di legge. Restano applicabili i termini legali per farli
				valere.
			</p>

			<h2>6. Recesso senza motivazione</h2>

			<h3>Termine e decorrenza</h3>
			<p>
				Il consumatore può normalmente recedere entro <strong>14 giorni dalla consegna</strong>, senza
				indicare il motivo. Per gli ordini effettuati dopo l’accesso all’account estendiamo il termine a{" "}
				<strong>30 giorni</strong>, come beneficio MAKY.STORE con la stessa procedura e le condizioni qui
				descritte, senza limitare i diritti legali.
			</p>
			<p>
				Non si conta il giorno della consegna. Per più prodotti di un solo contratto consegnati separatamente,
				conta l’ultimo; per un prodotto consegnato in lotti o pezzi, l’ultimo lotto o pezzo; per forniture
				regolari durante un periodo definito, la prima consegna. La ricezione può avvenire tramite un terzo
				designato, diverso dal corriere.
			</p>
			<p>
				Puoi recedere prima della consegna o per alcuni prodotti soltanto. Se non forniamo l’informativa
				obbligatoria, il termine legale si prolunga secondo la legge, normalmente fino a 12 mesi dopo il
				termine originario. Se l’informativa viene fornita durante tale periodo, i 14 giorni decorrono dalla
				sua ricezione.
			</p>

			<h3>Dichiarazione</h3>
			<p>
				Invia una dichiarazione inequivocabile a <Mail /> o all’indirizzo per i resi indicato nella sezione 1.
				La pagina <Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Diritto di recesso</Link> spiega
				le modalità disponibili e offre un{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy/vzorovy-formular")}>
					modulo facoltativo da stampare
				</Link>
				.
			</p>
			<p>
				La dichiarazione deve permettere di identificare chi recede, il contratto e i prodotti interessati.
				Non richiediamo un motivo, un account o una precedente autorizzazione. È sufficiente inviarla entro
				l’ultimo giorno del termine; non occorre che anche il prodotto arrivi entro tale giorno.
			</p>
			<p>
				In questa versione di anteprima la funzione di recesso online non è ancora attiva. Puoi utilizzare
				e-mail, posta o un’altra modalità legalmente ammessa. Non aspettare l’attivazione se sta decorrendo un
				termine. Consultare la pagina non costituisce invio della dichiarazione.
			</p>

			<h3>Restituzione e costi</h3>
			<p>
				Se non abbiamo offerto il ritiro, restituisci il prodotto senza ritardo e al massimo entro{" "}
				<strong>14 giorni dalla comunicazione del recesso</strong>, a {RETURN_ADDRESS_IT}. Basta spedirlo
				entro il termine. Se abbiamo offerto il ritiro, prepara il prodotto come concordato.
			</p>
			<p>
				Puoi utilizzare un tuo corriere senza autorizzazione preventiva oppure chiedere un preventivo.
				Comunichiamo prezzo e modalità in anticipo e ordiniamo un ritiro a pagamento solo dopo l’accettazione
				espressa. Una richiesta di prezzo non costituisce né un ordine né una nostra offerta di ritiro.
			</p>
			<p>
				I costi diretti della restituzione sono a tuo carico se ne sei stato correttamente informato prima
				dell’acquisto. Per i beni non restituibili normalmente per posta forniamo prima dell’acquisto anche il
				costo del reso. Se manca l’informazione dovuta, o ci siamo impegnati a sostenere il costo, non te lo
				addebitiamo. Un preventivo successivo all’acquisto non sostituisce questa informazione.
			</p>
			<p>
				Restituisci gli accessori del prodotto e proteggilo per il trasporto. Imballaggio originale, originale
				della fattura e numero di pratica assegnato da noi non sono condizioni generali di validità del
				recesso.
			</p>

			<h3>Rimborso</h3>
			<p>
				Rimborsiamo senza ritardo, entro <strong>14 giorni dalla ricezione della dichiarazione</strong>. Per
				il recesso totale includiamo il costo della consegna iniziale fino alla modalità standard meno costosa
				proposta per l’ordine, non l’eventuale maggior costo scelto espressamente.
			</p>
			<p>
				Per il recesso parziale rimborsiamo gli importi pertinenti senza applicare retroattivamente spedizioni
				o commissioni aggiuntive. Il rimborso utilizza lo stesso metodo di pagamento, salvo un accordo
				espresso diverso e gratuito per te. Non devi accettare un buono in sostituzione del denaro.
			</p>
			<p>
				Se non abbiamo offerto il ritiro, possiamo sospendere il rimborso fino alla ricezione del prodotto o
				della prova di spedizione, a seconda di quale avvenga prima. Se abbiamo offerto il ritiro, non ci
				avvaliamo di questa facoltà.
			</p>

			<h3>Diminuzione di valore ed eccezioni</h3>
			<p>
				Puoi essere responsabile della diminuzione di valore causata da manipolazioni ulteriori rispetto a
				quelle necessarie per accertare natura, caratteristiche e funzionamento, se hai ricevuto l’informativa
				richiesta. Aprire la confezione o esaminare ragionevolmente il prodotto non elimina il diritto.
			</p>
			<p>
				Non applichiamo una tariffa forfettaria di reso, apertura o gestione. Motiviamo un’eventuale
				diminuzione di valore in base alle circostanze concrete e non la compensiamo unilateralmente con i
				tuoi crediti derivanti dal recesso.
			</p>
			<p>
				Le eccezioni possono riguardare beni realmente realizzati su specifiche individuali o chiaramente
				personalizzati e, alle condizioni di legge, beni sigillati non restituibili per motivi igienici o
				sanitari dopo l’apertura.{" "}
				<strong>
					Un normale articolo procurato dal fornitore o un kit standard abbinato a un’auto non è per questo un
					bene personalizzato.
				</strong>
			</p>

			<h2>7. Conformità dei prodotti e reclami</h2>

			<h3>Responsabilità legale</h3>
			<p>
				Secondo la legge slovacca scelta, rispondiamo dei difetti esistenti alla consegna che si manifestano
				entro <strong>due anni</strong>. Per beni con elementi digitali con fornitura continuativa concordata,
				la responsabilità per tali elementi copre il periodo concordato, almeno due anni dalla consegna; gli
				obblighi di aggiornamento seguono la legge applicabile.
			</p>
			<p>
				Per i contratti dal <strong>31 luglio 2026</strong>, dopo la prima riparazione il periodo di
				responsabilità slovacco aumenta una sola volta di <strong>12 mesi</strong>, indipendentemente dalle
				riparazioni successive. Per i contratti precedenti valgono le norme allora applicabili. Restano ferme
				le regole di sospensione, rinnovo e proroga dei termini.
			</p>
			<p>
				Un difetto manifestatosi nel periodo applicabile si presume già presente alla consegna, salvo prova
				contraria o incompatibilità con la natura del bene o del difetto. Rispondiamo anche di
				un’installazione errata eseguita da noi o sotto la nostra responsabilità e di errori del cliente
				dovuti a istruzioni carenti. La normale usura e un danno causato dal cliente non costituiscono
				automaticamente un difetto imputabile al venditore; ogni caso va valutato.
			</p>
			<p>
				Questa disciplina non riduce la garanzia legale di conformità italiana e gli altri diritti
				inderogabili. In particolare, la durata di due anni per la manifestazione del difetto non va confusa
				con il termine dell’azione: per i difetti non dolosamente occultati, la disciplina italiana prevede{" "}
				<strong>26 mesi dalla consegna</strong>, ferme le regole applicabili al caso e i diritti più
				favorevoli qui riconosciuti. Non introduciamo un’ulteriore decadenza di due mesi dalla scoperta per
				esercitare i diritti inderogabili italiani.
			</p>

			<h3>Segnalazione e rimedi</h3>
			<p>
				Segnala il difetto appena possibile a <Mail />, per iscritto all’indirizzo per i resi o con un’altra
				modalità legalmente ammessa. Descrivi prodotto, difetto, data di manifestazione e un riferimento
				d’acquisto. Foto, video e numero d’ordine aiutano ma non sono gli unici mezzi di prova. Non
				richiediamo imballaggio originale o esclusivamente l’originale della fattura.
			</p>
			<p>
				Confermiamo senza ritardo per iscritto la segnalazione e il termine del rimedio. Puoi scegliere{" "}
				<strong>riparazione o sostituzione</strong>, salvo impossibilità o costi sproporzionati rispetto
				all’altra soluzione. Prima dell’intervento informiamo del diritto di scelta e della proroga
				pertinente.
			</p>
			<p>
				Riparazione o sostituzione sono gratuite, entro un termine ragionevole e senza notevoli inconvenienti.
				Secondo la disciplina slovacca di base, il termine è normalmente entro{" "}
				<strong>30 giorni dalla segnalazione</strong>, salvo un motivo oggettivo dimostrabile fuori dal nostro
				controllo. Ciò non limita l’obbligo di un rimedio più rapido se richiesto dalle circostanze e dalle
				norme inderogabili applicabili.
			</p>
			<p>
				Sosteniamo le spese necessarie di ritiro e riconsegna, nonché la rimozione e reinstallazione quando
				richieste per un prodotto correttamente installato. Non chiediamo un pagamento per l’uso normale
				precedente alla sostituzione.
			</p>
			<p>
				Hai diritto alla riduzione del prezzo o alla risoluzione nei casi previsti dalla legge: rimedio non
				eseguito o rifiutato, obblighi di ritiro o installazione non rispettati, difetto persistente,
				sufficientemente grave o non destinato a essere risolto correttamente e in tempo. Una riduzione
				corrisponde alla differenza di valore. Un difetto lieve non giustifica da solo la risoluzione; spetta
				al venditore provarne la lieve entità. Restano le conseguenze legalmente previste quando il danno è
				imputabile al cliente, senza ridurre diritti inderogabili.
			</p>
			<p>
				In un ordine con più prodotti, la risoluzione riguarda quelli difettosi e può estendersi agli altri se
				non è ragionevole pretendere che li conservi senza quelli difettosi. La restituzione per difetto è a
				nostre spese. Rimborsiamo il prezzo entro{" "}
				<strong>14 giorni dal ricevimento del prodotto o dalla prova della spedizione</strong>, secondo
				l’evento anteriore, senza pregiudicare termini inderogabili più favorevoli. Usiamo il metodo
				originario salvo diverso accordo espresso e gratuito. Non addebitiamo l’uso normale o l’usura
				precedente alla risoluzione.
			</p>

			<h3>Rifiuto del reclamo e garanzia commerciale</h3>
			<p>
				Motiviamo per iscritto l’eventuale rifiuto. Se una successiva perizia o valutazione tecnica
				qualificata prova la nostra responsabilità, puoi ripresentare il reclamo; nella procedura slovacca
				descritta non possiamo nuovamente negare la responsabilità così dimostrata. Restano ammessi altri
				mezzi di prova e il rimborso delle spese necessarie secondo la legge.
			</p>
			<p>
				Un’eventuale garanzia commerciale di produttore o venditore aggiunge diritti, senza limitare quelli
				legali. Resta salvo l’eventuale diritto al risarcimento del danno.
			</p>

			<h2>8. Richieste di rimedio e controversie</h2>
			<p>
				Se non sei soddisfatto della gestione di un reclamo o ritieni violati i tuoi diritti, scrivi a{" "}
				<Mail /> chiedendo un rimedio.
			</p>
			<p>
				Se rifiutiamo la richiesta o non rispondiamo entro <strong>30 giorni</strong>, puoi avviare la
				procedura slovacca di risoluzione alternativa presso un organismo competente dell’elenco del Ministero
				dell’economia slovacco. Per le controversie sull’acquisto di beni, uno di questi è:
			</p>
			<Adr lang="it" country={SLOVAKIA_IT} />
			<p>
				La procedura SOI per il consumatore è gratuita. Per assistenza su un acquisto transfrontaliero puoi
				contattare il <strong>Centro Europeo Consumatori Italia</strong>, ad esempio tramite l’
				<a href="https://www.euroconsumatori.org/it" rel="noopener noreferrer" target="_blank">
					ufficio di Bolzano
				</a>
				. Tale assistenza non implica che MAKY.STORE aderisca a un determinato organismo italiano di
				mediazione né sostituisce l’accesso al giudice.
			</p>
			<p>
				Restano salve le altre procedure legalmente disponibili e la competenza giurisdizionale prevista dalla
				legge. Queste condizioni non impongono al consumatore di rivolgersi esclusivamente a un giudice
				slovacco.
			</p>

			<h2>9. Dati personali</h2>
			<p>
				L’
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Informativa sulla privacy</Link> descrive
				finalità e regole del trattamento. La pagina{" "}
				<Link href={marketHref(channel, "/cookies")}>Cookie e preferenze</Link> spiega le tecnologie del sito.
			</p>
			<p>Acquisto, reclamo e recesso non richiedono il consenso al marketing o ai cookie facoltativi.</p>

			<h2>10. Disposizioni finali</h2>
			<p>
				Si applica il diritto slovacco, in particolare il codice civile e le leggi n. 108/2024 sulla tutela
				del consumatore e n. 22/2004 sul commercio elettronico, senza privare il consumatore della protezione
				inderogabile del paese di residenza abituale alle condizioni dell’articolo 6 del regolamento Roma I.
			</p>
			<p>
				L’autorità di vigilanza nel paese del venditore è la{" "}
				<strong>
					Slovenská obchodná inšpekcia, {companyInfo.supervisoryAuthority.department}, Bajkalská 21/A, P. O.
					BOX č. 5, 820 07 Bratislava, {SLOVAKIA_IT}
				</strong>
				. Le attribuzioni delle altre autorità competenti restano ferme.
			</p>
			<p>
				Le modifiche valgono per i contratti conclusi dopo la loro entrata in vigore. Quelli già conclusi
				restano regolati dalla versione pertinente e dalle norme vincolanti. Nessuna disposizione limita i
				diritti inderogabili del consumatore.
			</p>
		</>
	);
}

export function Fr({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Les présentes conditions régissent l’achat de produits sur MAKY.STORE. La version applicable est celle
				en vigueur lors de la conclusion du contrat.
			</p>
			<p>
				<strong>
					Nous sommes un vendeur slovaque. Le choix du droit slovaque ne prive pas le consommateur de la
					protection des dispositions impératives de son pays de résidence habituelle
				</strong>
				, dans les conditions de l’article 6 du règlement Rome I. Les droits impératifs applicables au
				consommateur résidant en France sont préservés.
			</p>

			<h2>1. Vendeur et coordonnées</h2>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				Siège : {companyInfo.street}, {companyInfo.city}, {SLOVAKIA_FR}
				<br />
				Numéro d’identification de l’entreprise (IČO) : <strong>{companyInfo.ico}</strong>
				<br />
				Numéro fiscal slovaque (DIČ) : <strong>{companyInfo.dic}</strong>
				<br />
				Numéro de TVA intracommunautaire : <strong>{companyInfo.icDph}</strong>
			</p>
			<p>
				La société est assujettie à la TVA en Slovaquie et inscrite au registre du commerce tenu par le
				Mestský súd Bratislava III, section Sro, numéro 200804/B.
			</p>
			<p>
				E-mail : <Mail />
				<br />
				Téléphone : <Phone />
			</p>
			<p>
				<strong>Adresse pour les retours, réclamations et courriers associés :</strong> {RETURN_ADDRESS_FR}.
			</p>
			<p>
				«Nous» et «vendeur» désignent {companyInfo.legalName} ; «acheteur» désigne la personne qui achète. Un
				consommateur est une personne physique agissant à des fins étrangères à son activité professionnelle.
				Cette qualité dépend de la finalité réelle de l’achat et des règles applicables, et non de la seule
				présence de données professionnelles sur la facture.
			</p>

			<h2>2. Commande et conclusion du contrat</h2>
			<p>
				L’achat est possible sans inscription. Ajoutez les produits au panier, renseignez vos coordonnées, les
				données de facturation et l’adresse de livraison, puis choisissez parmi les modes de livraison et de
				paiement proposés.
			</p>
			<p>
				Avant l’envoi de la commande engageante, vous pouvez vérifier et corriger son contenu et vos données.
				Nous affichons le total à payer, livraison et services supplémentaires préalablement annoncés compris.
				Le bouton <strong>«Commande avec obligation de paiement»</strong>, ou une formulation aussi explicite,
				signale qu’en validant vous vous engagez à payer.
			</p>
			<p>
				Le contrat est conclu lorsque vous recevez notre e-mail confirmant l’acceptation de la commande. Il
				comporte son récapitulatif, les conditions convenues et les conditions de vente sur un support
				durable. Une notification de paiement émise par le prestataire de paiement ne constitue pas, à elle
				seule, notre acceptation de la commande.
			</p>
			<p>
				Dans la version française de la boutique, le contrat est conclu <strong>en français</strong>. Nous
				conservons les données contractuelles pour exécuter la commande et respecter nos obligations légales.
				Vous pouvez enregistrer la confirmation et les documents reçus et demander une copie des informations
				relatives à votre commande par e-mail. Nous ne facturons pas de supplément pour conclure à distance ;
				les frais de connexion ou d’appel relèvent de votre opérateur.
			</p>

			<h2>3. Produits et utilisation</h2>
			<p>
				Les caractéristiques, le contenu du colis, l’usage prévu et les limites d’utilisation figurent sur la
				fiche produit. Pour les kits de montage, la configuration du véhicule et les pièces incluses comptent
				également.
			</p>
			<p>
				En cas de doute sur la compatibilité, contactez-nous avant d’acheter. Ce conseil ne limite pas notre
				responsabilité quant à l’exactitude des informations et à la conformité des produits livrés.
			</p>
			<p>
				La mention <strong>«Sur commande»</strong> signifie que nous approvisionnons le produit auprès d’un
				fournisseur. Elle n’en fait pas, à elle seule, un produit personnalisé exclu du droit de rétractation.
			</p>

			<h2>4. Prix et paiement</h2>
			<p>
				Les prix destinés aux consommateurs sont des prix finaux comprenant la TVA due et les autres taxes.
				Les frais de livraison sont indiqués séparément. Tous ces montants et le total apparaissent avant la
				commande engageante. Aucun service payant n’est ajouté sans accord exprès.
			</p>
			<p>
				Les prix de la version française sont exprimés en <strong>euros (EUR)</strong>. Le prix convenu à la
				conclusion du contrat s’applique ; une modification ultérieure sur le site ne change pas le prix d’un
				contrat déjà conclu.
			</p>
			<p>
				Les commandes pour la France sont payées <strong>à l’avance par Stripe</strong>, avec les moyens
				proposés pendant la commande. <strong>Le paiement contre remboursement n’est pas disponible.</strong>{" "}
				L’expédition intervient après réception du paiement, selon la disponibilité annoncée. Le numéro
				complet de carte et le cryptogramme sont traités par le prestataire de paiement ; nous ne les
				conservons pas et n’y avons pas accès.
			</p>
			<p>
				Si nous ne pouvons pas accepter la commande alors que le paiement a été reçu, nous le remboursons sans
				retard. Après conclusion du contrat, une modification du prix ou de la disponibilité chez notre
				fournisseur ne permet pas, à elle seule, de modifier unilatéralement les conditions convenues.
			</p>

			<h2>5. Livraison et réception</h2>
			<p>
				Nous expédions depuis la Slovaquie avec <strong>FedEx et Slovenská pošta (la Poste slovaque)</strong>.
				Les options dépendent des produits, des dimensions et du poids du colis et de l’adresse. Les
				possibilités et tarifs sont affichés pendant la commande.
			</p>
			<p>
				Les conditions de livraison sont communiquées avant la conclusion du contrat. Sauf autre délai
				convenu, nous livrons sans retard et au plus tard{" "}
				<strong>30 jours après la conclusion du contrat</strong>. Le délai spécifiquement convenu prévaut.
			</p>
			<p>
				En cas de dépassement, vous pouvez nous accorder un délai supplémentaire approprié et, à défaut de
				livraison, résoudre le contrat. Ce délai supplémentaire n’est notamment pas nécessaire si nous
				refusons de livrer ou si la livraison à la date prévue était essentielle au regard des circonstances
				ou d’une demande expresse portée à notre connaissance avant l’achat.
			</p>
			<p>
				Avec un transporteur que nous proposons, le risque de perte ou de dommage ne vous est transféré qu’à
				la réception par vous-même ou le tiers désigné, autre que le transporteur. L’exception légale
				concernant un transporteur choisi par vous et non proposé par nous reste applicable. Selon le code
				civil slovaque, la propriété est transférée lors de la livraison au consommateur.
			</p>
			<p>
				Il est utile de vérifier le colis et de documenter les dommages visibles. L’absence de photos ou de
				constat du transporteur ne supprime pas, à elle seule, les droits légaux. Les délais légaux de recours
				demeurent applicables.
			</p>

			<h2>6. Rétractation sans motif</h2>

			<h3>Délai et point de départ</h3>
			<p>
				Le consommateur peut en principe se rétracter dans les <strong>14 jours suivant la réception</strong>,
				sans motif. Pour les commandes passées en étant connecté au compte client, nous portons ce délai à{" "}
				<strong>30 jours</strong>. Cet avantage MAKY.STORE suit la même procédure et les conditions
				ci-dessous, sans limiter les droits légaux.
			</p>
			<p>
				Le jour de réception n’est pas compté. Pour plusieurs produits d’un même contrat livrés séparément, on
				retient le dernier ; pour une livraison en lots ou pièces, le dernier lot ou la dernière pièce ; pour
				des livraisons régulières pendant une période définie, la première réception. Le produit peut être
				reçu par un tiers désigné autre que le transporteur.
			</p>
			<p>
				La rétractation peut intervenir avant livraison ou pour certains produits seulement. Si les
				informations obligatoires n’ont pas été fournies, le délai légal est prolongé selon la loi,
				normalement jusqu’à 12 mois après le délai initial. Si elles sont communiquées pendant cette période,
				le délai de 14 jours court dès leur réception.
			</p>

			<h3>Déclaration</h3>
			<p>
				Adressez une déclaration claire à <Mail /> ou à l’adresse de retour de la section 1. La page{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Droit de rétractation</Link> présente les
				modalités disponibles et un{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy/vzorovy-formular")}>
					formulaire facultatif à imprimer
				</Link>
				.
			</p>
			<p>
				La déclaration doit identifier la personne, le contrat et les produits concernés. Aucun motif, compte
				client ou accord préalable n’est requis. Son envoi avant la fin du délai suffit ; le produit ne doit
				pas déjà être arrivé chez nous.
			</p>
			<p>
				Dans cette version de prévisualisation, la fonction de rétractation en ligne n’est pas encore active.
				Vous pouvez utiliser l’e-mail, le courrier ou une autre voie légalement admise. N’attendez pas
				l’activation si un délai court. La consultation de la page ne constitue pas un envoi de déclaration.
			</p>

			<h3>Retour et frais</h3>
			<p>
				Si nous n’avons pas proposé de reprendre le produit, retournez-le sans retard et au plus tard{" "}
				<strong>14 jours après votre déclaration</strong>, à {RETURN_ADDRESS_FR}. Une expédition dans le délai
				suffit. Si nous avons proposé l’enlèvement, préparez le produit selon les modalités convenues.
			</p>
			<p>
				Vous pouvez utiliser votre transporteur sans autorisation préalable ou demander un devis. Prix et
				modalités sont annoncés à l’avance ; nous commandons un enlèvement payant seulement après votre
				acceptation expresse. Une demande de prix ne constitue ni une commande de transport ni une offre de
				reprise de notre part.
			</p>
			<p>
				Les frais directs de retour sont à votre charge si nous vous en avons correctement informé avant
				l’achat. Le coût du retour des biens ne pouvant être renvoyés normalement par la poste est également
				communiqué avant l’achat. Sans l’information requise, ou si nous avons accepté de les supporter, nous
				ne vous facturons pas ces frais. Un devis après l’achat ne remplace pas cette information.
			</p>
			<p>
				Joignez les accessoires du produit et protégez-le pour le transport. L’emballage d’origine, l’original
				de la facture ou un numéro de dossier attribué par nous ne sont pas des conditions générales de
				validité de la rétractation.
			</p>

			<h3>Remboursement</h3>
			<p>
				Nous remboursons sans retard et au plus tard{" "}
				<strong>14 jours après réception de votre déclaration</strong>. Pour une rétractation totale, les
				frais de livraison initiaux sont inclus dans la limite de la livraison standard la moins chère
				proposée pour la commande, sans le supplément d’une option plus coûteuse expressément choisie.
			</p>
			<p>
				En cas de rétractation partielle, nous remboursons les sommes correspondantes sans ajouter
				rétroactivement de frais de livraison ou de traitement. Le moyen de paiement initial est utilisé, sauf
				accord exprès pour une solution différente sans frais. Vous n’êtes pas tenu d’accepter un avoir.
			</p>
			<p>
				Si nous n’avons pas proposé l’enlèvement, le remboursement peut être différé jusqu’à réception du
				produit ou de la preuve d’expédition, selon le premier événement. Nous n’exerçons pas cette faculté
				lorsque nous avons proposé de reprendre le produit.
			</p>

			<h3>Dépréciation et exceptions</h3>
			<p>
				Une manipulation dépassant ce qui est nécessaire pour établir la nature, les caractéristiques et le
				fonctionnement du produit peut engager votre responsabilité pour sa dépréciation, si l’information
				obligatoire sur la rétractation a été fournie. Ouvrir l’emballage ou examiner raisonnablement le
				produit ne supprime pas ce droit.
			</p>
			<p>
				Aucun forfait de retour, de déballage ou de traitement n’est facturé. Une dépréciation éventuelle est
				justifiée par les circonstances concrètes ; nous ne la compensons pas unilatéralement avec les sommes
				qui vous sont dues au titre de la rétractation.
			</p>
			<p>
				Les exceptions peuvent notamment concerner un bien réellement fabriqué selon des spécifications
				individuelles ou nettement personnalisé et, aux conditions légales, un bien scellé non retournable
				pour des raisons d’hygiène ou de santé après ouverture.{" "}
				<strong>
					Un produit ordinaire approvisionné chez un fournisseur ou un kit standard adapté à un véhicule n’est
					pas, pour cela seul, personnalisé.
				</strong>
			</p>

			<h2>7. Conformité, garanties et réclamations</h2>

			<h3>Protection issue du droit slovaque choisi</h3>
			<p>
				Nous répondons des défauts présents à la livraison qui apparaissent dans les <strong>deux ans</strong>
				. Pour un produit comportant des éléments numériques fournis en continu selon le contrat, la
				responsabilité pour ces éléments couvre la période convenue, au moins deux ans après la livraison. Les
				obligations de mise à jour nécessaires suivent la loi applicable.
			</p>
			<p>
				Pour les contrats conclus à compter du <strong>31 juillet 2026</strong>, la première réparation
				prolonge une seule fois la période de responsabilité slovaque de <strong>12 mois</strong>, quel que
				soit le nombre de réparations ultérieures. Les contrats antérieurs suivent les règles alors
				applicables. Les prolongations, suspensions ou nouveaux délais prévus par les règles impératives
				françaises restent préservés ; les durées ne s’additionnent pas automatiquement sans examen de leurs
				conditions.
			</p>
			<p>
				Un défaut apparu pendant la période applicable est présumé avoir existé à la livraison, sauf preuve
				contraire ou incompatibilité avec la nature du produit ou du défaut. Nous répondons aussi d’une
				installation incorrecte réalisée par nous ou sous notre responsabilité, ou d’une erreur du client due
				à des instructions insuffisantes. Une usure normale ou un dommage causé par le client ne constitue pas
				automatiquement un défaut imputable au vendeur ; chaque cas doit être apprécié.
			</p>

			<h3>Vos garanties légales en France</h3>
			{/*
			 * The statutory-guarantee information box.
			 *
			 * ⚠️ This is the delivered EDITORIAL box, in MAKY's own words. It is NOT a verbatim
			 * reproduction of the model in Annexe A to article D211-2 of the code de la
			 * consommation, and covering the same ground is not the same thing as formal
			 * conformity with the prescribed model. Closing that — picking the model that fits
			 * the goods actually sold, and settling the box's formal shape — is an open item
			 * owned by M before the terms are published for real selling. See
			 * `interne/PRAVNE_ROZDIELY_A_ZDROJE.md` § FR3 and the IT/FR handoff.
			 *
			 * A <blockquote> because the source marks it as one and `prose` already sets it
			 * apart from the surrounding text; the box has to READ as a distinct notice.
			 * The generated quotation marks are suppressed, though: `prose` decorates
			 * blockquote paragraphs with “ ”, which would present a statutory information
			 * box as if we were quoting somebody. It is our own statement of the reader's
			 * rights, not a citation.
			 */}
			<blockquote className="[&>p]:before:content-none [&>p]:after:content-none">
				<p>
					<strong>
						La garantie légale de conformité s’exerce contre le vendeur, indépendamment d’une éventuelle
						garantie commerciale.
					</strong>{" "}
					Pour un bien neuf, un défaut apparaissant pendant les deux années suivant la délivrance relève de
					cette protection ; vous devez établir le défaut, sans devoir prouver à quelle date il est né pendant
					la période de présomption applicable. Pour un contenu ou service numérique fourni en continu au-delà
					de deux ans, la protection liée à cette fourniture couvre la période contractuelle concernée. Les
					mises à jour nécessaires à la conformité restent dues selon la loi.
				</p>
				<p>
					Vous pouvez demander la réparation ou le remplacement, sous réserve des impossibilités et
					disproportions prévues par la loi. La solution doit être gratuite, sans inconvénient majeur et
					intervenir dans un délai raisonnable qui ne dépasse pas{" "}
					<strong>30 jours à compter de votre demande</strong>.
				</p>
				<p>
					Une réparation au titre de cette garantie ouvre une prolongation de <strong>six mois</strong>.
					Lorsque vous avez choisi la réparation mais que le vendeur ne l’effectue pas et remplace le produit
					à la place, un nouveau délai de garantie court dès la délivrance du bien de remplacement.
					L’immobilisation du produit pour sa remise en état ou son remplacement suspend le délai restant dans
					les conditions légales.
				</p>
				<p>
					Vous pouvez conserver le produit avec une réduction de prix ou le rendre contre remboursement
					lorsque les conditions légales sont réunies : refus de mise en conformité, délai dépassé,
					inconvénient majeur ou défaut qui persiste malgré une tentative. Un défaut assez grave peut
					justifier immédiatement ce choix. Un défaut mineur ne permet pas à lui seul la résolution.
				</p>
				<p>
					Les articles L. 217-1 à L. 217-32 du code de la consommation régissent cette protection. Une
					obstruction de mauvaise foi à sa mise en œuvre peut donner lieu aux sanctions civiles prévues à
					l’article L. 241-5, dont le plafond légal peut atteindre 300 000 euros ou 10 % du chiffre d’affaires
					annuel moyen selon les conditions du texte.
				</p>
				<p>
					La <strong>garantie des vices cachés</strong> des articles 1641 à 1649 du code civil reste également
					disponible. L’action s’exerce dans les deux ans à compter de la découverte du vice, sous réserve des
					autres règles de délai applicables. Elle permet, selon les conditions légales, de demander le
					remboursement contre restitution ou une réduction du prix en conservant le bien.
				</p>
			</blockquote>
			<p>
				Les droits plus favorables résultant du droit slovaque choisi ne sont pas supprimés par ce rappel des
				garanties françaises. Une durée de garantie ne signifie pas que tous les recours expirent
				automatiquement à son terme.
			</p>

			<h3>Signalement et mise en conformité</h3>
			<p>
				Signalez le défaut dès que possible à <Mail />, par écrit à notre adresse de retour ou par une autre
				voie admise. Indiquez le produit, le défaut, son apparition et un élément permettant d’identifier
				l’achat. Photos, vidéos et numéro de commande sont utiles, sans être les seuls moyens de preuve. Nous
				n’exigeons ni emballage d’origine ni exclusivement l’original de la facture. Nous ne subordonnons pas
				vos droits impératifs français à un délai de signalement de deux mois repris du droit slovaque.
			</p>
			<p>
				Nous confirmons sans retard par écrit le signalement et le délai de traitement. Avant l’intervention,
				nous vous informons du choix entre réparation et remplacement ainsi que de la prolongation pertinente.
				Toute impossibilité ou disproportion invoquée est expliquée.
			</p>
			<p>
				La réparation ou le remplacement sont gratuits, sans inconvénient majeur.{" "}
				<strong>
					Nous n’opposons pas une exception générale de délai issue du droit slovaque au maximum de 30 jours
					applicable à la mise en conformité française.
				</strong>{" "}
				Les frais nécessaires de reprise, de réexpédition, de démontage et de réinstallation d’un produit
				correctement installé sont à notre charge. Nous ne facturons pas l’usage normal avant remplacement.
			</p>
			<p>
				La réduction de prix correspond à la perte de valeur du produit. Les cas de résolution ou de réduction
				prévus par la loi comprennent notamment le remède refusé ou non exécuté, les obligations de reprise ou
				d’installation non respectées, le défaut persistant ou assez grave et l’absence manifeste de solution
				correcte dans le délai. Le caractère mineur du défaut doit être démontré par le vendeur. Les
				conséquences légales d’un dommage imputable au client s’apprécient sans réduire ses droits impératifs.
			</p>
			<p>
				Pour un ensemble de produits, la résolution concerne le produit défectueux et peut s’étendre aux
				autres lorsqu’il n’est pas raisonnable de vous demander de les conserver sans lui. Le retour pour
				défaut est à notre charge. Nous remboursons le prix dans les{" "}
				<strong>14 jours après réception du produit ou de la preuve d’expédition</strong>, selon le premier
				événement, sans préjudice d’un délai impératif plus favorable. Nous utilisons le paiement initial sauf
				accord exprès pour un autre moyen gratuit. L’usage normal ou l’usure avant cette résolution ne donne
				pas lieu à facturation.
			</p>

			<h3>Refus et garantie commerciale</h3>
			<p>
				Tout refus de responsabilité est motivé par écrit. Si une expertise ou une évaluation technique
				qualifiée établit ensuite notre responsabilité, vous pouvez présenter à nouveau la réclamation ; dans
				la procédure slovaque décrite, nous ne pouvons plus refuser la responsabilité ainsi démontrée.
				D’autres preuves restent admises et les frais nécessaires sont remboursés dans les conditions légales.
			</p>
			<p>
				Une garantie commerciale du fabricant ou du vendeur apporte des droits supplémentaires sans
				restreindre les droits légaux. Une demande d’indemnisation d’un préjudice reste possible selon la loi.
			</p>

			<h2>8. Demande de solution et règlement des litiges</h2>
			<p>
				Si le traitement d’une réclamation ne vous satisfait pas ou si vous estimez vos droits méconnus,
				demandez-nous une solution à <Mail />.
			</p>
			<p>
				En cas de refus ou d’absence de réponse sous <strong>30 jours</strong>, la procédure slovaque de
				règlement extrajudiciaire permet de saisir un organisme compétent figurant sur la liste du ministère
				slovaque de l’Économie. Pour les litiges relatifs à l’achat de biens, l’un de ces organismes est :
			</p>
			<Adr lang="fr" country={SLOVAKIA_FR} />
			<p>
				La procédure SOI est gratuite pour le consommateur. Pour un achat transfrontalier, un consommateur
				résidant en France peut aussi demander l’assistance gratuite du{" "}
				<a
					href="https://www.europe-consommateurs.eu/question-reclamation/"
					rel="noopener noreferrer"
					target="_blank"
				>
					Centre Européen des Consommateurs France
				</a>
				. Ce centre accompagne les consommateurs ; il ne doit pas être confondu avec un médiateur de la
				consommation désigné par le vendeur. Sa saisine ne suspend pas, à elle seule, les délais de recours.
			</p>
			<p>
				Ces informations ne limitent pas les autres voies de règlement légalement ouvertes, notamment les
				droits impératifs en matière de médiation, ni votre droit de saisir un tribunal compétent. Elles
				n’imposent pas de recourir exclusivement à un tribunal slovaque et ne déclarent pas une affiliation de
				MAKY.STORE à un médiateur français déterminé.
			</p>

			<h2>9. Données personnelles</h2>
			<p>
				La <Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Politique de confidentialité</Link>{" "}
				présente les finalités et règles de traitement. La page{" "}
				<Link href={marketHref(channel, "/cookies")}>Cookies et préférences</Link> explique les technologies
				utilisées.
			</p>
			<p>
				L’achat, la réclamation ou la rétractation ne sont pas subordonnés à l’acceptation du marketing ou des
				cookies facultatifs.
			</p>

			<h2>10. Dispositions finales</h2>
			<p>
				Les relations relèvent du droit slovaque, notamment du code civil et des lois n° 108/2024 sur la
				protection du consommateur et n° 22/2004 sur le commerce électronique. Ce choix ne prive pas le
				consommateur de la protection impérative de son pays de résidence habituelle dans les conditions de
				l’article 6 du règlement Rome I.
			</p>
			<p>
				L’autorité de contrôle dans le pays du vendeur est la{" "}
				<strong>
					Slovenská obchodná inšpekcia, {companyInfo.supervisoryAuthority.department}, Bajkalská 21/A, P. O.
					BOX č. 5, 820 07 Bratislava, {SLOVAKIA_FR}
				</strong>
				. Les attributions des autres autorités compétentes sont préservées.
			</p>
			<p>
				Une modification de ces conditions s’applique aux contrats conclus après son entrée en vigueur. Les
				contrats existants restent soumis à la version pertinente et aux règles impératives. Aucune
				disposition ne limite les droits impérativement reconnus au consommateur.
			</p>
		</>
	);
}
