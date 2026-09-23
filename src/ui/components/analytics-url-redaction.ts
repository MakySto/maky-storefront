/**
 * Analytics must never see an access value that rides in a URL.
 *
 * Some URLs of this shop carry a credential in their query string, and today they cannot stop
 * doing so without touching checkout logic:
 *
 * - `/checkout?checkout=<id>`: the checkout id opens the checkout, with its e-mail, addresses and
 *   phone, and it stays in the URL for the whole checkout.
 * - the Stripe return: `payment_intent`, `payment_intent_client_secret`, `redirect_status`, plus
 *   the Saleor `transaction` id that `buildStripeReturnUrl` adds.
 * - password reset and account confirmation: Saleor appends `email` and `token` to the redirect
 *   URL, which lands on `/{market}/login` or back on `/checkout`. Account deletion appends `token`
 *   to the market home.
 * - `order`: the proxy removes it before a page loads (`src/lib/order-confirmation-handoff.ts`),
 *   and it stays here for a request that ever slips past it.
 *
 * The Google tag in GTM-5HNB9CTJ (GA4 G-95LGZXT9W9 + Google Ads AW-863129663) sends the page URL
 * as `page_location`, and the URL of the previous page as `page_referrer`, on every page_view,
 * cookieless consent ping, remarketing and conversion-linker hit. Measured on 2026-09-23 against
 * the live container with every Google request intercepted: the order, checkout and Stripe
 * values all went out, with and without consent.
 *
 * What this script does, before the container loads, and why each part is needed:
 *
 * 1. `gtag("set", { page_location, page_referrer })` with the access values replaced by a fixed
 *    placeholder, when the address or `document.referrer` carries one. GA4 and Ads both honour
 *    it on the load of the page and for the referrer of the next one (verified per endpoint).
 * 2. It does NOT reach the page_view GA4 sends on a history change (a checkout step, a client-side
 *    navigation): that event takes `gtm.newUrl` / `gtm.oldUrl` from its history listener as
 *    explicit parameters, which beat anything set. Those two fields travel through
 *    `dataLayer.push`, so the push is wrapped and they are rewritten in place before the tag
 *    reads them. Verified: without this the step change leaked the checkout id and the Stripe
 *    client secret; with it, nothing did.
 * 3. After a history change the set values would otherwise stay those of the landing URL, so
 *    once they are in use they follow the address bar (pushState, replaceState, popstate).
 *    That keeps the data right; the privacy part is 1 and 2.
 *
 * Only query parameter VALUES change; names and every other parameter stay, so funnels and
 * reports keep working. It runs in the beforeInteractive consent script and never changes how
 * or when the tag manager loads.
 *
 * ES5 on purpose: it is inlined as a string and executed as is, not compiled.
 */
export const ACCESS_PARAMS = [
	"order",
	"checkout",
	"token",
	"email",
	"payment_intent",
	"payment_intent_client_secret",
	"redirect_status",
	"transaction",
] as const;

export const REDACTED_VALUE = "redacted";

export const analyticsUrlRedactionScript = `
(function () {
	if (typeof URL !== "function" || !window.dataLayer) return;
	var KEYS = ${JSON.stringify(ACCESS_PARAMS)};
	var MARK = ${JSON.stringify(REDACTED_VALUE)};
	function scrub(href) {
		if (typeof href !== "string" || href.indexOf("?") < 0) return href;
		var u;
		try { u = new URL(href); } catch (e) { return href; }
		var hit = false;
		for (var i = 0; i < KEYS.length; i++) {
			if (u.searchParams.has(KEYS[i])) { u.searchParams.set(KEYS[i], MARK); hit = true; }
		}
		return hit ? u.href : href;
	}
	var active = false;
	function setUrls(loc, ref, both) {
		var l = scrub(loc), r = scrub(ref), o = {}, n = 0;
		if (both || l !== loc) { o.page_location = l; n++; }
		if (both || r !== ref) { o.page_referrer = r; n++; }
		if (n) { active = true; gtag("set", o); }
	}
	setUrls(location.href, document.referrer, false);

	var push = dataLayer.push;
	dataLayer.push = function () {
		for (var i = 0; i < arguments.length; i++) {
			var m = arguments[i];
			if (m && typeof m === "object") {
				if (typeof m["gtm.newUrl"] === "string") m["gtm.newUrl"] = scrub(m["gtm.newUrl"]);
				if (typeof m["gtm.oldUrl"] === "string") m["gtm.oldUrl"] = scrub(m["gtm.oldUrl"]);
			}
		}
		return push.apply(this, arguments);
	};

	var last = location.href;
	function follow() {
		var now = location.href;
		if (now === last) return;
		var prev = last;
		last = now;
		if (active || scrub(now) !== now || scrub(prev) !== prev) setUrls(now, prev, true);
	}
	["pushState", "replaceState"].forEach(function (name) {
		var original = history[name];
		if (typeof original !== "function") return;
		history[name] = function () {
			var result = original.apply(this, arguments);
			try { follow(); } catch (e) {}
			return result;
		};
	});
	window.addEventListener("popstate", function () { try { follow(); } catch (e) {} });
})();
`;
