import { getTranslations } from "next-intl/server";
import { REVERSE_MAP } from "@/lib/channel-map";
import { contactFormBlockReason, isContactFormServable } from "@/lib/contact/servable";
import { ContactForm } from "./contact-form";

/**
 * The contact form section, or nothing.
 *
 * Only the FORM is gated. `/kontakt` is a legally required disclosure and is served in
 * all twelve markets whatever this returns — when the form is off the page still shows
 * the address, the e-mail, the phone number and the statutory identifiers, which is the
 * part the law actually asks for. The absence is logged with a reason so it is never a
 * silent omission somebody has to go looking for.
 *
 * The `submissionId` is minted by the form itself, once, and travels unchanged with
 * every attempt the visitor makes — that is what lets the provider's unique index turn
 * a retry into a replay instead of a second message. It is not minted here because
 * `randomUUID()` in a prerendered Server Component is a build error under
 * `cacheComponents`, and it does not need to be: it must be unique, not secret.
 */
export async function ContactSection({ channel }: { channel: string }) {
	const market = REVERSE_MAP[channel] ?? "";

	if (!isContactFormServable(market)) {
		console.info(
			"[contact] form-off",
			JSON.stringify({ channel, market, reason: contactFormBlockReason(market) }),
		);
		return null;
	}

	const t = await getTranslations("contact");

	return (
		<section aria-labelledby="contact-form-heading" className="mt-10">
			<h2 id="contact-form-heading">{t("heading")}</h2>
			<p>{t("intro")}</p>
			<ContactForm channel={channel} />
		</section>
	);
}
