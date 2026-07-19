"use client";

import { type FC } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

type PaymentErrorProps = {
	message?: string;
};

export const PaymentError: FC<PaymentErrorProps> = ({ message }) => {
	const t = useTranslations("checkout.payment");

	if (!message) {
		return null;
	}

	return (
		<div className="border-destructive/50 bg-destructive/10 flex items-start gap-3 rounded-lg border p-4">
			<AlertCircle className="text-destructive h-5 w-5 flex-shrink-0" />
			<div>
				<p className="text-destructive font-medium">{t("failed")}</p>
				<p className="text-destructive/80 text-sm">{message}</p>
			</div>
		</div>
	);
};
