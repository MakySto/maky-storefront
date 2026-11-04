"use client";

import { type FC } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import type { B2bStatusAction, B2bStatusMessage } from "@/checkout/lib/b2b/status-message";
import { LoadingSpinner } from "@/checkout/ui-kit/loading-spinner";
import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";

const TONE: Record<B2bStatusMessage["tone"], { box: string; icon: typeof Info }> = {
	info: { box: "bg-status-info-bg border-status-info-border text-foreground", icon: Info },
	success: { box: "bg-status-success-bg border-status-success-border text-foreground", icon: CheckCircle2 },
	warning: { box: "bg-status-warning-bg border-status-warning-border text-foreground", icon: AlertTriangle },
	error: { box: "bg-status-danger-bg border-status-danger-border text-foreground", icon: XCircle },
};

const ICON_TONE: Record<B2bStatusMessage["tone"], string> = {
	info: "text-status-info",
	success: "text-status-success",
	warning: "text-status-warning",
	error: "text-status-danger",
};

type B2bStatusNoticeProps = {
	message: B2bStatusMessage;
	pending?: boolean;
	/** Only the actions with a handler are offered. */
	on?: Partial<Record<B2bStatusAction, () => void>>;
	/** Shown under the sentence where a taxed total is to be confirmed ("Na úhradu: 154,98 €"). */
	detail?: string;
};

/** The company block's status line: one sentence, the actions it allows, announced politely to screen readers. */
export const B2bStatusNotice: FC<B2bStatusNoticeProps> = ({ message, pending, on = {}, detail }) => {
	const t = useTranslations("checkout");
	const tone = TONE[message.tone];
	const Icon = tone.icon;
	const actions = message.actions.filter((action) => on[action]);

	return (
		<div
			className={cn("flex items-start gap-3 rounded-lg border p-4", tone.box)}
			role={message.tone === "error" ? "alert" : "status"}
			aria-live="polite"
		>
			{pending ? (
				<span className="mt-0.5 shrink-0">
					<LoadingSpinner />
				</span>
			) : (
				<Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ICON_TONE[message.tone])} aria-hidden />
			)}
			<div className="min-w-0 flex-1 space-y-3">
				<div className="space-y-1">
					<p className="text-sm">{t(message.key)}</p>
					{detail ? <p className="text-sm font-medium">{detail}</p> : null}
				</div>
				{actions.length ? (
					<div className="flex flex-wrap gap-2">
						{actions.map((action) => (
							<Button
								key={action}
								type="button"
								size="sm"
								variant={action === "continueWithVat" ? "default" : "outline-solid"}
								disabled={pending}
								onClick={on[action]}
							>
								{t(`b2b.actions.${action}`)}
							</Button>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
};
