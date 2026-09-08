import Link from "next/link";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { AUSTRIA, GERMANY, SLOVAKIA_DE, type GermanMarket } from "./german-market";
import { SLOVAKIA_HU, SLOVAKIA_PL } from "./slovakia";

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
