import { type ReactNode } from "react";
import { CarIcon } from "lucide-react";

/**
 * The panel, shared with the skeleton so the two are the same size: a warm light band with the
 * mountains drawn along its right side, the title and the fields on its left — the approved
 * homepage's "Vyberte svoje vozidlo" (second pass, 2026-09-24).
 */
export function HomeVehicleFrame({
	title,
	body,
	children,
}: {
	title: string;
	body: string;
	children: ReactNode;
}) {
	return (
		<section className="max-w-page mx-auto px-4 pb-4 sm:px-6 lg:px-8">
			<div className="border-border-subtle bg-surface-muted relative isolate overflow-hidden rounded-sm border shadow-xs">
				<div
					aria-hidden="true"
					className="from-surface-card/70 absolute inset-y-0 left-0 -z-10 w-2/3 bg-linear-to-r to-transparent"
				/>
				<div
					aria-hidden="true"
					className="art-mountains bg-sand-500/70 absolute right-0 bottom-0 -z-10 hidden h-full w-[40%] md:block"
				/>
				<div
					aria-hidden="true"
					className="art-mountains bg-sand-400/60 absolute right-[18%] bottom-0 -z-10 hidden h-[70%] w-[34%] -scale-x-100 lg:block"
				/>
				<div className="p-5 sm:p-8 lg:px-10 lg:py-9">
					<div className="flex items-center gap-3">
						<span className="bg-cta text-cta-text flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm">
							<CarIcon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
						</span>
						<h2 className="text-text-primary text-2xl font-extrabold tracking-[-0.025em] sm:text-[1.75rem]">
							{title}
						</h2>
					</div>
					<p className="text-text-secondary mt-2 max-w-xl text-[0.9375rem] sm:text-base">{body}</p>
					<div className="mt-6">{children}</div>
				</div>
			</div>
		</section>
	);
}
