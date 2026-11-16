"use client";

import { type FC, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { User, MapPin, Building, Phone, type LucideIcon } from "lucide-react";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import { cn } from "@/lib/utils";
import { type AddressField } from "@/checkout/components/address-form/types";
import { phoneExamplesFor, phoneHintValues, unbrokenPhone } from "@/checkout/lib/phone";
import { diagnosePhone } from "@/checkout/lib/phone-diagnosis";
import { autocompleteTags, typeTags } from "@/checkout/lib/consts/input-attributes";

// =============================================================================
// Constants
// =============================================================================

/** Icon mapping for address fields */
export const addressFieldIcons: Partial<Record<AddressField, LucideIcon>> = {
	firstName: User,
	streetAddress1: MapPin,
	streetAddress2: Building,
	companyName: Building,
	phone: Phone,
};

/** Fields that should be grouped in a 2-column row */
export const addressFieldPairs: [AddressField, AddressField][] = [
	["firstName", "lastName"],
	["city", "postalCode"],
];

// =============================================================================
// Shared Components
// =============================================================================

export const FieldError: FC<{ error?: string; id?: string }> = ({ error, id }) =>
	error ? (
		<p id={id} role="alert" className="text-destructive text-sm">
			{error}
		</p>
	) : null;

interface FormSelectProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
	placeholder?: string;
	options: Array<{ value: string; label: string }>;
	autoComplete?: string;
}

export const FormSelect: FC<FormSelectProps> = ({
	id,
	value,
	onChange,
	error,
	placeholder,
	options,
	autoComplete,
}) => (
	<select
		id={id}
		value={value}
		onChange={(e) => onChange(e.target.value)}
		autoComplete={autoComplete}
		className={cn(
			"border-input flex h-12 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm",
			"ring-offset-background focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none",
			"disabled:cursor-not-allowed disabled:opacity-50",
			error && "border-destructive",
		)}
	>
		{placeholder && (
			<option value="" disabled>
				{placeholder}
			</option>
		)}
		{options.map((option) => (
			<option key={option.value} value={option.value}>
				{option.label}
			</option>
		))}
	</select>
);

interface FormInputProps {
	id: string;
	type?: string;
	placeholder: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
	icon?: LucideIcon;
	maxLength?: number;
	className?: string;
	autoComplete?: string;
	inputMode?: "tel";
}

export const FormInput: FC<FormInputProps> = ({
	id,
	type = "text",
	placeholder,
	value,
	onChange,
	error,
	icon: Icon,
	maxLength,
	className,
	autoComplete,
	inputMode,
}) => (
	<div className="relative">
		{Icon && <Icon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />}
		<Input
			id={id}
			type={type}
			placeholder={placeholder}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			maxLength={maxLength}
			autoComplete={autoComplete}
			inputMode={inputMode}
			aria-invalid={error ? true : undefined}
			aria-describedby={error ? `${id}-error` : undefined}
			className={cn("h-12", Icon && "pl-10", error && "border-destructive", className)}
		/>
	</div>
);

// =============================================================================
// Address Fields Renderer
// =============================================================================

interface AddressFieldsProps {
	/** Ordered list of fields to render */
	orderedFields: AddressField[];
	/** Function to get field label */
	getFieldLabel: (field: AddressField) => string;
	/** Function to check if field is required */
	isRequiredField: (field: AddressField) => boolean;
	/**
	 * `false` while the country's address rules load or when they could not be read (`useAddressFormUtils`): then no
	 * field is labelled optional, since the rules may still require it.
	 */
	rulesKnown?: boolean;
	/** Current form values */
	formData: Record<string, string>;
	/** Validation errors */
	errors: Record<string, string>;
	/** Callback when field value changes */
	onFieldChange: (field: string, value: string) => void;
	/** Country area choices for state/province dropdown */
	countryAreaChoices?: Array<{ raw?: unknown; verbose?: unknown }>;
	/** ID prefix for form fields (e.g., "billing-") */
	idPrefix?: string;
	/** Country of this address: the phone field shows that country's example number and says how to write it. */
	countryCode?: string;
}

