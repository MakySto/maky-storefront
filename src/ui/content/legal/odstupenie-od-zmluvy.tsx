import Link from "next/link";
import { type ReactNode } from "react";
import { companyInfo, companyPhoneHref } from "@/config/company";
import { marketHref } from "@/lib/channel-map";
import { AUSTRIA, GERMANY, SLOVAKIA_DE, type GermanMarket } from "./german-market";

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
