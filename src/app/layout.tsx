import { GeistSans } from "geist/font/sans";
import Script from "next/script";
import "./globals.css";
import { type ReactNode } from "react";
import { rootMetadata } from "@/lib/seo";
import { DEFAULT_LOCALE, LOCALE_MAP } from "@/config/locale";

export const metadata = rootMetadata;

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const CF_WEB_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN;

export default function RootLayout(props: { children: ReactNode }) {
	const { children } = props;

	return (
		// No GeistMono. next/font preloads every font it is given — the mono face
		// was fetched at high priority on every page while the LCP image waited —
		// and nothing renders it: `font-mono` has no remaining use in src/, and the
		// `--font-mono` token in brand.css names "Geist Mono" while the @font-face
		// family is "GeistMono", so the utility never selected this file anyway.
		<html lang={LOCALE_MAP[DEFAULT_LOCALE].htmlLang} className={`${GeistSans.variable} min-h-dvh`}>
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
`,
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