export const AddressFields: FC<AddressFieldsProps> = ({
	orderedFields,
	getFieldLabel,
	isRequiredField,
	rulesKnown = true,
	formData,
	errors,
	onFieldChange,
	countryAreaChoices,
	idPrefix = "",
	countryCode,
}) => {
	const t = useTranslations("checkout");
	const locale = useLocale();
	const phoneHint = phoneHintValues(countryCode);

	const renderField = (field: AddressField): ReactNode => {
		if (field === "countryCode") return null;

		const label = getFieldLabel(field);
		const isRequired = isRequiredField(field);
		const error = errors[field];
		const Icon = addressFieldIcons[field];
		const fieldId = `${idPrefix}${field}`;
		const autoComplete = autocompleteTags[field];
		const inputType = typeTags[field] || "text";

		// Label with optional indicator
		const fieldLabel = (
			<Label htmlFor={fieldId} className="text-sm font-medium">
				{label}
				{!isRequired && rulesKnown && (
					<span className="text-muted-foreground ml-1 font-normal">{t("common.optional")}</span>
				)}
			</Label>
		);

		// State/Province dropdown
		if (field === "countryArea" && countryAreaChoices?.length) {
			return (
				<div key={field} className="space-y-1.5">
					{fieldLabel}
					<FormSelect
						id={fieldId}
						value={formData[field] || ""}
						onChange={(value) => onFieldChange(field, value)}
						error={error}
						placeholder={t("addressForm.selectField")}
						autoComplete={autoComplete}
						options={countryAreaChoices.map(({ raw, verbose }) => ({
							value: raw as string,
							label: verbose as string,
						}))}
					/>
					<FieldError error={error} id={`${fieldId}-error`} />
				</div>
			);
		}

		// Text input. The phone shows the delivery country's own example as placeholder and, under the field, the two
		// ways that country's number is written (at home and with its calling code), so the customer does not have to
		// guess. When Saleor refused a number that is a mobile number of another market written without its calling
		// code, the same number with the code is one tap away.
		const isPhone = field === "phone";
		const refused =
			isPhone && error ? diagnosePhone(formData.phone, countryCode, locale.split("-")[1]) : null;
		const suggestion = refused?.kind === "otherCountry" ? refused.suggestion : null;
		return (
			<div key={field} className="space-y-1.5">
				{fieldLabel}
				<FormInput
					id={fieldId}
					type={inputType}
					placeholder={isPhone ? phoneExamplesFor(countryCode)?.national ?? label : label}
					value={formData[field] || ""}
					onChange={(value) => onFieldChange(field, value)}
					error={error}
					icon={Icon}
					autoComplete={autoComplete}
					inputMode={isPhone ? "tel" : undefined}
				/>
				{isPhone && !error && phoneHint && (
					<p className="text-muted-foreground text-xs" data-testid={`${fieldId}-hint`}>
						{t("addressForm.phoneHint", { example: t("addressForm.phoneExamplePair", phoneHint) })}
					</p>
				)}
				<FieldError error={error} id={`${fieldId}-error`} />
				{suggestion && (
					<button
						type="button"
						data-testid={`${fieldId}-suggestion`}
						onClick={() => onFieldChange(field, suggestion)}
						className="border-input bg-background text-foreground hover:bg-accent inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium"
					>
						{t("addressForm.phoneUseSuggestion", { suggestion: unbrokenPhone(suggestion) })}
					</button>
				)}
			</div>
		);
	};

	const rendered = new Set<string>();
	const elements: ReactNode[] = [];

	orderedFields.forEach((field) => {
		if (field === "countryCode") return;

		const pair = addressFieldPairs.find((p) => p.includes(field));
		if (pair) {
			const pairKey = pair.join("-");
			if (rendered.has(pairKey)) return;
			rendered.add(pairKey);

			const [f1, f2] = pair;
			const has1 = orderedFields.includes(f1);
			const has2 = orderedFields.includes(f2);

			if (has1 && has2) {
				elements.push(
					<div key={pairKey} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{renderField(f1)}
						{renderField(f2)}
					</div>,
				);
			} else {
				if (has1) elements.push(renderField(f1));
				if (has2) elements.push(renderField(f2));
			}
		} else {
			elements.push(renderField(field));
		}
	});

	return <>{elements}</>;
};
