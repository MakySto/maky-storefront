import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { companyInfo, companyPhoneHref } from "@/config/company";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Všeobecné obchodné podmienky"),
	description:
		"Obchodné podmienky MAKY.STORE: objednávka, platba, doručenie, odstúpenie od zmluvy, zodpovednosť za vady a riešenie spotrebiteľských sporov.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	const mail = <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;
	const returnAddress = `${companyInfo.legalName}, ${companyInfo.returnAddress}, ${companyInfo.country}`;
	return (
		<LegalPage title="Všeobecné obchodné podmienky">
			<p>
				Tieto podmienky upravujú nákup tovaru v internetovom obchode MAKY.STORE. Pre konkrétnu objednávku
				platí znenie účinné v čase uzavretia zmluvy.
			</p>

			<h2>1. Kto je predávajúci</h2>
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				Sídlo: {companyInfo.street}, {companyInfo.city}, {companyInfo.country}
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
				E-mail: {mail}
				<br />
				Telefón: <a href={companyPhoneHref}>{companyInfo.phone}</a>
			</p>
			<p>
				<strong>Adresa na vrátenie tovaru, reklamácie a súvisiace oznámenia:</strong> {returnAddress}.
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
				pokladni zobrazujú dostupné spôsoby a ceny dopravy.
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
				Odstúpenie môžete odoslať cez funkciu{" "}
				<strong>
					<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>„Odstúpiť od zmluvy tu“</Link>
				</strong>
				, e-mailom na {mail} alebo písomne na adresu {companyInfo.legalName}, {companyInfo.returnAddress}.
			</p>
			<p>
				Na stránke <Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstúpenie od zmluvy</Link>{" "}
				nájdete aj vzorový formulár. Jeho použitie nie je povinné; postačuje jednoznačné vyhlásenie umožňujúce
				identifikovať zákazníka, zmluvu a rozsah odstúpenia.
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
				doby zodpovednosti. Oznámenie môžete poslať e-mailom na {mail}, písomne na adresu{" "}
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
				skôr. Použijeme rovnaký spôsob platby, pokiaľ výslovne nesúhlasíte s iným, bez nákladov pre vás. Za
				bežné používanie alebo opotrebovanie pred týmto odstúpením odplatu nepožadujeme.
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
				požiadať o nápravu na {mail}.
			</p>
			<p>
				Ak žiadosť zamietneme alebo na ňu neodpovieme do <strong>30 dní</strong>, môžete podať návrh na
				alternatívne riešenie spotrebiteľského sporu. Obrátiť sa môžete na príslušný subjekt zo zoznamu
				Ministerstva hospodárstva SR; pre spory z nákupu tovaru je jedným z nich Slovenská obchodná inšpekcia.
			</p>
			<p>
				<strong>Slovenská obchodná inšpekcia — alternatívne riešenie sporov</strong>
				<br />
				Ústredný inšpektorát, Odbor pre medzinárodné vzťahy a alternatívne riešenie spotrebiteľských sporov
				<br />
				Bajkalská 21/A, p. p. 29, 827 99 Bratislava 27
				<br />
				E-mail: <a href="mailto:ars@soi.sk">ars@soi.sk</a> alebo <a href="mailto:adr@soi.sk">adr@soi.sk</a>
				<br />
				<a
					href="https://www.soi.sk/alternativne-riesenie-spotrebitelskych-sporov"
					rel="noopener noreferrer"
					target="_blank"
				>
					Informácie a postup podania na stránke SOI
				</a>
			</p>
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
		</LegalPage>
	);
}
