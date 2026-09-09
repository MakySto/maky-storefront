import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { marketHref } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { companyInfo } from "@/config/company";
import { hasAuthSession } from "@/lib/auth/has-auth-session";
import { newSubmissionId } from "@/lib/forms/payload-forms-client";
import { loadOwnedOrders, type OwnedOrder } from "@/lib/withdrawal/account-orders";
import { isWithdrawalFormServable, withdrawalBlockReason } from "@/lib/withdrawal/contract";
import { normalizeWithdrawalPhone } from "@/lib/withdrawal/validate";
import { legalLocaleFor, type LegalLocale } from "@/lib/legal/locale";
import { LegalPage } from "@/ui/components/legal/legal-page";
import { Cs, De, DeAt, Fr, Hu, It, Pl, Sk } from "@/ui/content/legal/odstupenie-od-zmluvy";
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

/**
 * Titles and the two descriptions, per approved legal language.
 *
 * Annotated rather than `as const` because `heading` is optional: under `as const` each
 * entry narrows to its own literal shape, so reading `META[locale].heading` fails on the
 * locales that do not set one. The annotation makes the optionality part of the type
 * instead of an accident of which entries happen to carry the key.
 */
interface WithdrawalMeta {
	/** The `<title>`. */
	readonly title: string;
	/** The `<h1>`, when the delivered copy distinguishes it from the title. */
	readonly heading?: string;
	readonly withForm: string;
	readonly withoutForm: string;
}

const META: Readonly<Record<LegalLocale, WithdrawalMeta>> = {
	sk: {
		title: "Odstúpenie od zmluvy",
		withForm:
			"Vrátenie nákupu bez uvedenia dôvodu: online formulár, lehoty, spätná doprava a vrátenie peňazí. Odstúpenie môžete poslať aj e-mailom alebo poštou.",
		withoutForm:
			"Vrátenie nákupu bez uvedenia dôvodu: lehoty, spätná doprava a vrátenie peňazí. Odstúpenie môžete poslať e-mailom alebo poštou.",
	},
	cs: {
		title: "Odstoupení od smlouvy",
		withForm:
			"Vrácení nákupu bez uvedení důvodu: online formulář, lhůty, zpětná doprava a vrácení peněz. Odstoupení můžete poslat i e-mailem nebo poštou.",
		withoutForm:
			"Vrácení nákupu bez uvedení důvodu: lhůty, zpětná doprava a vrácení peněz. Odstoupení můžete poslat e-mailem nebo poštou.",
	},
	// Germany and Austria name the right differently — Widerrufsrecht vs Rücktrittsrecht
	// — and the <h1> follows the local term. Only the `withoutForm` description is ever
	// served today (see `servesOnlineFunction`); `withForm` is kept so that the copy is
	// not what holds the activation up.
	//
	// ⚠️ Activation is NOT a one-line change, and an earlier version of this comment said
	// it was. Serving the form to a market needs, at minimum: Returns V2 accepting that
	// market and locale (the contract pins `market: "SK"` as a literal type), a receipt
	// that states something true about the times it names, the runtime gate, the
	// preview/active/outage prose and the metadata moving together, and M's release
	// approval. The delivered package puts it plainly: a static preview state is not a
	// lawful permanent substitute for the function.
	de: {
		title: "Widerrufsrecht",
		withForm:
			"So erklären Sie den Widerruf Ihres Kaufs bei MAKY.STORE: Online-Funktion, Fristen, Rücksendung, Erstattung und Muster-Widerrufsformular.",
		withoutForm:
			"So erklären Sie den Widerruf Ihres Kaufs bei MAKY.STORE. Informationen zu Fristen, Rücksendung, Erstattung und zum Muster-Widerrufsformular.",
	},
	deAt: {
		title: "Rücktrittsrecht",
		withForm:
			"Ihr Rücktrittsrecht beim Online-Kauf bei MAKY.STORE: Online-Funktion, Fristen, Erklärung, Rücksendung und Erstattung. Mit Muster-Widerrufsformular.",
		withoutForm:
			"Ihr Rücktrittsrecht beim Online-Kauf bei MAKY.STORE: Fristen, Erklärung, Rücksendung und Erstattung. Mit Muster-Widerrufsformular.",
	},
	// Only `withoutForm` is ever served for these two today, for the same reason as
	// de/deAt: `servesOnlineFunction` keeps the online function on `sk`. See the note
	// above on what activation actually costs — for Hungary it is a sales question rather
	// than a convenience one, because 45/2014 § 22 has required the function since
	// 2026-06-19.
	pl: {
		title: "Odstąpienie od umowy i zwrot towaru",
		heading: "Odstąpienie od umowy",
		withForm:
			"Odstąpienie od umowy w MAKY.STORE: formularz online, terminy, zwrot towaru, koszty przesyłki, zwrot pieniędzy i wzór oświadczenia.",
		withoutForm:
			"Prawo odstąpienia od umowy w MAKY.STORE: 14 dni, wydłużony termin dla zakupów po zalogowaniu, zwrot towaru, koszt przesyłki i formularz.",
	},
	hu: {
		title: "Elállási jog és visszaküldés",
		heading: "Elállási jog",
		withForm:
			"Az online vásárlástól való elállás feltételei: online elállási funkció, 14 nap, bejelentkezve leadott rendelésnél 30 nap, visszaküldés és visszatérítés.",
		withoutForm:
			"Az online vásárlástól való elállás feltételei: 14 nap, bejelentkezve leadott rendelésnél 30 nap, visszaküldés, visszatérítés és nyilatkozatminta.",
	},

	// Same again for it/fr, and here the two descriptions are the delivered
	// `withdrawalMetadata.withForm` / `.withoutForm` pair rather than something written
	// here — the package supplies both states precisely so that switching the function on
	// is not held up by copy, and so that the served description never claims an online
	// function the market does not have. Only `withoutForm` is reachable today.
	//
	// Both markets transposed the online-withdrawal duty with effect from 19 June 2026
	// (Italy: art. 54-bis Codice del consumo via D.lgs. 209/2025; France: art. D221-5 via
	// décret 2026-3). The preview state is therefore a gap to be closed by R and M before
	// these markets serve real purchases — not a lawful permanent substitute for the
	// function, and not something noindex resolves.
	it: {
		title: "Diritto di recesso e restituzione",
		heading: "Diritto di recesso",
		withForm:
			"Recesso dagli acquisti MAKY.STORE: funzione online, termini di 14 o 30 giorni secondo l’acquisto, reso, costi, rimborso e modulo facoltativo.",
		withoutForm:
			"Recesso dagli acquisti MAKY.STORE: 14 giorni, 30 per ordini effettuati dopo l’accesso, restituzione, rimborso e modulo facoltativo da stampare.",
	},
	fr: {
		title: "Droit de rétractation et retour",
		heading: "Droit de rétractation",
		withForm:
			"Rétractation chez MAKY.STORE : fonction en ligne, délais de 14 ou 30 jours selon l’achat, retour, frais, remboursement et formulaire facultatif.",
		withoutForm:
			"Rétractation chez MAKY.STORE : délai de 14 jours, porté à 30 pour les achats en étant connecté, retour, frais, remboursement et formulaire à imprimer.",
	},
};

