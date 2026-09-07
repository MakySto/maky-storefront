import Link from "next/link";

/**
 * The original hand-written body of `/sk/o-nas`, kept as the durable fallback for
 * the CMS-backed route.
 *
 * This is the whole last-known-good story, and it is deliberately not a snapshot
 * layer. A file on disk survives a build, a `pm2 restart`, `rm -rf .next` and a git
 * rollback for free, with no directory to provision, no atomic-write dance, no
 * ownership or retention policy, and nothing to go stale in a way nobody notices.
 * Next's fetch cache cannot make any of those claims: measured on this box, every
 * deploy starts with an empty `.next/cache/fetch-cache`, so ISR alone would leave
 * the page with nothing to serve if Payload happened to be down after a deploy.
 *
 * A real snapshot layer becomes necessary when the CMS holds a page that never
 * existed in code — that is a blog/homepage problem, not this one.
 *
 * IMPORTANT: updating this file does NOT change what visitors see. Payload is
 * authoritative for `/sk/o-nas`; this body renders only when the CMS read fails.
 * New copy has to be published in Payload as well, or the two will disagree and
 * only an outage will reveal it.
 *
 * The company block is NOT duplicated here: both this fallback and the CMS path
 * render `<CompanyDetails />` from `@/config/company`, so the legal identifiers
 * have one source and the two paths render the same thing.
 */
export function ONasStaticContent() {
	return (
		<>
			<h2>Výbava pre auto. Viac možností na cesty.</h2>
			<p>
				Bicykle na víkend, lyže na hory alebo batožina na rodinnú dovolenku. Niekedy stačí pridať trochu
				miesta, inokedy treba nájsť spôsob, ako všetko previezť. Práve s tým vám v MAKY.STORE pomôžeme.
			</p>
			<p>
				Sme slovenský internetový obchod so strešnými nosičmi, boxmi, nosičmi bicyklov a ďalšou výbavou pre
				auto a cestovanie. Nájdete u nás aj ťažné zariadenia, nosiče lyží, snehové reťaze, autochladničky a
				príslušenstvo.
			</p>

			<h2>Dôležité je vybrať správne</h2>
			<p>
				Pri nosiči nestačí, že dobre vyzerá. Musí byť vhodný na vaše auto aj na to, čo chcete prevážať.
				Rozhodovať môže rok výroby, typ strechy, spôsob uchytenia či obsah montážnej súpravy.
			</p>
			<p>
				Pomôžeme vám tieto rozdiely rozlíšiť. Ak si nie ste istí, napíšte nám, aké máte auto a na čo výbavu
				potrebujete. Pozrieme sa na konkrétne možnosti, nie iba na názov produktu.
			</p>
			<p>
				Nie každý potrebuje najdrahší model. Dôležité je vedieť, čo od výbavy očakávate, čo je súčasťou
				balenia a za ktoré vlastnosti má pre vás zmysel priplatiť.
			</p>

			<h2>Aj po nákupe</h2>
			<p>
				Nákupom sa otázky nemusia skončiť. Niekedy potrebujete poradiť s príslušenstvom, inokedy nájsť
				náhradný diel alebo vyriešiť problém s výrobkom. Ozvite sa nám aj vtedy. Pomôžeme vám zistiť, aké
				riešenie prichádza do úvahy.
			</p>
			<p>
				Chceme, aby príprava na cestu bola jednoduchšia — a aby výbava slúžila tomu, kvôli čomu si ju
				kupujete. Výletu, dovolenke alebo obyčajnému dobrému víkendu.
			</p>
			<p>
				<strong>
					Potrebujete poradiť? <Link href="/sk/kontakt">Kontaktujte nás</Link>.
				</strong>
			</p>
			<p>
				Internetový obchod prevádzkuje MAKY.STORE s. r. o. Firemné a fakturačné údaje nájdete na stránke{" "}
				<Link href="/sk/kontakt">Kontakt</Link>.
			</p>
		</>
	);
}
