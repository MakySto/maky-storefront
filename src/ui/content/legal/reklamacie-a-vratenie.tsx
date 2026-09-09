import Link from "next/link";
import { type ReactNode } from "react";
import { companyInfo } from "@/config/company";
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

export function Sk({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Potrebujete tovar vrátiť alebo nefunguje tak, ako má? Ide o dva odlišné postupy:{" "}
				<strong>vrátenie bez uvedenia dôvodu</strong> a <strong>reklamáciu vady</strong>. Nižšie nájdete, ako
				postupovať v oboch prípadoch.
			</p>

			<h2>Chcem vrátiť tovar bez uvedenia dôvodu</h2>
			<p>
				Ako spotrebiteľ môžete od zmluvy odstúpiť do <strong>14 dní od prevzatia tovaru</strong>.
				Registrovaným zákazníkom, ktorí objednávku vytvorili po prihlásení do svojho účtu, poskytujeme
				predĺženú lehotu <strong>30 dní</strong>.
			</p>
			<p>
				Odstúpiť môžete aj pred doručením, od celej objednávky alebo od jednotlivých položiek. Dôvod uvádzať
				nemusíte.
			</p>
			{/* Names the PAGE, not the form: this page is statically generated, so branching
			    on the withdrawal interlock here would bake the build-time value. */}
			<p>
				Oznámenie odošlite cez stránku{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstúpenie od zmluvy</Link>, e-mailom na{" "}
				<Mail /> alebo poštou na adresu uvedenú nižšie. Nemusíte čakať na schválenie odstúpenia.
			</p>

			<h3>Spätná doprava</h3>
			<p>
				Môžete použiť vlastného dopravcu alebo nás požiadať o ponuku na vyzdvihnutie zásielky. Cenu nami
				zabezpečovaného zvozu vám oznámime vopred a platený zvoz objednáme až po vašom výslovnom súhlase.
				Vlastnú dopravu nemusíme vopred schvaľovať.
			</p>
			<p>
				Ak sme vám neponúkli vyzdvihnutie, tovar odošlite alebo odovzdajte do{" "}
				<strong>14 dní od odstúpenia</strong>. Pri nami ponúknutom vyzdvihnutí pripravte zásielku podľa
				dohody. Samotná otázka na cenu zvozu ešte nenahrádza dohodnutie spôsobu vrátenia.
			</p>
			<p>
				Pri vrátení bez uvedenia dôvodu znášate priame náklady na spätnú dopravu, ak sme vás o nich riadne
				informovali pred nákupom. Pri tovare, ktorý nemožno bežne vrátiť poštou, musíte vopred dostať aj
				informáciu o nákladoch na jeho vrátenie.{" "}
				<strong>
					Reklamácia vady, za ktorú zodpovedáme, sa riadi inými pravidlami — potrebné náklady znášame my.
				</strong>
			</p>

			<h3>Vrátenie peňazí</h3>
			<p>
				Platby v rozsahu odstúpenia vrátime do <strong>14 dní od doručenia oznámenia</strong>. Pri vrátení
				celej objednávky vrátime aj cenu pôvodného doručenia, najviac vo výške najlacnejšieho bežného
				doručenia, ktoré sme pre danú objednávku ponúkali.
			</p>
			<p>
				Peniaze vrátime rovnakým spôsobom, akým ste platili, pokiaľ sa bez ďalších poplatkov nedohodneme inak.
				Ak sme vám neponúkli vyzdvihnutie tovaru, môžeme s vrátením platieb počkať, kým tovar dostaneme alebo
				preukážete jeho odoslanie — podľa toho, čo nastane skôr. Ak sme vyzdvihnutie ponúkli, táto možnosť
				pozdržania platieb sa neuplatní.
			</p>
			<p>
				Podrobnosti vrátane zákonných výnimiek nájdete na stránke{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstúpenie od zmluvy</Link>.
			</p>

			<h2>Chcem reklamovať vadný výrobok</h2>
			<p>
				Napíšte na <Mail />. Uveďte, o aký výrobok ide, aká vada sa prejavila a kedy ste ju zistili. Pridajte
				číslo objednávky alebo iný údaj, podľa ktorého dohľadáme nákup.
			</p>
			<p>
				Fotografia alebo krátke video môže pomôcť, ale <strong>nie je podmienkou prijatia reklamácie</strong>.
				Rovnako nevyžadujeme pôvodný obal ani výlučne originál faktúry; nákup môžete preukázať aj iným vhodným
				spôsobom.
			</p>
			<p>
				Reklamáciu môžete uplatniť aj písomne. Pri objemnom výrobku s vami dohodneme vhodný spôsob
				sprístupnenia alebo prepravy. Nahlásenie vady neodkladajte len preto, že ešte nemáte dohodnutý zvoz.
			</p>

			<h3>Za aké vady zodpovedáme</h3>
			<p>
				Pri spotrebiteľskej kúpe zodpovedáme za vady, ktoré mal tovar pri dodaní a ktoré sa prejavia do{" "}
				<strong>dvoch rokov od dodania</strong>. Ak sa vada v zákonnej dobe prejaví, predpokladá sa, že
				existovala už pri dodaní, pokiaľ sa nepreukáže opak alebo to nie je nezlučiteľné s povahou tovaru či
				vady.
			</p>
			<p>
				Vadu nám treba oznámiť do <strong>dvoch mesiacov od jej zistenia</strong>, najneskôr do uplynutia
				príslušnej doby zodpovednosti za vady.
			</p>
			<p>
				Pri zmluvách uzavretých od <strong>31. júla 2026</strong> sa po prvom odstránení vady opravou doba
				zodpovednosti za vady predlžuje o <strong>12 mesiacov</strong>. Predĺži sa len raz, bez ohľadu na
				počet opráv. O tejto možnosti aj o vašom práve vybrať si opravu alebo výmenu vás informujeme pred
				odstránením vady. Na staršie zmluvy sa vzťahujú pravidlá účinné v čase ich uzavretia.
			</p>
			<p>Prípadná záruka výrobcu poskytuje práva navyše. Nemôže obmedziť vaše zákonné práva voči nám.</p>

			<h3>Ako reklamáciu riešime</h3>
			<p>
				O oznámení vady vám <strong>bezodkladne vydáme písomné potvrdenie</strong>. Uvedieme v ňom aj lehotu
				na odstránenie vady.
			</p>
			<p>
				Prednostne máte právo vybrať si <strong>opravu alebo výmenu</strong>. Zvolený spôsob nemusí byť možný,
				ak je neuskutočniteľný alebo by v porovnaní s druhým spôsobom vyvolal neprimerané náklady. V takom
				prípade vám vysvetlíme dôvod.
			</p>
			<p>
				Opravu alebo výmenu zabezpečíme bezplatne, v primeranej lehote a bez závažných ťažkostí pre vás.
				Lehota nesmie presiahnuť <strong>30 dní od oznámenia vady</strong>, ibaže dlhšiu lehotu odôvodňuje
				objektívny dôvod, ktorý nemôžeme ovplyvniť. Takýto dôvod musíme vedieť preukázať.
			</p>
			<p>
				Za zákonných podmienok máte právo aj na <strong>primeranú zľavu alebo odstúpenie od zmluvy</strong> —
				napríklad ak sa rovnaká vada prejaví aj po oprave či výmene, vadu neodstránime riadne alebo je
				dostatočne závažná. Pri zanedbateľnej vade právo odstúpiť z tohto dôvodu nevzniká. Podrobné pravidlá
				nájdete v <Link href={marketHref(channel, "/obchodne-podmienky")}>obchodných podmienkach</Link>.
			</p>
			<p>
				Ak zodpovednosť za vadu odmietneme, dostanete písomné odôvodnenie. Ak následne znalecký posudok alebo
				odborné stanovisko akreditovanej osoby preukáže našu zodpovednosť, môžete vadu oznámiť opakovane. Vaše
				právo na náhradu účelne vynaložených nákladov sa posúdi podľa zákona.
			</p>

			<h3>Kto hradí prepravu pri reklamácii</h3>
			<p>
				Pri oprave alebo výmene vady, za ktorú zodpovedáme, hradíme potrebné náklady na prevzatie výrobku aj
				jeho doručenie späť. Ak si náprava vyžaduje demontáž riadne namontovaného výrobku a následnú montáž,
				zabezpečíme ich alebo sa dohodneme na ich úhrade podľa zákonných pravidiel.
			</p>

			<h2>Adresa na zaslanie tovaru</h2>
			<ReturnAddress />
			<p>
				K zásielke odporúčame priložiť číslo objednávky alebo podania. Pomôže nám ju správne priradiť; jeho
				chýbanie samo osebe neruší vaše práva.
			</p>
			<p>
				Nie ste si istí, ktorý postup zvoliť?{" "}
				<Link href={marketHref(channel, "/kontakt")}>Ozvite sa nám</Link> a opíšte, čo potrebujete vyriešiť.
			</p>
		</>
	);
}

export function Cs({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Potřebujete zboží vrátit, nebo nefunguje tak, jak má? Jde o dva odlišné postupy:{" "}
				<strong>vrácení bez uvedení důvodu</strong> a <strong>reklamaci vady</strong>. Níže najdete, jak
				postupovat v obou případech.
			</p>

			<h2>Chci vrátit zboží bez uvedení důvodu</h2>
			<p>
				Jako spotřebitel můžete od smlouvy odstoupit do <strong>14 dnů od převzetí zboží</strong>.
				Registrovaným zákazníkům, kteří objednávku vytvořili po přihlášení ke svému účtu, poskytujeme
				prodlouženou lhůtu <strong>30 dnů</strong>.
			</p>
			<p>
				Odstoupit můžete i před doručením, od celé objednávky nebo od jednotlivých položek. Důvod uvádět
				nemusíte.
			</p>
			<p>
				Oznámení odešlete přes stránku{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstoupení od smlouvy</Link>, e-mailem na{" "}
				<Mail /> nebo poštou na adresu uvedenou níže. Nemusíte čekat na schválení odstoupení.
			</p>

			<h3>Zpětná doprava</h3>
			<p>
				Můžete využít vlastního dopravce nebo nás požádat o nabídku vyzvednutí zásilky. Cenu námi
				zajišťovaného svozu vám sdělíme předem a placený svoz objednáme až po vašem výslovném souhlasu.
				Vlastní dopravu nemusíme předem schvalovat.
			</p>
			<p>
				Pokud jsme vám nenabídli vyzvednutí, zboží odešlete nebo předejte do{" "}
				<strong>14 dnů od odstoupení</strong>. Při námi nabídnutém vyzvednutí připravte zásilku podle dohody.
				Samotný dotaz na cenu svozu ještě nenahrazuje dohodu o způsobu vrácení.
			</p>
			<p>
				Při vrácení bez uvedení důvodu nesete přímé náklady na zpětnou dopravu, pokud jsme vás o nich řádně
				informovali před nákupem. U zboží, které nelze běžně vrátit poštou, musíte předem dostat také
				informaci o nákladech na jeho vrácení.{" "}
				<strong>
					Reklamace vady, za kterou odpovídáme, se řídí jinými pravidly — potřebné náklady neseme my.
				</strong>
			</p>

			<h3>Vrácení peněz</h3>
			<p>
				Platby v rozsahu odstoupení vrátíme do <strong>14 dnů od doručení oznámení</strong>. Při vrácení celé
				objednávky vrátíme také cenu původního doručení, nejvýše ve výši nejlevnějšího běžného doručení, které
				jsme pro danou objednávku nabízeli.
			</p>
			<p>
				Peníze vrátíme stejným způsobem, jakým jste platili, pokud se bez dalších poplatků nedohodneme jinak.
				Pokud jsme vám nenabídli vyzvednutí zboží, můžeme s vrácením plateb počkat, až zboží dostaneme nebo
				prokážete jeho odeslání — podle toho, co nastane dříve. Pokud jsme vyzvednutí nabídli, tato možnost
				pozdržení plateb se neuplatní.
			</p>
			<p>
				Podrobnosti včetně zákonných výjimek najdete na stránce{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstoupení od smlouvy</Link>.
			</p>

			<h2>Chci reklamovat vadný výrobek</h2>
			<p>
				Napište na <Mail />. Uveďte, o jaký výrobek jde, jaká vada se projevila a kdy jste ji zjistili.
				Přidejte číslo objednávky nebo jiný údaj, podle kterého dohledáme nákup.
			</p>
			<p>
				Fotografie nebo krátké video mohou pomoci, ale <strong>nejsou podmínkou přijetí reklamace</strong>.
				Stejně tak nevyžadujeme původní obal ani výhradně originál faktury; nákup můžete prokázat i jiným
				vhodným způsobem.
			</p>
			<p>
				Reklamaci můžete uplatnit i písemně. U objemného výrobku s vámi dohodneme vhodný způsob zpřístupnění
				nebo přepravy. Oznámení vady neodkládejte jen proto, že ještě nemáte dohodnutý svoz.
			</p>

			<h3>Za jaké vady odpovídáme</h3>
			<p>
				Při spotřebitelské koupi odpovídáme za vady, které zboží mělo při dodání a které se projeví do{" "}
				<strong>dvou let od dodání</strong>. Pokud se vada v zákonné době projeví, předpokládá se, že
				existovala už při dodání, pokud se neprokáže opak nebo to není neslučitelné s povahou zboží či vady.
			</p>
			<p>
				Vadu nám musíte oznámit do <strong>dvou měsíců od jejího zjištění</strong>, nejpozději do uplynutí
				příslušné doby odpovědnosti za vady.
			</p>
			<p>
				U smluv uzavřených od <strong>31. července 2026</strong> se po prvním odstranění vady opravou doba
				odpovědnosti za vady prodlužuje o <strong>12 měsíců</strong>. Prodlouží se pouze jednou, bez ohledu na
				počet oprav. O této možnosti i o vašem právu zvolit opravu nebo výměnu vás informujeme před
				odstraněním vady. Na starší smlouvy se vztahují pravidla účinná v době jejich uzavření.
			</p>
			<p>Případná záruka výrobce poskytuje práva navíc. Nemůže omezit vaše zákonná práva vůči nám.</p>

			<h3>Jak reklamaci řešíme</h3>
			<p>
				O oznámení vady vám <strong>bezodkladně vydáme písemné potvrzení</strong>. Uvedeme v něm také lhůtu
				pro odstranění vady.
			</p>
			<p>
				Přednostně máte právo zvolit <strong>opravu nebo výměnu</strong>. Zvolený způsob nemusí být možný,
				pokud je neuskutečnitelný nebo by v porovnání s druhým způsobem vyvolal nepřiměřené náklady. V takovém
				případě vám vysvětlíme důvod.
			</p>
			<p>
				Opravu nebo výměnu zajistíme bezplatně, v přiměřené lhůtě a bez závažných obtíží pro vás. Lhůta nesmí
				přesáhnout <strong>30 dnů od oznámení vady</strong>, ledaže delší lhůtu odůvodňuje objektivní důvod,
				který nemůžeme ovlivnit. Takový důvod musíme být schopni prokázat.
			</p>
			<p>
				Za zákonných podmínek máte právo také na <strong>přiměřenou slevu nebo odstoupení od smlouvy</strong>{" "}
				— například pokud se stejná vada projeví i po opravě či výměně, vadu řádně neodstraníme nebo je
				dostatečně závažná. U zanedbatelné vady právo odstoupit z tohoto důvodu nevzniká. Podrobná pravidla
				najdete v <Link href={marketHref(channel, "/obchodne-podmienky")}>obchodních podmínkách</Link>.
			</p>
			<p>
				Pokud odpovědnost za vadu odmítneme, dostanete písemné odůvodnění. Pokud následně znalecký posudek
				nebo odborné stanovisko akreditované osoby prokáže naši odpovědnost, můžete vadu oznámit opakovaně.
				Vaše právo na náhradu účelně vynaložených nákladů se posoudí podle zákona.
			</p>

			<h3>Kdo hradí přepravu při reklamaci</h3>
			<p>
				Při opravě nebo výměně kvůli vadě, za kterou odpovídáme, hradíme potřebné náklady na převzetí výrobku
				i jeho doručení zpět. Pokud náprava vyžaduje demontáž řádně namontovaného výrobku a následnou montáž,
				zajistíme je nebo se dohodneme na jejich úhradě podle zákonných pravidel.
			</p>

			<h2>Adresa pro zaslání zboží</h2>
			<ReturnAddress />
			<p>
				K zásilce doporučujeme přiložit číslo objednávky nebo podání. Pomůže nám ji správně přiřadit; jeho
				absence sama o sobě neruší vaše práva.
			</p>
			<p>
				Nejste si jisti, který postup zvolit?{" "}
				<Link href={marketHref(channel, "/kontakt")}>Ozvěte se nám</Link> a popište, co potřebujete vyřešit.
			</p>
		</>
	);
}

/**
 * The German body, shared by both German-speaking markets.
 *
 * Only two things vary: the local name of the right to withdraw, and the sentence
 * naming the mandatory consumer-protection rules that survive the choice of Slovak law.
 * Austria names the VGG and the KSchG specifically; Germany refers to Mängelrechte and
 * Verjährung. Those are not stylistic variants and must not be merged.
 *
 * The 30-day return window and the 12-month extension after a first repair are described
 * throughout as consequences of the AGREED SLOVAK LAW, not as local German or Austrian
 * entitlements — because that is what they are. Austria's own repair-extension rules
 * (BGBl. I Nr. 60/2026) take effect 2026-10-01, which is why this text does not claim
 * them as already-applicable Austrian law.
 */
function German({ channel, market }: { channel: string; market: GermanMarket }) {
	const withdrawalLink = (
		<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>{market.withdrawalTerm}</Link>
	);

	return (
		<>
			<p>
				Sie möchten einen Artikel zurückgeben oder haben einen Mangel entdeckt? Hier finden Sie den passenden
				Ablauf.{" "}
				<strong>
					Eine Rückgabe ohne Angabe von Gründen und eine Reklamation wegen eines Mangels sind zwei
					unterschiedliche Vorgänge.
				</strong>{" "}
				Insbesondere bei den Rücksendekosten gelten unterschiedliche Regeln.
			</p>

			<h2>Ich möchte Ware ohne Angabe von Gründen zurückgeben</h2>
			<p>
				Als Verbraucher können Sie Ihren Online-Kauf grundsätzlich innerhalb von{" "}
				<strong>14 Tagen nach Erhalt der Ware</strong> widerrufen. Für Bestellungen, die Sie nach der
				Anmeldung in Ihrem Kundenkonto aufgegeben haben, verlängern wir diese Frist auf{" "}
				<strong>30 Tage</strong>. Die Voraussetzungen und Ausnahmen erläutern wir auf der Seite{" "}
				{withdrawalLink}.
			</p>
			<p>
				Sie können den Widerruf auch vor der Lieferung erklären oder auf einzelne Artikel beschränken. Dafür
				brauchen Sie weder ein Kundenkonto noch unsere vorherige Genehmigung. Eine Begründung ist nicht
				erforderlich.
			</p>
			<p>
				Teilen Sie uns eindeutig mit, dass Sie den Kauf ganz oder teilweise widerrufen möchten. Schreiben Sie
				an <Mail /> oder nutzen Sie die auf der Seite {withdrawalLink} beschriebenen Wege.
			</p>

			<h3>Rücktransport</h3>
			<p>
				Sie können einen eigenen Versanddienstleister wählen oder bei uns ein Angebot für eine Abholung
				anfragen. Eine kostenpflichtige Abholung beauftragen wir erst, nachdem Sie dem Preis ausdrücklich
				zugestimmt haben. <strong>Eine Anfrage nach einem Angebot ist noch kein Abholauftrag.</strong>
			</p>
			<p>
				Wenn wir Ihnen keine Abholung angeboten haben, senden Sie die Ware spätestens{" "}
				<strong>14 Tage nach Ihrer Widerrufserklärung</strong> zurück oder übergeben Sie sie uns. Es genügt,
				die Sendung innerhalb dieser Frist abzuschicken. Wenn wir eine Abholung angeboten haben, bereiten Sie
				die Ware wie vereinbart vor.
			</p>
			<p>
				Bei einem Widerruf tragen Sie die unmittelbaren Rücksendekosten, sofern wir Sie vor dem Kauf
				ordnungsgemäß darüber informiert haben. Bei nicht normal per Post versendbarer Ware müssen Sie vor dem
				Kauf auch über die Kosten der Rücksendung informiert werden.{" "}
				<strong>
					Bei einer berechtigten Reklamation wegen eines Mangels tragen dagegen wir die erforderlichen Kosten.
				</strong>
			</p>

			<h3>Erstattung</h3>
			<p>
				Wir erstatten die vom Widerruf erfassten Zahlungen innerhalb von{" "}
				<strong>14 Tagen nach Eingang Ihrer Erklärung</strong>. Bei einem vollständigen Widerruf erstatten wir
				auch die ursprünglichen Lieferkosten, höchstens jedoch die Kosten der günstigsten Standardlieferung,
				die wir für diese Bestellung angeboten haben.
			</p>
			<p>
				Die Erstattung erfolgt mit demselben Zahlungsmittel, das Sie beim Kauf verwendet haben, sofern wir
				nicht ausdrücklich eine andere, für Sie kostenfreie Lösung vereinbaren.
			</p>
			<p>
				Haben wir keine Abholung angeboten, dürfen wir die Erstattung zurückhalten, bis die Ware bei uns
				eingegangen ist oder Sie ihre Absendung nachgewiesen haben — je nachdem, was früher eintritt. Haben
				wir die Abholung angeboten, berufen wir uns nicht auf dieses Zurückbehaltungsrecht.
			</p>
			<p>Weitere Informationen finden Sie unter {withdrawalLink}.</p>

			<h2>Ich möchte einen mangelhaften Artikel reklamieren</h2>
			<p>
				Schreiben Sie an <Mail />. Nennen Sie den Artikel, beschreiben Sie den Mangel und teilen Sie uns mit,
				wann Sie ihn bemerkt haben. Die Bestellnummer oder eine andere Angabe zum Kauf hilft uns bei der
				Zuordnung.
			</p>
			<p>
				Ein Foto oder ein kurzes Video kann helfen, ist aber{" "}
				<strong>keine Voraussetzung für die Annahme einer Reklamation</strong>. Auch die Originalverpackung
				oder ausschließlich die Originalrechnung verlangen wir nicht. Sie können den Kauf auf andere geeignete
				Weise nachweisen.
			</p>
			<p>
				Sie können einen Mangel auch schriftlich melden. Bei sperrigen Artikeln stimmen wir die Bereitstellung
				oder den Transport mit Ihnen ab. Warten Sie mit der Meldung nicht, bis eine Abholung vereinbart ist.
			</p>

			<h3>Wofür wir haften</h3>
			<p>
				Es gelten Ihre gesetzlichen Mängelrechte. Nach dem in unseren AGB vereinbarten slowakischen Recht
				haften wir bei Verbraucherkäufen für Mängel, die bei Lieferung vorhanden waren und sich innerhalb von{" "}
				<strong>zwei Jahren ab Lieferung</strong> zeigen. Zeigt sich der Mangel innerhalb der maßgeblichen
				Haftungsdauer, wird nach diesen Regeln vermutet, dass er bereits bei Lieferung vorhanden war, sofern
				nicht das Gegenteil nachgewiesen wird oder die Vermutung mit der Art der Ware oder des Mangels
				unvereinbar ist.
			</p>
			<p>
				Bei ab dem <strong>31. Juli 2026</strong> geschlossenen Verträgen verlängert sich diese Haftungsdauer
				nach der ersten Mangelbeseitigung durch Reparatur einmalig um <strong>zwölf Monate</strong>. Vor der
				Mangelbeseitigung informieren wir Sie über die Wahl zwischen Reparatur und Ersatzlieferung und die
				einschlägige Verlängerung. Für ältere Verträge gelten die zum Vertragsabschluss anwendbaren
				Bestimmungen.
			</p>
			<p>{market.mandatoryLawSentence}</p>
			<p>
				Bitte melden Sie einen Mangel möglichst bald nach seiner Entdeckung. Die gesetzlichen Fristen bleiben
				maßgeblich. Ihre zwingenden Verbraucherrechte machen wir nicht von einer sofortigen Prüfung der Ware
				oder einer zusätzlichen Mängelanzeige innerhalb von zwei Monaten abhängig.
			</p>
			<p>
				Eine Herstellergarantie kann weitere Rechte gewähren. Sie ersetzt oder beschränkt Ihre gesetzlichen
				Ansprüche gegen uns nicht.
			</p>

			<h3>Wie wir die Reklamation bearbeiten</h3>
			<p>
				Sie erhalten unverzüglich eine schriftliche Bestätigung Ihrer Mängelanzeige. Darin nennen wir auch die
				Frist für die Mangelbeseitigung.
			</p>
			<p>
				Zunächst können Sie grundsätzlich zwischen <strong>Reparatur und Ersatzlieferung</strong> wählen. Die
				gewählte Lösung kann ausgeschlossen sein, wenn sie unmöglich ist oder im Vergleich zur anderen Lösung
				unverhältnismäßige Kosten verursachen würde. Den Grund erläutern wir Ihnen.
			</p>
			<p>
				Wir sorgen für eine kostenfreie Abhilfe innerhalb angemessener Frist und ohne erhebliche
				Unannehmlichkeiten für Sie. Für unser Verfahren gilt nach den zugrunde gelegten slowakischen Regeln:
				grundsätzlich höchstens <strong>30 Tage ab der Mängelanzeige</strong>, es sei denn, ein von uns nicht
				beeinflussbarer objektiver Grund rechtfertigt eine längere Frist. Einen solchen Grund müssen wir
				nachweisen. Rechte auf eine schnellere Abhilfe nach zwingendem Verbraucherrecht bleiben unberührt.
			</p>
			<p>
				Unter den gesetzlichen Voraussetzungen können Sie außerdem eine{" "}
				<strong>Preisminderung oder die Auflösung des Kaufvertrags wegen des Mangels</strong> verlangen — etwa
				wenn eine ordnungsgemäße Abhilfe ausbleibt, derselbe Mangel trotz Reparatur oder Ersatzlieferung
				erneut auftritt oder der Mangel besonders schwerwiegend ist. Bei einem nur unerheblichen Mangel
				besteht dieses Recht auf Vertragsauflösung nicht. Einzelheiten stehen in unseren{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>AGB</Link>.
			</p>
			<p>
				Lehnen wir die Haftung für einen Mangel ab, begründen wir dies schriftlich. Belegt später ein
				Gutachten oder eine fachliche Stellungnahme einer akkreditierten Person unsere Verantwortung, können
				Sie den Mangel erneut geltend machen. Die Erstattung zweckmäßig aufgewendeter Kosten richtet sich nach
				den anwendbaren gesetzlichen Regeln. Dies sind nicht die einzigen zulässigen Beweismittel; Ihre
				weiteren Rechte bleiben bestehen.
			</p>

			<h3>Wer den Transport bei einer Reklamation bezahlt</h3>
			<p>
				Bei Reparatur oder Ersatzlieferung für einen von uns zu verantwortenden Mangel tragen wir die
				erforderlichen Kosten der Rücknahme und der erneuten Lieferung. Sind für die Abhilfe der Ausbau einer
				ordnungsgemäß eingebauten Ware und ein anschließender Einbau erforderlich, übernehmen wir diese
				Arbeiten oder erstatten die notwendigen Kosten nach den gesetzlichen Regeln.
			</p>

			<h2>Anschrift für Rücksendungen</h2>
			<ReturnAddress country={SLOVAKIA_DE} />
			<p>
				Legen Sie nach Möglichkeit die Bestellnummer oder die Vorgangsnummer bei. Das erleichtert die
				Zuordnung. Fehlt die Nummer, entfallen Ihre Rechte dadurch nicht.
			</p>
			<p>
				Sie sind unsicher, welcher Ablauf zu Ihrem Anliegen passt?{" "}
				<Link href={marketHref(channel, "/kontakt")}>Kontaktieren Sie uns</Link> und schildern Sie kurz, was
				Sie klären möchten.
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
				Chcą Państwo zwrócić produkt albo nie działa on tak, jak powinien?{" "}
				<strong>Zwrot bez podania przyczyny i reklamacja z powodu wady to dwa różne tryby.</strong> Różnią się
				między innymi zasadami ponoszenia kosztów odesłania towaru.
			</p>

			<h2>Chcę zwrócić towar bez podania przyczyny</h2>
			<p>
				Jako konsument mogą Państwo co do zasady odstąpić od umowy w ciągu{" "}
				<strong>14 dni od otrzymania towaru</strong>. Dla zamówień złożonych po zalogowaniu się na konto
				klienta wydłużamy ten termin do <strong>30 dni</strong>. Jest to dodatkowe uprawnienie MAKY.STORE, a
				nie warunek korzystania z praw ustawowych.
			</p>
			<p>
				Odstąpienie można złożyć także przed dostawą, w odniesieniu do całego zamówienia lub wybranych
				pozycji. Nie trzeba podawać powodu ani czekać na naszą zgodę.
			</p>
			<p>
				Jednoznaczne oświadczenie można wysłać na <Mail />, pocztą na podany niżej adres albo innym sposobem
				wskazanym na stronie{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstąpienie od umowy</Link>.
			</p>

			<h3>Transport zwrotny</h3>
			<p>
				Mogą Państwo wybrać własnego przewoźnika albo poprosić nas o wycenę odbioru przesyłki. Cenę i
				proponowany sposób odbioru podamy wcześniej. Płatny odbiór zlecimy dopiero po wyraźnej zgodzie na
				cenę. <strong>Pytanie o wycenę nie jest zleceniem odbioru.</strong> Własna wysyłka nie wymaga naszej
				wcześniejszej akceptacji.
			</p>
			<p>
				Jeżeli nie zaoferowaliśmy odbioru, towar należy odesłać lub przekazać nam w ciągu{" "}
				<strong>14 dni od odstąpienia od umowy</strong>. Wystarczy nadać przesyłkę w tym terminie. Jeżeli
				zaoferowaliśmy odbiór, prosimy przygotować towar zgodnie z uzgodnieniami.
			</p>
			<p>
				Przy odstąpieniu bez podania przyczyny ponoszą Państwo bezpośrednie koszty zwrotu, o ile prawidłowo
				poinformowaliśmy o tym przed zakupem. Przy towarze, którego nie można zwyczajnie odesłać pocztą, przed
				zakupem trzeba otrzymać także informację o kosztach zwrotu.{" "}
				<strong>Przy uzasadnionej reklamacji z powodu wady niezbędne koszty ponosimy my.</strong>
			</p>

			<h3>Zwrot pieniędzy</h3>
			<p>
				Płatności objęte odstąpieniem zwracamy nie później niż w ciągu{" "}
				<strong>14 dni od otrzymania oświadczenia</strong>. Przy odstąpieniu od całego zamówienia zwracamy
				również pierwotny koszt dostawy, najwyżej do wysokości najtańszej zwykłej dostawy, którą oferowaliśmy
				dla tego zamówienia.
			</p>
			<p>
				Zwrot następuje tym samym sposobem płatności, chyba że wyraźnie uzgodnimy inny, bez dodatkowych
				kosztów dla Państwa. Jeżeli nie zaoferowaliśmy odbioru, możemy wstrzymać zwrot do otrzymania towaru
				lub dowodu jego odesłania — w zależności od tego, co nastąpi wcześniej. Jeżeli zaoferowaliśmy odbiór,
				nie korzystamy z tego prawa wstrzymania.
			</p>
			<p>
				Szczegóły i wyjątki opisujemy na stronie{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstąpienie od umowy</Link>.
			</p>

			<h2>Chcę zareklamować wadliwy produkt</h2>
			<p>
				Prosimy napisać na <Mail />. Należy wskazać produkt, opisać wadę i podać, kiedy została zauważona.
				Numer zamówienia lub inna informacja o zakupie ułatwią jego odnalezienie.
			</p>
			<p>
				Zdjęcie lub krótki film mogą pomóc, ale <strong>nie są warunkiem przyjęcia reklamacji</strong>. Nie
				wymagamy oryginalnego opakowania ani wyłącznie oryginału faktury. Zakup można wykazać także w inny
				odpowiedni sposób.
			</p>
			<p>
				Reklamację można złożyć również pisemnie. Przy dużym produkcie uzgodnimy sposób jego udostępnienia lub
				transportu. Nie należy odkładać zgłoszenia wady tylko dlatego, że nie ustalono jeszcze odbioru.
			</p>

			<h3>Za co odpowiadamy</h3>
			<p>
				Odpowiadamy za wady i niezgodność towaru z umową. Według słowackiego prawa przyjętego w naszym
				regulaminie odpowiadamy przy sprzedaży konsumenckiej za wady istniejące przy dostawie, które ujawnią
				się w ciągu <strong>dwóch lat od dostarczenia towaru</strong>. W tym okresie stosuje się domniemanie,
				że ujawniona wada istniała przy dostawie, chyba że zostanie wykazane inaczej lub domniemanie nie daje
				się pogodzić z charakterem towaru albo wady.
			</p>
			<p>
				Dla umów zawartych od <strong>31 lipca 2026 r.</strong> słowacki okres odpowiedzialności po pierwszym
				usunięciu wady przez naprawę wydłuża się jednorazowo o <strong>12 miesięcy</strong>, niezależnie od
				liczby dalszych napraw. O prawie wyboru między naprawą a wymianą i o tym przedłużeniu informujemy
				przed usunięciem wady. Do starszych umów stosuje się przepisy właściwe w chwili ich zawarcia.
			</p>
			<p>
				Nie ogranicza to bezwzględnie obowiązujących polskich praw konsumenta, w szczególności wynikających z
				przepisów o niezgodności towaru z umową. Dwuletni okres ujawnienia niezgodności nie oznacza
				automatycznie, że z jego upływem wygasają wszystkie roszczenia. Jeżeli ustalony termin przydatności
				towaru do użycia jest dłuższy, uwzględniamy właściwe przepisy o dłuższej odpowiedzialności.
			</p>
			<p>
				Wadę warto zgłosić możliwie szybko. Nie uzależniamy Państwa obowiązkowej ochrony konsumenckiej od
				natychmiastowego sprawdzenia przesyłki ani od dodatkowego, dwumiesięcznego terminu zgłoszenia
				przeniesionego ze słowackich warunków.
			</p>
			<p>
				Ewentualna gwarancja producenta jest dodatkową podstawą uprawnień. Nie zastępuje ani nie ogranicza
				roszczeń wobec nas z tytułu niezgodności towaru z umową.
			</p>

			<h3>Jak rozpatrujemy reklamację</h3>
			<p>
				Niezwłocznie przekazujemy pisemne potwierdzenie zgłoszenia wady, wskazując termin jej usunięcia.{" "}
				<strong>Na reklamację konsumenta odpowiadamy w ciągu 14 dni od jej otrzymania</strong>, na papierze
				lub innym trwałym nośniku, na przykład e-mailem. Jeżeli ma zastosowanie art. 7a polskiej ustawy o
				prawach konsumenta, brak odpowiedzi w tym terminie oznacza uznanie reklamacji. Samo potwierdzenie
				otrzymania zgłoszenia nie zastępuje odpowiedzi na zgłoszone żądanie.
			</p>
			<p>
				Co do zasady mogą Państwo wybrać <strong>naprawę albo wymianę</strong>. Wybrany sposób może być
				niedostępny, jeżeli jest niemożliwy lub wiąże się z niewspółmiernymi kosztami w porównaniu z drugim.
				Wyjaśnimy przyczynę takiej decyzji.
			</p>
			<p>
				Naprawę lub wymianę zapewniamy bezpłatnie, w rozsądnym czasie i bez nadmiernych niedogodności. W
				ramach słowackiego trybu opisanego w regulaminie termin usunięcia wady co do zasady nie przekracza{" "}
				<strong>30 dni od zgłoszenia</strong>, chyba że dłuższy termin uzasadnia obiektywna przyczyna, na
				którą nie mamy wpływu i którą potrafimy wykazać. Nie daje nam to prawa do odraczania naprawy wymaganej
				wcześniej przez okoliczności ani do ograniczania obowiązkowych praw konsumenta.{" "}
				<strong>Termin odpowiedzi na reklamację i termin naprawy to dwie różne rzeczy.</strong>
			</p>
			<p>
				Na warunkach określonych prawem przysługuje także{" "}
				<strong>obniżenie ceny albo odstąpienie od umowy z powodu niezgodności towaru z umową</strong>, na
				przykład gdy wada pozostaje mimo naprawy lub wymiany, nie zapewniamy właściwej naprawy albo
				niezgodność jest istotna. Szczegóły znajdują się w{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Regulaminie sklepu</Link>.
			</p>
			<p>
				Odmowę odpowiedzialności uzasadniamy pisemnie. Jeżeli później opinia rzeczoznawcy lub odpowiednio
				akredytowanej osoby wykaże naszą odpowiedzialność, reklamację można zgłosić ponownie. Rozliczenie
				celowych kosztów następuje według właściwych przepisów. Nie wyklucza to innych dopuszczalnych dowodów
				ani pozostałych uprawnień.
			</p>

			<h3>Kto płaci za transport przy reklamacji</h3>
			<p>
				Przy naprawie lub wymianie towaru z wadą, za którą odpowiadamy, ponosimy niezbędne koszty jego
				odebrania i ponownego dostarczenia. Jeżeli konieczny jest demontaż prawidłowo zamontowanego produktu i
				późniejszy montaż, zapewnimy te czynności lub ich rozliczenie zgodnie z prawem.
			</p>

			<h2>Adres do odesłania towaru</h2>
			<ReturnAddress country={SLOVAKIA_PL} />
			<p>
				Warto dołączyć numer zamówienia lub zgłoszenia. Ułatwi to przyporządkowanie przesyłki, ale brak numeru
				sam w sobie nie pozbawia Państwa praw.
			</p>
			<p>
				Nie wiedzą Państwo, który tryb wybrać? Prosimy o{" "}
				<Link href={marketHref(channel, "/kontakt")}>kontakt</Link> i krótki opis sprawy.
			</p>
		</>
	);
}

export function Hu({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Visszaküldene egy terméket, vagy hibát észlelt? Itt találja a megfelelő ügyintézési módot.{" "}
				<strong>
					Az indokolás nélküli elállás és a hibás termékkel kapcsolatos reklamáció két külön eljárás.
				</strong>{" "}
				A visszaszállítás költségeire is eltérő szabályok vonatkoznak.
			</p>

			<h2>Indokolás nélkül szeretném visszaküldeni a terméket</h2>
			<p>
				Fogyasztóként az online vásárlástól főszabály szerint a termék átvételétől számított{" "}
				<strong>14 napon belül</strong> elállhat. Ha a rendelést a vásárlói fiókjába bejelentkezve adta le,
				ezt a határidőt <strong>30 napra</strong> hosszabbítjuk meg. A feltételeket és a kivételeket az{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Elállási jog</Link> oldalon ismertetjük.
			</p>
			<p>
				Az elállást a kézbesítés előtt is közölheti, és az egyes termékekre is korlátozhatja. Ehhez nem kell
				vásárlói fiók vagy előzetes engedélyünk, és indokolást sem kérünk.
			</p>
			<p>
				Egyértelműen jelezze, hogy az egész vásárlástól vagy annak egy részétől el kíván állni. Írhat az{" "}
				<Mail /> címre, vagy használhatja az{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Elállási jog</Link> oldalon ismertetett
				lehetőségeket.
			</p>

			<h3>Visszaszállítás</h3>
			<p>
				Saját fuvarozót választhat, vagy árajánlatot kérhet tőlünk a termék elszállítására. Fizetős
				elszállítást csak az ár kifejezett elfogadása után rendelünk meg.{" "}
				<strong>Az árajánlat kérése önmagában nem elszállítási megrendelés.</strong>
			</p>
			<p>
				Ha nem ajánlottuk fel az elszállítást, az elállási nyilatkozattól számított{" "}
				<strong>14 napon belül</strong> küldje vissza vagy adja át nekünk a terméket. A határidőn belüli
				feladás elegendő. Ha felajánlottuk az elszállítást, a terméket a megállapodásnak megfelelően készítse
				elő.
			</p>
			<p>
				Indokolás nélküli elállásnál a visszaküldés közvetlen költségét Ön viseli, ha erről a vásárlás előtt
				megfelelően tájékoztattuk. A szokásos postai úton nem visszaküldhető termékek visszaszállítási
				költségéről is előzetesen kell tájékoztatást adni.{" "}
				<strong>
					Megalapozott, általunk viselendő hibával kapcsolatos reklamációnál viszont a szükséges költségeket
					mi álljuk.
				</strong>
			</p>

			<h3>Visszatérítés</h3>
			<p>
				Az elállással érintett összegeket a nyilatkozat beérkezésétől számított{" "}
				<strong>14 napon belül</strong> visszatérítjük. Teljes elállás esetén az eredeti szállítás díját is
				megtérítjük, legfeljebb az adott rendeléshez kínált legolcsóbb szokásos szállítás költségéig.
			</p>
			<p>
				A visszatérítést az eredeti fizetési móddal teljesítjük, kivéve, ha kifejezetten más, Önnek díjmentes
				megoldásban állapodunk meg.
			</p>
			<p>
				Ha nem ajánlottuk fel az elszállítást, a visszatérítést a termék vagy a feladást igazoló bizonylat
				átvételéig visszatarthatjuk, attól függően, melyik történik korábban. Ha felajánlottuk az
				elszállítást, erre a visszatartási jogra nem hivatkozunk.
			</p>
			<p>
				További részletek az <Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Elállási jog</Link>{" "}
				oldalon találhatók.
			</p>

			<h2>Hibás terméket szeretnék reklamálni</h2>
			<p>
				Írjon az <Mail /> címre. Nevezze meg a terméket, írja le a hibát és azt, mikor észlelte. A rendelési
				szám vagy a vásárlást azonosító más adat segíti az ügyintézést.
			</p>
			<p>
				Egy fénykép vagy rövid videó hasznos lehet, de{" "}
				<strong>nem feltétele a reklamáció befogadásának</strong>. Eredeti csomagolást vagy kizárólag eredeti
				számlát sem követelünk; a vásárlás más megfelelő módon is igazolható.
			</p>
			<p>
				A hibát írásban is bejelentheti. Nagyméretű terméknél külön egyeztetjük annak rendelkezésre bocsátását
				vagy szállítását. A bejelentéssel ne várjon az elszállítás megszervezéséig.
			</p>

			<h3>Milyen felelősséget vállalunk</h3>
			<p>
				Önt megilletik a hibás teljesítésből eredő törvényes jogok. Az ÁSZF-ben választott szlovák jog szerint
				fogyasztói vásárlásnál a kézbesítéskor fennálló, a kézbesítéstől számított{" "}
				<strong>két éven belül</strong> jelentkező hibákért felelünk. Az irányadó felelősségi időn belül
				jelentkező hibáról e szabályok szerint vélelmezni kell, hogy már a kézbesítéskor fennállt, kivéve, ha
				az ellenkezőjét bizonyítják, vagy a vélelem a termék, illetve a hiba jellegével összeegyeztethetetlen.
			</p>
			<p>
				A <strong>2026. július 31-étől kötött szerződéseknél</strong> az első kijavítást követően ez az idő a
				szlovák jog alapján egyszer, <strong>12 hónappal</strong> meghosszabbodik. A kijavítás előtt
				tájékoztatjuk a javítás és a csere közötti választásról, valamint az alkalmazandó hosszabbításról.
				Régebbi szerződéseknél a megkötésükkor irányadó szabályok érvényesek.
			</p>
			<p>
				A Róma I. rendelet 6. cikke alapján alkalmazandó kötelező magyar fogyasztóvédelmi rendelkezések,
				köztük a kellékszavatosság és az esetleges kötelező jótállás szabályai, változatlanul védik Önt. A
				fent ismertetett kedvezőbb jogokat ezek nem rövidítik le.
			</p>
			<p>
				Kérjük, a hibát a felfedezése után mielőbb jelezze. A magyar kellékszavatossági szabályok szerint a
				felfedezéstől számított két hónapon belüli közlés késedelem nélkülinek minősül. Ez nem azt jelenti,
				hogy két hónap elteltével automatikusan megszűnik minden igény. Az irányadó határidők és a késedelmes
				közlés jogkövetkezményei a jogszabályokból következnek.
			</p>

			<h3>Kellékszavatosság és jótállás</h3>
			<p>
				A <strong>kellékszavatosság</strong> az eladó hibás teljesítésért fennálló törvényes felelőssége. A{" "}
				<strong>jótállás</strong> ettől különböző, jogszabályon vagy külön vállaláson alapuló kötelezettség.
				Egy gyártói jótállás nem helyettesíti és nem korlátozza az eladóval szemben érvényesíthető törvényes
				jogokat.
			</p>
			<p>
				Ha a termék az alkalmazandó magyar szabályok szerint kötelező jótállás alá tartozó új tartós
				fogyasztási cikk, akkor a 151/2003. (IX. 22.) Korm. rendelet alapján a jótállás a{" "}
				<strong>10 000–250 000 forintos eladási ársávban két év, 250 000 forint felett három év</strong>. A
				besorolást a termékkör és az eladási ár együtt határozza meg; ez nem jelenti azt, hogy minden autós
				tartozék automatikusan ugyanabba a körbe tartozik. Az érintett termékhez az előírt tájékoztatást és
				dokumentumokat biztosítjuk. Az alkalmazandó kötelező jótállási és javítási szabályokat nem írják felül
				a lent ismertetett általános ügyintézési feltételek.
			</p>

			<h3>A reklamáció kezelése</h3>
			<p>
				A hibabejelentésről késedelem nélkül írásos visszaigazolást adunk, és tájékoztatjuk a hiba
				megszüntetésének határidejéről.
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
			<p>
				Elsősorban <strong>kijavítást vagy kicserélést</strong> kérhet. A választott megoldás kizárható, ha
				lehetetlen, vagy a másik megoldáshoz képest aránytalan többletköltséget okozna. Ennek okát
				megindokoljuk.
			</p>
			<p>
				A hibát díjmentesen, észszerű időn belül és jelentős kényelmetlenség nélkül rendezzük. A szlovák alap
				szerint a határidő főszabály szerint legfeljebb <strong>30 nap a hibabejelentéstől</strong>, kivéve,
				ha tőlünk független, igazolható objektív ok hosszabb határidőt indokol. Ez nem korlátozza az
				alkalmazandó magyar előírások szerinti gyorsabb intézkedést, kötelező cserét vagy visszatérítést. A
				válaszadási, a javítási és a pénz-visszatérítési határidő nem azonos.
			</p>
			<p>
				Törvényi feltételek mellett{" "}
				<strong>árleszállítást vagy a szerződés hibás teljesítés miatti megszüntetését</strong> is kérheti,
				például ha a megfelelő kijavítás vagy csere elmarad, a hiba ismét jelentkezik, vagy olyan súlyos, hogy
				azonnali más jogorvoslat indokolt. Jelentéktelen hiba önmagában nem alapozza meg a szerződés
				megszüntetését. A részletes szabályok az{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>ÁSZF-ben</Link> szerepelnek.
			</p>
			<p>
				Ha a felelősséget elutasítjuk, írásban megindokoljuk. Ha később szakértői vélemény vagy megfelelően
				akkreditált személy szakvéleménye bizonyítja a felelősségünket, a hibát újból bejelentheti. Az
				indokolt költségek megtérítésére a jogszabályok irányadók. Más megengedett bizonyítékok és további
				jogok is érvényesíthetők.
			</p>

			<h3>Ki fizeti a reklamációhoz kapcsolódó szállítást</h3>
			<p>
				Az általunk viselendő hiba javításánál vagy a termék cseréjénél mi álljuk a visszavétel és az
				újraküldés szükséges költségeit. Ha egy megfelelően beépített termék eltávolítása és visszaszerelése
				szükséges, ezeket elvégezzük vagy a jogszabályok szerint megtérítjük a szükséges költségeket.
			</p>

			<h2>Visszaküldési cím</h2>
			<ReturnAddress country={SLOVAKIA_HU} />
			<p>
				Lehetőség szerint mellékelje a rendelési számot vagy az ügyszámot. Ez segít az azonosításban, de
				hiánya nem szünteti meg a jogait.
			</p>
			<p>
				Nem biztos benne, melyik eljárás vonatkozik az ügyére?{" "}
				<Link href={marketHref(channel, "/kontakt")}>Írjon nekünk</Link>, és röviden mondja el, miben
				segíthetünk.
			</p>
		</>
	);
}

export function It({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Vuoi restituire un prodotto o hai riscontrato un difetto?{" "}
				<strong>
					Il recesso senza motivazione e il reclamo per un prodotto difettoso sono due procedure diverse
				</strong>
				, anche per quanto riguarda i costi del trasporto.
			</p>

			<h2>Voglio restituire un acquisto senza indicare il motivo</h2>
			<p>
				Come consumatore, puoi normalmente recedere da un acquisto online entro{" "}
				<strong>14 giorni dalla consegna</strong>. Per gli ordini effettuati dopo aver eseguito l’accesso al
				tuo account, estendiamo questo termine a <strong>30 giorni</strong>. Le condizioni e le eccezioni sono
				nella pagina <Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Diritto di recesso</Link>.
			</p>
			<p>
				Puoi comunicarci il recesso anche prima della consegna o limitarlo ad alcuni prodotti. Per esercitarlo
				non servono un account, la nostra autorizzazione preventiva o una motivazione.
			</p>
			<p>
				Comunica chiaramente la volontà di recedere dall’intero acquisto o da una sua parte a <Mail />, oppure
				utilizza le modalità descritte nella pagina sul recesso.
			</p>

			<h3>Trasporto del reso</h3>
			<p>
				Puoi scegliere un tuo corriere oppure chiederci un preventivo per il ritiro. Un ritiro a pagamento
				viene ordinato soltanto dopo la tua esplicita accettazione del prezzo.{" "}
				<strong>Chiedere un preventivo non equivale a ordinare il ritiro.</strong>
			</p>
			<p>
				Se non abbiamo offerto di ritirare il prodotto, spediscilo o consegnacelo entro{" "}
				<strong>14 giorni dalla comunicazione del recesso</strong>. È sufficiente spedirlo entro il termine.
				Se abbiamo offerto il ritiro, prepara il prodotto secondo gli accordi.
			</p>
			<p>
				In caso di recesso senza motivazione, sostieni i costi diretti della restituzione se ne sei stato
				correttamente informato prima dell’acquisto. Anche il costo del reso di un prodotto non restituibile
				normalmente per posta deve essere comunicato in anticipo.{" "}
				<strong>
					Per un difetto di cui siamo responsabili, i costi necessari sono invece a nostro carico.
				</strong>
			</p>

			<h3>Rimborso</h3>
			<p>
				Rimborsiamo gli importi interessati dal recesso entro{" "}
				<strong>14 giorni dalla ricezione della comunicazione</strong>. Se recedi dall’intero ordine,
				rimborsiamo anche la consegna iniziale, fino al costo della modalità standard meno costosa offerta per
				quell’ordine.
			</p>
			<p>
				Utilizziamo il metodo di pagamento originario, salvo un diverso accordo espresso che non comporti
				costi per te. Se non abbiamo offerto il ritiro, possiamo attendere la ricezione del prodotto oppure
				della prova di spedizione, a seconda di quale avvenga prima. Se abbiamo offerto il ritiro, non ci
				avvaliamo di questa sospensione del rimborso.
			</p>

			<h2>Voglio segnalare un prodotto difettoso</h2>
			<p>
				Scrivi a <Mail />, indicando il prodotto, il difetto, quando si è manifestato e un riferimento che ci
				permetta di identificare l’acquisto.
			</p>
			<p>
				Una foto o un breve video possono aiutare, ma{" "}
				<strong>non sono una condizione per ricevere il reclamo</strong>. Non richiediamo l’imballaggio
				originale o esclusivamente l’originale della fattura: l’acquisto può essere provato anche in altro
				modo adeguato. Puoi segnalare il difetto anche per iscritto o con le altre modalità consentite dalla
				legge. Per un articolo voluminoso concorderemo come metterlo a disposizione; non rimandare la
				segnalazione perché il trasporto non è ancora definito.
			</p>

			<h3>Responsabilità per difetti e garanzie</h3>
			<p>
				Secondo la disciplina slovacca richiamata nelle nostre condizioni, rispondiamo dei difetti presenti
				alla consegna che si manifestano entro <strong>due anni</strong>. Nel relativo periodo si presume che
				il difetto esistesse già alla consegna, salvo prova contraria o incompatibilità con la natura del
				prodotto o del difetto.
			</p>
			<p>
				Per i contratti conclusi dal <strong>31 luglio 2026</strong>, dopo la prima riparazione il periodo di
				responsabilità previsto dal diritto slovacco si prolunga, una sola volta, di <strong>12 mesi</strong>.
				Informiamo del diritto di scegliere tra riparazione e sostituzione e della proroga prima
				dell’intervento. Per i contratti precedenti valgono le disposizioni applicabili alla loro conclusione.
			</p>
			<p>
				Queste condizioni non riducono la <strong>garanzia legale di conformità</strong> e gli altri diritti
				inderogabili applicabili al consumatore residente in Italia. Il periodo in cui il difetto deve
				manifestarsi e il termine per far valere un diritto non sono la stessa cosa. Non facciamo dipendere
				tali diritti da un controllo immediato del pacco o da un ulteriore termine di denuncia di due mesi
				importato dalle condizioni slovacche.
			</p>
			<p>
				Una garanzia commerciale del produttore offre eventuali diritti aggiuntivi; non sostituisce quelli
				verso di noi.
			</p>

			<h3>Come gestiamo il reclamo</h3>
			<p>
				Forniamo senza ritardo una conferma scritta della segnalazione, indicando il termine per porre rimedio
				al difetto. Puoi scegliere tra <strong>riparazione e sostituzione</strong>, salvo che la soluzione
				scelta sia impossibile o sproporzionata rispetto all’altra; in tal caso spieghiamo il motivo.
			</p>
			<p>
				Il rimedio è gratuito, avviene entro un tempo ragionevole e senza notevoli inconvenienti. La
				disciplina slovacca di base prevede normalmente un massimo di{" "}
				<strong>30 giorni dalla segnalazione</strong>, salvo un motivo oggettivo dimostrabile e indipendente
				dalla nostra volontà. Questa eccezione non consente di rinviare un rimedio che le circostanze e i
				diritti inderogabili applicabili richiedono prima.
			</p>
			<p>
				Nei casi previsti dalla legge puoi chiedere una{" "}
				<strong>riduzione del prezzo o la risoluzione per difetto di conformità</strong>, ad esempio se il
				rimedio non viene eseguito correttamente, il difetto persiste oppure è sufficientemente grave. Un
				difetto lieve non giustifica da solo la risoluzione. Le{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Condizioni generali di vendita</Link>{" "}
				descrivono i dettagli.
			</p>
			<p>
				Se rifiutiamo la responsabilità, ne motiviamo per iscritto le ragioni. Puoi ripresentare il reclamo se
				una successiva valutazione tecnica dimostra la nostra responsabilità; restano ammessi gli altri mezzi
				di prova e i diritti al rimborso delle spese necessarie secondo la legge.
			</p>

			<h3>Chi paga il trasporto</h3>
			<p>
				Quando rispondiamo del difetto, sosteniamo le spese necessarie di ritiro e riconsegna. Se occorre
				rimuovere un prodotto correttamente installato e reinstallarlo, provvediamo a tali operazioni o al
				rimborso dei relativi costi secondo la legge.
			</p>

			<h2>Indirizzo per la restituzione</h2>
			<ReturnAddress country={SLOVAKIA_IT} />
			<p>
				Aggiungi, se possibile, il numero dell’ordine o del reclamo: ci aiuta a identificare il pacco, ma la
				sua assenza non ti priva dei tuoi diritti.
			</p>
			<p>
				Non sai quale procedura scegliere? <Link href={marketHref(channel, "/kontakt")}>Contattaci</Link> e
				descrivici il problema.
			</p>
		</>
	);
}

export function Fr({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Vous souhaitez retourner un produit ou avez constaté un défaut ?{" "}
				<strong>
					La rétractation sans motif et la réclamation pour un produit défectueux sont deux démarches
					différentes.
				</strong>{" "}
				Les règles relatives aux frais de transport diffèrent également.
			</p>

			<h2>Je souhaite retourner un achat sans donner de motif</h2>
			<p>
				En tant que consommateur, vous pouvez en principe vous rétracter d’un achat en ligne dans les{" "}
				<strong>14 jours suivant la réception</strong>. Pour une commande passée en étant connecté à votre
				compte client, nous portons ce délai à <strong>30 jours</strong>. Les conditions et exceptions
				figurent sur la page{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Droit de rétractation</Link>.
			</p>
			<p>
				Vous pouvez vous rétracter avant la livraison ou seulement pour certains produits. Aucun compte
				client, accord préalable de notre part ou motif n’est nécessaire pour exercer ce droit.
			</p>
			<p>
				Indiquez clairement votre volonté de vous rétracter de tout ou partie de l’achat à <Mail />, ou
				utilisez les possibilités présentées sur la page consacrée à la rétractation.
			</p>

			<h3>Transport du retour</h3>
			<p>
				Vous pouvez choisir votre transporteur ou nous demander un devis d’enlèvement. Nous ne commandons un
				enlèvement payant qu’après votre acceptation expresse du prix.{" "}
				<strong>Une demande de devis n’est pas une commande d’enlèvement.</strong>
			</p>
			<p>
				Si nous n’avons pas proposé de reprendre le produit, renvoyez-le ou remettez-le-nous dans les{" "}
				<strong>14 jours suivant votre déclaration de rétractation</strong>. Une expédition dans ce délai
				suffit. Si nous avons proposé l’enlèvement, préparez le produit selon les modalités convenues.
			</p>
			<p>
				En cas de rétractation sans motif, les frais directs de retour sont à votre charge si vous en avez été
				correctement informé avant l’achat. Pour un produit qui ne peut pas être retourné normalement par la
				poste, le coût du retour doit également être indiqué à l’avance.{" "}
				<strong>
					Les frais nécessaires liés à un défaut dont nous répondons sont, en revanche, à notre charge.
				</strong>
			</p>

			<h3>Remboursement</h3>
			<p>
				Nous remboursons les sommes concernées dans les{" "}
				<strong>14 jours suivant la réception de votre déclaration</strong>. En cas de rétractation totale,
				cela comprend les frais de livraison initiaux, dans la limite du mode standard le moins cher proposé
				pour cette commande.
			</p>
			<p>
				Le remboursement utilise le moyen de paiement initial, sauf accord exprès pour une autre solution sans
				frais pour vous. Si nous n’avons pas proposé l’enlèvement, nous pouvons différer le remboursement
				jusqu’à la réception du produit ou de la preuve de son expédition, selon le premier de ces événements.
				Nous n’utilisons pas cette faculté lorsque nous avons proposé de reprendre le produit.
			</p>

			<h2>Je souhaite signaler un produit défectueux</h2>
			<p>
				Écrivez à <Mail />. Précisez le produit, le défaut, la date à laquelle il est apparu et une référence
				permettant d’identifier l’achat.
			</p>
			<p>
				Une photo ou une courte vidéo peut aider, mais{" "}
				<strong>n’est pas une condition de réception de la réclamation</strong>. Nous n’exigeons pas
				l’emballage d’origine ni exclusivement l’original de la facture : tout moyen adapté de prouver l’achat
				peut être utilisé. Vous pouvez aussi signaler le défaut par écrit ou par une autre voie admise par la
				loi. Pour un produit volumineux, nous conviendrons des modalités de mise à disposition ; n’attendez
				pas que le transport soit organisé pour signaler le défaut.
			</p>

			<h3>Vos garanties</h3>
			<p>
				Le droit slovaque choisi dans nos conditions prévoit notre responsabilité pour les défauts présents à
				la livraison qui apparaissent dans les <strong>deux ans</strong>. Pendant la période applicable, leur
				présence à la livraison est présumée, sauf preuve contraire ou incompatibilité avec la nature du
				produit ou du défaut.
			</p>
			<p>
				Pour les contrats conclus à compter du <strong>31 juillet 2026</strong>, la première réparation
				prolonge, une seule fois, cette période de responsabilité slovaque de <strong>12 mois</strong>. Nous
				vous informons du choix entre réparation et remplacement ainsi que de cette prolongation avant
				l’intervention. Les contrats antérieurs restent soumis aux dispositions applicables lors de leur
				conclusion.
			</p>
			<p>
				Cela ne limite ni la <strong>garantie légale de conformité</strong> ni la{" "}
				<strong>garantie des vices cachés</strong> applicables en France. Les règles françaises de
				prolongation, de suspension et de renouvellement des délais restent préservées. La garantie
				commerciale éventuelle du fabricant s’y ajoute ; elle ne remplace pas les droits que vous pouvez
				exercer à notre égard.
			</p>
			<p>
				Signalez le défaut dès que possible. Nous ne subordonnons pas vos droits impératifs à une inspection
				immédiate du colis ni à un délai supplémentaire de deux mois repris des conditions slovaques.
			</p>

			<h3>Traitement de la réclamation</h3>
			<p>
				Nous vous remettons sans retard une confirmation écrite du signalement et indiquons le délai de
				traitement. Vous pouvez en principe choisir la <strong>réparation ou le remplacement</strong>, sauf
				impossibilité ou coût disproportionné par rapport à l’autre solution. Nous expliquons toute décision
				de ce type.
			</p>
			<p>
				Lorsque la garantie légale française de conformité s’applique, la mise en conformité doit intervenir
				dans un délai raisonnable <strong>ne dépassant pas 30 jours après votre demande</strong>, sans frais
				et sans inconvénient majeur. Nous ne lui opposons pas l’exception générale de délai prévue par le
				droit slovaque.
			</p>
			<p>
				Une <strong>réduction du prix ou la résolution de la vente pour défaut</strong> peut être demandée
				dans les cas prévus par la loi, notamment en cas de refus de mise en conformité, de dépassement du
				délai, d’inconvénient majeur ou de défaut persistant. Un défaut suffisamment grave peut justifier
				immédiatement cette solution. Un défaut mineur ne permet pas, à lui seul, de résoudre la vente.
			</p>
			<p>
				Pour les détails, notamment les délais de garantie et les vices cachés, consultez les{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Conditions générales de vente</Link>.
			</p>
			<p>
				Si nous refusons notre responsabilité, nous motivons cette décision par écrit. Un avis technique
				ultérieur peut permettre de présenter à nouveau la réclamation. Cela n’exclut ni les autres moyens de
				preuve admis ni le remboursement des frais nécessaires dans les conditions légales.
			</p>

			<h3>Qui paie le transport</h3>
			<p>
				Pour un défaut dont nous répondons, les frais nécessaires de reprise et de réexpédition sont à notre
				charge. Si la solution exige le démontage puis la réinstallation d’un produit correctement installé,
				nous les prenons en charge conformément à la loi.
			</p>

			<h2>Adresse de retour</h2>
			<ReturnAddress country={SLOVAKIA_FR} />
			<p>
				Joindre le numéro de commande ou de dossier facilite l’identification du colis, mais son absence ne
				vous fait pas perdre vos droits.
			</p>
			<p>
				Vous hésitez sur la démarche ? <Link href={marketHref(channel, "/kontakt")}>Contactez-nous</Link> en
				décrivant votre situation.
			</p>
		</>
	);
}

export function Es({ channel }: { channel: string }) {
	return (
		<>
			<p>
				¿Quieres devolver un producto o has detectado un defecto?{" "}
				<strong>
					El desistimiento sin indicar el motivo y la reclamación por un producto defectuoso son dos
					procedimientos distintos.
				</strong>{" "}
				También cambian las reglas sobre quién paga el transporte.
			</p>

			<h2>Quiero devolver un producto sin indicar el motivo</h2>
			<p>
				Como consumidor, puedes desistir normalmente en un plazo de{" "}
				<strong>14 días naturales desde la recepción del producto</strong>. Si realizaste el pedido después de
				iniciar sesión en tu cuenta, ampliamos el plazo a <strong>30 días</strong>. Las condiciones y
				excepciones figuran en el{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Derecho de desistimiento</Link>.
			</p>
			<p>
				Puedes comunicarlo antes de recibir la compra y limitarlo a determinados productos. No necesitas una
				cuenta para hacerlo ni nuestra autorización previa, y no tienes que justificar tu decisión.
			</p>
			<p>
				Comunícanos de forma inequívoca qué compra o productos quieres devolver. Puedes escribir a <Mail /> o
				utilizar las vías explicadas en la página de desistimiento.
			</p>

			<h3>Transporte de devolución</h3>
			<p>
				Puedes elegir tu propio transportista o pedirnos un presupuesto de recogida. Solo contratamos una
				recogida de pago cuando aceptas expresamente su precio.{" "}
				<strong>
					Pedir un presupuesto no equivale a contratar la recogida ni, por sí solo, a que nosotros la hayamos
					ofrecido.
				</strong>
			</p>
			<p>
				Si no hemos ofrecido recoger el producto, envíalo o entrégalo en un plazo de{" "}
				<strong>14 días desde que comunicas el desistimiento</strong>. Basta con enviarlo antes de que venza
				el plazo. Si hemos ofrecido la recogida, prepara el paquete según lo acordado.
			</p>
			<p>
				Los costes directos de la devolución sin motivo corren de tu cuenta si te informamos debidamente antes
				de comprar. Cuando el producto no puede devolverse normalmente por correo, también debemos informar
				antes de la compra de ese coste.{" "}
				<strong>
					En una reclamación por un defecto del que respondemos, los gastos necesarios nos corresponden a
					nosotros.
				</strong>
			</p>

			<h3>Reembolso</h3>
			<p>
				Devolvemos las cantidades afectadas por el desistimiento dentro de los{" "}
				<strong>14 días siguientes a la recepción de tu comunicación</strong>. Si desistes de todo el pedido,
				incluimos el envío inicial, hasta el coste del servicio ordinario más económico que ofrecíamos para
				ese pedido.
			</p>
			<p>
				Usamos el mismo medio de pago, salvo acuerdo expreso sobre otro que no te genere gastos. Si no hemos
				ofrecido recoger el producto, podemos esperar a recibirlo o a que acredites su envío, lo que ocurra
				primero. Si ofrecimos la recogida, no aplicamos esa retención.
			</p>

			<h2>Quiero reclamar por un producto defectuoso</h2>
			<p>
				Escribe a <Mail />. Identifica el producto, describe el defecto y cuándo lo detectaste, e indica el
				número de pedido u otro dato que permita localizar la compra.
			</p>
			<p>
				Una foto o un vídeo breve puede ayudar, pero{" "}
				<strong>no es una condición para recibir la reclamación</strong>. Tampoco exigimos el embalaje
				original ni exclusivamente la factura original: puedes acreditar la compra por otros medios adecuados.
			</p>
			<p>
				También puedes reclamar por escrito. Si el producto es voluminoso, acordaremos cómo ponerlo a nuestra
				disposición o transportarlo. No retrases la comunicación del defecto mientras esperas una recogida.
			</p>

			<h3>Garantía legal y plazos</h3>
			<p>
				Para los bienes nuevos comprados por consumidores a los que se aplica la protección imperativa
				española, respondemos por las faltas de conformidad existentes en la entrega que se manifiesten
				durante <strong>tres años desde la entrega</strong>. No limitamos esa protección a los dos años del
				régimen general eslovaco.
			</p>
			<p>
				La reclamación de los remedios por falta de conformidad tiene un plazo de prescripción distinto:
				conforme al régimen español,{" "}
				<strong>cinco años desde que se manifiesta la falta de conformidad</strong>. No significa que todos
				los defectos que aparezcan durante cinco años estén cubiertos automáticamente.
			</p>
			<p>
				Durante los dos primeros años se presume, salvo prueba en contrario y con las excepciones legales, que
				la falta de conformidad ya existía en la entrega. Se mantienen las reglas de suspensión de plazos
				durante la reparación o sustitución y los derechos adicionales del régimen eslovaco descritos en las{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Condiciones generales</Link>.
			</p>
			<p>
				Comunícanos el problema cuanto antes. No condicionamos la protección imperativa española a un plazo
				adicional de dos meses importado de las condiciones eslovacas.
			</p>
			<p>Una garantía comercial del fabricante es adicional: no sustituye nuestros deberes como vendedor.</p>

			<h3>Cómo resolvemos la reclamación</h3>
			<p>
				Te facilitamos sin demora una confirmación escrita y la información sobre el plazo de solución. Puedes
				solicitar <strong>reparación o sustitución</strong>, salvo que la opción elegida resulte imposible o
				desproporcionada frente a la otra. Te explicaremos cualquier limitación.
			</p>
			<p>
				La solución debe ser gratuita, realizarse en un plazo razonable y no causarte inconvenientes
				importantes. Conforme al régimen eslovaco descrito en nuestras condiciones, normalmente no superará{" "}
				<strong>30 días desde la comunicación del defecto</strong>, salvo una causa objetiva ajena a nuestro
				control que podamos acreditar. Esa excepción no permite incumplir la exigencia española de un plazo
				razonable ni restringir un derecho obligatorio más favorable.
			</p>
			<p>
				En los casos previstos legalmente puedes pedir{" "}
				<strong>una reducción del precio o la resolución del contrato por falta de conformidad</strong>: por
				ejemplo, cuando no se realiza la solución debida, el defecto persiste o es suficientemente grave. Esto
				no es el desistimiento de 14 días. Una falta leve no justifica por sí sola la resolución.
			</p>
			<p>
				Si rechazamos la responsabilidad, te daremos una explicación escrita. Puedes aportar otros medios de
				prueba admisibles y volver a reclamar; los informes periciales y sus costes se tratan conforme a las
				reglas aplicables.
			</p>

			<h3>Quién paga el transporte</h3>
			<p>
				Cuando respondemos por el defecto, asumimos los costes necesarios de recogida y nueva entrega. Si la
				solución requiere desmontar y volver a instalar un producto correctamente instalado, nos encargamos o
				asumimos los costes que correspondan legalmente.
			</p>

			<h2>Dirección para enviar el producto</h2>
			<ReturnAddress country={SLOVAKIA_ES} />
			<p>
				Incluir el número de pedido o de reclamación facilita la identificación, pero su ausencia no elimina
				tus derechos. Si no sabes qué procedimiento corresponde,{" "}
				<Link href={marketHref(channel, "/kontakt")}>escríbenos</Link> y cuéntanos qué ocurre.
			</p>
		</>
	);
}

export function Ro({ channel }: { channel: string }) {
	return (
		<>
			<p>
				Vrei să returnezi un produs sau ai observat un defect?{" "}
				<strong>
					Retragerea fără indicarea motivului și reclamația privind un produs neconform sunt proceduri
					diferite.
				</strong>{" "}
				Și regulile privind costul transportului sunt diferite.
			</p>

			<h2>Vreau să returnez produsul fără să indic un motiv</h2>
			<p>
				Ca persoană care cumpără în calitate de consumator, te poți retrage, de regulă, în{" "}
				<strong>14 zile de la primirea produsului</strong>. Dacă ai plasat comanda după autentificarea în
				contul de client, prelungim termenul la <strong>30 de zile</strong>. Condițiile și excepțiile sunt
				explicate în pagina{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Dreptul de retragere</Link>.
			</p>
			<p>
				Poți anunța retragerea înainte de livrare și o poți limita la anumite produse. Nu ai nevoie de cont
				sau de aprobarea noastră prealabilă și nu trebuie să explici motivul.
			</p>
			<p>
				Trimite o declarație clară din care să reiasă la ce cumpărătură și produse se referă retragerea. Poți
				scrie la <Mail /> sau folosi modalitățile descrise în pagina de retragere.
			</p>

			<h3>Transportul de retur</h3>
			<p>
				Poți alege propriul transportator sau ne poți solicita o ofertă pentru ridicarea coletului. Comandăm o
				ridicare contra cost numai după ce accepți expres prețul.{" "}
				<strong>
					Solicitarea unei oferte nu este o comandă de transport și nici, prin ea însăși, o ofertă de ridicare
					din partea noastră.
				</strong>
			</p>
			<p>
				Dacă nu ne-am oferit să ridicăm produsul, trimite-l sau predă-ni-l în{" "}
				<strong>14 zile de la comunicarea retragerii</strong>. Este suficient să îl expediezi înainte de
				expirarea termenului. Dacă am oferit ridicarea, pregătește coletul conform înțelegerii.
			</p>
			<p>
				La retragerea fără motiv suporți costurile directe de retur dacă ai fost informat corespunzător
				înainte de cumpărare. Pentru produsele care nu pot fi returnate în mod normal prin poștă, trebuie
				comunicat înainte de cumpărare și costul returului.{" "}
				<strong>
					Costurile necesare pentru remedierea unei neconformități de care răspundem sunt suportate de noi.
				</strong>
			</p>

			<h3>Restituirea banilor</h3>
			<p>
				Restituim plățile vizate în <strong>14 zile de la primirea declarației de retragere</strong>. La
				retragerea din întreaga comandă, rambursăm și livrarea inițială, în limita celei mai ieftine metode
				standard oferite pentru acea comandă.
			</p>
			<p>
				Folosim aceeași metodă de plată, cu excepția unui acord expres pentru o altă metodă fără costuri
				pentru tine. Dacă nu am oferit ridicarea, putem aștepta până primim produsul sau dovada expedierii,
				oricare intervine prima. Dacă am oferit ridicarea, nu aplicăm această amânare.
			</p>

			<h2>Vreau să reclam un produs defect</h2>
			<p>
				Scrie la <Mail />. Indică produsul, descrie defectul și când l-ai observat și adaugă numărul comenzii
				sau alte informații care permit identificarea cumpărăturii.
			</p>
			<p>
				O fotografie sau un scurt videoclip poate ajuta, dar{" "}
				<strong>nu este o condiție pentru primirea reclamației</strong>. Nu cerem ambalajul original sau
				exclusiv factura originală; cumpărarea poate fi dovedită și prin alte mijloace adecvate.
			</p>
			<p>
				Poți formula reclamația și în scris. Pentru un produs voluminos, stabilim cum ni-l pui la dispoziție
				sau cum îl transportăm. Nu amâna anunțarea defectului pentru că ridicarea nu a fost încă stabilită.
			</p>

			<h3>Garanția legală de conformitate</h3>
			<p>
				Răspundem pentru neconformitățile existente la livrare care se constată în{" "}
				<strong>doi ani de la livrare</strong>, fără a limita cazurile în care legea oferă o protecție mai
				lungă. Se păstrează drepturile privind viciile ascunse care fac produsul impropriu utilizării în
				durata medie de utilizare, în condițiile legii.
			</p>
			<p>
				Conform regimului slovac convenit, defectul constatat în perioada de răspundere se prezumă existent la
				livrare, dacă nu se dovedește contrariul sau dacă prezumția este incompatibilă cu natura bunului ori a
				defectului. Regula românească privind prezumția privind existența neconformității la livrare nu reduce
				drepturile mai favorabile prevăzute în condițiile noastre.
			</p>
			<p>
				Pentru contractele încheiate de la <strong>31 iulie 2026</strong>, perioada de răspundere prevăzută de
				dreptul slovac se prelungește o singură dată cu{" "}
				<strong>12 luni după prima remediere prin reparație</strong>. Celelalte reguli legale privind
				prelungirea sau reluarea termenelor rămân aplicabile. Detaliile sunt în{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Termenii și condițiile de vânzare</Link>.
			</p>
			<p>
				Anunță-ne cât mai curând după ce descoperi defectul. Nu condiționăm protecția obligatorie românească
				de un termen suplimentar de două luni preluat din dreptul slovac. Garanția comercială a producătorului
				este suplimentară și nu înlocuiește răspunderea noastră legală.
			</p>

			<h3>Cum rezolvăm reclamația</h3>
			<p>
				Îți oferim fără întârziere o confirmare scrisă și informațiile privind remedierea. Poți solicita{" "}
				<strong>repararea sau înlocuirea</strong>, în condițiile legii. O opțiune poate fi exclusă dacă este
				imposibilă sau disproporționată față de cealaltă; îți explicăm motivul.
			</p>
			<p>
				Repararea sau înlocuirea se face gratuit și fără inconveniente semnificative, într-un termen rezonabil
				de <strong>cel mult 15 zile calendaristice de la informarea noastră despre neconformitate</strong>.
				Stabilim termenul de comun acord, în scris, ținând cont de produs și de defect. Nu invocăm termenul
				general slovac de 30 de zile sau excepția lui pentru a depăși limita românească.
			</p>
			<p>
				Dacă neconformitatea este constatată la scurt timp după livrare, în cel mult{" "}
				<strong>30 de zile calendaristice</strong>, beneficiezi de înlocuirea bunului potrivit regulii
				speciale românești. Nu este vorba despre termenul de retragere fără motiv.
			</p>
			<p>
				În situațiile prevăzute legal poți cere{" "}
				<strong>reducerea prețului sau încetarea contractului pentru neconformitate</strong>, de exemplu dacă
				remedierea corespunzătoare nu are loc, defectul persistă ori este suficient de grav. O neconformitate
				minoră nu justifică, singură, încetarea contractului.
			</p>
			<p>
				Dacă respingem răspunderea, motivăm în scris. Poți prezenta alte dovezi admisibile și formula din nou
				reclamația. Regimul expertizelor și al cheltuielilor necesare este cel prevăzut de lege.
			</p>

			<h3>Cine plătește transportul</h3>
			<p>
				Când răspundem pentru neconformitate, suportăm costurile necesare preluării și noii livrări. Dacă
				remedierea presupune demontarea și remontarea unui produs instalat corect, le asigurăm sau suportăm
				costurile potrivit legii.
			</p>

			<h2>Adresa de retur</h2>
			<ReturnAddress country={SLOVAKIA_RO} />
			<p>
				Numărul comenzii sau al reclamației ajută la identificare, dar lipsa lui nu îți anulează drepturile.
				Dacă nu știi ce procedură se potrivește, <Link href={marketHref(channel, "/kontakt")}>scrie-ne</Link>{" "}
				și descrie pe scurt situația.
			</p>
		</>
	);
}

/**
 * The shared half of the two English returns pages.
 *
 * Four things differ between the United States and Canada, and each is a prop:
 *
 * - the verb. American English cancels with one `l`, Canadian English with two. The
 *   delivered copy is consistent about this, and so is this component — the word is never
 *   written literally in the shared prose, it always comes from `cancelling`.
 * - which country's cooling-off period we are *not* claiming to be.
 * - where the goods are shipped back from.
 * - the statutory-rights paragraph. That is the substantive one: US state express and
 *   implied warranties, versus Canadian provincial and territorial legal warranties and
 *   Québec's reasonable-durability rule. They are different laws and get different text.
 */
function EnglishClaims({
	channel,
	market,
	cancelling,
	notCoolingOff,
	statutoryRights,
}: {
	channel: string;
	/** How the market is named in prose: `the United States`, `Canada`. */
	market: string;
	/** `canceling` in US spelling, `cancelling` in Canadian. */
	cancelling: string;
	/** The cooling-off regime this policy must not be mistaken for. */
	notCoolingOff: string;
	/** The market's own mandatory-rights paragraph. See the note above. */
	statutoryRights: ReactNode;
}) {
	return (
		<>
			<p>
				Changed your plans, or is something wrong with the product?{" "}
				<strong>
					A change-of-mind return and a claim about a defective, damaged or incorrect item are different
					processes.
				</strong>{" "}
				Different rules apply to the shipping costs too.
			</p>

			<h2>Returning an item because you changed your mind</h2>
			<p>
				For consumer purchases, MAKY.STORE provides <strong>14 calendar days from delivery</strong> to tell us
				that you are {cancelling} the purchase without giving a reason. If you placed the order while signed
				in to your customer account, the period is <strong>30 days</strong>. The same return procedure applies
				to that extension.
			</p>
			<p>
				We provide this protection under our store terms and the agreed Slovak framework. We do not describe
				it as {notCoolingOff} for all online shopping. Any mandatory rights that give you more protection
				remain available.
			</p>
			<p>
				You can cancel before delivery or return selected items. You do not need an account at the time of
				cancellation, a reason or our prior approval. Send a clear notice to <Mail />, identifying the
				purchase and the items concerned. The full procedure and exceptions are on{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Cancellations and returns</Link>.
			</p>

			<h3>Return shipping</h3>
			<p>
				For routine change-of-mind returns from {market},{" "}
				<strong>you arrange shipping to Slovakia with a carrier of your choice</strong>. We do not currently
				offer routine pickup or a prepaid return label. Send the goods within 14 days after notifying us of
				cancellation; dispatching them within that period is enough.
			</p>
			<p>
				You pay the direct return-shipping costs where we properly informed you of them before purchase. For
				goods that cannot normally be returned by post, the required cost information must also be given
				before purchase. We do not use a later quote to replace missing pre-purchase information. If we agreed
				to bear the cost or applicable law makes it ours, we do not charge it to you.
			</p>

			<h3>Refunds</h3>
			<p>
				Under our change-of-mind policy, we refund the amounts due within{" "}
				<strong>14 days after receiving your cancellation notice</strong>, subject to the permitted hold until
				we receive the goods or evidence that you sent them, whichever comes first. If we have separately
				offered to collect the goods, we do not use that hold.
			</p>
			<p>
				For a cancellation of the whole order, we also refund the original delivery charge up to the least
				expensive standard delivery option offered for that order. We use the original payment method unless
				you expressly agree to another no-cost method. There is no flat restocking fee. These rules do not
				delay a refund required sooner under another applicable right.
			</p>

			<h2>Reporting a defective, damaged or incorrect item</h2>
			<p>
				Email <Mail />. Tell us which product is affected, what is wrong and when you noticed it. Include the
				order number or other details that let us identify the purchase.
			</p>
			<p>
				A photo or short video is helpful but <strong>is not a condition for accepting the report</strong>.
				Original packaging or only an original invoice is not required; other suitable evidence of purchase
				can be used. You can also write to us by mail. Do not delay reporting the problem while shipping
				arrangements are being discussed.
			</p>

			<h3>Our responsibility as seller</h3>
			<p>
				Our Terms of sale retain the Slovak seller-responsibility framework: defects present at delivery that
				appear within two years, with the applicable presumptions and other protections. For contracts entered
				into on or after <strong>July 31, 2026</strong>, that Slovak period is extended once by{" "}
				<strong>12 months after the first repair that remedies a defect</strong>. Older contracts follow the
				rules applicable when they were made.
			</p>
			{statutoryRights}
			<p>
				A manufacturer’s commercial warranty is additional and may have its own geographical scope. It does
				not replace your rights against us. We do not assume that a warranty offered for a European product
				includes service in North America.
			</p>

			<h3>How we handle a claim</h3>
			<p>
				We acknowledge the report in writing without delay and explain the proposed remedy and timing. Under
				the agreed framework, you can generally choose repair or replacement, unless the chosen remedy is
				impossible or disproportionate compared with the other. We explain any limitation.
			</p>
			<p>
				We provide the required remedy without charge, within a reasonable time and without significant
				inconvenience. The Slovak procedure normally sets a period of no more than 30 days from the report,
				unless an objective reason beyond our control justifies a longer period and we can demonstrate it. We
				do not use this rule or its exception to override a more protective mandatory local requirement.
			</p>
			<p>
				A price reduction or cancellation for a defect may be available in the circumstances set by law, for
				example where an appropriate repair or replacement is not provided, the defect persists or it is
				sufficiently serious. This is not the same as the 14/30-day change-of-mind policy. Details are in our{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Terms of sale</Link>.
			</p>
			<p>
				If we reject responsibility, we explain why in writing. You may provide further evidence and pursue
				other remedies available under the law.
			</p>

			<h3>Shipping costs for a valid product claim</h3>
			<p>
				<strong>
					When we are responsible for the defect, we bear the necessary costs of the remedy, including the
					required return and replacement shipping.
				</strong>{" "}
				Contact us to coordinate an appropriate method, especially for a bulky product. The absence of routine
				change-of-mind pickup does not transfer these costs to you or remove your right to a remedy. Necessary
				removal and reinstallation are dealt with as required by law.
			</p>

			<h2>Return address</h2>
			<ReturnAddress country={SLOVAKIA_EN} />
			<p>
				Include the order or case reference where possible; this helps us match the package but is not, on its
				own, a condition of your rights. For customs paperwork, ask your carrier what it needs and provide an
				accurate description. We can supply purchase details; a customs question should not delay your
				cancellation notice.
			</p>
		</>
	);
}

export function Us({ channel }: { channel: string }) {
	return (
		<EnglishClaims
			channel={channel}
			market="the United States"
			cancelling="canceling"
			notCoolingOff="a general US federal cooling-off period"
			statutoryRights={
				<p>
					Applicable US law may give you express or implied warranty rights, including rights relating to
					merchantability or fitness for a particular purpose. Those rights and the time allowed to enforce
					them vary by state. We do not sell to consumers under a blanket “as is” disclaimer or make a
					manufacturer your only route to a remedy. The two-year period in our Slovak framework does not cap a
					longer mandatory US right.
				</p>
			}
		/>
	);
}

export function Ca({ channel }: { channel: string }) {
	return (
		<EnglishClaims
			channel={channel}
			market="Canada"
			cancelling="cancelling"
			notCoolingOff="a general Canadian cooling-off period"
			statutoryRights={
				<p>
					Your Canadian rights may also include provincial or territorial legal warranties and conditions
					relating to quality, fitness and reasonable durability. In Québec, for example, goods must be fit
					for their ordinary use and last a reasonable time having regard to their price, contract terms and
					conditions of use. A manufacturer’s warranty expiring does not by itself end those rights. The
					two-year period in our Slovak framework does not cap a longer mandatory Canadian right.
				</p>
			}
		/>
	);
}