/**
 * Whether the online function is served for this market.
 *
 * Two independent conditions, and both are load-bearing. The interlock is operational —
 * it says the Payload backend is ready. The locale check is contractual: Returns V2 pins
 * `market: "SK"` and `locale: "sk"` as literal types, so a notice submitted from any
 * other market is rejected by the endpoint that stores it. Rendering the form on /cz
 * would offer a Czech customer a button that cannot produce a record — which is the one
 * outcome this whole feature exists to prevent.
 */
function servesOnlineFunction(channel: string): boolean {
	return isWithdrawalFormServable() && legalLocaleFor(channel) === "sk";
}

export async function generateMetadata(props: { params: Promise<{ channel: string }> }): Promise<Metadata> {
	const { channel } = await props.params;
	const locale = legalLocaleFor(channel);

	// Markets with no approved copy 404 below; metadata must agree, or the 404 acquires
	// a canonical.
	if (!locale) return { robots: { index: false, follow: false } };

	const meta = META[locale];
	return {
		title: formatPageTitle(meta.title),
		// The interlock DOES show here, because this makes a claim about the page's
		// contents. Promising an online form on a page currently serving only the postal
		// and e-mail routes would be a false statement in the SERP.
		description: servesOnlineFunction(channel) ? meta.withForm : meta.withoutForm,
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
	const locale = legalLocaleFor(channel);
	if (!locale) notFound();

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
	const formServable = servesOnlineFunction(channel);
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

	const BODIES = { sk: Sk, cs: Cs, de: De, deAt: DeAt, pl: Pl, hu: Hu, it: It, fr: Fr } as const;
	const Body = BODIES[locale];
	const form = formServable ? (
		<section aria-labelledby="online-withdrawal" className="not-prose my-10">
			<h2 id="online-withdrawal" className="text-text-primary text-xl font-semibold">
				Online odstúpenie od zmluvy
			</h2>
			<p className="text-text-secondary mt-2 text-sm">
				Vyplňte svoje meno, údaje na identifikáciu objednávky a e-mail, na ktorý vám pošleme potvrdenie. Po
				kontrole údajov odošlite oznámenie tlačidlom „Potvrdiť odstúpenie od zmluvy“.
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
	) : null;

	// The form section is Slovak-only by construction (see `servesOnlineFunction`), so it
	// is built here rather than inside the body — a Czech body must never be handed a
	// Slovak form to place.
	return (
		// Same rule as `legalRoute`: the <h1> is the heading when the delivered copy
		// distinguishes it from the <title>, and the title otherwise.
		<LegalPage title={META[locale].heading ?? META[locale].title}>
			<Body channel={channel} form={form} modelFormHref={modelFormHref} />
		</LegalPage>
	);
}
