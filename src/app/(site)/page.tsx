import { redirect } from "next/navigation";
import { DefaultChannelSlug } from "@/app/config";

/**
 * Root page redirects to the default channel.
 *
 * Requires NEXT_PUBLIC_DEFAULT_CHANNEL to be set.
 * In development, shows setup instructions if not configured.
 */
export default function RootPage() {
	if (DefaultChannelSlug) {
		redirect(`/${DefaultChannelSlug}`);
	}

	// No channel configured - show setup instructions
	return (
		<div className="bg-background flex min-h-screen items-center justify-center p-8">
			<div className="max-w-md text-center">
				<h1 className="text-foreground mb-4 text-2xl font-semibold">Channel Not Configured</h1>
				<p className="text-muted-foreground mb-6">
					Set the <code className="bg-muted rounded px-2 py-1">NEXT_PUBLIC_DEFAULT_CHANNEL</code> environment
					variable to your Saleor channel slug.
				</p>
				<div className="bg-muted rounded-lg p-4 text-left">
					<p className="text-foreground mb-2 text-sm font-medium">In your .env.local file:</p>
					<code className="text-muted-foreground text-sm">NEXT_PUBLIC_DEFAULT_CHANNEL=default-channel</code>
				</div>
			</div>
		</div>
	);
}
