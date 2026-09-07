import Link from "next/link";
import { type ReactNode } from "react";
import { companyInfo } from "@/config/company";
import { marketHref } from "@/lib/channel-map";

const Mail = () => <a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>;

export interface WithdrawalBodyProps {
	readonly channel: string;
	/** The online function, already gated by the caller. `null` when it is not served. */
	readonly form: ReactNode;
	readonly modelFormHref: string;
}

function ReturnAddress() {
	return (
		<address>
			{companyInfo.legalName}
			<br />
			Stará Vajnorská 11
			<br />
			831 04 Bratislava
			<br />
			Slovenská republika
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
