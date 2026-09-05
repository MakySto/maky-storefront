"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteLineFromCheckout } from "./actions";

type Props = {
	lineId: string;
	checkoutId: string;
	/** Saleor slug, forwarded so the action can invalidate the right paths. */
	channel: string;
};

export const DeleteLineButton = ({ lineId, checkoutId, channel }: Props) => {
	const t = useTranslations("cart");
	const [isPending, startTransition] = useTransition();

	return (
		<button
			type="button"
			className="text-sm text-neutral-500 hover:text-neutral-900"
			onClick={() => {
				if (isPending) return;
				startTransition(() => deleteLineFromCheckout({ lineId, checkoutId, channel }));
			}}
			aria-disabled={isPending}
			aria-label={isPending ? t("removingLineAria") : t("removeLineAria")}
		>
			{isPending ? t("removing") : t("remove")}
		</button>
	);
};
