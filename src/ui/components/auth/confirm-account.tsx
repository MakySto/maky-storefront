"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { marketHref } from "@/lib/channel-map";
import { accountErrorKey } from "@/ui/components/account/account-error";

type State = { status: "pending" } | { status: "confirmed" } | { status: "failed"; messageKey: string };

/**
 * Activates the account from the registration e-mail link (/login/confirm?email=…&token=…).
 *
 * The request runs in the browser, not while the page renders: link scanners in mail clients
 * (Outlook Safe Links and the like) fetch the URL without running scripts, so they cannot use
 * up the token before the customer opens it.
 */
export function ConfirmAccount() {
	const t = useTranslations("account.confirmAccount");
	const tr = useTranslations();
	const params = useParams<{ channel: string }>();
	const searchParams = useSearchParams();
	const email = searchParams.get("email");
	const token = searchParams.get("token");
	const [state, setState] = useState<State>(() =>
		email && token
			? { status: "pending" }
			: { status: "failed", messageKey: "account.confirmAccount.linkInvalid" },
	);
	// React's development double effect must not send the one-time token twice.
	const sent = useRef(false);

	useEffect(() => {
		if (!email || !token || sent.current) {
			return;
		}
		sent.current = true;

		const confirm = async () => {
			try {
				const response = await fetch("/api/auth/confirm-account", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email, token }),
				});
				const data = (await response.json()) as {
					errors?: Array<{ message: string; code?: string | null }>;
					success?: boolean;
				};

				if (data.success) {
					setState({ status: "confirmed" });
					return;
				}

				setState({ status: "failed", messageKey: accountErrorKey("confirmAccount", data.errors?.[0]?.code) });
			} catch {
				setState({ status: "failed", messageKey: "checkout.errors.generic" });
			}
		};

		void confirm();
	}, [email, token]);

	const loginHref = marketHref(params.channel, "/login");

	return (
		<div className="mx-auto my-16 w-full max-w-md">
			<div className="border-border bg-card rounded-lg border p-8 shadow-sm">
				<div className="flex flex-col items-center gap-4 text-center" aria-live="polite">
					{state.status === "pending" && (
						<>
							<Loader2 className="text-muted-foreground h-10 w-10 animate-spin" aria-hidden="true" />
							<h1 className="text-2xl font-semibold">{t("pendingTitle")}</h1>
						</>
					)}

					{state.status === "confirmed" && (
						<>
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
								<CheckCircle className="h-8 w-8 text-green-600" aria-hidden="true" />
							</div>
							<h1 className="text-2xl font-semibold">{t("successTitle")}</h1>
							<p className="text-muted-foreground">{t("successText")}</p>
							<Link
								href={loginHref}
								className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 inline-flex h-12 w-full items-center justify-center rounded-md px-6 font-semibold"
							>
								{t("signIn")}
							</Link>
						</>
					)}

					{state.status === "failed" && (
						<>
							<div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
								<XCircle className="text-destructive h-8 w-8" aria-hidden="true" />
							</div>
							<h1 className="text-2xl font-semibold">{t("failedTitle")}</h1>
							<p role="alert" className="text-muted-foreground">
								{tr(state.messageKey)}
							</p>
							<Link
								href={loginHref}
								className="text-foreground mt-2 text-sm font-medium underline underline-offset-2 hover:no-underline"
							>
								{t("backToSignIn")}
							</Link>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
