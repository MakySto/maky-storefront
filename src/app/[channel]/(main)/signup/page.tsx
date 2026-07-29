import { Suspense } from "react";
import { SignUpForm } from "@/ui/components/sign-up-form";

export const metadata = {
	title: "Create Account",
	description: "Create a new account to save your addresses and order history.",
	// Kept out of the index by a robots.txt Disallow until now. That rule had to go
	// so Googlebot can see the 404s on the junk URLs it already indexed, and a
	// disallowed URL can never be de-indexed. noindex is the right mechanism for a
	// page that should not rank but must stay crawlable.
	robots: { index: false, follow: true },
};

export default function SignUpPage() {
	return (
		<Suspense fallback={<SignUpSkeleton />}>
			<section className="mx-auto max-w-7xl p-8 pb-24">
				<SignUpForm />
			</section>
		</Suspense>
	);
}

function SignUpSkeleton() {
	return (
		<section className="mx-auto max-w-7xl p-8 pb-24">
			<div className="mx-auto my-16 w-full max-w-md">
				<div className="border-border bg-card rounded-lg border p-8 shadow-sm">
					<div className="mb-6 flex flex-col items-center gap-2">
						<div className="bg-secondary h-7 w-44 animate-pulse rounded" />
						<div className="bg-secondary h-4 w-52 animate-pulse rounded" />
					</div>
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<div className="bg-secondary h-4 w-20 animate-pulse rounded" />
								<div className="bg-secondary h-12 w-full animate-pulse rounded-md" />
							</div>
							<div className="space-y-1.5">
								<div className="bg-secondary h-4 w-20 animate-pulse rounded" />
								<div className="bg-secondary h-12 w-full animate-pulse rounded-md" />
							</div>
						</div>
						<div className="space-y-1.5">
							<div className="bg-secondary h-4 w-24 animate-pulse rounded" />
							<div className="bg-secondary h-12 w-full animate-pulse rounded-md" />
						</div>
						<div className="space-y-1.5">
							<div className="bg-secondary h-4 w-16 animate-pulse rounded" />
							<div className="bg-secondary h-12 w-full animate-pulse rounded-md" />
						</div>
						<div className="space-y-1.5">
							<div className="bg-secondary h-4 w-32 animate-pulse rounded" />
							<div className="bg-secondary h-12 w-full animate-pulse rounded-md" />
						</div>
						<div className="bg-foreground/10 h-12 w-full animate-pulse rounded-md" />
					</div>
				</div>
			</div>
		</section>
	);
}
