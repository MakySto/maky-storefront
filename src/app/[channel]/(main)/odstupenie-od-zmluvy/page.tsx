import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { companyInfo } from "@/config/company";
import { hasAuthSession } from "@/lib/auth/has-auth-session";
import { newSubmissionId } from "@/lib/forms/payload-forms-client";
import { loadOwnedOrders, type OwnedOrder } from "@/lib/withdrawal/account-orders";
import { isWithdrawalFormServable, withdrawalBlockReason } from "@/lib/withdrawal/contract";
import { normalizeWithdrawalPhone } from "@/lib/withdrawal/validate";
import { LegalPage } from "@/ui/components/legal/legal-page";
import { WithdrawalForm } from "@/ui/components/withdrawal/withdrawal-form";
import { getCurrentUser, type AccountUser } from "../account/get-current-user";
import { submitWithdrawalAction } from "./actions";

/**
 * `/sk/odstupenie-od-zmluvy` — the online withdrawal function, plus the explanation.
 *
 * The function sits at the top of the page rather than behind another click, because
 * the requirement is that it be continuously and easily reachable. The explanation
 * follows it, and the statutory model form has its own printable route: three separate
 * things, two of which happen to share a page.
 *
 * ## Why this page is not cached
 *
 * Each render mints a `submissionId` that becomes the idempotency key for one form
 * attempt. Were the page prerendered or held in ISR, every visitor would be handed the
 * SAME id, and the second person to submit would silently receive the first person's
 * confirmation as a "duplicate" — their notice never stored, and a receipt that looks
 * perfectly convincing. Per-request rendering is therefore load-bearing here, not a
 * precaution.
 *
 * `export const dynamic = "force-dynamic"` is rejected outright under `cacheComponents`,
 * so the opt-out is `connection()`: it marks the render as depending on the incoming
 * request, which is exactly the claim being made. Relying on the `cookies()` read
 * inside `hasAuthSession()` would work today and silently stop working the moment that
 * call moved behind a Suspense boundary or an early return — far too subtle a thing for
 * a guarantee this load-bearing to rest on.
 */

const PATH = "/odstupenie-od-zmluvy";

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;

	// Non-SK channels 404 below; metadata must agree, or the 404 acquires a canonical.
	//
	// The online-function interlock deliberately does NOT appear here. It suppresses the
	// form, not the page: the legal content, the deadlines and the model-form link stay
	// reachable and indexable either way, and `sitemap.ts` lists this path.
	if (REVERSE_MAP[channel] !== "sk") return { robots: { index: false, follow: false } };

	// The description is the one place the interlock DOES show, because it makes a claim
	// about the page's contents. Promising an online form on a page that is currently
	// serving only the postal and e-mail routes would be a false statement in the SERP.
	return {
		title: formatPageTitle("Odstúpenie od zmluvy"),
		description: isWithdrawalFormServable()
			? "Vrátenie nákupu bez uvedenia dôvodu: online formulár, lehoty, spätná doprava a vrátenie peňazí. Odstúpenie môžete poslať aj e-mailom alebo poštou."
			: "Vrátenie nákupu bez uvedenia dôvodu: lehoty, spätná doprava a vrátenie peňazí. Odstúpenie môžete poslať e-mailom alebo poštou.",
		alternates: { canonical: marketHref(channel, PATH) },
	};
}

/**
 * A phone to offer as a default, from data this page already fetched.
 *
 * `CurrentUserProfile` — the query the account area runs, reused here — already returns
 * the customer's saved addresses, and `AddressDetails` already includes `phone`. So this
 * costs nothing and needs no change to a Saleor document, which would have required
 * sign-off (CLAUDE.md §10) and would not have been worth it for a convenience default.
 *
 * The default billing address wins, then the shipping one, then any address that has a
 * number at all. Anything the wire contract would refuse is dropped rather than offered:
 * prefilling a value the server will reject would hand the customer an error they did not
 * cause, on a field they never filled in.
 */
