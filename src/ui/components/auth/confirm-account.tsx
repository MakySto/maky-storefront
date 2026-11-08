"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { marketHref } from "@/lib/channel-map";

type State = "pending" | "success" | "invalid" | "error";

/** Codes that mean the link itself is no good, not that something broke on the way. */
const INVALID_LINK_CODES = new Set([
	"REQUIRED",
	"INVALID",
	"NOT_FOUND",
	"INVALID_TOKEN",
	"JWT_INVALID_TOKEN",
]);

export function ConfirmAccount() {
	const t = useTranslations("account.confirm");
	const tSignUp = useTranslations("account.signUp");
	const searchParams = useSearchParams();
	const params = useParams<{ channel: string }>();
	const email = searchParams.get("email") ?? "";
	const token = searchParams.get("token") ?? "";

	const [state, setState] = useState<State>(email && token ? "pending" : "invalid");
	// React's dev double-mount must not send the token twice.
	const sent = useRef(false);

	useEffect(() => {
		if (!email || !token || sent.current) return;
		sent.current = true;

		void (async () => {
			try {
				const response = await fetch("/api/auth/confirm-account", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email, token }),
				});
				const data = (await response.json()) as {
					success?: boolean;
					errors?: Array<{ code?: string | null }>;
				};

				if (data.success) {
					setState("success");
					return;
				}
				const code = data.errors?.[0]?.code ?? "";
				setState(INVALID_LINK_CODES.has(code) ? "invalid" : "error");
			} catch {
				setState("error");
			}
		})();
	}, [email, token]);

	const loginHref = marketHref(params.channel, "/login");

	return (
		<div className="mx-auto my-16 w-full max-w-md">
			<div className="border-border bg-card rounded-lg border p-8 shadow-sm">
				<div className="flex flex-col items-center gap-4 text-center" aria-live="polite">
					{state === "pending" && (
						<>
							<Loader2 className="text-muted-foreground h-8 w-8 animate-spin" aria-hidden="true" />
							<h1 className="text-2xl font-semibold">{t("pending")}</h1>
						</>
					)}

					{state === "success" && (
						<>
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
								<CheckCircle className="h-8 w-8 text-green-600" aria-hidden="true" />
							</div>
							<h1 className="text-2xl font-semibold">{t("successTitle")}</h1>
							<p className="text-muted-foreground">{t("successBody")}</p>
						</>
					)}

					{(state === "invalid" || state === "error") && (
						<>
							<div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
								<XCircle className="text-destructive h-8 w-8" aria-hidden="true" />
							</div>
							<h1 className="text-2xl font-semibold">
								{state === "invalid" ? t("invalidTitle") : t("errorTitle")}
							</h1>
							<p className="text-muted-foreground">
								{state === "invalid" ? t("invalidBody") : t("errorBody")}
							</p>
						</>
					)}

					{state !== "pending" && (
						<Link
							href={loginHref}
							className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 inline-flex h-12 w-full items-center justify-center rounded-md text-base font-semibold"
						>
							{tSignUp("goToSignIn")}
						</Link>
					)}
				</div>
			</div>
		</div>
	);
}
