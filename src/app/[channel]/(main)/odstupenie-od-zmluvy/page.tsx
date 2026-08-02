import { type Metadata } from "next";
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

	return {
		title: formatPageTitle("Odstúpenie od zmluvy"),
		description:
			"Odstúpte od zmluvy online. Po odoslaní dostanete potvrdenie s číslom podania a presným časom prijatia.",
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
			{formServable ? (
				<section aria-labelledby="online-withdrawal" className="not-prose mb-10">
					<h2 id="online-withdrawal" className="text-text-primary text-xl font-semibold">
						Odstúpiť od zmluvy online
					</h2>
					<p className="text-text-secondary mt-2 mb-6 text-sm">
						Vyplňte formulár nižšie. Hneď po odoslaní vám zobrazíme potvrdenie s číslom podania a presným
						dátumom a časom, kedy sme oznámenie prijali. Prihlásenie nie je potrebné.
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

			<h2>Ako odstúpenie funguje</h2>
			<p>
				Ak ste spotrebiteľ, môžete od zmluvy odstúpiť bez uvedenia dôvodu do 14 dní od prevzatia tovaru.
				Registrovaným zákazníkom, ktorí objednávku vytvorili po prihlásení do svojho zákazníckeho účtu,
				poskytujeme predĺženú lehotu 30 dní.
			</p>
			<p>
				Odstúpiť môžete aj skôr, než vám tovar doručíme, a odstúpiť môžete od celej objednávky alebo len od
				niektorých položiek.
			</p>
			<p>
				{formServable ? "Okrem formulára vyššie nám" : "Odstúpenie nám"} môžete oznámiť e-mailom na{" "}
				{companyInfo.email} alebo zaslaním vyplneného <a href={modelFormHref}>vzorového formulára</a> e-mailom
				či poštou na adresu {companyInfo.returnAddress}. Po prijatí oznámenia vám potvrdíme jeho prijatie.
			</p>

			<h2>Zvoz tovaru zabezpečíme my</h2>
			<p>
				Tovar zatiaľ neposielajte. Ozveme sa vám e-mailom s presnou cenou zvozu a navrhneme termín
				vyzdvihnutia.
			</p>
			<p>
				Náklady na spätnú prepravu znášate vy. Presnú cenu vám oznámime vopred. Zvoz objednáme až po vašom
				výslovnom súhlase.
			</p>
			<p>Ak potrebujete zabezpečiť dopravu vlastným spôsobom, kontaktujte nás pred odoslaním tovaru.</p>
			<p>K tovaru priložte číslo podania, ktoré dostanete po odoslaní odstúpenia.</p>

			<h2>Adresa na vrátenie tovaru</h2>
			<p>Ak sa s nami dohodnete na odoslaní tovaru vlastnou dopravou, použite túto adresu:</p>
			<address>
				{companyInfo.legalName}
				<br />
				Stará Vajnorská 11
				<br />
				831 04 Bratislava
			</address>

			<h2>Vrátenie platieb</h2>
			<p>
				Platby v rozsahu vášho odstúpenia vám vrátime najneskôr do 14 dní odo dňa, keď nám bolo doručené vaše
				oznámenie o odstúpení. Vrátime ich rovnakým spôsobom, akým ste platili, ak sa spolu bez ďalších
				poplatkov nedohodneme inak.
			</p>
		</LegalPage>
	);
}
