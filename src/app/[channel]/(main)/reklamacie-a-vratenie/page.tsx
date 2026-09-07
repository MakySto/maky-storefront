import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { companyInfo } from "@/config/company";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Reklamácie a vrátenie tovaru"),
	description:
		"Chcete vrátiť objednávku alebo reklamovať vadný výrobok? Tu nájdete postup, lehoty, adresu na zaslanie a informácie o vrátení peňazí.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	const mail = <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;
	return (
		<LegalPage title="Reklamácie a vrátenie tovaru">
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
			{/* Deliberately names the PAGE, not the form. This page is statically
			    generated, so a `isWithdrawalFormServable()` branch here would bake the
			    build-time value of the interlock and could then disagree with the
			    withdrawal page, which is per-request. Wording that is true in both
			    states needs no branch. */}
			<p>
				Oznámenie odošlite cez stránku{" "}
				<Link href={marketHref(channel, "/odstupenie-od-zmluvy")}>Odstúpenie od zmluvy</Link>, e-mailom na{" "}
				{mail} alebo poštou na adresu uvedenú nižšie. Nemusíte čakať na schválenie odstúpenia.
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
				Napíšte na {mail}. Uveďte, o aký výrobok ide, aká vada sa prejavila a kedy ste ju zistili. Pridajte
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
			<p>
				<strong>{companyInfo.legalName}</strong>
				<br />
				Stará Vajnorská 11
				<br />
				831 04 Bratislava
				<br />
				{companyInfo.country}
			</p>
			<p>
				K zásielke odporúčame priložiť číslo objednávky alebo podania. Pomôže nám ju správne priradiť; jeho
				chýbanie samo osebe neruší vaše práva.
			</p>
			<p>
				Nie ste si istí, ktorý postup zvoliť?{" "}
				<Link href={marketHref(channel, "/kontakt")}>Ozvite sa nám</Link> a opíšte, čo potrebujete vyriešiť.
			</p>
		</LegalPage>
	);
}