function prefillPhone(user: AccountUser): string | null {
	const addresses = user.addresses ?? [];
	const withId = (id: string | undefined) =>
		id ? addresses.find((address) => address?.id === id) : undefined;

	const candidates = [
		withId(user.defaultBillingAddress?.id),
		withId(user.defaultShippingAddress?.id),
		...addresses,
	];

	for (const candidate of candidates) {
		const normalized = normalizeWithdrawalPhone(candidate?.phone);
		if (normalized.ok && normalized.value) return normalized.value;
	}
	return null;
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	// Opt out of prerendering: every render must mint its own submissionId.
	await connection();

	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();

	// The online function can be switched off. The PAGE cannot.
	//
	// `/sk/odstupenie-od-zmluvy` has been live since the legal-pages release, sits in
	// `sitemap.ts`, and carries the statutory information a consumer needs in order to
	// withdraw at all — the deadlines, the e-mail and postal routes, and the model form.
	// An earlier version of this gate called `notFound()` here, which would have pulled a
	// legally required disclosure off a live site. Worse than that: under `cacheComponents`
	// a page-level `notFound()` does not even produce a 404 (see `src/proxy.ts`), so the
	// result would have been HTTP 200 serving the global English "Page Not Found".
	//
	// Suppressing the form is a product decision. Suppressing the page is a legal defect.
	const formServable = isWithdrawalFormServable();
	if (!formServable) {
		console.error(
			"[withdrawal] online-function-off",
			JSON.stringify({ path: PATH, reason: withdrawalBlockReason() }),
		);
	}

	// Account mode is a convenience and nothing more. Both of these staying empty is a
	// perfectly good outcome — requiring a session would make registration a condition
	// of exercising the right, which it must never be.
	let prefill: { name: string; email: string; phone: string | null } | null = null;
	let orders: OwnedOrder[] = [];

	if (await hasAuthSession()) {
		const [user, ownedOrders] = await Promise.all([getCurrentUser(), loadOwnedOrders()]);
		if (user) {
			prefill = {
				name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
				email: user.email,
				phone: prefillPhone(user),
			};
			orders = ownedOrders;
		}
	}

	const alternatives = { email: companyInfo.email, postalAddress: companyInfo.returnAddress };
	const modelFormHref = marketHref(channel, `${PATH}/vzorovy-formular`);

	return (
		<LegalPage title="Odstúpenie od zmluvy">
			<p>
				Tovar vám nevyhovuje alebo ste si nákup rozmysleli? Ako spotrebiteľ môžete od zmluvy odstúpiť{" "}
				<strong>bez uvedenia dôvodu do 14 dní od prevzatia tovaru</strong>. Registrovaným zákazníkom, ktorí
				objednávku vytvorili po prihlásení do svojho účtu, poskytujeme lehotu <strong>30 dní</strong>.
			</p>
			<p>
				Odstúpiť môžete aj pred doručením a tiež iba od časti objednávky. Na oznámenie nepotrebujete
				zákaznícky účet ani náš predchádzajúci súhlas.
			</p>

			{formServable ? (
				<section aria-labelledby="online-withdrawal" className="not-prose my-10">
					<h2 id="online-withdrawal" className="text-text-primary text-xl font-semibold">
						Online odstúpenie od zmluvy
					</h2>
					<p className="text-text-secondary mt-2 text-sm">
						Vyplňte svoje meno, údaje na identifikáciu objednávky a e-mail, na ktorý vám pošleme potvrdenie.
						Po kontrole údajov odošlite oznámenie tlačidlom „Potvrdiť odstúpenie od zmluvy“.
					</p>
					<p className="text-text-secondary mt-2 mb-6 text-sm">
						Potvrdenie o doručení oznámenia vám bezodkladne pošleme e-mailom. Bude obsahovať vaše oznámenie aj
						dátum a čas jeho odoslania. Toto potvrdenie si uschovajte.
					</p>
					<WithdrawalForm
						submissionId={newSubmissionId()}
						action={submitWithdrawalAction.bind(null, channel)}
						prefill={prefill}
						orders={orders}
						alternatives={alternatives}
						modelFormHref={modelFormHref}
					/>
				</section>
			) : null}

			<h2>{formServable ? "Odstúpenie e-mailom alebo poštou" : "Ako odstúpenie oznámiť"}</h2>
			<p>
				{formServable ? "Online formulár nie je jedinou možnosťou. Napíšte" : "Napíšte"} na{" "}
				<a href={`mailto:${companyInfo.email}`}>{companyInfo.email}</a> alebo pošlite jednoznačné oznámenie na
				adresu{" "}
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
			<address>
				{companyInfo.legalName}
				<br />
				Stará Vajnorská 11
				<br />
				831 04 Bratislava
				<br />
				{companyInfo.country}
			</address>
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
		</LegalPage>
	);
}
