"use client";

import { type FC } from "react";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";

import { type CountryCode } from "@/checkout/graphql";
import { useAddressFormUtils } from "@/checkout/components/address-form/use-address-form-utils";
import { getCountryName } from "@/checkout/lib/utils/locale";
import { COMPANY_NAME_MAX_LENGTH } from "@/checkout/lib/b2b/b2b-input";
import type { B2bCompanyFieldsValue } from "@/checkout/lib/b2b/company-form-state";
import { VAT_ID_MAX_LENGTH, vatFieldLabelKey, vatIdExample } from "@/checkout/lib/b2b/vat-id";
import {
	AddressFields,
	FieldError,
	FormInput,
	FormSelect,
} from "@/checkout/views/saleor-checkout/address-form-fields";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { Label } from "@/ui/components/ui/label";
import { useLocale } from "@/providers/locale-provider";

export type { B2bCompanyFieldsValue };

type B2bCompanyFieldsProps = {
	value: B2bCompanyFieldsValue;
	onChange: (next: B2bCompanyFieldsValue) => void;
	/** The country the billing company sits in when the billing address is the delivery one. */
	shippingCountry: CountryCode;
	/** A delivery address exists on this step (physical goods), so "same as delivery" can be offered. */
	canUseShippingAddress: boolean;
	/** EU market: the VAT field and the Slovak IČO/DIČ apply. US/CA need the company and its address only. */
	euMarket: boolean;
	availableCountries: CountryCode[];
	errors: Record<string, string>;
	disabled?: boolean;
};

/**
 * "Nakupujem na firmu" in the Information step, for guests too (zadanie 02, §2).
 *
 * The company name is the billing address's `companyName` — one billing address, the same address model and
 * components as everywhere in the checkout. The VAT field is named after the invoiced company's country, not the
 * URL language. A filled "Firma" field of the delivery address does not switch anything on.
 */
