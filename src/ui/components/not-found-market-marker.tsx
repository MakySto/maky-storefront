"use client";

import { useEffect } from "react";

/**
 * The same marking the inline script of the static 404 does, for the one case that script does
 * not run in: the page arriving through a client-side navigation, where React inserts a
 * `<script>` element without executing it. `locales` is passed in (market → language tag) so the
 * twelve message files stay on the server.
 */
export function NotFoundMarketMarker({
	attribute,
	locales,
}: {
	attribute: string;
	locales: Readonly<Record<string, string>>;
}) {
	useEffect(() => {
		const market = window.location.pathname.split("/")[1] ?? "";
		if (!Object.prototype.hasOwnProperty.call(locales, market)) return;
		const root = document.documentElement;
		root.setAttribute(attribute, market);
		root.lang = locales[market]!;
	}, [attribute, locales]);

	return null;
}
