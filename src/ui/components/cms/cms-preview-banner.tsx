import { type ReactNode } from "react";
import { CMS_PREVIEW_COPY } from "@/lib/cms/preview-copy";

/**
 * The strip above a CMS draft preview: "Náhľad konceptu — nie je verejný", and the way out.
 *
 * The exit is a plain `<a>` on purpose. Next prefetches a `<Link>`, and prefetching the exit
 * route would switch the preview off before the editor ever clicked it.
 */
export function CmsPreviewBanner({ exitHref }: { exitHref: string }): ReactNode {
	return (
		<div
			role="status"
			className="border-status-warning-border bg-status-warning-bg text-status-warning border-b"
		>
			<div className="max-w-page mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 text-sm sm:px-6 lg:px-8">
				<p className="font-semibold">{CMS_PREVIEW_COPY.banner}</p>
				<a href={exitHref} rel="nofollow" className="font-semibold underline underline-offset-2">
					{CMS_PREVIEW_COPY.exit}
				</a>
			</div>
		</div>
	);
}

/** `/api/cms/preview/exit`, returning to `path` once the preview is off. */
export function cmsPreviewExitHref(path: string): string {
	return `/api/cms/preview/exit?path=${encodeURIComponent(path)}`;
}
