"use client";

import { useId, useRef, useState, type FC } from "react";
import { Gift, LoaderCircle, Tag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	hasAppliedPromoCodes,
	normalizePromoCode,
	type AppliedPromoCodes,
	type PromoCodeRemoval,
} from "@/checkout/lib/promo-code";
import { formatPrice } from "@/config/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";

/** What a caller's action answers: done, or the sentence for the customer (already in their language). */
export type PromoCodeOutcome = { ok: true } | { ok: false; message: string };

type PromoCodeBoxProps = {
	applied: AppliedPromoCodes;
	locale: string;
	onApply: (code: string) => Promise<PromoCodeOutcome>;
	onRemove: (removal: PromoCodeRemoval) => Promise<PromoCodeOutcome>;
	/** Nothing may be changed right now (a payment is being confirmed). */
	disabled?: boolean;
	className?: string;
};

/**
 * The field for a discount code or a gift card, and what is applied. One component for the cart and for the
 * checkout summary; where the code goes and what is re-read afterwards is the caller's (`onApply`, `onRemove`).
 *
 * Closed until asked for: most customers have no code, and an open empty field under the total reads as "you are
 * paying too much".
 */
export const PromoCodeBox: FC<PromoCodeBoxProps> = ({
	applied,
	locale,
	onApply,
	onRemove,
	disabled = false,
	className,
}) => {
	const t = useTranslations("checkout");
	const fieldId = useId();
	const errorId = `${fieldId}-error`;
	const inputRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState<"apply" | "remove" | null>(null);
	const [error, setError] = useState("");

	const hasApplied = hasAppliedPromoCodes(applied);
	const locked = disabled || busy !== null;

	const submit = async () => {
		if (locked) return;
		if (!normalizePromoCode(code)) {
			setError(t("promo.empty"));
			inputRef.current?.focus();
			return;
		}
		setBusy("apply");
		setError("");
		try {
			const outcome = await onApply(code);
			if (outcome.ok) {
				setCode("");
				setOpen(false);
			} else {
				setError(outcome.message);
				inputRef.current?.focus();
			}
		} catch {
			setError(t("promo.failed"));
		} finally {
			setBusy(null);
		}
	};

	const remove = async (removal: PromoCodeRemoval) => {
		if (locked) return;
		setBusy("remove");
		setError("");
		try {
			const outcome = await onRemove(removal);
			if (!outcome.ok) setError(outcome.message);
		} catch {
			setError(t("promo.failed"));
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className={cn("space-y-3", className)} data-testid="promo-code">
			{hasApplied ? (
				<ul className="space-y-2" aria-label={t("promo.appliedListLabel")}>
					{applied.voucher ? (
						<li
							className="border-status-success-border bg-status-success-bg flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
							data-testid="promo-applied-voucher"
						>
							<Tag className="text-status-success h-4 w-4 shrink-0" aria-hidden />
							<span className="min-w-0 flex-1">
								<span className="block font-medium break-all">{applied.voucher.code}</span>
								{applied.voucher.name ? (
									<span className="text-muted-foreground block text-xs">{applied.voucher.name}</span>
								) : null}
							</span>
							{applied.voucher.discount ? (
								<span className="shrink-0 tabular-nums">
									−{formatPrice(applied.voucher.discount.amount, applied.voucher.discount.currency, locale)}
								</span>
							) : null}
							<button
								type="button"
								onClick={() => void remove({ promoCode: applied.voucher!.code })}
								disabled={locked}
								aria-label={t("promo.remove", { code: applied.voucher.code })}
								className="text-muted-foreground hover:text-foreground -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md disabled:opacity-50"
							>
								<X className="h-4 w-4" aria-hidden />
							</button>
						</li>
					) : null}
					{applied.giftCards.map((card) => (
						<li
							key={card.id}
							className="border-status-success-border bg-status-success-bg flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
							data-testid="promo-applied-gift-card"
						>
							<Gift className="text-status-success h-4 w-4 shrink-0" aria-hidden />
							<span className="min-w-0 flex-1">
								<span className="block font-medium">{t("promo.giftCard", { code: card.displayCode })}</span>
								{card.balance ? (
									<span className="text-muted-foreground block text-xs">
										{t("promo.giftCardBalance", {
											amount: formatPrice(card.balance.amount, card.balance.currency, locale),
										})}
									</span>
								) : null}
							</span>
							<button
								type="button"
								onClick={() => void remove({ promoCodeId: card.id })}
								disabled={locked}
								aria-label={t("promo.remove", { code: card.displayCode })}
								className="text-muted-foreground hover:text-foreground -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md disabled:opacity-50"
							>
								<X className="h-4 w-4" aria-hidden />
							</button>
						</li>
					))}
				</ul>
			) : null}

			{open ? (
				// Not a <form>: on the payment step this sits inside the step's own form, and Enter must apply the code,
				// never place the order.
				<div className="space-y-1.5">
					<Label htmlFor={fieldId} className="text-sm font-medium">
						{t("promo.label")}
					</Label>
					<div className="flex gap-2">
						<Input
							ref={inputRef}
							id={fieldId}
							name="promoCode"
							value={code}
							onChange={(event) => {
								setCode(event.target.value);
								if (error) setError("");
							}}
							onKeyDown={(event) => {
								if (event.key !== "Enter") return;
								event.preventDefault();
								void submit();
							}}
							disabled={locked}
							autoFocus
							autoComplete="off"
							autoCapitalize="characters"
							autoCorrect="off"
							spellCheck={false}
							enterKeyHint="done"
							maxLength={64}
							aria-invalid={error ? true : undefined}
							aria-describedby={error ? errorId : undefined}
							className="min-w-0 flex-1"
						/>
						<Button
							type="button"
							variant="outline-solid"
							disabled={locked}
							onClick={() => void submit()}
							className="shrink-0"
						>
							{busy === "apply" ? (
								<>
									<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
									{t("promo.applying")}
								</>
							) : (
								t("promo.apply")
							)}
						</Button>
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={() => {
						setOpen(true);
						setError("");
					}}
					disabled={locked}
					className="text-foreground flex min-h-9 items-center gap-2 text-left text-sm font-medium underline underline-offset-2 hover:no-underline disabled:opacity-50"
				>
					<Tag className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
					{hasApplied ? t("promo.addAnother") : t("promo.toggle")}
				</button>
			)}

			{error ? (
				<p id={errorId} role="alert" className="text-destructive text-sm">
					{error}
				</p>
			) : null}
		</div>
	);
};
