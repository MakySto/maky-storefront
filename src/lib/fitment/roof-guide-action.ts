"use server";

/**
 * The link from the selector's roof question to the guide that explains the roof types.
 *
 * Its own action, apart from `loadSelectorStep`: the steps are read from the fitment dataset alone,
 * and this is the one thing the roof question takes from the CMS. Asked once, when the question is
 * first shown. `null` in every case in which there is nothing to link to (the market has no guide,
 * the guide has no roof section, the CMS did not answer): the quick explanation in the window stands
 * on its own, and a shopper is never sent to a page that does not hold what the link promised.
 */

import { ADVICE_GUIDE_SLUG, getAdviceGuide, roofGuidePath } from "@/lib/cms/advice-guide";
import { cmsRouteAvailable } from "@/lib/cms/availability";

export async function loadRoofGuidePath(channel: string | undefined): Promise<string | null> {
	if (!channel) return null;
	try {
		if (!(await cmsRouteAvailable(channel, ADVICE_GUIDE_SLUG))) return null;
		return roofGuidePath(await getAdviceGuide(channel));
	} catch {
		return null;
	}
}
