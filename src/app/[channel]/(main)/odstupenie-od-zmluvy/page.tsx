import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { REVERSE_MAP, marketHref } from "@/lib/channel-map";
import { formatPageTitle } from "@/config/brand";
import { companyInfo } from "@/config/company";
import { hasAuthSession } from "@/lib/auth/has-auth-session";
import { newSubmissionId } from "@/lib/forms/payload-forms-client";
import { loadOwnedOrders, type OwnedOrder } from "@/lib/withdrawal/account-orders";
import { LegalPage } from "@/ui/components/legal/legal-page";
import { WithdrawalForm } from "@/ui/components/withdrawal/withdrawal-form";
import { getCurrentUser } from "../account/get-current-user";
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
	if (REVERSE_MAP[channel] !== "sk") return { robots: { index: false, follow: false } };

	return {
		title: formatPageTitle("Odstúpenie od zmluvy"),
		description:
			"Odstúpte od zmluvy online. Po odoslaní dostanete potvrdenie s číslom podania a presným časom prijatia.",
		alternates: { canonical: marketHref(channel, PATH) },
	};
}

export default async function Page(props: { params: Promise<{ channel: string }> }) {
	// Opt out of prerendering: every render must mint its own submissionId.
	await connection();

	const { channel } = await props.params;
	if (REVERSE_MAP[channel] !== "sk") notFound();

	// Account mode is a convenience and nothing more. Both of these staying empty is a
	// perfectly good outcome — requiring a session would make registration a condition
	// of exercising the right, which it must never be.
	let prefill: { name: string; email: string } | null = null;
	let orders: OwnedOrder[] = [];

	if (await hasAuthSession()) {
		const [user, ownedOrders] = await Promise.all([getCurrentUser(), loadOwnedOrders()]);
		if (user) {
			prefill = {
				name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
				email: user.email,
			};
			orders = ownedOrders;
		}
	}

	const alternatives = { email: companyInfo.email, postalAddress: companyInfo.returnAddress };
	const modelFormHref = marketHref(channel, `${PATH}/vzorovy-formular`);

	return (
		<LegalPage title="Odstúpenie od zmluvy">
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
				Okrem formulára vyššie nám odstúpenie môžete oznámiť e-mailom na {companyInfo.email} alebo zaslaním
				vyplneného <a href={modelFormHref}>vzorového formulára</a> e-mailom či poštou na adresu{" "}
				{companyInfo.returnAddress}. Po prijatí oznámenia vám potvrdíme jeho prijatie.
			</p>
			<p>
				Tovar nám zašlite najneskôr do 14 dní od odstúpenia. Vrátenie platby prebehne po splnení podmienok
				uvedených vo Všeobecných obchodných podmienkach.
			</p>
		</LegalPage>
	);
}
