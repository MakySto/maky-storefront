import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Všeobecné obchodné podmienky"),
	description:
		"Všeobecné obchodné podmienky internetového obchodu MAKY.STORE s. r. o. — objednávka, ceny, doprava, odstúpenie od zmluvy, reklamácie a riešenie sporov.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="Všeobecné obchodné podmienky">
			<p>Platné a účinné od 30. 6. 2026.</p>

			<h3>1. Úvodné ustanovenia a identifikácia obchodníka</h3>
			<p>
				1.1 Tieto všeobecné obchodné podmienky (ďalej len „podmienky“) upravujú práva a povinnosti zmluvných
				strán pri kúpe tovaru v internetovom obchode na adrese maky.store a sú neoddeliteľnou súčasťou kúpnej
				zmluvy uzavretej na diaľku.
			</p>
			<p>
				1.2 Predávajúci:
				<br />
				<strong>MAKY.STORE s. r. o.</strong>, so sídlom Lermontovova 911/3, 811 05 Bratislava-Staré Mesto,
				Slovenská republika, IČO: 57 704 627, DIČ: 2122890660. Predávajúci nie je platiteľom DPH. Spoločnosť
				je zapísaná v Obchodnom registri Mestského súdu Bratislava III, oddiel: Sro, vložka č. 200804/B.
				Konateľ: Marek Kysucký.
				<br />
				E-mail: info@maky.store, telefón: +421 901 730 066.
				<br />
				Adresa na vrátenie tovaru a reklamácie: Stará Vajnorská 11, 831 04 Bratislava.
			</p>
			<p>
				1.3 Spotrebiteľom je fyzická osoba, ktorá pri uzatváraní a plnení zmluvy nekoná v rámci svojej
				podnikateľskej činnosti alebo povolania. Zmluva uzavretá na diaľku je zmluva uzavretá výlučne
				prostredníctvom prostriedkov diaľkovej komunikácie, bez súčasnej fyzickej prítomnosti predávajúceho a
				spotrebiteľa.
			</p>
			<p>
				1.4 Vzťahy, ktoré tieto podmienky neupravujú, sa riadia najmä zákonom o ochrane spotrebiteľa, zákonom
				o elektronickom obchode a Občianskym zákonníkom.
			</p>

			<h3>2. Objednávka a uzavretie kúpnej zmluvy</h3>
			<p>
				2.1 Tovar si zákazník vyberie vložením do košíka. Registrácia účtu je možná, ale nie je podmienkou
				nákupu.
			</p>
			<p>
				2.2 Objednávka prebieha v týchto krokoch: výber tovaru, vloženie do košíka, vyplnenie kontaktných a
				doručovacích údajov, výber dopravy a platby, kontrola a možnosť opravy zadaných údajov a napokon
				odoslanie objednávky tlačidlom označeným slovami „Objednávka s povinnosťou platby“.
			</p>
			<p>2.3 Pred odoslaním objednávky má zákazník možnosť skontrolovať a opraviť zadané údaje.</p>
			<p>
				2.4 Kúpna zmluva je uzavretá doručením potvrdenia o prijatí objednávky na e-mail zákazníka. Potvrdenie
				obsahuje zhrnutie objednávky a tieto podmienky. Zmluva sa uzatvára v slovenskom jazyku a predávajúci
				ju uchováva na účely jej plnenia.
			</p>

			<h3>3. Ceny a platba</h3>
			<p>
				3.1 Ceny tovaru sú uvedené pri jednotlivých produktoch. Predávajúci nie je platiteľom DPH; uvedené
				ceny sú konečné a k cene sa nepripočítava DPH.
			</p>
			<p>
				3.2 Cena tovaru nezahŕňa cenu dopravy. Celkovú cenu vrátane dopravy zákazník vidí v pokladni pred
				odoslaním objednávky.
			</p>
			<p>
				3.3 Platba prebieha online prostredníctvom zabezpečenej platobnej brány Stripe. Podporované platobné
				metódy sa zákazníkovi zobrazia pri platbe. Údaje o platobnej karte spracúva poskytovateľ platobnej
				brány; predávajúci k úplným údajom o karte nemá prístup.
			</p>

			<h3>4. Doprava</h3>
			<p>
				4.1 Tovar doručujeme kuriérskou službou FedEx. Cena dopravy závisí od rozmerov, hmotnosti a adresy
				doručenia a zákazník ju vidí v pokladni ešte pred odoslaním objednávky.
			</p>
			<p>
				4.2 Predpokladaný termín dodania závisí od dostupnosti tovaru a zvolenej dopravy. Ak je pri objednávke
				uvedený odhadovaný termín doručenia, slúži ako orientačný.
			</p>
			<p>
				4.3 Pri prevzatí zásielky odporúčame skontrolovať jej neporušenosť. Zjavné poškodenie obalu alebo
				tovaru, prosím, oznámte nám bez zbytočného odkladu.
			</p>

			<h3>5. Nadobudnutie vlastníctva a prechod nebezpečenstva škody</h3>
			<p>
				5.1 Vlastnícke právo k tovaru prechádza na zákazníka úplným zaplatením kúpnej ceny. Nebezpečenstvo
				škody na tovare prechádza na zákazníka jeho prevzatím.
			</p>

			<h3>6. Odstúpenie od zmluvy</h3>
			<p>6.1 Spotrebiteľ má právo odstúpiť od zmluvy bez uvedenia dôvodu do 14 dní od prevzatia tovaru.</p>
			<p>
				6.2 Registrovaným zákazníkom, ktorí objednávku vytvorili po prihlásení do svojho zákazníckeho účtu,
				poskytujeme nad rámec zákona predĺženú lehotu na odstúpenie 30 dní od prevzatia tovaru. Táto predĺžená
				lehota nemení zákonné práva spotrebiteľa.
			</p>
			<p>
				6.3 Odstúpenie od zmluvy môže spotrebiteľ uplatniť vyplnením vzorového formulára (dostupný na stránke
				„Odstúpenie od zmluvy“) alebo iným jednoznačným vyhlásením zaslaným na e-mail info@maky.store alebo
				písomne na adresu Stará Vajnorská 11, 831 04 Bratislava. Lehota je zachovaná, ak je oznámenie odoslané
				pred jej uplynutím.
			</p>
			<p>
				6.4 Tovar je spotrebiteľ povinný zaslať alebo odovzdať najneskôr do 14 dní odo dňa odstúpenia, na
				adresu Stará Vajnorská 11, 831 04 Bratislava.
			</p>
			<p>
				6.5 Predávajúci vráti spotrebiteľovi všetky prijaté platby vrátane nákladov na najlacnejší ponúkaný
				spôsob doručenia najneskôr do 14 dní od doručenia oznámenia o odstúpení, rovnakým platobným
				prostriedkom. Predávajúci nie je povinný vrátiť platbu skôr, ako mu je tovar doručený alebo ako
				spotrebiteľ preukáže jeho zaslanie.
			</p>
			<p>6.6 Náklady na vrátenie tovaru znáša spotrebiteľ.</p>
			<p>
				6.7 Spotrebiteľ zodpovedá za zníženie hodnoty tovaru, ktoré vzniklo jeho používaním nad rámec potrebný
				na zistenie vlastností a funkčnosti tovaru.
			</p>
			<p>
				6.8 Spotrebiteľ nemôže odstúpiť od zmluvy najmä pri tovare zhotovenom podľa jeho osobitných
				požiadaviek alebo vyrobenom na mieru a pri tovare uzavretom v ochrannom obale, ktorý nie je vhodné
				vrátiť z dôvodu ochrany zdravia alebo hygieny, ak bol obal po dodaní porušený.
			</p>

			<h3>7. Zodpovednosť za vady a reklamácie</h3>
			<p>
				7.1 Predávajúci zodpovedá za vady, ktoré má tovar pri prevzatí, a za vady, ktoré sa vyskytnú v
				záručnej dobe. Záručná doba je 24 mesiacov, ak nie je pri tovare uvedené inak. Práva z vád sa
				uplatňujú podľa Občianskeho zákonníka.
			</p>
			<p>
				7.2 Reklamáciu zákazník uplatní e-mailom na info@maky.store alebo písomne na adrese Stará Vajnorská
				11, 831 04 Bratislava; uveďte číslo objednávky a popis vady.
			</p>
			<p>
				7.3 Predávajúci vydá zákazníkovi písomné potvrdenie o uplatnení reklamácie bez zbytočného odkladu a
				reklamáciu vybaví najneskôr do 30 dní od jej uplatnenia, ak nie je objektívne odôvodnená dlhšia
				lehota.
			</p>
			<p>
				7.4 Podľa povahy vady má spotrebiteľ právo najmä na bezplatné odstránenie vady opravou alebo výmenou,
				prípadne na primeranú zľavu z ceny alebo na odstúpenie od zmluvy.
			</p>

			<h3>8. Alternatívne riešenie sporov</h3>
			<p>
				8.1 Ak spotrebiteľ nie je spokojný so spôsobom vybavenia reklamácie alebo sa domnieva, že boli
				porušené jeho práva, môže sa obrátiť na predávajúceho so žiadosťou o nápravu. Ak predávajúci na
				žiadosť odpovie zamietavo alebo neodpovie do 30 dní, má spotrebiteľ právo podať návrh na alternatívne
				riešenie sporu.
			</p>
			<p>
				8.2 Subjektom alternatívneho riešenia sporov je Slovenská obchodná inšpekcia, Bajkalská 21/A, 827 99
				Bratislava 27, e-mail: ars@soi.sk alebo adr@soi.sk,{" "}
				<a href="https://www.soi.sk" target="_blank" rel="noopener noreferrer">
					www.soi.sk
				</a>
				. Zoznam subjektov alternatívneho riešenia sporov vedie Ministerstvo hospodárstva SR. Spotrebiteľ si
				môže vybrať, na ktorý subjekt sa obráti.
			</p>

			<h3>9. Ochrana osobných údajov</h3>
			<p>
				9.1 Spracúvanie osobných údajov upravujú samostatné Zásady ochrany osobných údajov dostupné na našom
				webe.
			</p>

			<h3>10. Záverečné ustanovenia</h3>
			<p>
				10.1 Tieto podmienky nadobúdajú účinnosť 30. 6. 2026. Predávajúci si vyhradzuje právo podmienky meniť;
				pre uzavreté zmluvy platí znenie účinné v čase uzavretia zmluvy.
			</p>
			<p>
				10.2 Vzťahy medzi predávajúcim a zákazníkom sa riadia právnym poriadkom Slovenskej republiky. Orgánom
				dozoru je Slovenská obchodná inšpekcia, Inšpektorát SOI pre Bratislavský kraj, Bajkalská 21/A, P. O.
				BOX č. 5, 820 07 Bratislava.
			</p>
		</LegalPage>
	);
}
