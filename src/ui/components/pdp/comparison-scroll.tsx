"use client";

import { useEffect } from "react";

/**
 * The comparison table scrolls sideways when the box it is in is narrower than the table, and the
 * model the customer is looking at can then be off to the right — on CoolZ 83 it is the last column.
 * Once the page is up, move each table so the current model's column stands directly beside the
 * fixed first column. Only the table's own box is scrolled (`scrollLeft`), never the page, and
 * a table that fits is left alone.
 *
 * The table itself is server-rendered HTML (`parseEditorJSToHtml`), complete and readable without
 * this: it only decides where the table starts.
 */
export function ComparisonScrollToCurrent() {
	useEffect(() => {
		for (const region of document.querySelectorAll<HTMLElement>(".maky-cmp-scroll")) {
			if (region.scrollWidth <= region.clientWidth) continue;
			const current = region.querySelector<HTMLElement>("thead th.maky-cmp-self");
			const fixed = region.querySelector<HTMLElement>("thead th:first-child");
			if (!current || !fixed) continue;
			region.scrollLeft = Math.max(0, current.offsetLeft - fixed.offsetWidth);
		}
	}, []);

	return null;
}
