import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { companyInfo } from "@/config/company";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";
import { PrivacySettingsLink } from "@/ui/components/privacy-settings-link";

export const metadata: Metadata = {
	title: formatPageTitle("Zásady používania cookies"),
	description:
		"Čo sú cookies a podobné technológie, na čo ich MAKY.STORE používa a ako si môžete nastaviť alebo odvolať súhlas s analytikou a marketingom.",
};

/**
 * The storage inventory.
 *
 * Read off the code that actually writes each entry, not off a template:
 * `maky-market` from `src/proxy.ts`, `checkoutId-<channel>` from `saveIdToCookie()`
 * (no `maxAge` — so genuinely a session cookie), the Saleor auth pair from
 * `src/lib/auth/constants.ts` (15 min / 7 days), and `maky-consent` from
 * `CookieConsent`, which is localStorage rather than a cookie and is listed as such
 * because the consent rules follow the purpose, not the storage technology.
 *
 * The optional row is deliberately vaguer than the necessary ones, and honestly so: the
 * storefront loads a Google Tag Manager container, but WHICH tags that container fires
 * is configured in GTM, not here. Naming `_ga` with a confident lifetime would be
 * stating as verified something this repository cannot see.
 */
const NECESSARY: ReadonlyArray<{ name: string; kind: string; purpose: string; life: string }> = [
	{
		name: "maky-market",
		kind: "Cookie",
		purpose: "Pamätá si jazykovú a trhovú verziu obchodu, ktorú ste otvorili.",
		life: "1 rok",
	},
	{
		name: "checkoutId-sk-eur",
		kind: "Cookie",
		purpose: "Spája váš prehliadač s obsahom košíka a s rozpracovanou objednávkou.",
		life: "Do zatvorenia prehliadača",
	},
	{
		name: "Prihlasovacie cookies zákazníckeho účtu",
		kind: "Cookie",
		purpose: "Udržiavajú vaše prihlásenie. Ukladajú sa až po prihlásení do účtu.",
		life: "Prístupový token 15 minút, obnovovací 7 dní",
	},
	{
		name: "maky-consent",
		kind: "Miestne úložisko (localStorage)",
		purpose: "Uchováva vašu voľbu súkromia, aby sme sa nepýtali pri každej návšteve.",
		life: "Do vymazania údajov webu v prehliadači",
	},
];

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	const settingsButtonClass =
		"cursor-pointer font-semibold text-forest-700 underline underline-offset-2 transition-colors hover:text-forest-800";
	return (
		<LegalPage title="Zásady používania cookies">
			<p>
				Cookies a podobné technológie používame na fungovanie e-shopu a podľa vašej voľby aj na ďalšie účely.
				Voliteľné analytické a marketingové technológie môžete odmietnuť a naďalej nakupovať.
			</p>

			<h2>Čo sú cookies a podobné technológie</h2>
			<p>
				Cookies sú malé údaje, ktoré si web ukladá vo vašom prehliadači. Pomáhajú napríklad udržať obsah
				košíka alebo prihlásenie. Niektoré sa vymažú po ukončení návštevy, iné zostávajú do skončenia
				nastavenej platnosti.
			</p>
			<p>
				Web môže využívať aj miestne úložisko prehliadača, napríklad <strong>localStorage</strong>, alebo iné
				obdobné technológie. Pri pravidlách súhlasu nerozhoduje iba ich názov, ale skutočný účel. Tieto zásady
				sa preto netýkajú len súborov označovaných ako cookies.
			</p>

			<h2>Nevyhnutné funkcie</h2>
			<p>
				Technológie bezpodmienečne potrebné na službu, ktorú si výslovne vyžiadate, používame bez osobitného
				súhlasu. Môže ísť napríklad o košík, prihlásenie, uskutočnenie platby alebo uloženie vašej voľby
				súkromia.
			</p>
			<p>
				Rozsah obmedzujeme na to, čo je pre danú funkciu skutočne potrebné. Za nevyhnutné automaticky
				nepovažujeme každé meranie ani všetky nástroje toho istého dodávateľa.
			</p>

			<h2>Analytika a marketing</h2>
			<p>
				<strong>Voliteľná analytika</strong> slúži na vyhodnocovanie návštevnosti a používania obchodu.{" "}
				<strong>Marketingové technológie</strong> môžu slúžiť na meranie reklamy, vytváranie reklamných publík
				alebo prispôsobenie reklám.
			</p>
			<p>
				Na tieto účely používame službu <strong>Google Tag Manager</strong> spolu s meracími nástrojmi
				spoločnosti Google. Kým nedáte súhlas, sú ukladanie a čítanie údajov v prehliadači na analytické a
				reklamné účely <strong>vypnuté</strong> — web posiela službe Google výslovný pokyn „denied“ ešte
				predtým, než sa akékoľvek meranie spustí. Súhlasom sa tento pokyn zmení na „granted“; odvolaním sa
				vráti späť.
			</p>
			<p>
				Samotné pokračovanie v prehliadaní, zatvorenie lišty alebo nákup sa nepovažujú za súhlas. Voliteľné
				kategórie nie sú vopred zaškrtnuté.
			</p>
			<p>
				Na meranie návštevnosti používame aj <strong>Cloudflare Web Analytics</strong>. Táto služba{" "}
				<strong>neukladá cookies</strong>, nevytvára identifikátor návštevníka ani neprepája údaje naprieč
				webmi, preto beží aj bez súhlasu. Vyhodnocuje iba súhrnnú návštevnosť stránok.
			</p>
			<p>
				Použitie technológie, ktorá neukladá cookies, ešte samo osebe neznamená, že nespracúva osobné údaje.
				Účely, právne základy a poskytovatelia prípadných ďalších technických služieb sú uvedení aj v{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Ochrane osobných údajov</Link>.
			</p>

			<h2>Čo si môžete vybrať</h2>
			<p>
				V nastaveniach súkromia môžete <strong>prijať všetky voliteľné účely</strong>,{" "}
				<strong>odmietnuť všetky voliteľné účely</strong> alebo <strong>povoliť iba vybrané</strong>.
				Nevyhnutné funkcie zostávajú aktívne, pretože bez nich nemožno poskytnúť príslušnú vyžiadanú službu.
			</p>
			<p className="not-prose">
				<PrivacySettingsLink label="Otvoriť nastavenia súkromia" className={settingsButtonClass} />
			</p>
			<p>
				Svoju voľbu môžete kedykoľvek zmeniť aj cez tlačidlo <strong>„Nastavenia súkromia“</strong> v pätičke.
				Odvolanie súhlasu sa uplatní na ďalšie používanie príslušných voliteľných technológií. Zastavíme ich
				ďalšie spúšťanie a odstránime príslušné voliteľné cookies, ktoré spravuje náš web, pokiaľ je to
				technicky možné. Odvolanie súhlasu samo osebe nevymaže všetky údaje, ktoré už spracoval samostatný
				poskytovateľ; na tie sa vzťahujú príslušné práva podľa GDPR.
			</p>
			<p>
				Nastavenie sa vzťahuje na daný prehliadač a zariadenie. Pri použití iného zariadenia alebo po vymazaní
				úložiska môže byť potrebné voľbu zopakovať. O novú voľbu požiadame aj vtedy, keď skončí platnosť
				uloženého súhlasu alebo sa podstatne zmenia účely vyžadujúce súhlas.
			</p>

			<h2>Prehľad používaných technológií</h2>
			<h3>Nevyhnutné — bez súhlasu</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Názov</th>
							<th>Typ</th>
							<th>Účel</th>
							<th>Platnosť</th>
						</tr>
					</thead>
					<tbody>
						{NECESSARY.map((row) => (
							<tr key={row.name}>
								<td>{row.name}</td>
								<td>{row.kind}</td>
								<td>{row.purpose}</td>
								<td>{row.life}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p>
				Všetky uvedené položky ukladá priamo náš web (maky.store). Pri platbe vás pokladňa odovzdá platobnej
				bráne Stripe, ktorá si pre spracovanie a bezpečnosť platby ukladá vlastné údaje podľa svojich zásad.
			</p>

			<h3>Voliteľné — až po vašom súhlase</h3>
			<p>
				Po udelení súhlasu s analytikou alebo marketingom môže Google Tag Manager spustiť meracie nástroje
				spoločnosti Google, ktoré si vo vašom prehliadači uložia vlastné cookies. Ich názvy a platnosť určuje
				Google podľa konkrétneho nastavenia merania; spravidla ide o cookies s platnosťou v mesiacoch až
				rokoch. Bez súhlasu sa neuložia. Aktuálny zoznam vám na požiadanie poskytneme na{" "}
				<a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>.
			</p>

			<h2>Nastavenie v prehliadači</h2>
			<p>
				Cookies môžete vymazať alebo blokovať aj v prehliadači. Ak zablokujete aj nevyhnutné cookies, nemusí
				správne fungovať košík, prihlásenie alebo platba. Odmietnutie voliteľnej analytiky a marketingu v
				našej lište však nákup neblokuje.
			</p>
			<p>
				Vymazanie cookies nemusí zároveň vymazať iné miestne úložiská. Tie sa spravujú v nastaveniach údajov
				webu príslušného prehliadača.
			</p>

			<h2>Kontakt a ďalšie informácie</h2>
			<p>
				Prevádzkovateľom webu je <strong>{companyInfo.legalName}</strong>, {companyInfo.street},{" "}
				{companyInfo.city}, IČO {companyInfo.ico}. Otázky nám môžete poslať na{" "}
				<a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a>.
			</p>
			<p>
				Informácie o právach, príjemcoch údajov a kontaktnom mieste dozorného úradu nájdete na stránke{" "}
				<Link href={marketHref(channel, "/ochrana-osobnych-udajov")}>Ochrana osobných údajov</Link>.
			</p>
		</LegalPage>
	);
}
