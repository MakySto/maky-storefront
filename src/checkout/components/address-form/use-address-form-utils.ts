import camelCase from "lodash-es/camelCase";
import { useCallback, useEffect, useMemo, useState } from "react";
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
export const addressFieldMessages: Record<AddressFieldLabel, string> = {
	city: "Mesto",
	firstName: "Meno",
	countryArea: "Kraj/oblasť",
	lastName: "Priezvisko",
	country: "Krajina",
	cityArea: "Mestská časť",
	postalCode: "PSČ",
	companyName: "Firma",
	streetAddress1: "Ulica a číslo",
	streetAddress2: "Byt, vchod, poschodie",
	phone: "Telefón",
};

export type LocalizedAddressFieldLabel =
	| "province"
	| "district"
	| "state"
	| "zip"
	| "postal"
	| "postTown"
	| "prefecture";
export const localizedAddressFieldMessages: Record<LocalizedAddressFieldLabel, string> = {
	province: "Provincia",
	district: "Okres",
	state: "Štát",
	zip: "PSČ",
	postal: "PSČ",
	postTown: "Poštové mesto",
	prefecture: "Prefektúra",
};

export const useAddressFormUtils = (countryCode: CountryCode = defaultCountry) => {
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

	const getLocalizedFieldLabel = useCallback((field: AddressField, localizedField?: string) => {
		try {
			const translatedLabel =
				localizedAddressFieldMessages[camelCase(localizedField) as LocalizedAddressFieldLabel];
			return translatedLabel;
		} catch (e) {
			console.warn(`Missing translation: ${localizedField}`);
			return addressFieldMessages[camelCase(field) as AddressFieldLabel];
		}
	}, []);

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

			return addressFieldMessages[field as AddressFieldLabel];
		},
		[getLocalizedFieldLabel, localizedFields],
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
