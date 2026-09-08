import Link from "next/link";
import { companyInfo, companyPhoneHref } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { AUSTRIA, GERMANY, SLOVAKIA_DE, type GermanMarket } from "./german-market";

const Mail = () => <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;
const Phone = () => <a href={companyPhoneHref}>{companyInfo.phone}</a>;

const RETURN_ADDRESS = `${companyInfo.legalName}, ${companyInfo.returnAddress}, Slovenská republika`;
const RETURN_ADDRESS_DE = `${companyInfo.legalName}, ${companyInfo.returnAddress}, ${SLOVAKIA_DE}`;

function Adr({ lang }: { lang: "sk" | "cs" | "de" }) {
	return (
		<p>
			<strong>
				Slovenská obchodná inšpekcia —{" "}
				{lang === "sk" ? "alternatívne" : lang === "cs" ? "alternativní" : "alternative"} riešenie sporov
			</strong>
			<br />
			Ústredný inšpektorát, Odbor pre medzinárodné vzťahy a alternatívne riešenie spotrebiteľských sporov
			<br />
			Bajkalská 21/A, p. p. 29, 827 99 Bratislava 27
			<br />
			E-mail: <a href="mailto:ars@soi.sk">ars@soi.sk</a>{" "}
			{lang === "sk" ? "alebo" : lang === "cs" ? "nebo" : "oder"} <a href="mailto:adr@soi.sk">adr@soi.sk</a>
			<br />
			<a
				href="https://www.soi.sk/alternativne-riesenie-spotrebitelskych-sporov"
				rel="noopener noreferrer"
				target="_blank"
			>
				{lang === "sk"
					? "Informácie a postup podania na stránke SOI"
					: lang === "cs"
						? "Informace a postup podání na stránce SOI"
						: "Informationen zum Verfahren bei der SOI"}
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
