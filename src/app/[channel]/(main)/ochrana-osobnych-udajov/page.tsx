import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { REVERSE_MAP } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { LegalPage } from "@/ui/components/legal/legal-page";

export const metadata: Metadata = {
	title: formatPageTitle("Ochrana osobných údajov"),
	description:
		"Zásady spracúvania osobných údajov MAKY.STORE s. r. o. — aké údaje spracúvame, na aké účely, komu ich poskytujeme a aké máte práva.",
};

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();
	return (
		<LegalPage title="Zásady ochrany osobných údajov">
			<h3>Prevádzkovateľ</h3>
			<p>
				MAKY.STORE s. r. o., Lermontovova 911/3, 811 05 Bratislava-Staré Mesto, IČO: 57 704 627. Kontakt vo
				veciach ochrany osobných údajov: info@maky.store.
			</p>
			<h3>Aké údaje spracúvame</h3>
			<ul>
				<li>
					Identifikačné a kontaktné údaje: meno, priezvisko, e-mail, telefón, doručovacia a fakturačná adresa.
				</li>
				<li>Údaje o objednávke: objednaný tovar, cena a história objednávok.</li>
				<li>
					Platobné údaje: spracúva priamo platobná brána Stripe; úplné údaje o platobnej karte neukladáme.
				</li>
				<li>
					Údaje účtu, ak si vytvoríte zákaznícky účet, a e-mailovú adresu pri prihlásení na odber noviniek.
				</li>
			</ul>
			<h3>Účely a právne základy spracúvania</h3>
			<ul>
				<li>Vybavenie a doručenie objednávky a komunikácia k nej — na základe plnenia zmluvy.</li>
				<li>Účtovné a daňové povinnosti — na základe zákonnej povinnosti.</li>
				<li>
					Ochrana pred podvodmi, vymáhanie nárokov a zlepšovanie služieb — na základe oprávneného záujmu.
				</li>
				<li>Zasielanie noviniek a marketingová komunikácia — na základe vášho súhlasu.</li>
			</ul>
			<h3>Komu údaje poskytujeme</h3>
			<p>
				Osobné údaje poskytujeme len v nevyhnutnom rozsahu poskytovateľom služieb, ktoré používame na
				prevádzku obchodu:
			</p>
			<ul>
				<li>doručovanie zásielok — FedEx,</li>
				<li>spracovanie platieb — Stripe,</li>
				<li>hosting a serverová infraštruktúra vrátane databázy objednávok — Amazon Web Services,</li>
				<li>ochrana, CDN a meranie návštevnosti — Cloudflare,</li>
				<li>meranie výkonu webu — Vercel,</li>
				<li>
					analytické a marketingové nástroje (Google a Meta), aktivované iba s vaším súhlasom prostredníctvom
					nástroja Google Tag Manager,
				</li>
				<li>poskytovateľ e-mailových služieb na zasielanie transakčných e-mailov,</li>
				<li>poskytovatelia účtovných a obdobných služieb nevyhnutných na prevádzku.</li>
			</ul>
			<h3>Prenos do tretích krajín</h3>
			<p>
				Niektorí poskytovatelia (Stripe, Google, Amazon Web Services, Cloudflare, Vercel) môžu spracúvať údaje
				aj mimo Európskej únie vrátane USA. Takýto prenos je zabezpečený primeranými zárukami podľa platných
				predpisov o ochrane osobných údajov.
			</p>
			<h3>Ako dlho údaje uchovávame</h3>
			<p>
				Údaje potrebné na účtovné a daňové účely uchovávame po dobu vyžadovanú právnymi predpismi. Údaje
				zákazníckeho účtu uchovávame počas jeho trvania. Údaje na zasielanie noviniek uchovávame do odvolania
				súhlasu.
			</p>
			<h3>Vaše práva</h3>
			<p>
				Máte právo na prístup k svojim údajom, ich opravu, vymazanie, obmedzenie spracúvania, prenosnosť a
				právo namietať proti spracúvaniu. Udelený súhlas môžete kedykoľvek odvolať, a to aj cez tlačidlo
				„Nastavenia súkromia“ v pätičke nášho webu. Svoje práva uplatníte na e-maile info@maky.store. Máte
				tiež právo podať sťažnosť Úradu na ochranu osobných údajov Slovenskej republiky, Hraničná 12, 820 07
				Bratislava 27,{" "}
				<a href="https://www.dataprotection.gov.sk" target="_blank" rel="noopener noreferrer">
					www.dataprotection.gov.sk
				</a>
				.
			</p>
			<h3>Automatizované rozhodovanie</h3>
			<p>Nevykonávame automatizované rozhodovanie ani profilovanie s právnymi účinkami pre dotknutú osobu.</p>
		</LegalPage>
	);
}
