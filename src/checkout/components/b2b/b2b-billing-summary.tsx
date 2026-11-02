"use client";

import { type FC } from "react";
import { useTranslations } from "next-intl";

import { type AddressFragment, type CountryCode } from "@/checkout/graphql";
import type { B2bInputV1 } from "@/checkout/lib/b2b/contract";
import { countryOfVatId, vatFieldLabelKey } from "@/checkout/lib/b2b/vat-id";
import { getCountryName } from "@/checkout/lib/utils/locale";
import { useLocale } from "@/providers/locale-provider";

type B2bBillingSummaryProps = {
	billingAddress: AddressFragment | null | undefined;
	input: B2bInputV1;
	onEdit?: () => void;
	disabled?: boolean;
};

/**
 * The payment step's view of a company purchase's billing: what was saved in the Information step, with
 * "Upraviť" leading back there. Nothing here writes — one billing address, edited in one place (zadanie 02, §2).
 */
export const B2bBillingSummary: FC<B2bBillingSummaryProps> = ({
	billingAddress,
	input,
	onEdit,
	disabled,
}) => {
	const t = useTranslations("checkout");
	const { locale } = useLocale();
	const country = billingAddress?.country?.code;
	const vatLabel = t(`b2b.vatLabel.${vatFieldLabelKey(countryOfVatId(input.vatId) ?? country)}`);
	const name = [billingAddress?.firstName, billingAddress?.lastName].filter(Boolean).join(" ");
	const street = [billingAddress?.streetAddress1, billingAddress?.streetAddress2].filter(Boolean).join(", ");
	const city = [billingAddress?.postalCode, billingAddress?.city].filter(Boolean).join(" ");

	return (
		<section className="space-y-3" aria-labelledby="b2b-billing-summary-title">
			<div className="flex items-center justify-between gap-4">
				<h2 id="b2b-billing-summary-title" className="text-lg font-semibold">
					{t("b2b.billingSummaryTitle")}
				</h2>
				{onEdit ? (
					<button
						type="button"
						onClick={onEdit}
						disabled={disabled}
						className="text-foreground text-sm font-medium underline underline-offset-2 hover:no-underline disabled:pointer-events-none disabled:opacity-50"
					>
						{t("b2b.actions.edit")}
					</button>
				) : null}
			</div>
			<div className="border-border rounded-lg border p-4 text-sm">
				{billingAddress ? (
					<dl className="space-y-1">
						<div>
							<dt className="sr-only">{t("b2b.companyName")}</dt>
							<dd className="font-medium">{billingAddress.companyName || "—"}</dd>
						</div>
						<div className="text-muted-foreground">
							<dt className="sr-only">{t("b2b.billingAddressTitle")}</dt>
							<dd>
								{name ? <span className="block">{name}</span> : null}
								{street ? <span className="block">{street}</span> : null}
								<span className="block">
									{city}
									{country ? `${city ? ", " : ""}${getCountryName(country as CountryCode, locale)}` : ""}
								</span>
							</dd>
						</div>
						{input.registrationId ? (
							<div className="flex gap-2">
								<dt className="text-muted-foreground">{t("b2b.registrationId")}:</dt>
								<dd>{input.registrationId}</dd>
							</div>
						) : null}
						{input.taxId ? (
							<div className="flex gap-2">
								<dt className="text-muted-foreground">{t("b2b.taxId")}:</dt>
								<dd>{input.taxId}</dd>
							</div>
						) : null}
						{input.vatId ? (
							<div className="flex gap-2">
								<dt className="text-muted-foreground">{vatLabel}:</dt>
								<dd>{input.vatId}</dd>
							</div>
						) : null}
					</dl>
				) : (
					<p className="text-muted-foreground">{t("b2b.billingMissing")}</p>
				)}
			</div>
		</section>
	);
};
