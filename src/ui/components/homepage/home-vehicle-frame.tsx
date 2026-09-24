import { type ReactNode } from "react";
import { CarIcon } from "lucide-react";

/** The panel, shared with the skeleton so the two are the same size. */
export function HomeVehicleFrame({
	title,
	body,
	children,
}: {
	title: string;
	body: string;
	children: [ReactNode, ReactNode];
}) {
	const [fields, action] = children;
	return (
		<section className="max-w-page mx-auto px-4 pb-4 sm:px-6 lg:px-8">
			<div className="border-border-subtle bg-surface-card relative isolate overflow-hidden rounded-sm border shadow-sm">
				<div
					aria-hidden="true"
					className="from-surface-secondary absolute inset-y-0 right-0 -z-10 hidden w-1/2 bg-linear-to-l to-transparent md:block"
				/>
				<div
					aria-hidden="true"
					className="art-mountains bg-sand-400/70 absolute right-0 bottom-0 -z-10 hidden h-[88%] w-[46%] md:block"
				/>
				<div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,44rem)_auto] lg:items-end lg:gap-8 lg:p-10">
					<div>
						<div className="flex items-center gap-3">
							<span className="bg-status-success-bg text-status-success flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
								<CarIcon className="h-5 w-5" aria-hidden="true" />
							</span>
							<h2 className="text-text-primary text-xl font-bold tracking-[-0.02em] sm:text-2xl">{title}</h2>
						</div>
						<p className="text-text-secondary mt-2 max-w-xl text-[0.9375rem]">{body}</p>
						<div className="mt-6">{fields}</div>
					</div>
					{action}
				</div>
			</div>
		</section>
	);
}
