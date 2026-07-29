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
 * The company block is NOT duplicated here: both this fallback and the CMS path
 * render `<CompanyDetails />` from `@/config/company`, so the legal identifiers
 * have one source and the two paths render the same thing.
 */
export function ONasStaticContent() {
	return (
		<>
			<p>
				MAKY.STORE je slovenský internetový obchod s praktickým auto-moto príslušenstvom pre každodenné
				používanie, cestovanie, šport a voľný čas.
			</p>
			<p>
				Zameriavame sa najmä na produkty, ktoré pomáhajú bezpečne a pohodlne prevážať vybavenie autom —
				strešné nosiče, strešné boxy, nosiče bicyklov, nosiče lyží, snehové reťaze, autochladničky, ťažné
				zariadenia a súvisiace príslušenstvo.
			</p>
			<p>
				Našou pridanou hodnotou je dôraz na správnu kompatibilitu. Pri produktoch sa snažíme čo
				najzrozumiteľnejšie uvádzať, pre ktoré vozidlá sú vhodné, aby si zákazník vedel vybrať riešenie, ktoré
				bude na jeho auto naozaj sedieť.
			</p>
			<p>
				Chceme ponúkať overené produkty, férový prístup a zrozumiteľné informácie bez zbytočne komplikovaného
				technického jazyka. Ak si zákazník nie je istý výberom, môže nás kontaktovať a radi mu pomôžeme nájsť
				vhodné riešenie.
			</p>
		</>
	);
}
