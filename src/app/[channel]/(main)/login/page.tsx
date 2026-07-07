import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/ui/components/login-form";
import { executeAuthenticatedGraphQL } from "@/lib/graphql";
import { resolveSessionUser } from "@/lib/auth/resolve-session-user";
import { CurrentUserDocument } from "@/gql/graphql";
import { AuthProvider } from "@/lib/auth";
import { marketHref } from "@/lib/channel-map";

export const metadata = {
	title: "Sign In",
	description: "Sign in to your account to access your orders and saved addresses.",
};

export default function LoginPage(props: { params: Promise<{ channel: string }> }) {
	return (
		<Suspense fallback={<LoginSkeleton />}>
			<LoginContent params={props.params} />
		</Suspense>
	);
}

function LoginSkeleton() {
	return (
		<section className="mx-auto max-w-7xl p-8 pb-24">
			<div className="mx-auto my-16 w-full max-w-md">
				<div className="border-border bg-card rounded-lg border p-8 shadow-sm">
					<div className="mb-6 flex flex-col items-center gap-2">
						<div className="bg-secondary h-7 w-40 animate-pulse rounded" />
						<div className="bg-secondary h-4 w-56 animate-pulse rounded" />
					</div>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<div className="bg-secondary h-4 w-24 animate-pulse rounded" />
							<div className="bg-secondary h-12 w-full animate-pulse rounded-md" />
						</div>
						<div className="space-y-1.5">
							<div className="bg-secondary h-4 w-16 animate-pulse rounded" />
							<div className="bg-secondary h-12 w-full animate-pulse rounded-md" />
						</div>
						<div className="flex justify-end">
							<div className="bg-secondary h-4 w-28 animate-pulse rounded" />
						</div>
						<div className="bg-foreground/10 h-12 w-full animate-pulse rounded-md" />
					</div>
				</div>
			</div>
		</section>
	);
}

async function LoginContent({ params: paramsPromise }: { params: Promise<{ channel: string }> }) {
	const { channel } = await paramsPromise;

	// Already signed in → send to the market home. Existing redirect behavior is kept
	// verbatim (market-aware routing itself is B.3, out of B.2 scope).
	const session = await resolveSessionUser(() =>
		executeAuthenticatedGraphQL(CurrentUserDocument, { cache: "no-cache" }),
	);

	if (session.status === "authenticated") {
		redirect(marketHref(channel));
	}

	return (
		<section className="mx-auto max-w-7xl p-8 pb-24">
			<AuthProvider>
				<LoginForm />
			</AuthProvider>
		</section>
	);
}
