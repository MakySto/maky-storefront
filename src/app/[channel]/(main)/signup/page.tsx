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
		<section className="mx-auto max-w-7xl p-8 pb-24">
			<SignUpForm />
		</section>
	);
}
