import Link from "next/link";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";

const Mail = () => <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;

function ReturnAddress() {
	return (
		<p>
			<strong>{companyInfo.legalName}</strong>
			<br />
			Stará Vajnorská 11
			<br />
			831 04 Bratislava
			<br />
			Slovenská republika
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