export const B2bCompanyFields: FC<B2bCompanyFieldsProps> = ({
	value,
	onChange,
	shippingCountry,
	canUseShippingAddress,
	euMarket,
	availableCountries,
	errors,
	disabled,
}) => {
	const t = useTranslations("checkout");
	const { locale } = useLocale();
	const sameAsShipping = canUseShippingAddress && value.billingSameAsShipping;
	const billingCountry = sameAsShipping ? shippingCountry : value.billingCountry;
	const isSlovak = billingCountry === "SK";
	const { orderedAddressFields, getFieldLabel, isRequiredField, countryAreaChoices, rulesKnown } =
		useAddressFormUtils(value.billingCountry);

	const set = (patch: Partial<B2bCompanyFieldsValue>) => onChange({ ...value, ...patch });
	const vatLabel = t(`b2b.vatLabel.${vatFieldLabelKey(billingCountry)}`);
	// The example follows the invoiced company's country, as the label does (SK1234567890, ATU12345678, …).
	const vatExample = vatIdExample(billingCountry);
	const optional = <span className="text-muted-foreground ml-1 font-normal">{t("common.optional")}</span>;
	// The company name has its own required field above; the billing form does not ask for it twice.
	const billingFields = orderedAddressFields.filter((field) => field !== "companyName");

	return (
		<section className="space-y-4" aria-labelledby="b2b-section-title">
			<h2 id="b2b-section-title" className="sr-only">
				{t("b2b.sectionTitle")}
			</h2>
			<div className="flex items-start gap-3">
				<Checkbox
					id="b2b-is-business"
					checked={value.isBusiness}
					disabled={disabled}
					onCheckedChange={(checked) => set({ isBusiness: checked === true })}
				/>
				<div className="space-y-0.5">
					<Label htmlFor="b2b-is-business" className="cursor-pointer text-sm font-medium">
						{t("b2b.toggle")}
					</Label>
					<p className="text-muted-foreground text-xs">{t("b2b.toggleHint")}</p>
				</div>
			</div>

			{value.isBusiness ? (
				<div className="border-border bg-secondary/30 space-y-4 rounded-lg border p-4">
					<div className="space-y-1.5">
						<Label htmlFor="b2b-company-name" className="text-sm font-medium">
							{t("b2b.companyName")}
						</Label>
						<FormInput
							id="b2b-company-name"
							placeholder={t("b2b.companyName")}
							value={value.companyName}
							onChange={(companyName) => set({ companyName })}
							error={errors.companyName}
							icon={Building2}
							maxLength={COMPANY_NAME_MAX_LENGTH}
							autoComplete="organization"
						/>
						<FieldError error={errors.companyName} />
					</div>

					{canUseShippingAddress ? (
						<div className="flex items-center gap-3">
							<Checkbox
								id="b2b-billing-same"
								checked={value.billingSameAsShipping}
								disabled={disabled}
								onCheckedChange={(checked) => set({ billingSameAsShipping: checked === true })}
							/>
							<Label htmlFor="b2b-billing-same" className="cursor-pointer text-sm">
								{t("b2b.billingSameAsShipping")}
							</Label>
						</div>
					) : null}

					{!sameAsShipping ? (
						<div className="space-y-4">
							<p className="text-sm font-semibold">{t("b2b.billingAddressTitle")}</p>
							<div className="space-y-1.5">
								<Label htmlFor="b2b-billing-country" className="text-sm font-medium">
									{t("addressForm.countryRegion")}
								</Label>
								<FormSelect
									id="b2b-billing-country"
									value={value.billingCountry}
									onChange={(code) =>
										set({
											billingCountry: code as CountryCode,
											billingForm: { ...value.billingForm, countryArea: "" },
										})
									}
									placeholder={t("addressForm.selectCountry")}
									autoComplete="billing country"
									options={availableCountries.map((code) => ({
										value: code,
										label: getCountryName(code, locale),
									}))}
								/>
							</div>
							<AddressFields
								orderedFields={billingFields}
								getFieldLabel={getFieldLabel}
								isRequiredField={isRequiredField}
								rulesKnown={rulesKnown}
								formData={value.billingForm}
								errors={Object.fromEntries(
									Object.entries(errors)
										.filter(([key]) => key.startsWith("billing."))
										.map(([key, message]) => [key.slice("billing.".length), message]),
								)}
								onFieldChange={(field, fieldValue) =>
									set({ billingForm: { ...value.billingForm, [field]: fieldValue } })
								}
								countryAreaChoices={countryAreaChoices}
								idPrefix="b2b-billing-"
							/>
						</div>
					) : null}

					{euMarket && isSlovak ? (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label htmlFor="b2b-registration-id" className="text-sm font-medium">
									{t("b2b.registrationId")}
								</Label>
								<FormInput
									id="b2b-registration-id"
									placeholder={t("b2b.registrationId")}
									value={value.registrationId}
									onChange={(registrationId) => set({ registrationId })}
									error={errors.registrationId}
									maxLength={16}
									autoComplete="off"
								/>
								<FieldError error={errors.registrationId} />
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="b2b-tax-id" className="text-sm font-medium">
									{t("b2b.taxId")}
									{optional}
								</Label>
								<FormInput
									id="b2b-tax-id"
									placeholder={t("b2b.taxId")}
									value={value.taxId}
									onChange={(taxId) => set({ taxId })}
									error={errors.taxId}
									maxLength={16}
									autoComplete="off"
								/>
								<FieldError error={errors.taxId} />
							</div>
						</div>
					) : null}

					{euMarket ? (
						<div className="space-y-1.5">
							<Label htmlFor="b2b-vat-id" className="text-sm font-medium">
								{vatLabel}
								{optional}
							</Label>
							<FormInput
								id="b2b-vat-id"
								placeholder={vatExample ? t("b2b.vatIdPlaceholder", { example: vatExample }) : vatLabel}
								value={value.vatId}
								onChange={(vatId) => set({ vatId })}
								error={errors.vatId}
								maxLength={VAT_ID_MAX_LENGTH + 8}
								autoComplete="off"
							/>
							<FieldError error={errors.vatId} />
							{/* The exemption sentence is about a company from ANOTHER member state: never for a Slovak one. */}
							{isSlovak ? null : <p className="text-muted-foreground text-xs">{t("b2b.vatIdHint")}</p>}
						</div>
					) : null}
				</div>
			) : null}
		</section>
	);
};
