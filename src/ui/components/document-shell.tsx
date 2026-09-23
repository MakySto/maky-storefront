import { GeistSans } from "geist/font/sans";
import Script from "next/script";
import { type ReactNode } from "react";

import { analyticsUrlRedactionScript } from "./analytics-url-redaction";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const CF_WEB_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN;

/**
 * The `<html>` document every root layout renders.
 *
 * There are two root layouts, and that is what lets `lang` be true. `<html>` can only be
 * emitted by a root layout, and a root layout at `app/` has no `params` — `[channel]` sits
 * below it — so a single root could only ever hardcode one language. It hardcoded `sk`, and
 * all twelve markets were served `lang="sk"`; a client effect corrected it after hydration,
 * which is invisible to anything that does not run JavaScript and arrives too late for a
 * screen reader's first announcement.
 *
 * So the market segment owns its own document (`app/[channel]/layout.tsx`) and everything
 * without a market shares another (`app/(site)/layout.tsx`). The chrome that must be
 * identical in both — fonts, consent defaults, tag manager, analytics — lives here rather
 * than being copied into each, because a consent default that drifts between two roots is
 * the kind of difference nobody notices until it matters.
 *
 * No GeistMono. next/font preloads every font it is given — the mono face was fetched at
 * high priority on every page while the LCP image waited — and nothing renders it:
 * `font-mono` has no remaining use in src/, and the `--font-mono` token in brand.css names
 * "Geist Mono" while the @font-face family is "GeistMono", so the utility never selected
 * this file anyway.
 *
 * The sans face had the same mismatch and nobody noticed until 2026-09-22: `--font-sans`
 * named "Geist" while next/font declares "GeistSans", so this preload ran on every page and
 * the text was drawn in the visitor's system font. brand.css now reads `--font-geist-sans`,
 * the variable this class sets on <html>, and `brand-fonts.test.ts` keeps it that way.
 */
export function DocumentShell({ lang, children }: { lang: string; children: ReactNode }) {
	return (
		<html lang={lang} className={`${GeistSans.variable} min-h-dvh`}>
			<body className="min-h-dvh font-sans">
				{GTM_ID ? (
					<noscript>
						<iframe
							src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
							height="0"
							width="0"
							style={{ display: "none", visibility: "hidden" }}
							title="Google Tag Manager"
						/>
					</noscript>
				) : null}

				{/* No <SpeedInsights />. It only works on Vercel's platform; this site is
				    served by PM2 behind nginx, so its script 404s and the browser refuses
				    the HTML response as `text/html`. It has never reported a single metric.
				    Cloudflare Web Analytics below is the one that actually works. */}
				{children}

				{GTM_ID ? (
					<>
						{/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document --
						    The rule recognises `app/layout.tsx` and this file is not one, but it IS
						    rendered by both root layouts and nothing else — which is exactly the
						    position the rule is protecting. The strategy is load-bearing: the consent
						    defaults must be in dataLayer before the container below can read them, and
						    so must the URL redaction appended to them (./analytics-url-redaction.ts),
						    which keeps checkout, Stripe and password-reset values out of every hit. */}
						<Script
							id="maky-consent-default"
							strategy="beforeInteractive"
							dangerouslySetInnerHTML={{
								__html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  personalization_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});
try {
  var s = JSON.parse(localStorage.getItem('maky-consent') || 'null');
  if (s && s.consent) { gtag('consent', 'update', s.consent); }
} catch (e) {}
${analyticsUrlRedactionScript}`,
							}}
						/>
						{/* lazyOnload, not afterInteractive. The container and gtag/js are
						    304 KB — 49% of all script bytes on the page — and they land in
						    the middle of the TBT window: measured 183 ms of blocking time
						    out of 284 ms total, and blocking both of them moved TBT from
						    284 to 103 ms. Loading during idle after `load` keeps every tag,
						    GA4, Ads and Consent Mode exactly as they are; it only stops them
						    competing with the page's own hydration. The consent defaults
						    above stay beforeInteractive, so dataLayer still carries the
						    denied state before the container ever reads it. */}
						<Script
							id="maky-gtm"
							strategy="lazyOnload"
							dangerouslySetInnerHTML={{
								__html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');
`,
							}}
						/>
					</>
				) : null}

				{CF_WEB_ANALYTICS_TOKEN ? (
					<Script
						id="cf-web-analytics"
						src="https://static.cloudflareinsights.com/beacon.min.js"
						strategy="afterInteractive"
						data-cf-beacon={JSON.stringify({ token: CF_WEB_ANALYTICS_TOKEN })}
					/>
				) : null}
			</body>
		</html>
	);
}
