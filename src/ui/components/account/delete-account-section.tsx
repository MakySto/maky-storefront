"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { requestAccountDeletion } from "@/app/[channel]/(main)/account/actions";
import { marketHref } from "@/lib/channel-map";
import { accountErrorKey } from "@/ui/components/account/account-error";

export function DeleteAccountSection() {
	const params = useParams<{ channel: string }>();
	const [showConfirm, setShowConfirm] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState("");
	const [sent, setSent] = useState(false);
	const t = useTranslations("account.deletion");
	const tCommon = useTranslations("common");
	const tr = useTranslations();

	function handleDelete() {
		setError("");
		startTransition(async () => {
			const formData = new FormData();
			formData.set("redirectUrl", `${window.location.origin}${marketHref(params.channel)}`);
			formData.set("channel", params.channel);
			const result = await requestAccountDeletion(formData);
			if (!result.success) {
				setError(tr(accountErrorKey("deletion", result.code)));
			} else {
				setSent(true);
			}
		});
	}

	if (sent) {
		return (
			<div aria-live="polite" className="border-border rounded-lg border bg-green-50 p-4">
				<p className="text-sm text-green-800">{t("sent")}</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div>
				<p className="text-destructive text-sm font-medium">{t("title")}</p>
				{/* Not "and all associated data", as this said until 2026-09-26: Saleor keeps a deleted
				    customer's orders (under the order's e-mail address), so that was not true. */}
				<p className="text-muted-foreground text-sm">{t("description")}</p>
			</div>

			{error && (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			)}

			{!showConfirm ? (
				<Button variant="destructive" size="sm" onClick={() => setShowConfirm(true)}>
					{t("open")}
				</Button>
			) : (
				<div className="border-destructive/20 bg-destructive/5 flex items-start gap-3 rounded-lg border p-4">
					<AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
					<div className="space-y-3">
						<p className="text-sm">{t("warning")}</p>
						<div className="flex gap-2">
							<Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
								{isPending ? tr("checkout.contactSection.processing") : t("confirm")}
							</Button>
							<Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>
								{tCommon("cancel")}
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
