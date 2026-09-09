import Link from "next/link";
import { type ReactNode } from "react";
import { companyInfo, companyPhoneHref } from "@/config/company";
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
const Phone = () => <a href={companyPhoneHref}>{companyInfo.phone}</a>;

export interface WithdrawalBodyProps {
	readonly channel: string;
	/** The online function, already gated by the caller. `null` when it is not served. */
	readonly form: ReactNode;
	readonly modelFormHref: string;
}

function ReturnAddress({ country = "Slovenská republika" }: { country?: string }) {
	return (
		<address>
			{companyInfo.legalName}
			<br />
			Stará Vajnorská 11
			<br />
			831 04 Bratislava
			<br />
			{country}
		</address>
	);
}

export function Sk({ channel, form, modelFormHref }: WithdrawalBodyProps) {
	return (
		<>
			<p>
				Tovar vám nevyhovuje alebo ste si nákup rozmysleli? Ako spotrebiteľ môžete od zmluvy odstúpiť{" "}
				<strong>bez uvedenia dôvodu do 14 dní od prevzatia tovaru</strong>. Registrovaným zákazníkom, ktorí
				objednávku vytvorili po prihlásení do svojho účtu, poskytujeme lehotu <strong>30 dní</strong>.
			</p>
			<p>
				Odstúpiť môžete aj pred doručením a tiež iba od časti objednávky. Na oznámenie nepotrebujete
				zákaznícky účet ani náš predchádzajúci súhlas.
			</p>

			{form}

			<h2>{form ? "Odstúpenie e-mailom alebo poštou" : "Ako odstúpenie oznámiť"}</h2>
			<p>
				{form ? "Online formulár nie je jedinou možnosťou. Napíšte" : "Napíšte"} na <Mail /> alebo pošlite
				jednoznačné oznámenie na adresu{" "}
				<strong>
					{companyInfo.legalName}, {companyInfo.returnAddress}
				</strong>
				.
			</p>
			<p>
				Môžete použiť aj <Link href={modelFormHref}>vzorový formulár na vytlačenie</Link>. Použitie vzoru nie
				je povinné. Stačí, aby bolo z oznámenia zrejmé, kto odstupuje, od ktorej zmluvy a ktorého tovaru sa
				odstúpenie týka.
			</p>

			<h2>Ako sa počíta lehota</h2>
			<p>
				Lehota začína plynúť dňom nasledujúcim po prevzatí tovaru vami alebo osobou, ktorú ste určili, nie
				dopravcom. Ak sa výrobky z jednej objednávky doručujú samostatne, rozhoduje prevzatie posledného
				výrobku. Pri výrobku dodávanom po častiach je rozhodujúca posledná časť.
			</p>
			<p>
				Stačí, ak oznámenie odošlete najneskôr v posledný deň príslušnej lehoty.{" "}
				<strong>Nemusíte dovtedy doručiť aj samotný tovar.</strong> Pri zákonnej lehote sa uplatnia aj zákonné
				pravidlá počítania času a jej prípadného predĺženia.
			</p>

			<h2>Ako nám tovar vrátite</h2>
			<p>
				Môžete si vybrať vlastného dopravcu alebo nás požiadať o ponuku na vyzdvihnutie. Cenu nami
				zabezpečovaného zvozu a navrhovaný termín vám pošleme vopred. Platený zvoz objednáme až po vašom
				výslovnom súhlase.
			</p>
			<p>
				<strong>Vrátenie vlastným dopravcom nepodlieha nášmu predchádzajúcemu schváleniu.</strong> Ak sme vám
				neponúkli vyzdvihnutie, tovar odošlite alebo odovzdajte najneskôr do{" "}
				<strong>14 dní od odstúpenia</strong> na adresu:
			</p>
			<ReturnAddress />
			<p>
				Ak sme ponúkli vyzdvihnutie, pripravte zásielku podľa dohody. Samotné vyžiadanie cenovej ponuky zvozu
				ešte nie je jeho objednaním. Neodkladajte preto odoslanie len preto, že ste sa na cenu opýtali.
			</p>
			<p>
				Tovar zabaľte tak, aby sa pri preprave nepoškodil, a vráťte aj príslušenstvo patriace k vracanej
				položke. Pôvodný obal pomôže pri balení, <strong>nie je však všeobecnou podmienkou odstúpenia</strong>
				. K zásielke odporúčame priložiť číslo objednávky alebo podania.
			</p>

			<h2>Kto hradí spätnú dopravu</h2>
			<p>
				Pri odstúpení bez uvedenia dôvodu znášate priame náklady na vrátenie tovaru, ak sme vás o tejto
				povinnosti riadne informovali pred uzavretím zmluvy. Pri tovare, ktorý vzhľadom na povahu alebo
				rozmery nemožno vrátiť bežnou poštou, vás musíme pred nákupom informovať aj o nákladoch na vrátenie.
				Ak túto informačnú povinnosť nesplníme, tieto náklady znášať nemusíte.
			</p>
			<p>
				Cena zvozu, ktorú si vyžiadate po nákupe, nenahrádza informáciu, ktorú ste mali dostať pred
				objednaním.
			</p>
			<p>
				Ak vraciate výrobok pre vadu, za ktorú zodpovedáme, postupujte podľa časti{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamácie a vrátenie tovaru</Link>.
				Pravidlá úhrady nákladov sú vtedy odlišné.
			</p>

			<h2>Kedy dostanete peniaze späť</h2>
			<p>
				Platby v rozsahu odstúpenia vám vrátime do <strong>14 dní od doručenia oznámenia</strong>. Pri
				odstúpení od celej objednávky vrátime aj náklady na pôvodné doručenie, najviac vo výške najlacnejšieho
				bežného spôsobu, ktorý sme pre danú objednávku ponúkali. Príplatok za drahší spôsob doručenia vracať
				nemusíme.
			</p>
			<p>
				Pri čiastočnom odstúpení vrátime platby v zodpovedajúcom rozsahu. Nebudeme vám spätne doúčtovávať
				dopravu ani iné dodatočné poplatky.
			</p>
			<p>
				Peniaze vraciame rovnakým spôsobom, akým ste platili. Na inom spôsobe sa môžeme dohodnúť, ak vás to
				nebude stáť ďalšie poplatky. Pri vrátení platby na kartu od vás nepotrebujeme IBAN.
			</p>
			<p>
				Ak sme vám neponúkli vyzdvihnutie tovaru, s vrátením platieb môžeme počkať, kým tovar dostaneme alebo
				preukážete jeho odoslanie — podľa toho, čo nastane skôr. Ak sme vyzdvihnutie ponúkli, toto pozdržanie
				neuplatníme.
			</p>

			<h2>V akom stave môžete výrobok vrátiť</h2>
			<p>
				Výrobok si môžete prezrieť a vyskúšať v rozsahu potrebnom na zistenie jeho vlastností a funkčnosti,
				podobne ako v predajni. Za zníženie hodnoty spôsobené zaobchádzaním nad tento rozsah môžete
				zodpovedať, ak sme vás riadne poučili o práve odstúpiť.
			</p>
			<p>
				Nevyžadujeme paušálny poplatok za rozbalenie ani za prijatie vráteného tovaru. Prípadné zníženie
				hodnoty musí vychádzať zo skutočného stavu výrobku; príslušný nárok vám vysvetlíme. Nebudeme ho
				jednostranne započítavať proti vášmu nároku vzniknutému odstúpením.
			</p>

			<h2>Kedy platí výnimka</h2>
			<p>
				Právo odstúpiť sa nevzťahuje najmä na tovar skutočne vyrobený na mieru alebo podľa osobitných
				požiadaviek zákazníka. Zákonná výnimka môže platiť aj pre zapečatený tovar nevhodný na vrátenie zo
				zdravotných alebo hygienických dôvodov, ak sa jeho ochranný obal po dodaní poruší.
			</p>
			<p>
				<strong>
					Bežný výrobok označený „na objednávku“ ani štandardná zostava vybraná podľa auta nie sú len z tohto
					dôvodu výrobkom na mieru.
				</strong>{" "}
				Podrobné podmienky nájdete vo{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Všeobecných obchodných podmienkach</Link>.
			</p>
		</>
	);
}

export function Cs({ channel, form, modelFormHref }: WithdrawalBodyProps) {
	return (
		<>
			<p>
				Zboží vám nevyhovuje, nebo jste si nákup rozmysleli? Jako spotřebitel můžete od smlouvy odstoupit{" "}
				<strong>bez uvedení důvodu do 14 dnů od převzetí zboží</strong>. Registrovaným zákazníkům, kteří
				objednávku vytvořili po přihlášení ke svému účtu, poskytujeme lhůtu <strong>30 dnů</strong>.
			</p>
			<p>
				Odstoupit můžete i před doručením a také jen od části objednávky. K oznámení nepotřebujete zákaznický
				účet ani náš předchozí souhlas.
			</p>

			{form}

			<h2>{form ? "Odstoupení e-mailem nebo poštou" : "Jak odstoupení oznámit"}</h2>
			<p>
				{form ? "Online formulář není jedinou možností. Napište" : "Napište"} na <Mail /> nebo pošlete
				jednoznačné oznámení na adresu{" "}
				<strong>
					{companyInfo.legalName}, {companyInfo.returnAddress}
				</strong>
				.
			</p>
			<p>
				Můžete použít také <Link href={modelFormHref}>vzorový formulář k vytištění</Link>. Použití vzoru není
				povinné. Stačí, aby z oznámení bylo zřejmé, kdo odstupuje, od které smlouvy a jakého zboží se
				odstoupení týká.
			</p>

			<h2>Jak se počítá lhůta</h2>
			<p>
				Lhůta začíná běžet dnem následujícím po převzetí zboží vámi nebo osobou, kterou jste určili, nikoli
				dopravcem. Pokud se výrobky z jedné objednávky doručují samostatně, rozhoduje převzetí posledního
				výrobku. U výrobku dodávaného po částech je rozhodující poslední část.
			</p>
			<p>
				Stačí, když oznámení odešlete nejpozději poslední den příslušné lhůty.{" "}
				<strong>Nemusíte do té doby doručit i samotné zboží.</strong> U zákonné lhůty se uplatní také zákonná
				pravidla počítání času a jejího případného prodloužení.
			</p>

			<h2>Jak nám zboží vrátíte</h2>
			<p>
				Můžete si vybrat vlastního dopravce nebo nás požádat o nabídku vyzvednutí. Cenu námi zajišťovaného
				svozu a navrhovaný termín vám pošleme předem. Placený svoz objednáme až po vašem výslovném souhlasu.
			</p>
			<p>
				<strong>Vrácení vlastním dopravcem nepodléhá našemu předchozímu schválení.</strong> Pokud jsme vám
				nenabídli vyzvednutí, zboží odešlete nebo předejte nejpozději do <strong>14 dnů od odstoupení</strong>{" "}
				na adresu:
			</p>
			<ReturnAddress />
			<p>
				Pokud jsme nabídli vyzvednutí, připravte zásilku podle dohody. Samotné vyžádání cenové nabídky svozu
				ještě není jeho objednáním. Neodkládejte proto odeslání jen proto, že jste se zeptali na cenu.
			</p>
			<p>
				Zboží zabalte tak, aby se při přepravě nepoškodilo, a vraťte také příslušenství patřící k vracené
				položce. Původní obal pomůže při balení, <strong>není však obecnou podmínkou odstoupení</strong>. K
				zásilce doporučujeme přiložit číslo objednávky nebo podání.
			</p>

			<h2>Kdo hradí zpětnou dopravu</h2>
			<p>
				Při odstoupení bez uvedení důvodu nesete přímé náklady na vrácení zboží, pokud jsme vás o této
				povinnosti řádně informovali před uzavřením smlouvy. U zboží, které vzhledem ke své povaze nebo
				rozměrům nelze vrátit běžnou poštou, vás musíme před nákupem informovat také o nákladech na vrácení.
				Pokud tuto informační povinnost nesplníme, tyto náklady nést nemusíte.
			</p>
			<p>
				Cena svozu, kterou si vyžádáte po nákupu, nenahrazuje informaci, kterou jste měli dostat před
				objednáním.
			</p>
			<p>
				Pokud vracíte výrobek kvůli vadě, za kterou odpovídáme, postupujte podle části{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamace a vrácení zboží</Link>. Pravidla
				úhrady nákladů jsou v takovém případě odlišná.
			</p>

			<h2>Kdy dostanete peníze zpět</h2>
			<p>
				Platby v rozsahu odstoupení vám vrátíme do <strong>14 dnů od doručení oznámení</strong>. Při
				odstoupení od celé objednávky vrátíme také náklady na původní doručení, nejvýše ve výši nejlevnějšího
				běžného způsobu, který jsme pro danou objednávku nabízeli. Příplatek za dražší způsob doručení vracet
				nemusíme.
			</p>
			<p>
				Při částečném odstoupení vrátíme platby v odpovídajícím rozsahu. Nebudeme vám zpětně doúčtovávat
				dopravu ani jiné dodatečné poplatky.
			</p>
			<p>
				Peníze vracíme stejným způsobem, jakým jste platili. Na jiném způsobu se můžeme dohodnout, pokud vás
				to nebude stát další poplatky. Při vrácení platby na kartu od vás nepotřebujeme IBAN.
			</p>
			<p>
				Pokud jsme vám nenabídli vyzvednutí zboží, můžeme s vrácením plateb počkat, až zboží dostaneme nebo
				prokážete jeho odeslání — podle toho, co nastane dříve. Pokud jsme vyzvednutí nabídli, toto pozdržení
				neuplatníme.
			</p>

			<h2>V jakém stavu můžete výrobek vrátit</h2>
			<p>
				Výrobek si můžete prohlédnout a vyzkoušet v rozsahu potřebném ke zjištění jeho vlastností a
				funkčnosti, podobně jako v prodejně. Za snížení hodnoty způsobené zacházením nad tento rozsah můžete
				odpovídat, pokud jsme vás řádně poučili o právu odstoupit.
			</p>
			<p>
				Nevyžadujeme paušální poplatek za rozbalení ani za přijetí vráceného zboží. Případné snížení hodnoty
				musí vycházet ze skutečného stavu výrobku; příslušný nárok vám vysvětlíme. Nebudeme ho jednostranně
				započítávat proti vašemu nároku vzniklému odstoupením.
			</p>

			<h2>Kdy platí výjimka</h2>
			<p>
				Právo odstoupit se nevztahuje zejména na zboží skutečně vyrobené na míru nebo podle zvláštních
				požadavků zákazníka. Zákonná výjimka může platit také pro zapečetěné zboží nevhodné k vrácení ze
				zdravotních nebo hygienických důvodů, pokud je jeho ochranný obal po dodání porušen.
			</p>
			<p>
				<strong>
					Běžný výrobek označený „na objednávku“ ani standardní sestava vybraná podle auta nejsou jen z tohoto
					důvodu výrobkem na míru.
				</strong>{" "}
				Podrobné podmínky najdete ve{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Všeobecných obchodních podmínkách</Link>.
			</p>
		</>
	);
}

/**
 * The German body, shared by both German-speaking markets.
 *
 * ## What happens where the online function would go
 *
 * `form` is `null` for `de` and `at` and will stay that way until Returns V2 accepts
 * those markets: the contract pins `market: "SK"` / `locale: "sk"` as literal types, so
 * a notice submitted from `/de` would be rejected by the endpoint that stores it. See
 * `servesOnlineFunction()` in the route.
 *
 * The delivered copy carried a `WITHDRAWAL_ONLINE_SECTION` slot with three
 * variants; this renders the `previewNotActivated` one. It is rendered rather than
 * dropped on purpose. Deleting the slot and leaving the surrounding sentences would
 * have left a page that reads as though an online function exists, and the section
 * heading above it already promises one. An honest "not activated here yet, use these
 * routes instead" is the only variant that is true today.
 *
 * ⚠️ For Germany this is a SALES blocker, not a missing convenience: § 356a BGB (in
 * force since 2026-06-19) presupposes an online withdrawal function. The market must
 * not be opened to paid consumer sales while this branch is the one rendering.
 */
function German({ channel, form, modelFormHref, market }: WithdrawalBodyProps & { market: GermanMarket }) {
	return (
		<>
			<p>
				Der Artikel passt nicht zu Ihren Plänen oder Sie haben es sich anders überlegt? Als Verbraucher können
				Sie Ihren Online-Kauf grundsätzlich{" "}
				<strong>innerhalb von 14 Tagen nach Erhalt der Ware ohne Angabe von Gründen widerrufen</strong>.
				{market.terminologyNote ? ` ${market.terminologyNote}` : ""}
			</p>
			<p>
				Für Bestellungen, die Sie nach der Anmeldung in Ihrem Kundenkonto aufgegeben haben, verlängern wir die
				Frist auf <strong>30 Tage</strong>. Es gelten derselbe Rückgabeablauf und dieselben nachstehend
				beschriebenen Bedingungen. Die verlängerte Frist schränkt Ihre gesetzlichen Rechte nicht ein.
			</p>
			<p>
				Sie können den Widerruf auch vor der Lieferung erklären oder auf einzelne Artikel beschränken. Ein
				Kundenkonto oder unsere vorherige Zustimmung benötigen Sie dafür nicht.
			</p>

			{form ?? (
				<>
					<h2>Online-Funktion in dieser Vorschau noch nicht aktiviert</h2>
					<p>
						Diese Länderversion wird derzeit vorbereitet. Die Online-Funktion ist hier noch nicht
						freigeschaltet. Eine bereits bestehende Bestellung können Sie weiterhin per E-Mail an <Mail />{" "}
						oder auf einem anderen gesetzlich zulässigen Weg widerrufen. Ihre gesetzlichen Rechte bleiben
						davon unberührt.
					</p>
				</>
			)}

			<h2>{form ? "Widerruf per E-Mail oder Post" : "So erklären Sie den Widerruf"}</h2>
			<p>
				{form ? "Die Online-Funktion ist nicht der einzige Weg. Senden Sie" : "Senden Sie"} eine eindeutige
				Erklärung an <Mail /> oder an{" "}
				<strong>
					{companyInfo.legalName}, {companyInfo.returnAddress}, {SLOVAKIA_DE}
				</strong>
				. Sie erreichen uns auch telefonisch unter <Phone />.
			</p>
			<p>
				Sie können unser <Link href={modelFormHref}>Muster-Widerrufsformular zum Ausdrucken</Link> verwenden,
				müssen dies aber nicht. Aus Ihrer Erklärung muss hervorgehen, wer den Widerruf erklärt, auf welchen
				Kauf er sich bezieht und welche Ware er umfasst.
			</p>

			<h2>Wann die Frist beginnt</h2>
			<p>
				Die gesetzliche Widerrufsfrist beträgt 14 Tage ab dem Tag, an dem Sie oder eine von Ihnen benannte
				Person, die nicht der Beförderer ist, die Ware erhalten haben. Für die Berechnung der Frist wird der
				Tag des Erhalts nicht mitgezählt. Bei mehreren Artikeln einer einheitlichen Bestellung, die getrennt
				geliefert werden, ist der Erhalt des letzten Artikels maßgeblich. Bei einer Lieferung in mehreren
				Teilsendungen oder Stücken zählt der Erhalt der letzten Teilsendung oder des letzten Stücks.
			</p>
			<p>
				Zur Wahrung der Frist genügt es, die Widerrufserklärung spätestens am letzten Tag der maßgeblichen
				Frist abzusenden. <strong>Die Ware muss bis dahin noch nicht bei uns eingetroffen sein.</strong>{" "}
				Gesetzliche Regeln zur Fristberechnung und eine gesetzliche Verlängerung bei unvollständiger Belehrung
				bleiben unberührt.
			</p>

			<h2>So senden Sie die Ware zurück</h2>
			<p>
				Sie können einen eigenen Versanddienstleister beauftragen oder bei uns ein Angebot für eine Abholung
				anfragen. Preis und vorgeschlagenen Ablauf teilen wir Ihnen vorab mit. Eine kostenpflichtige Abholung
				beauftragen wir erst nach Ihrer ausdrücklichen Zustimmung.
			</p>
			<p>
				<strong>
					Eine Rücksendung mit einem selbst gewählten Versanddienstleister müssen wir nicht vorher genehmigen.
				</strong>{" "}
				Haben wir Ihnen keine Abholung angeboten, senden Sie die Ware unverzüglich, spätestens innerhalb von{" "}
				<strong>14 Tagen ab Ihrer Widerrufserklärung</strong>, an folgende Anschrift zurück oder übergeben Sie
				sie dort:
			</p>
			<ReturnAddress country={SLOVAKIA_DE} />
			<p>
				Die Frist ist gewahrt, wenn Sie die Ware vor ihrem Ablauf absenden. Haben wir eine Abholung angeboten,
				bereiten Sie die Sendung entsprechend der Vereinbarung vor.
			</p>
			<p>
				Eine bloße Anfrage nach dem Preis einer Abholung ist noch kein Abholauftrag. Warten Sie deshalb nicht
				allein wegen einer solchen Anfrage mit der Rücksendung, solange wir Ihnen noch keine Abholung
				angeboten haben.
			</p>
			<p>
				Verpacken Sie die Ware so, dass sie beim Transport geschützt ist, und senden Sie das zugehörige
				Zubehör mit zurück. Die Originalverpackung kann dabei hilfreich sein,{" "}
				<strong>ist aber keine allgemeine Voraussetzung für den Widerruf</strong>. Legen Sie nach Möglichkeit
				die Bestellnummer oder die Vorgangsnummer bei.
			</p>

			<h2>Kosten der Rücksendung</h2>
			<p>
				Bei einem Widerruf ohne Angabe von Gründen tragen Sie die unmittelbaren Rücksendekosten, sofern wir
				Sie vor Vertragsabschluss ordnungsgemäß darüber informiert haben. Kann ein Artikel aufgrund seiner Art
				oder Größe nicht auf dem normalen Postweg zurückgesendet werden, müssen wir Ihnen vor dem Kauf auch
				die Kosten seiner Rücksendung mitteilen. Haben wir diese Informationspflicht nicht erfüllt, müssen Sie
				diese Kosten nicht tragen.
			</p>
			<p>Ein erst nach dem Kauf angefragtes Abholangebot ersetzt die vorvertragliche Information nicht.</p>
			<p>
				Senden Sie ein Produkt wegen eines Mangels zurück, für den wir verantwortlich sind, beachten Sie bitte{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamationen und Rücksendungen</Link>. In
				diesem Fall gelten andere Regeln zur Kostenübernahme.
			</p>

			<h2>Wann Sie Ihr Geld zurückerhalten</h2>
			<p>
				Wir erstatten die vom Widerruf erfassten Zahlungen unverzüglich, spätestens innerhalb von{" "}
				<strong>14 Tagen nach Eingang Ihrer Widerrufserklärung</strong>. Bei einem vollständigen Widerruf
				erstatten wir auch die ursprünglichen Lieferkosten bis zur Höhe der günstigsten von uns für diese
				Bestellung angebotenen Standardlieferung. Den Aufpreis für eine von Ihnen ausdrücklich gewählte
				teurere Lieferung müssen wir nicht erstatten.
			</p>
			<p>
				Bei einem teilweisen Widerruf erstatten wir die entsprechenden Beträge. Wir berechnen Ihnen deshalb
				nicht nachträglich zusätzliche Versandkosten oder andere Gebühren.
			</p>
			<p>
				Die Erstattung erfolgt mit demselben Zahlungsmittel wie beim Kauf. Eine andere Lösung können wir
				ausdrücklich vereinbaren, wenn Ihnen dadurch keine zusätzlichen Kosten entstehen. Für eine Rückzahlung
				auf die ursprünglich verwendete Zahlungskarte benötigen wir keine IBAN.
			</p>
			<p>
				Haben wir Ihnen keine Abholung angeboten, dürfen wir die Erstattung zurückhalten, bis wir die Ware
				erhalten haben oder Sie ihre Absendung nachgewiesen haben — je nachdem, was früher eintritt. Haben wir
				die Abholung angeboten, machen wir von diesem Zurückbehaltungsrecht keinen Gebrauch.
			</p>

			<h2>In welchem Zustand Sie die Ware zurückgeben können</h2>
			<p>
				Sie dürfen die Ware so prüfen, wie es nötig ist, um ihre Beschaffenheit, Eigenschaften und
				Funktionsweise festzustellen — vergleichbar mit einer Prüfung im Geschäft. Für einen Wertverlust durch
				einen darüber hinausgehenden Umgang können Sie verantwortlich sein, sofern wir Sie ordnungsgemäß über
				das Widerrufsrecht informiert haben.
			</p>
			<p>
				Wir verlangen keine pauschale Gebühr für das Öffnen der Verpackung oder die Bearbeitung einer
				Rückgabe. Einen möglichen Wertverlust beurteilen wir anhand des tatsächlichen Zustands und erläutern
				Ihnen einen entsprechenden Anspruch. Wir rechnen einen solchen Anspruch nicht einseitig gegen Ihren
				Erstattungsanspruch aus dem Widerruf auf.
			</p>

			<h2>Wann eine Ausnahme gilt</h2>
			<p>
				Das Widerrufsrecht besteht insbesondere nicht bei Waren, die tatsächlich nach Ihren individuellen
				Vorgaben angefertigt werden oder eindeutig auf Ihre persönlichen Bedürfnisse zugeschnitten sind. Eine
				gesetzliche Ausnahme kann auch für versiegelte Waren gelten, die aus Gründen des Gesundheitsschutzes
				oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt
				wurde.
			</p>
			<p>
				<strong>
					Ein normaler Artikel mit dem Hinweis „Auf Bestellung“ oder ein Standardset, das passend zu einem
					Fahrzeug ausgewählt wird, ist allein deshalb keine Sonderanfertigung.
				</strong>{" "}
				Eine Ausnahme wenden wir nur an, wenn ihre gesetzlichen Voraussetzungen erfüllt sind. Weitere
				Informationen stehen in unseren <Link href={marketHref(channel, "/obchodne-podmienky")}>AGB</Link>.
			</p>
		</>
	);
}

export function De(props: WithdrawalBodyProps) {
	return <German {...props} market={GERMANY} />;
}

export function DeAt(props: WithdrawalBodyProps) {
	return <German {...props} market={AUSTRIA} />;
}

export function Pl({ channel, form, modelFormHref }: WithdrawalBodyProps) {
	return (
		<>
			<p>
				Produkt nie odpowiada Państwa potrzebom albo zmienili Państwo zdanie? Jako konsument mogą Państwo co
				do zasady odstąpić od zakupu internetowego{" "}
				<strong>bez podania przyczyny w ciągu 14 dni od otrzymania towaru</strong>.
			</p>
			<p>
				Dla zamówień złożonych po zalogowaniu się na konto klienta wydłużamy termin do <strong>30 dni</strong>
				. To dodatkowa korzyść MAKY.STORE. Obowiązują ten sam tryb zwrotu i opisane poniżej warunki, bez
				ograniczania praw ustawowych.
			</p>
			<p>
				Odstąpienie można złożyć przed dostawą, w odniesieniu do całego zamówienia lub tylko jego części. Do
				złożenia oświadczenia nie jest potrzebne konto klienta ani nasza wcześniejsza zgoda.
			</p>

			{form ?? (
				<>
					<h2>Odstąpienie online</h2>
					<p>
						Funkcja składania odstąpienia online nie jest jeszcze aktywna w tej wersji podglądowej sklepu.
						Oświadczenie dotyczące już zawartej umowy można wysłać na <Mail />, pocztą albo innym prawnie
						dopuszczalnym sposobem. Jeżeli biegnie termin, nie należy czekać na uruchomienie funkcji.
					</p>
				</>
			)}

			<h2>Odstąpienie e-mailem lub pocztą</h2>
			<p>
				Jednoznaczne oświadczenie prosimy wysłać na <Mail /> albo na adres{" "}
				<strong>
					{companyInfo.legalName}, {companyInfo.returnAddress}, {SLOVAKIA_PL}
				</strong>
				. Telefon kontaktowy: <Phone />.
			</p>
			<p>
				Można skorzystać ze <Link href={modelFormHref}>wzoru formularza odstąpienia</Link>, ale nie jest to
				obowiązkowe. Z oświadczenia powinno wynikać, kto odstępuje od umowy, jakiego zakupu dotyczy
				oświadczenie i jakie produkty obejmuje.
			</p>

			<h2>Jak liczymy termin</h2>
			<p>
				Termin zaczyna biec następnego dnia po otrzymaniu towaru przez Państwa lub wskazaną przez Państwa
				osobę inną niż przewoźnik. Jeżeli produkty z jednego zamówienia dostarczane są osobno, liczy się
				otrzymanie ostatniego z nich. Przy towarze dostarczanym w częściach decyduje otrzymanie ostatniej
				części.
			</p>
			<p>
				Wystarczy wysłać oświadczenie najpóźniej ostatniego dnia właściwego terminu.{" "}
				<strong>Sam towar nie musi do tego dnia dotrzeć do nas.</strong> Zachowane pozostają ustawowe zasady
				obliczania i przedłużania terminów, w tym przy nieprzekazaniu wymaganej informacji o prawie
				odstąpienia.
			</p>

			<h2>Jak odesłać towar</h2>
			<p>
				Mogą Państwo skorzystać z własnego przewoźnika albo poprosić nas o wycenę odbioru. Cenę i proponowany
				termin podamy wcześniej. Płatny odbiór zlecimy dopiero po wyraźnej zgodzie.
			</p>
			<p>
				<strong>Wysyłka wybranym przez Państwa przewoźnikiem nie wymaga naszej uprzedniej akceptacji.</strong>{" "}
				Jeżeli nie zaoferowaliśmy odbioru, prosimy odesłać lub przekazać towar niezwłocznie, najpóźniej w
				ciągu <strong>14 dni od odstąpienia</strong>, na adres:
			</p>
			<ReturnAddress country={SLOVAKIA_PL} />
			<p>
				Wystarczy nadać przesyłkę przed upływem terminu. Jeżeli zaoferowaliśmy odbiór, prosimy przygotować
				przesyłkę zgodnie z uzgodnieniami.
			</p>
			<p>
				Samo pytanie o wycenę nie jest zleceniem odbioru ani naszą ofertą odebrania towaru. Dlatego nie należy
				odkładać odesłania wyłącznie z powodu zapytania, dopóki nie zaoferujemy odbioru.
			</p>
			<p>
				Prosimy bezpiecznie zapakować towar i dołączyć akcesoria należące do zwracanej pozycji. Oryginalne
				opakowanie może ułatwić pakowanie, <strong>ale nie jest ogólnym warunkiem odstąpienia</strong>. Warto
				dołączyć numer zamówienia lub zgłoszenia.
			</p>

			<h2>Kto ponosi koszty zwrotu</h2>
			<p>
				Przy odstąpieniu bez podania przyczyny ponoszą Państwo bezpośrednie koszty zwrotu, jeżeli prawidłowo
				poinformowaliśmy o tym przed zawarciem umowy. Przy towarze, którego ze względu na charakter lub
				rozmiary nie można zwyczajnie odesłać pocztą, przed zakupem musimy przekazać także informację o
				kosztach jego zwrotu. Jeżeli nie dopełnimy tej informacji, nie muszą Państwo ponosić tych kosztów.
			</p>
			<p>
				Wycena odbioru zamówiona dopiero po zakupie nie zastępuje informacji, którą należało przekazać przed
				zamówieniem.
			</p>
			<p>
				Przy zwrocie z powodu wady, za którą odpowiadamy, obowiązują inne zasady pokrycia kosztów. Opisujemy
				je na stronie <Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamacje i zwroty</Link>.
			</p>

			<h2>Kiedy zwracamy pieniądze</h2>
			<p>
				Płatności objęte odstąpieniem zwracamy niezwłocznie, nie później niż w ciągu{" "}
				<strong>14 dni od otrzymania oświadczenia</strong>. Przy odstąpieniu od całego zamówienia zwracamy
				także pierwotny koszt dostawy, do wysokości najtańszego zwykłego sposobu dostawy oferowanego dla tego
				zamówienia. Nie musimy zwracać dopłaty za wybraną droższą dostawę.
			</p>
			<p>
				Przy odstąpieniu od części zamówienia zwracamy odpowiednią część płatności. Nie doliczamy z tego
				powodu wstecznie kosztów dostawy ani innych opłat.
			</p>
			<p>
				Pieniądze zwracamy tym samym sposobem, którym zapłacono. Inny sposób wymaga wyraźnego uzgodnienia i
				nie może powodować dodatkowych kosztów dla Państwa. Do zwrotu na pierwotnie używaną kartę nie
				potrzebujemy numeru IBAN.
			</p>
			<p>
				Jeżeli nie zaoferowaliśmy odbioru, możemy wstrzymać zwrot pieniędzy do otrzymania towaru lub
				przedstawienia dowodu jego odesłania — w zależności od tego, co nastąpi wcześniej. Jeżeli
				zaoferowaliśmy odbiór, nie korzystamy z tej możliwości.
			</p>

			<h2>W jakim stanie można zwrócić produkt</h2>
			<p>
				Towar można obejrzeć i sprawdzić w zakresie potrzebnym do ustalenia jego charakteru, cech i działania,
				podobnie jak w sklepie stacjonarnym. Za zmniejszenie wartości wynikające z korzystania wykraczającego
				poza ten zakres mogą Państwo odpowiadać, pod warunkiem prawidłowego poinformowania o prawie
				odstąpienia.
			</p>
			<p>
				Nie pobieramy ryczałtowej opłaty za rozpakowanie ani przyjęcie zwrotu. Ewentualne zmniejszenie
				wartości oceniamy na podstawie rzeczywistego stanu produktu i wyjaśniamy jego podstawę. Nie potrącamy
				takiego roszczenia jednostronnie z Państwa należności wynikających z odstąpienia.
			</p>

			<h2>Kiedy obowiązuje wyjątek</h2>
			<p>
				Prawo odstąpienia nie przysługuje w szczególności przy towarze rzeczywiście wykonanym według
				indywidualnej specyfikacji lub wyraźnie dostosowanym do osobistych potrzeb. Wyjątek może również
				dotyczyć zapieczętowanych produktów, których po naruszeniu opakowania nie można zwrócić ze względów
				ochrony zdrowia lub higieny.
			</p>
			<p>
				<strong>
					Zwykły produkt „Na zamówienie” ani standardowy zestaw dobrany do samochodu nie stają się tylko z
					tego powodu towarem wykonanym na indywidualne zamówienie.
				</strong>{" "}
				Wyjątek stosujemy wyłącznie wtedy, gdy spełnione są jego ustawowe przesłanki. Szczegóły znajdują się w{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Regulaminie sklepu</Link>.
			</p>
		</>
	);
}

export function Hu({ channel, form, modelFormHref }: WithdrawalBodyProps) {
	return (
		<>
			<p>
				Mégsem illik a terveibe a termék, vagy meggondolta magát? Fogyasztóként az online vásárlástól
				főszabály szerint a termék átvételétől számított{" "}
				<strong>14 napon belül, indokolás nélkül elállhat</strong>.
			</p>
			<p>
				Ha a rendelést a vásárlói fiókjába bejelentkezve adta le, a határidőt <strong>30 napra</strong>{" "}
				hosszabbítjuk meg. Erre ugyanaz a visszaküldési folyamat és az alábbi feltételek vonatkoznak. A
				hosszabb határidő nem korlátozza törvényes jogait.
			</p>
			<p>
				Az elállást a kézbesítés előtt is közölheti, és egyes termékekre is korlátozhatja. Ehhez nem kell
				vásárlói fiók vagy előzetes hozzájárulásunk.
			</p>

			{form ?? (
				<>
					<h2>Online elállás</h2>
					<p>
						A webáruház jelenlegi előnézeti változatában az online elállási funkció még nem aktív.
						Nyilatkozatát e-mailben vagy postán is elküldheti az alábbi elérhetőségekre. Az oldal megnyitása
						önmagában nem jelenti az elállási nyilatkozat benyújtását.
					</p>
				</>
			)}

			<h2>Elállás e-mailben vagy postán</h2>
			<p>
				Egyértelmű nyilatkozatát az <Mail /> címre vagy postán a{" "}
				<strong>
					{companyInfo.legalName}, {companyInfo.returnAddress}, {SLOVAKIA_HU}
				</strong>{" "}
				címre küldheti. Telefonon a <Phone /> számon ér el minket.
			</p>
			<p>
				Használhatja a <Link href={modelFormHref}>nyomtatható elállási nyilatkozatmintát</Link>, de ez nem
				kötelező. A nyilatkozatból derüljön ki, ki áll el, melyik vásárlásról van szó, és milyen termékekre
				vonatkozik.
			</p>

			<h2>Mikor kezdődik a határidő</h2>
			<p>
				A törvényes 14 napos határidő a termék Ön vagy az Ön által megjelölt, a fuvarozótól eltérő személy
				általi átvételéhez kapcsolódik. Az átvétel napja nem számít bele. Egy rendelésben vásárolt, külön
				kézbesített termékeknél az utolsó termék átvétele számít. Több tételből vagy darabból álló terméknél
				az utolsó tétel vagy darab átvétele irányadó.
			</p>
			<p>
				A határidő megtartásához elegendő az elállási nyilatkozatot legkésőbb az utolsó napon elküldeni.{" "}
				<strong>A terméknek eddig a napig még nem kell visszaérkeznie hozzánk.</strong> A határidő számítására
				és a hiányos tájékoztatás miatti meghosszabbítására vonatkozó törvényi szabályok változatlanul
				érvényesek.
			</p>

			<h2>Hogyan küldje vissza a terméket</h2>
			<p>
				Választhat saját fuvarozót, vagy árajánlatot kérhet tőlünk az elszállításra. Az árat és a javasolt
				folyamatot előre közöljük. Fizetős elszállítást csak az Ön kifejezett hozzájárulása után rendelünk
				meg.
			</p>
			<p>
				<strong>A saját fuvarozóval történő visszaküldéshez nem szükséges előzetes engedélyünk.</strong> Ha
				nem ajánlottuk fel az elszállítást, a terméket késedelem nélkül, legkésőbb az elállási nyilatkozattól
				számított <strong>14 napon belül</strong> küldje vissza vagy adja át az alábbi címen:
			</p>
			<ReturnAddress country={SLOVAKIA_HU} />
			<p>
				A határidő megtartottnak minősül, ha a terméket annak lejárta előtt feladja. Ha felajánlottuk az
				elszállítást, a csomagot a megállapodás szerint készítse elő.
			</p>
			<p>
				Az elszállítás díjára vonatkozó érdeklődés önmagában nem megrendelés. Kizárólag az árajánlatra várva
				ne mulassza el a visszaküldési határidőt, ha még nem ajánlottuk fel a termék elszállítását.
			</p>
			<p>
				A terméket szállításra alkalmasan csomagolja be, és küldje vissza a hozzá tartozó tartozékokat is. Az
				eredeti csomagolás segíthet, de <strong>nem általános feltétele az elállásnak</strong>. Lehetőség
				szerint tüntesse fel a rendelési számot vagy az ügyszámot.
			</p>

			<h2>A visszaküldés költsége</h2>
			<p>
				Indokolás nélküli elállás esetén a visszaküldés közvetlen költségét Ön viseli, ha erről a
				szerződéskötés előtt megfelelően tájékoztattuk. Ha a termék jellege vagy mérete miatt szokásos postai
				úton nem küldhető vissza, annak visszaszállítási költségéről is előzetesen tájékoztatnunk kell. Ha ezt
				az előzetes tájékoztatási kötelezettséget nem teljesítettük, ezt a költséget nem kell viselnie.
			</p>
			<p>A vásárlás után kért elszállítási ajánlat nem helyettesíti a szerződéskötés előtti tájékoztatást.</p>
			<p>
				Ha a terméket olyan hiba miatt küldi vissza, amelyért mi felelünk, a{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reklamáció és visszaküldés</Link> oldalon
				leírtak irányadók. Ilyenkor más költségviselési szabályok érvényesek.
			</p>

			<h2>Mikor kapja vissza a pénzét</h2>
			<p>
				Az elállással érintett összegeket késedelem nélkül, legkésőbb a nyilatkozat beérkezésétől számított{" "}
				<strong>14 napon belül</strong> visszatérítjük. Teljes elállásnál az eredeti szállítás költségét is
				visszafizetjük, legfeljebb az adott rendeléshez kínált legolcsóbb szokásos szállítás díjáig. Az Ön
				által kifejezetten választott drágább szállítás felárát nem vagyunk kötelesek visszatéríteni.
			</p>
			<p>
				Részleges elállásnál az érintett összegeket térítjük vissza. Emiatt nem számítunk fel utólag további
				szállítási vagy egyéb díjakat.
			</p>
			<p>
				Az eredeti fizetési módot használjuk. Más megoldásban kifejezetten megállapodhatunk, ha az Önnek nem
				jár többletköltséggel. Az eredeti bankkártyára történő visszatérítéshez nem kérünk IBAN-számot.
			</p>
			<p>
				Ha nem ajánlottuk fel az elszállítást, a visszatérítést addig visszatarthatjuk, amíg a terméket vagy a
				feladást igazoló bizonylatot meg nem kapjuk, a korábbi időpontot figyelembe véve. Ha felajánlottuk az
				elszállítást, ezzel a visszatartási joggal nem élünk.
			</p>

			<h2>Milyen állapotban küldhető vissza a termék</h2>
			<p>
				A terméket olyan mértékben vizsgálhatja meg, amennyire a jellegének, tulajdonságainak és működésének
				megállapításához szükséges — ahogyan azt egy üzletben is megtehetné. Az ezt meghaladó használatból
				eredő értékcsökkenésért felelhet, ha az elállási jogról megfelelően tájékoztattuk.
			</p>
			<p>
				A csomagolás felbontásáért vagy a visszaküldés ügyintézéséért nem kérünk átalánydíjat. Az
				értékcsökkenést a tényleges állapot alapján vizsgáljuk, és az esetleges igényt megindokoljuk. Az ilyen
				követelést nem számítjuk be egyoldalúan az elállásból eredő visszatérítési igényébe.
			</p>

			<h2>Mikor van kivétel</h2>
			<p>
				Az elállási jog különösen az Ön egyedi utasításai szerint gyártott vagy egyértelműen személyre szabott
				termékeknél lehet kizárt. Jogszabályi kivétel vonatkozhat olyan lezárt csomagolású termékre is, amely
				egészségvédelmi vagy higiéniai okból a kézbesítés utáni felbontást követően nem küldhető vissza.
			</p>
			<p>
				<strong>
					Egy „Rendelésre” elérhető szokásos termék vagy az autójához kiválasztott standard készlet önmagában
					nem egyedi gyártású termék.
				</strong>{" "}
				Kivételt csak a törvényi feltételek teljesülésekor alkalmazunk. További részletek az{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Általános szerződési feltételekben</Link>{" "}
				találhatók.
			</p>
		</>
	);
}

export function It({ channel, form, modelFormHref }: WithdrawalBodyProps) {
	return (
		<>
			<p>
				Hai cambiato idea o il prodotto non è più adatto ai tuoi programmi? Come consumatore, puoi normalmente
				recedere dall’acquisto online{" "}
				<strong>entro 14 giorni dalla consegna, senza indicarne il motivo</strong>.
			</p>
			<p>
				Per gli ordini effettuati dopo l’accesso al tuo account, estendiamo il termine a{" "}
				<strong>30 giorni</strong>. Si applicano la stessa procedura di restituzione e le condizioni descritte
				qui, senza ridurre i tuoi diritti di legge. Puoi recedere anche prima della consegna o limitatamente
				ad alcuni prodotti. Per comunicarlo non serve accedere a un account né ottenere la nostra
				autorizzazione.
			</p>

			{form ?? (
				<>
					<h2>Recesso online</h2>
					<p>
						In questa versione di anteprima del negozio, la funzione di recesso online non è ancora attiva.
						Puoi inviare la dichiarazione tramite e-mail o posta ai recapiti qui sotto, o con un’altra
						modalità ammessa dalla legge. Se un termine è in corso, non aspettare l’attivazione della
						funzione. Aprire questa pagina non equivale a inviare una dichiarazione.
					</p>
				</>
			)}

			<h2>Recesso tramite e-mail o posta</h2>
			<p>
				Invia una dichiarazione inequivocabile a <Mail /> oppure a{" "}
				<strong>
					{companyInfo.legalName}, {companyInfo.returnAddress}, {SLOVAKIA_IT}
				</strong>
				. Per assistenza puoi chiamare il <Phone />.
			</p>
			<p>
				Puoi usare il <Link href={modelFormHref}>modulo di recesso da stampare</Link>, ma non è obbligatorio.
				La dichiarazione deve permettere di capire chi recede, a quale acquisto si riferisce e quali prodotti
				riguarda. Il numero d’ordine aiuta; in sua assenza puoi fornire altri dati utili a identificare il
				contratto.
			</p>

			<h2>Da quando decorre il termine</h2>
			<p>
				Il termine inizia dalla consegna del prodotto a te o a un terzo da te indicato, diverso dal corriere.
				Il giorno della consegna non si conta. Per più prodotti acquistati con un solo contratto e consegnati
				separatamente, conta l’ultimo prodotto; per un prodotto consegnato in più lotti o pezzi, l’ultimo
				lotto o pezzo. Per forniture regolari durante un periodo definito, conta la prima consegna.
			</p>
			<p>
				<strong>
					È sufficiente inviare la dichiarazione entro l’ultimo giorno: il prodotto non deve già essere
					tornato da noi.
				</strong>{" "}
				Restano ferme le regole legali per il calcolo dei termini. Se non forniamo l’informativa richiesta, il
				termine legale si prolunga secondo la legge, normalmente fino a 12 mesi dopo il termine iniziale. Se
				rimediamo all’omissione durante tale periodo, i 14 giorni decorrono dalla ricezione dell’informativa.
			</p>

			<h2>Come restituire il prodotto</h2>
			<p>
				Puoi scegliere un tuo corriere oppure chiederci un preventivo per il ritiro. Comunichiamo in anticipo
				il prezzo e le modalità proposte. Ordiniamo un servizio a pagamento solo dopo la tua esplicita
				accettazione.
			</p>
			<p>
				<strong>Per restituire con un tuo corriere non serve la nostra autorizzazione.</strong> Se non abbiamo
				offerto il ritiro, restituisci il prodotto senza ritardo e comunque entro{" "}
				<strong>14 giorni dalla comunicazione del recesso</strong> a:
			</p>
			<ReturnAddress country={SLOVAKIA_IT} />
			<p>
				Basta spedire entro il termine. Se abbiamo offerto il ritiro, prepara il prodotto secondo gli accordi.
				La sola richiesta di un preventivo non è né un ordine di trasporto né un’offerta di ritiro da parte
				nostra: non attendere un preventivo rischiando di perdere il termine se il ritiro non è stato offerto.
			</p>
			<p>
				Proteggi il prodotto per il trasporto e restituisci gli accessori che ne fanno parte. L’imballaggio
				originale può essere utile, ma <strong>non è una condizione generale per il recesso</strong>. Il
				numero d’ordine o di pratica facilita l’identificazione, senza essere l’unico modo consentito di
				provare l’acquisto.
			</p>

			<h2>Chi sostiene le spese</h2>
			<p>
				Nel recesso senza motivazione, i costi diretti della restituzione sono a tuo carico se te ne abbiamo
				correttamente informato prima della conclusione del contratto. Per un prodotto che, per natura o
				dimensioni, non può essere normalmente restituito per posta, dobbiamo indicare in anticipo anche il
				costo di tale restituzione.
			</p>
			<p>
				Se non abbiamo fornito l’informazione dovuta, oppure abbiamo accettato di sostenere il costo, non te
				lo addebitiamo. Un preventivo richiesto dopo l’acquisto non sostituisce l’informazione che doveva
				essere fornita prima.
			</p>
			<p>
				Per un reso dovuto a un difetto di cui siamo responsabili si applicano regole diverse: consulta{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reclami e resi</Link>.
			</p>

			<h2>Quando rimborsiamo</h2>
			<p>
				Rimborsiamo le somme interessate dal recesso senza ritardo, entro{" "}
				<strong>14 giorni dalla ricezione della dichiarazione</strong>. Per il recesso totale rimborsiamo
				anche la consegna iniziale, fino al prezzo della modalità standard meno costosa offerta per
				quell’ordine. Non siamo tenuti a rimborsare il supplemento per una consegna più costosa scelta
				espressamente.
			</p>
			<p>
				In caso di recesso parziale rimborsiamo gli importi corrispondenti. Non aggiungiamo retroattivamente
				costi di spedizione o altre commissioni per questo motivo.
			</p>
			<p>
				Utilizziamo lo stesso metodo di pagamento dell’acquisto. Una soluzione diversa richiede il tuo accordo
				espresso e non deve comportare costi. Non sei obbligato ad accettare un buono. Per rimborsare sulla
				carta utilizzata originariamente <strong>non serve un IBAN</strong>.
			</p>
			<p>
				Se non abbiamo offerto il ritiro, possiamo sospendere il rimborso fino a quando riceviamo il prodotto
				oppure la prova della spedizione, a seconda di quale evento avvenga prima. Se abbiamo offerto di
				ritirare il prodotto, non utilizziamo questa facoltà.
			</p>

			<h2>In quali condizioni può essere restituito</h2>
			<p>
				Puoi esaminare il prodotto e provarlo nella misura necessaria a verificarne natura, caratteristiche e
				funzionamento, come faresti in negozio. Puoi essere responsabile di una diminuzione di valore dovuta a
				un uso ulteriore, a condizione che tu sia stato correttamente informato del diritto di recesso.
			</p>
			<p>
				Non applichiamo una commissione forfettaria per l’apertura della confezione, la gestione o
				l’accettazione del reso. Un’eventuale diminuzione di valore viene valutata in concreto e motivata. Non
				la compensiamo unilateralmente con le somme che ti sono dovute in seguito al recesso.
			</p>

			<h2>Quando si applica un’eccezione</h2>
			<p>
				Il diritto può essere escluso, in particolare, per beni realmente realizzati su specifiche individuali
				o chiaramente personalizzati. Un’altra eccezione può riguardare beni sigillati che, una volta aperti,
				non possono essere restituiti per motivi igienici o di tutela della salute. Applichiamo un’eccezione
				soltanto quando ne ricorrono i presupposti legali.
			</p>
			<p>
				<strong>
					Un normale prodotto «Su ordinazione» o un kit standard scelto per un’auto non diventano, per questo
					solo motivo, prodotti personalizzati.
				</strong>{" "}
				Per i dettagli consulta le{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Condizioni generali di vendita</Link>.
			</p>
		</>
	);
}

export function Fr({ channel, form, modelFormHref }: WithdrawalBodyProps) {
	return (
		<>
			<p>
				Vous avez changé d’avis ou le produit ne correspond plus à vos projets ? En tant que consommateur,
				vous pouvez en principe vous rétracter d’un achat en ligne{" "}
				<strong>dans les 14 jours suivant sa réception, sans donner de motif</strong>.
			</p>
			<p>
				Pour une commande passée en étant connecté à votre compte client, nous portons ce délai à{" "}
				<strong>30 jours</strong>. La même procédure de retour et les conditions ci-dessous s’appliquent, sans
				restreindre vos droits légaux. Vous pouvez vous rétracter avant la livraison ou pour certains produits
				seulement. Aucun compte ni accord préalable de notre part n’est nécessaire pour le déclarer.
			</p>

			{form ?? (
				<>
					<h2>Rétractation en ligne</h2>
					<p>
						Dans cette version de prévisualisation de la boutique, la fonction de rétractation en ligne n’est
						pas encore active. Vous pouvez transmettre votre déclaration par e-mail, par courrier aux
						coordonnées ci-dessous ou par une autre voie légalement admise. Si un délai est en cours,
						n’attendez pas l’activation de la fonction. La consultation de cette page ne constitue pas un
						envoi de déclaration.
					</p>
				</>
			)}

			<h2>Rétractation par e-mail ou courrier</h2>
			<p>
				Adressez une déclaration claire de votre décision à <Mail /> ou à{" "}
				<strong>
					{companyInfo.legalName}, {companyInfo.returnAddress}, {SLOVAKIA_FR}
				</strong>
				. Pour obtenir de l’aide, vous pouvez appeler le <Phone />.
			</p>
			<p>
				Vous pouvez utiliser le <Link href={modelFormHref}>formulaire de rétractation à imprimer</Link>, mais
				ce n’est pas obligatoire. La déclaration doit permettre d’identifier la personne qui se rétracte,
				l’achat et les produits concernés. Le numéro de commande est utile ; à défaut, d’autres informations
				permettant d’identifier le contrat conviennent.
			</p>

			<h2>Point de départ du délai</h2>
			<p>
				Le délai court à partir de la réception du produit par vous-même ou par un tiers que vous avez
				désigné, autre que le transporteur. Le jour de réception n’est pas compté. Pour plusieurs produits
				d’un même contrat livrés séparément, on retient la réception du dernier produit ; pour un produit
				livré en lots ou en pièces, celle du dernier lot ou de la dernière pièce. Pour des livraisons
				régulières pendant une période définie, on retient la première livraison.
			</p>
			<p>
				<strong>
					Il suffit d’envoyer votre déclaration au plus tard le dernier jour : le produit ne doit pas déjà
					nous être parvenu.
				</strong>{" "}
				Les règles légales de calcul des délais restent applicables. Si nous n’avons pas fourni les
				informations obligatoires, le délai légal est prolongé conformément à la loi, normalement jusqu’à 12
				mois après le délai initial. Si nous fournissons ces informations pendant cette période, le délai de
				14 jours court à compter de leur réception.
			</p>

			<h2>Comment retourner le produit</h2>
			<p>
				Vous pouvez choisir votre transporteur ou nous demander un devis d’enlèvement. Nous indiquons le prix
				et les modalités proposées à l’avance. Nous ne commandons un service payant qu’après votre acceptation
				expresse.
			</p>
			<p>
				<strong>
					Un retour par votre propre transporteur ne nécessite pas notre autorisation préalable.
				</strong>{" "}
				Si nous n’avons pas proposé de reprendre le produit, renvoyez-le sans retard et au plus tard{" "}
				<strong>14 jours après votre déclaration de rétractation</strong>, à :
			</p>
			<ReturnAddress country={SLOVAKIA_FR} />
			<p>
				Une expédition dans le délai suffit. Si nous avons proposé l’enlèvement, préparez le produit selon les
				modalités convenues. Une simple demande de devis n’est ni une commande de transport ni une offre de
				reprise de notre part : ne laissez pas passer le délai en attendant un devis si nous n’avons pas
				proposé l’enlèvement.
			</p>
			<p>
				Protégez le produit pour le transport et joignez les accessoires faisant partie de l’article retourné.
				L’emballage d’origine peut être pratique, mais{" "}
				<strong>n’est pas une condition générale d’exercice du droit de rétractation</strong>. Le numéro de
				commande ou de dossier facilite l’identification, sans être le seul moyen admis de prouver l’achat.
			</p>

			<h2>Qui paie les frais de retour</h2>
			<p>
				Les frais directs de retour sont à votre charge en cas de rétractation sans motif si nous vous en
				avons correctement informé avant la conclusion du contrat. Pour un produit qui, par sa nature ou ses
				dimensions, ne peut pas être renvoyé normalement par la poste, son coût de retour doit également être
				indiqué avant l’achat.
			</p>
			<p>
				Si nous n’avons pas fourni l’information obligatoire ou avons accepté de prendre le coût en charge,
				nous ne vous le facturons pas. Un devis demandé après l’achat ne remplace pas l’information qui devait
				être communiquée avant la commande.
			</p>
			<p>
				Les règles sont différentes pour un produit présentant un défaut dont nous répondons. Consultez{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Réclamations et retours</Link>.
			</p>

			<h2>Quand nous remboursons</h2>
			<p>
				Nous remboursons les sommes concernées sans retard et au plus tard{" "}
				<strong>14 jours après réception de votre déclaration</strong>. En cas de rétractation totale, les
				frais de livraison initiaux sont aussi remboursés, dans la limite du mode standard le moins cher
				proposé pour cette commande. Le supplément correspondant à une livraison plus coûteuse expressément
				choisie n’a pas à être remboursé.
			</p>
			<p>
				En cas de rétractation partielle, nous remboursons les sommes correspondantes. Nous n’ajoutons pas
				rétroactivement de frais de livraison ou d’autres frais pour ce motif.
			</p>
			<p>
				Le remboursement utilise le moyen de paiement initial. Un autre moyen suppose votre accord exprès et
				ne doit occasionner aucun frais. Vous n’êtes pas tenu d’accepter un avoir. Pour rembourser sur la
				carte utilisée lors de l’achat, <strong>nous n’avons pas besoin d’IBAN</strong>.
			</p>
			<p>
				Si nous n’avons pas proposé l’enlèvement, nous pouvons différer le remboursement jusqu’à réception du
				produit ou de la preuve de son expédition, selon le premier de ces événements. Si nous avons proposé
				de reprendre le produit, nous ne nous prévalons pas de cette faculté.
			</p>

			<h2>Dans quel état retourner le produit</h2>
			<p>
				Vous pouvez examiner et essayer le produit dans la mesure nécessaire pour en vérifier la nature, les
				caractéristiques et le fonctionnement, comme en magasin. Vous pouvez répondre d’une dépréciation
				résultant de manipulations allant au-delà, à condition d’avoir reçu l’information obligatoire sur la
				rétractation.
			</p>
			<p>
				Nous ne facturons pas de forfait pour l’ouverture de l’emballage, le traitement ou l’acceptation d’un
				retour. Toute dépréciation éventuelle est évaluée concrètement et motivée. Nous ne compensons pas
				unilatéralement cette créance avec les sommes qui vous sont dues au titre de la rétractation.
			</p>

			<h2>Dans quels cas existe-t-il une exception</h2>
			<p>
				Une exception peut notamment concerner un produit réellement fabriqué selon des spécifications
				individuelles ou nettement personnalisé. Elle peut aussi concerner un bien scellé qui ne peut être
				renvoyé pour des raisons d’hygiène ou de protection de la santé après ouverture. Nous n’appliquons une
				exception que lorsque ses conditions légales sont réunies.
			</p>
			<p>
				<strong>
					Un produit ordinaire «Sur commande» ou un kit standard sélectionné pour un véhicule ne devient pas,
					pour cette seule raison, un produit personnalisé.
				</strong>{" "}
				Les détails figurent dans les{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Conditions générales de vente</Link>.
			</p>
		</>
	);
}

export function Es({ channel, form, modelFormHref }: WithdrawalBodyProps) {
	return (
		<>
			<p>
				¿Has cambiado de idea o el producto ya no encaja en tus planes? Como consumidor, puedes desistir de
				una compra online normalmente en un plazo de{" "}
				<strong>14 días naturales desde la recepción del producto, sin indicar el motivo</strong>.
			</p>
			<p>
				Si realizaste el pedido después de iniciar sesión en tu cuenta, ampliamos ese plazo a{" "}
				<strong>30 días</strong>. Aplicamos el mismo procedimiento de devolución y las condiciones que se
				explican aquí, sin reducir tus derechos legales. No necesitas una cuenta para comunicar el
				desistimiento.
			</p>
			<p>
				Puedes desistir antes de la entrega y hacerlo de todo el pedido o solo de determinados productos. No
				tienes que esperar a que lo autoricemos.
			</p>

			{form ?? (
				<>
					<h2>Desistimiento online</h2>
					<p>
						En esta versión de vista previa de la tienda, la función de desistimiento online todavía no está
						activa. Puedes enviar tu declaración por e-mail o por correo postal a los datos indicados a
						continuación, o por otra vía legalmente admitida. Si tienes un plazo en curso, no esperes a que se
						active. Abrir esta página no equivale a presentar una declaración.
					</p>
				</>
			)}

			<h2>Comunicarlo por e-mail o por correo postal</h2>
			<p>
				Envía una declaración inequívoca a <Mail /> o a{" "}
				<strong>
					{companyInfo.legalName}, {companyInfo.returnAddress}, {SLOVAKIA_ES}
				</strong>
				. También puedes contactarnos en el <Phone />.
			</p>
			<p>
				Puedes usar el <Link href={modelFormHref}>modelo de formulario de desistimiento</Link>, pero no es
				obligatorio. La declaración debe permitir saber quién desiste, a qué compra se refiere y qué productos
				comprende. No pedimos un motivo, consentimiento publicitario ni un IBAN como condición para ejercer el
				derecho.
			</p>

			<h2>Cuándo empieza el plazo</h2>
			<p>
				El cómputo comienza el día siguiente a la recepción por ti o por una persona designada por ti,
				distinta del transportista. Si una misma compra se entrega en varios envíos, cuenta la recepción del
				último producto; si el producto llega por lotes o piezas, la del último lote o pieza. En entregas
				periódicas durante un periodo determinado, cuenta la primera entrega.
			</p>
			<p>
				Para cumplir el plazo basta con enviar la declaración antes de que termine.{" "}
				<strong>El producto no tiene que haber llegado de vuelta dentro de ese mismo plazo.</strong> Se
				mantienen las reglas legales de cómputo y de ampliación por falta de información: cuando no se
				facilita la información exigida, el plazo legal puede prolongarse hasta doce meses después del
				vencimiento inicial. Si se facilita durante ese periodo, dispones de los 14 días legales desde su
				recepción.
			</p>

			<h2>Cómo devolver el producto</h2>
			<p>
				Puedes elegir tu transportista sin autorización previa o pedirnos un presupuesto de recogida.
				Indicamos el coste y las condiciones antes de contratar; una recogida de pago solo se encarga tras tu
				aceptación expresa.
			</p>
			<p>
				Si no hemos ofrecido recoger el producto, envíalo o entrégalo sin demora indebida y, como máximo,
				dentro de los <strong>14 días siguientes a la comunicación del desistimiento</strong>, a:
			</p>
			<ReturnAddress country={SLOVAKIA_ES} />
			<p>
				Es suficiente enviarlo antes del vencimiento. Si hemos ofrecido recogerlo, prepáralo según lo
				acordado. La simple solicitud de presupuesto no es una oferta de recogida por nuestra parte ni
				suspende el plazo para enviarlo.
			</p>
			<p>
				Protege bien el producto e incluye los accesorios que le correspondan. El embalaje original puede
				facilitar el transporte, pero <strong>no es una condición general para desistir</strong>. El número de
				pedido ayuda a identificar la devolución; tampoco es obligatorio utilizar exclusivamente la factura
				original.
			</p>

			<h2>Quién paga la devolución</h2>
			<p>
				Asumes los costes directos de devolución si te informamos debidamente de ello antes de contratar. Si
				el producto, por su naturaleza o dimensiones, no puede devolverse normalmente por correo, debemos
				informar también antes de la compra de su coste de devolución. Si omitimos la información exigida, no
				te repercutimos esos costes.
			</p>
			<p>
				Un presupuesto solicitado después de comprar no sustituye esa información previa. Las devoluciones por
				un defecto del que respondemos se rigen por otras reglas, explicadas en{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reclamaciones y devoluciones</Link>.
			</p>

			<h2>Cuándo devolvemos el dinero</h2>
			<p>
				Reembolsamos los pagos afectados sin demora indebida y, como máximo, dentro de los{" "}
				<strong>14 días siguientes a la recepción de la declaración</strong>. Si desistes de todo el pedido,
				devolvemos también el envío inicial hasta el coste del servicio ordinario más económico ofrecido para
				ese pedido. No tenemos que devolver el suplemento de una entrega más cara que hayas elegido
				expresamente.
			</p>
			<p>
				Si desistes solo de una parte, devolvemos las cantidades correspondientes. No añadimos
				retroactivamente gastos de envío ni otras tarifas por ese motivo.
			</p>
			<p>
				El reembolso se hace por el mismo medio de pago, salvo que acuerdes expresamente otro sin gastos para
				ti. No tienes que aceptar un vale en lugar del dinero. Para devolver el pago a la tarjeta utilizada no
				necesitamos tu IBAN.
			</p>
			<p>
				Si no ofrecimos recoger el producto, podemos retener el reembolso hasta recibirlo o hasta que
				acredites su envío, lo que ocurra primero. Si ofrecimos recogerlo, no aplicamos esa retención.
			</p>

			<h2>En qué estado puedes devolverlo</h2>
			<p>
				Puedes examinar y probar el producto en la medida necesaria para comprobar su naturaleza,
				características y funcionamiento, como harías en una tienda. Si lo manipulas más de lo necesario y
				pierde valor, podrías responder por esa disminución, siempre que te hayamos informado debidamente del
				derecho de desistimiento.
			</p>
			<p>
				No cobramos una tarifa fija por abrir el embalaje, tramitar la devolución o reponer el producto. Una
				posible disminución de valor se valora según el estado real y se explica. No compensamos
				unilateralmente esa reclamación con tu derecho al reembolso derivado del desistimiento.
			</p>

			<h2>Excepciones</h2>
			<p>
				El derecho puede quedar excluido, en particular, en productos realmente fabricados según
				especificaciones individuales o claramente personalizados. También puede existir una excepción para
				productos precintados que, por razones de salud o higiene, no sean aptos para devolución tras retirar
				el precinto, siempre que concurran los requisitos legales.
			</p>
			<p>
				<strong>
					Un artículo «Bajo pedido» o un conjunto estándar seleccionado para tu coche no se convierte por ello
					en un producto personalizado.
				</strong>{" "}
				Las excepciones se aplican solo cuando se cumplen sus condiciones. Encontrarás más información en las{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Condiciones generales de venta</Link>.
			</p>
		</>
	);
}

export function Ro({ channel, form, modelFormHref }: WithdrawalBodyProps) {
	return (
		<>
			<p>
				Te-ai răzgândit sau produsul nu se mai potrivește planurilor tale? Ca persoană care cumpără în
				calitate de consumator, te poți retrage dintr-o cumpărătură online, de regulă, în{" "}
				<strong>14 zile de la primirea produsului, fără să indici un motiv</strong>.
			</p>
			<p>
				Dacă ai plasat comanda după autentificarea în contul de client, prelungim termenul la{" "}
				<strong>30 de zile</strong>. Se aplică aceeași procedură și condițiile descrise aici, fără a limita
				drepturile legale. Nu ai nevoie de cont pentru a comunica retragerea.
			</p>
			<p>
				Poți anunța retragerea înainte de livrare și o poți limita la o parte dintre produse. Nu trebuie să
				aștepți aprobarea noastră.
			</p>

			{form ?? (
				<>
					<h2>Retragere online</h2>
					<p>
						În această versiune de previzualizare a magazinului, funcția de retragere online nu este încă
						activă. Poți trimite declarația prin e-mail sau prin poștă la datele de mai jos ori prin altă
						modalitate permisă de lege. Dacă ai un termen în curs, nu aștepta activarea funcției. Deschiderea
						acestei pagini nu înseamnă trimiterea unei declarații.
					</p>
				</>
			)}

			<h2>Retragere prin e-mail sau prin poștă</h2>
			<p>
				Trimite o declarație neechivocă la <Mail /> sau la{" "}
				<strong>
					{companyInfo.legalName}, {companyInfo.returnAddress}, {SLOVAKIA_RO}
				</strong>
				. Ne poți contacta și la <Phone />.
			</p>
			<p>
				Poți utiliza <Link href={modelFormHref}>formularul de retragere pentru tipărire</Link>, dar folosirea
				lui este opțională. Declarația trebuie să permită identificarea persoanei care se retrage, a
				cumpărăturii și a produselor vizate. Nu cerem un motiv, acord de marketing sau IBAN ca o condiție
				pentru exercitarea dreptului.
			</p>

			<h2>De când se calculează termenul</h2>
			<p>
				Termenul începe să curgă din ziua următoare primirii produsului de către tine sau de către persoana
				indicată de tine, alta decât transportatorul. La produse din aceeași comandă livrate separat, contează
				ultimul produs primit; la un produs livrat în loturi sau piese, ultimul lot ori ultima piesă. Pentru
				livrări periodice pe o perioadă determinată, contează prima livrare.
			</p>
			<p>
				Este suficient să trimiți declarația înainte de expirarea termenului.{" "}
				<strong>Produsul nu trebuie să ajungă înapoi până la aceeași dată.</strong> Se aplică în continuare
				regulile legale de calcul și de prelungire pentru lipsa informării: termenul legal poate fi prelungit
				până la douăsprezece luni după expirarea termenului inițial. Dacă informarea necesară este comunicată
				în acel interval, cele 14 zile legale curg de la primirea ei.
			</p>

			<h2>Cum trimiți produsul înapoi</h2>
			<p>
				Poți alege propriul transportator fără aprobarea noastră prealabilă sau poți cere o ofertă pentru
				ridicare. Comunicăm prețul și condițiile înainte; un transport contra cost este comandat numai după
				acceptarea ta expresă.
			</p>
			<p>
				Dacă nu am oferit ridicarea produsului, trimite-l sau predă-ni-l fără întârziere nejustificată, în cel
				mult <strong>14 zile de la comunicarea retragerii</strong>, la:
			</p>
			<ReturnAddress country={SLOVAKIA_RO} />
			<p>
				Termenul este respectat dacă expediezi înainte de expirarea lui. Dacă am oferit ridicarea, pregătește
				coletul conform înțelegerii. O simplă cerere de preț nu reprezintă o ofertă de ridicare din partea
				noastră și nu suspendă termenul de expediere.
			</p>
			<p>
				Ambalează produsul în siguranță și include accesoriile care îi aparțin. Ambalajul original poate fi
				util, dar <strong>nu este o condiție generală a retragerii</strong>. Numărul comenzii ajută la
				identificare. Nu cerem exclusiv factura originală.
			</p>

			<h2>Cine suportă costul returului</h2>
			<p>
				Suporți costurile directe de returnare dacă te-am informat corespunzător înainte de încheierea
				contractului. Pentru un produs care, prin natura sau dimensiunile sale, nu poate fi returnat în mod
				normal prin poștă, trebuie comunicat înainte de cumpărare și costul returnării. Dacă omitem informarea
				obligatorie, nu îți cerem să suporți acele costuri.
			</p>
			<p>
				O ofertă solicitată după cumpărare nu înlocuiește informarea precontractuală. Pentru un retur cauzat
				de un defect de care răspundem se aplică alte reguli, descrise în{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Reclamații și retururi</Link>.
			</p>

			<h2>Când restituim banii</h2>
			<p>
				Rambursăm plățile vizate fără întârziere nejustificată, în cel mult{" "}
				<strong>14 zile de la primirea declarației</strong>. La retragerea din întreaga comandă, restituim și
				costul livrării inițiale, în limita celei mai ieftine metode standard pe care am oferit-o pentru acea
				comandă. Nu suntem obligați să restituim suplimentul pentru o livrare mai scumpă pe care ai ales-o
				expres.
			</p>
			<p>
				La retragerea parțială, restituim sumele corespunzătoare. Nu adăugăm retroactiv costuri de transport
				sau alte taxe din acest motiv.
			</p>
			<p>
				Folosim aceeași metodă de plată, cu excepția unui acord expres pentru o altă metodă fără costuri
				pentru tine. Nu trebuie să accepți un voucher în locul banilor. Pentru restituirea pe cardul folosit
				inițial nu avem nevoie de IBAN.
			</p>
			<p>
				Dacă nu am oferit ridicarea, putem amâna rambursarea până primim produsul sau dovada expedierii lui,
				oricare intervine prima. Dacă am oferit ridicarea, nu aplicăm această amânare.
			</p>

			<h2>În ce stare poți returna produsul</h2>
			<p>
				Poți examina și testa produsul în măsura necesară pentru a-i stabili natura, caracteristicile și
				funcționarea, ca într-un magazin. Dacă îl folosești mai mult decât este necesar și îi diminuezi
				valoarea, poți răspunde pentru acea diminuare, cu condiția să fi fost informat corespunzător despre
				retragere.
			</p>
			<p>
				Nu percepem o taxă fixă pentru desigilare, procesarea returului sau readucerea produsului în stoc. O
				eventuală diminuare a valorii se evaluează pe baza stării reale și se explică. Nu o compensăm
				unilateral cu dreptul tău la restituirea sumelor rezultate din retragere.
			</p>

			<h2>Când se aplică o excepție</h2>
			<p>
				Dreptul poate fi exclus, în special, pentru produse realizate efectiv după specificații individuale
				sau clar personalizate. O excepție poate exista și pentru bunuri sigilate care nu pot fi returnate din
				motive de sănătate sau igienă după desigilare, dacă sunt îndeplinite condițiile legale.
			</p>
			<p>
				<strong>
					Un produs „La comandă” sau un set standard ales pentru mașina ta nu devine, doar din acest motiv, un
					produs personalizat.
				</strong>{" "}
				Aplicăm excepțiile numai când sunt îndeplinite cerințele lor. Detaliile sunt în{" "}
				<Link href={marketHref(channel, "/obchodne-podmienky")}>Termenii și condițiile de vânzare</Link>.
			</p>
		</>
	);
}

/**
 * The shared half of the two English cancellation pages.
 *
 * The differing parts are props, and the last of them is the one that matters. "Other
 * cancellation rights" is a different section of law in each market: in the United States
 * the point is that the FTC's three-day Cooling-Off Rule does *not* reach purchases made
 * entirely online, so the reader is not left believing in a federal right they do not
 * have; in Canada the point is the opposite in shape — mandatory provincial and
 * territorial rights genuinely do arise independently of this policy, and Québec's
 * statutory cancellation can put reasonable return costs on the merchant.
 *
 * Neither statement is true of the other country, so neither is written once and shared.
 */
function EnglishWithdrawal({
	channel,
	form,
	modelFormHref,
	market,
	cancelling,
	otherRights,
}: WithdrawalBodyProps & {
	/** How the market is named in prose: `the United States`, `Canada`. */
	market: string;
	/** `canceling` in US spelling, `cancelling` in Canadian. */
	cancelling: string;
	/** The market's own mandatory-cancellation-rights section. See the note above. */
	otherRights: ReactNode;
}) {
	return (
		<>
			<p>
				Changed your mind about a purchase? For consumer orders, we give you{" "}
				<strong>14 calendar days from delivery</strong> to tell us you wish to cancel without giving a reason.
				If you placed the order while signed in to your customer account, you have <strong>30 days</strong>.
			</p>
			<p>
				This is protection provided in our store terms and the agreed Slovak framework, not a statement that
				every online purchase in {market} carries a national statutory 14-day cooling-off period. The same
				procedure applies during our 30-day extension. More protective mandatory rights are not reduced.
			</p>
			<p>
				You can give notice before delivery and can cancel all or part of an order. You do not need to create
				an account, log in again or obtain our prior approval.
			</p>

			{form ?? (
				<>
					<h2>Online cancellation</h2>
					<p>
						The online cancellation form is not yet active in this preview of the store. You can send your
						notice by email or by mail using the details below. Do not wait for the online form if a deadline
						is approaching. Opening this page does not send a notice.
					</p>
				</>
			)}

			<h2>Give notice by email or mail</h2>
			<p>
				Send a clear statement to <Mail /> or to{" "}
				<strong>
					{companyInfo.legalName}, {companyInfo.returnAddress}, {SLOVAKIA_EN}
				</strong>
				. You can reach us with questions on <Phone />.
			</p>
			<p>
				You may use our <Link href={modelFormHref}>printable cancellation form</Link>, but it is optional.
				Tell us who is {cancelling}, which purchase is involved and whether the notice covers the whole order
				or named items and quantities. You do not have to give a reason or your bank account details just to
				cancel.
			</p>

			<h2>When the period starts</h2>
			<p>
				The delivery day itself is not counted. For one contract covering goods delivered separately, count
				from delivery of the last item. For an item delivered in parts, count from the last part. For regular
				deliveries over an agreed period, count from the first delivery. Delivery to a person you nominate,
				other than the carrier, counts as delivery to you.
			</p>
			<p>
				Send your notice by the last day of the applicable period.{" "}
				<strong>The goods do not have to reach Slovakia by that day.</strong> If mandatory law extends a
				cancellation period because required information was not provided, that longer period remains
				available.
			</p>

			<h2>Send the items back</h2>
			<p>
				For routine change-of-mind returns from {market}, arrange the return with your own carrier.{" "}
				<strong>We do not currently offer routine pickup or a prepaid return label.</strong> No prior return
				authorization is required.
			</p>
			<p>
				Unless we have separately offered to collect the goods, send or hand them back without undue delay and
				within <strong>14 days after your cancellation notice</strong>. Sending them before the deadline is
				sufficient. Keep evidence of dispatch.
			</p>
			<ReturnAddress country={SLOVAKIA_EN} />
			<p>
				Pack the goods securely and include the accessories supplied with the returned item. Original
				packaging can help protect it, but is not a general condition of cancellation. Include your order
				reference where possible.
			</p>
			<p>
				A request for help with shipping is not a collection booking or an offer by us to collect. Do not miss
				the return deadline simply while waiting for advice. If we separately offer collection, follow the
				arrangement we confirm; paid collection is never ordered without your express acceptance of its price.
			</p>

			<h2>Who pays return shipping</h2>
			<p>
				For a change-of-mind return, you bear the direct return costs if we properly told you about them
				before purchase. For goods that cannot normally be returned by post, the required information about
				those costs must also be provided before you buy. If that information was not properly provided, or we
				agreed to pay, we do not charge you those costs.
			</p>
			<p>
				Return shipping to Slovakia can be significant for bulky items. A quote requested after purchase does
				not replace information that should have been given before purchase. This policy does not set a flat
				return fee or a handling charge.
			</p>
			<p>
				For defects, incorrect goods or other grounds that require us to pay, different cost rules apply. See{" "}
				<Link href={marketHref(channel, "/reklamacie-a-vratenie")}>Returns and product support</Link>.
			</p>

			<h2>Your refund</h2>
			<p>
				We refund the amounts due without undue delay and, under this policy, no later than{" "}
				<strong>14 days after receiving your notice</strong>. If you cancel the entire order, this includes
				original delivery up to the price of the least expensive standard delivery we offered for that order.
				The extra cost of a more expensive option you expressly selected need not be refunded.
			</p>
			<p>
				For a partial return, we refund the relevant amounts. We do not retrospectively add shipping charges
				or a penalty because you returned part of an order. Import costs already included in the price are not
				a new cancellation fee.
			</p>
			<p>
				We use the original payment method unless you expressly agree to a different method that costs you
				nothing. You do not have to accept store credit instead of a refund. We do not need an IBAN to refund
				the original card.
			</p>
			<p>
				Unless we offered collection, we may hold the refund until we receive the goods or evidence of
				dispatch, whichever happens first. If we offered collection, we do not use that hold. Any earlier
				refund or different procedure required by mandatory law takes priority.
			</p>

			<h2>Condition of returned goods</h2>
			<p>
				You may inspect the goods as needed to establish their nature, characteristics and operation, much as
				you would in a shop. You may be responsible for a reduction in value caused by handling beyond that,
				subject to the applicable information requirements and law. Opening the package or reasonably
				inspecting the product does not by itself remove the right to cancel.
			</p>
			<p>
				There is no flat restocking, unpacking or processing fee. Any claim for diminished value must be based
				on the actual condition and explained. We do not unilaterally deduct such a claim from the refund due
				under our agreed cancellation terms.
			</p>

			<h2>Exceptions</h2>
			<p>
				The change-of-mind right may not apply to goods genuinely made to your individual specifications or
				clearly personalized for you. An exception can also apply to sealed goods that are unsuitable for
				return for health or hygiene reasons once unsealed. We apply exceptions only where their conditions
				are met and without reducing mandatory rights.
			</p>
			<p>
				<strong>
					A normal “Available to order” item or a standard rack kit selected to fit your vehicle is not
					made-to-order in this sense just because we source or assemble that standard combination.
				</strong>{" "}
				An exception for changing your mind does not remove remedies for a defect.
			</p>

			<h2>Other cancellation rights</h2>
			{otherRights}
			<p>
				Our <Link href={marketHref(channel, "/obchodne-podmienky")}>Terms of sale</Link> give the full
				contractual framework. For a product problem, contact us even after the change-of-mind period has
				ended.
			</p>
		</>
	);
}

export function Us(props: WithdrawalBodyProps) {
	return (
		<EnglishWithdrawal
			{...props}
			market="the United States"
			cancelling="canceling"
			otherRights={
				<p>
					This store policy is not the FTC’s three-day Cooling-Off Rule, which does not cover purchases made
					entirely online. Other applicable rights remain available, including rights relating to delayed
					shipment, defective goods and misleading practices. A cancellation because we fail to ship as
					required is not treated as a customer-funded change-of-mind return.
				</p>
			}
		/>
	);
}

export function Ca(props: WithdrawalBodyProps) {
	return (
		<EnglishWithdrawal
			{...props}
			market="Canada"
			cancelling="cancelling"
			otherRights={
				<p>
					Mandatory Canadian cancellation rights can arise independently of this policy, including when
					legally required information or a contract copy is missing, goods are not delivered on time, or the
					seller engages in an unfair practice. Conditions and deadlines depend on the applicable provincial
					or territorial law. In Québec, statutory cancellation of a distance contract for non-compliance can
					require the merchant to pay reasonable return costs. Our ordinary change-of-mind cost rule does not
					override that protection.
				</p>
			}
		/>
	);
}
