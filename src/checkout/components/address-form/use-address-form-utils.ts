import camelCase from "lodash-es/camelCase";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { type CountryCode, type ValidationRulesFragment } from "@/checkout/graphql";
import { addressValidationRulesAction } from "@/checkout/lib/actions";
import { type OptionalAddress, type AddressField } from "@/checkout/components/address-form/types";
import { defaultCountry } from "@/checkout/lib/consts/countries";
import { getOrderedAddressFields, getRequiredAddressFields } from "@/checkout/components/address-form/utils";

// Default fields to show while loading country-specific validation rules
const DEFAULT_ADDRESS_FIELDS: AddressField[] = [
	"firstName",
	"lastName",
	"companyName",
	"streetAddress1",
	"streetAddress2",
	"city",
	"postalCode",
	"countryArea",
	"phone",
];

export type AddressFieldLabel = Exclude<AddressField, "countryCode"> | "country";
// next-intl message keys (relative to the `checkout` namespace). Simple field labels reuse the
// legacy flat `checkout.*` keys; the rest live under `checkout.addressForm.*`.
const addressFieldMessageKeys: Record<AddressFieldLabel, string> = {
	city: "city",
	firstName: "firstName",
	countryArea: "addressForm.fields.countryArea",
	lastName: "lastName",
	country: "country",
	cityArea: "addressForm.fields.cityArea",
	postalCode: "postalCode",
	companyName: "addressForm.fields.companyName",
	streetAddress1: "address",
	streetAddress2: "addressForm.fields.streetAddress2",
	phone: "phone",
};

export type LocalizedAddressFieldLabel =
	| "province"
	| "district"
	| "state"
	| "zip"
	| "postal"
	| "postTown"
	| "prefecture";
const localizedAddressFieldMessageKeys: Record<LocalizedAddressFieldLabel, string> = {
	province: "addressForm.localized.province",
	district: "addressForm.localized.district",
	state: "addressForm.localized.state",
	zip: "addressForm.localized.zip",
	postal: "addressForm.localized.postal",
	postTown: "addressForm.localized.postTown",
	prefecture: "addressForm.localized.prefecture",
};

export const useAddressFormUtils = (countryCode: CountryCode = defaultCountry) => {
	const t = useTranslations("checkout");
	// Country-specific validation rules — fetched client-side via a server action (no urql).
	const [validationRules, setValidationRules] = useState<ValidationRulesFragment | undefined>(undefined);
	const [fetching, setFetching] = useState(true);

	useEffect(() => {
		let cancelled = false;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading when countryCode changes
		setFetching(true);
		void addressValidationRulesAction({ countryCode }).then((result) => {
			if (cancelled) {
				return;
			}
			setValidationRules((result.data?.addressValidationRules as ValidationRulesFragment) ?? undefined);
			setFetching(false);
		});
		return () => {
			cancelled = true;
		};
	}, [countryCode]);

	const { countryAreaType, postalCodeType, cityType } = validationRules || {};

	const localizedFields = useMemo(
		() => ({
			countryArea: countryAreaType,
			city: cityType,
			postalCode: postalCodeType,
		}),
		[cityType, countryAreaType, postalCodeType],
	);

	const isRequiredField = useCallback(
		(field: AddressField) =>
			getRequiredAddressFields(validationRules?.requiredFields as AddressField[]).includes(field),
		[validationRules?.requiredFields],
	);

	const getMissingFieldsFromAddress = useCallback(
		(address: OptionalAddress) => {
			if (!address) {
				return [];
			}

			return Object.entries(address).reduce((result, [fieldName, fieldValue]) => {
				if (!isRequiredField(fieldName as AddressField)) {
					return result;
				}

				return !!fieldValue ? result : ([...result, fieldName] as AddressField[]);
			}, [] as AddressField[]);
		},
		[isRequiredField],
	);

	const hasAllRequiredFields = useCallback(
		(address: OptionalAddress) => !getMissingFieldsFromAddress(address).length,
		[getMissingFieldsFromAddress],
	);

	const getLocalizedFieldLabel = useCallback(
		(field: AddressField, localizedField?: string) => {
			const localizedKey =
				localizedAddressFieldMessageKeys[camelCase(localizedField) as LocalizedAddressFieldLabel];
			if (localizedKey) {
				return t(localizedKey);
			}
			console.warn(`Missing translation: ${localizedField}`);
			return t(addressFieldMessageKeys[camelCase(field) as AddressFieldLabel]);
		},
		[t],
	);

	const getFieldLabel = useCallback(
		(field: AddressField) => {
			const localizedField = localizedFields[field as keyof typeof localizedFields];

			const isLocalizedField = !!localizedField && localizedField !== field;

			if (isLocalizedField) {
				return getLocalizedFieldLabel(
					field,
					localizedFields[field as keyof typeof localizedFields] as LocalizedAddressFieldLabel,
				);
			}

			const key = addressFieldMessageKeys[field as AddressFieldLabel];
			return key ? t(key) : field;
		},
		[getLocalizedFieldLabel, localizedFields, t],
	);

	// Calculate ordered address fields from validation rules
	const orderedAddressFields = useMemo(() => {
		if (validationRules?.allowedFields) {
			return getOrderedAddressFields(validationRules.allowedFields as AddressField[]);
		}
		// While loading, show default fields
		return DEFAULT_ADDRESS_FIELDS;
	}, [validationRules?.allowedFields]);

	return {
		orderedAddressFields,
		getFieldLabel,
		isRequiredField,
		hasAllRequiredFields,
		getMissingFieldsFromAddress,
		fetching,
		...validationRules,
		allowedFields: validationRules?.allowedFields as AddressField[] | undefined,
	};
};
