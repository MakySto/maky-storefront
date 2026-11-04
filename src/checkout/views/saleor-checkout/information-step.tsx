"use client";

import { useState, useEffect, useCallback, type FC } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "@/providers/locale-provider";
import { Button } from "@/ui/components/ui/button";
import { type CheckoutFragment, type CountryCode } from "@/checkout/graphql";
import {
	checkoutBillingAddressUpdateAction,
	checkoutEmailUpdateAction,
	checkoutShippingAddressUpdateAction,
	userRegisterAction,
	updateNewsletterConsentAction,
} from "@/checkout/lib/actions";
import { saveB2bInputAction } from "@/checkout/lib/b2b/actions";
import { validateB2bForm, type B2bFormErrors } from "@/checkout/lib/b2b/b2b-input";
import {
	billingToFollowShipping,
	billingWhenCompanyOff,
	companyBillingAddressInput,
	companyFieldErrorKey,
	initialCompanyFieldsValue,
	placeBillingErrors,
	type B2bCompanyFieldsValue,
} from "@/checkout/lib/b2b/company-form-state";
import {
	isCheckoutLockedCode,
	isTaxContextChangedCode,
	type B2bUiOutcome,
} from "@/checkout/lib/b2b/contract";
import { confirmsTaxedQuote } from "@/checkout/lib/b2b/payment-gate";
import { b2bStatusMessage } from "@/checkout/lib/b2b/status-message";
import { B2bCompanyFields } from "@/checkout/components/b2b/b2b-company-fields";
import { B2bStatusNotice } from "@/checkout/components/b2b/b2b-status-notice";
import { PaymentLockRecovery } from "@/checkout/components/b2b/payment-lock-recovery";
import { useCheckoutB2b } from "@/checkout/providers/checkout-b2b";
import { useAvailableShippingCountries } from "@/checkout/hooks/use-available-shipping-countries";
import { useAddressFormUtils } from "@/checkout/components/address-form/use-address-form-utils";
import {
	getAddressInputData,
	getAddressInputDataFromAddress,
	isMatchingAddressData,
} from "@/checkout/components/address-form/utils";
import { useUser } from "@/checkout/hooks/use-user";
import { useCheckout } from "@/checkout/hooks/use-checkout";
import { syncAuthSurfacesAfterSignIn } from "@/lib/auth/sync-auth-surfaces-after-sign-in";
import { getQueryParams, createQueryString } from "@/checkout/lib/utils/url";
import { getStepNumber } from "./flow";

// Extracted components
import { SignInForm, ResetPasswordForm } from "@/checkout/components/contact";
import { ContactSection, ShippingAddressSection } from "./sections";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { Label } from "@/ui/components/ui/label";
import { MobileStickyAction } from "./mobile-sticky-action";

// =============================================================================
// Types
// =============================================================================

type ContactView = "main" | "signIn" | "resetPassword";

interface InformationStepProps {
	checkout: CheckoutFragment;
	onNext: () => void;
	/** The payment step, for "pay the original order" when a started payment keeps the details from changing. */
	onGoToPayment?: () => void;
}

/** After a save, these outcomes keep the customer on this step with the status card (they decide what next). */
function needsAttention(outcome: B2bUiOutcome): boolean {
	if (outcome.kind === "taxed") return outcome.needsTaxedConfirmation;
	return outcome.kind === "unconfirmed" || outcome.kind === "changed" || outcome.kind === "locked";
}

// =============================================================================
// Main Component
// =============================================================================

export const InformationStep: FC<InformationStepProps> = ({ checkout, onNext, onGoToPayment }) => {
	const t = useTranslations("checkout");
	const { locale } = useLocale();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, authenticated } = useUser();
	const { refetch } = useCheckout();
	const { availableShippingCountries } = useAvailableShippingCountries();
	const shippingAddress = checkout.shippingAddress;

	// Default country: the checkout's saved address wins; otherwise the MARKET's home country
	// (central market config — a cz-czk checkout defaults to CZ, not to the alphabetically first
	// channel country), falling back to the channel's first available country.
	const marketCountry = CHANNEL_MAP[REVERSE_MAP[checkout.channel.slug] ?? ""]?.country as
		| CountryCode
		| undefined;
	const defaultCountry =
		(shippingAddress?.country?.code as CountryCode) ||
		(marketCountry && availableShippingCountries.includes(marketCountry) ? marketCountry : undefined) ||
		availableShippingCountries[0] ||
		("US" as CountryCode);

	// View state - what sub-view are we showing?
	const [contactView, setContactView] = useState<ContactView>(() => {
		const { passwordResetToken } = getQueryParams(searchParams);
		if (passwordResetToken) return "resetPassword";
		return "main";
	});

	// ----- Contact form state -----
	const [email, setEmail] = useState(checkout.email || "");
	const [createAccount, setCreateAccount] = useState(false);
	const [newsletterConsent, setNewsletterConsent] = useState(false);
	const [accountPassword, setAccountPassword] = useState("");

	// ----- Address form state (for guests/new address) -----
	const [countryCode, setCountryCode] = useState<CountryCode>(defaultCountry);
	const [formData, setFormData] = useState<Record<string, string>>(() => ({
		firstName: shippingAddress?.firstName || "",
		lastName: shippingAddress?.lastName || "",
		streetAddress1: shippingAddress?.streetAddress1 || "",
		streetAddress2: shippingAddress?.streetAddress2 || "",
		companyName: shippingAddress?.companyName || "",
		city: shippingAddress?.city || "",
		postalCode: shippingAddress?.postalCode || "",
		countryArea: shippingAddress?.countryArea || "",
		cityArea: shippingAddress?.cityArea || "",
		phone: shippingAddress?.phone || "",
	}));

	// ----- Address selection state (for logged-in users) -----
	// Check if checkout's shipping address matches any saved address
	const findMatchingAddressId = (): string | null => {
		if (!shippingAddress || !user?.addresses?.length) return null;
		const match = user.addresses.find((addr) => isMatchingAddressData(addr, shippingAddress));
		return match?.id || null;
	};

	const [selectedAddressId, setSelectedAddressId] = useState<string | null>(() => {
		// First, check if checkout's address matches a saved address
		const matchingId = findMatchingAddressId();
		if (matchingId) return matchingId;
		// Otherwise, use defaults
		if (user?.defaultShippingAddress?.id) return user.defaultShippingAddress.id;
		if (user?.addresses?.[0]?.id) return user.addresses[0].id;
		return null;
	});

	// If checkout has an address that doesn't match any saved address, show the form
	const [showNewAddressForm, setShowNewAddressForm] = useState(() => {
		if (!shippingAddress) return false;
		if (!user?.addresses?.length) return false;
		// If there's a shipping address but it doesn't match any saved address, show the form
		const matchingId = findMatchingAddressId();
		return !matchingId && Boolean(shippingAddress.streetAddress1);
	});

	// Sync local state with checkout data when it updates (e.g. after auto-login)
	useEffect(() => {
		if (checkout.email) {
			setEmail(checkout.email);
		}
	}, [checkout.email]);

	// Sync form data with checkout's shipping address - but only when NOT entering a new address
	useEffect(() => {
		if (shippingAddress && !showNewAddressForm) {
			setCountryCode((shippingAddress.country?.code as CountryCode) || defaultCountry);
			setFormData({
				firstName: shippingAddress.firstName || "",
				lastName: shippingAddress.lastName || "",
				streetAddress1: shippingAddress.streetAddress1 || "",
				streetAddress2: shippingAddress.streetAddress2 || "",
				companyName: shippingAddress.companyName || "",
				city: shippingAddress.city || "",
				postalCode: shippingAddress.postalCode || "",
				countryArea: shippingAddress.countryArea || "",
				cityArea: shippingAddress.cityArea || "",
				phone: shippingAddress.phone || "",
			});
		}
	}, [shippingAddress, showNewAddressForm]);

	// Update selected address when user data loads
	useEffect(() => {
		if (user && !selectedAddressId && !showNewAddressForm) {
			// First check if checkout's address matches a saved address
			if (shippingAddress && user.addresses?.length) {
				const match = user.addresses.find((addr) => isMatchingAddressData(addr, shippingAddress));
				if (match) {
					setSelectedAddressId(match.id);
					return;
				}
				// If shipping address exists but doesn't match, show form
				if (shippingAddress.streetAddress1) {
					setShowNewAddressForm(true);
					return;
				}
			}
			// Fall back to defaults
			if (user.defaultShippingAddress?.id) {
				setSelectedAddressId(user.defaultShippingAddress.id);
			} else if (user.addresses?.[0]?.id) {
				setSelectedAddressId(user.addresses[0].id);
			}
		}
	}, [user, selectedAddressId, showNewAddressForm, shippingAddress]);

	// ----- Validation & Errors -----
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	// A change refused because a payment is in progress (contract revision 2, §5): the panel that ends the payment
	// takes the place of the error line. The key starts it afresh each time a change is refused.
	const [paymentLock, setPaymentLock] = useState({ key: 0, shown: false });

	// Country-specific address configuration
	const { orderedAddressFields, getFieldLabel, isRequiredField, countryAreaChoices, rulesKnown } =
		useAddressFormUtils(countryCode);

	// ----- Company purchase (MAKY-B2B-V1) -----
	const b2b = useCheckoutB2b();
	const b2bUiEnabled = b2b.config.uiEnabled;
	const meetPaymentLock = useCallback(() => {
		// With the B2B checkout switched off the step says what it said before; the way out is offered only with it on.
		if (!b2bUiEnabled) {
			setFormError(t("payment.checkoutLocked"));
			return;
		}
		setFormError(null);
		setPaymentLock((current) => ({ key: current.key + 1, shown: true }));
	}, [b2bUiEnabled, t]);
	const [b2bValue, setB2bValue] = useState<B2bCompanyFieldsValue>(() =>
		initialCompanyFieldsValue(checkout, b2b.input, defaultCountry),
	);
	const [b2bErrors, setB2bErrors] = useState<Record<string, string>>({});
	const [b2bAttention, setB2bAttention] = useState(false);
	const billingUtils = useAddressFormUtils(b2bValue.billingCountry);

	// The delivery country the "same as delivery" billing company sits in: the saved address picked, or the form.
	const selectedSavedAddress =
		authenticated && user?.addresses?.length && !showNewAddressForm && selectedAddressId
			? user.addresses.find((address) => address.id === selectedAddressId)
			: undefined;
	const deliveryCountry = (selectedSavedAddress?.country?.code as CountryCode | undefined) ?? countryCode;
	const canUseShippingAddress = checkout.isShippingRequired;

	const handleB2bChange = (next: B2bCompanyFieldsValue) => {
		setB2bValue(next);
		setB2bErrors({});
		setFormError(null);
		// What was said about the stored data no longer describes what is being typed, and an answer still on its
		// way (a check started before this edit) is dropped instead of being shown for these values.
		setB2bAttention(false);
		b2b.invalidate();
	};

	/** Client-side checks of the company block; returns the errors (keys as rendered by B2bCompanyFields). */
	const validateCompany = useCallback((): {
		errors: Record<string, string>;
		result: ReturnType<typeof validateB2bForm>;
	} => {
		const sameAsShipping = canUseShippingAddress && b2bValue.billingSameAsShipping;
		const billingCountry = sameAsShipping ? deliveryCountry : b2bValue.billingCountry;
		const result = validateB2bForm(
			{
				isBusiness: b2bValue.isBusiness,
				companyName: b2bValue.companyName,
				registrationId: b2bValue.registrationId,
				taxId: b2bValue.taxId,
				vatId: b2bValue.vatId,
			},
			billingCountry,
			{ euMarket: b2b.euMarket },
		);
		const found: Record<string, string> = {};
		if (!result.ok) {
			for (const [field, code] of Object.entries(result.errors) as [
				keyof B2bFormErrors,
				NonNullable<B2bFormErrors[keyof B2bFormErrors]>,
			][]) {
				found[field] = t(companyFieldErrorKey(field, code));
			}
		}
		if (b2bValue.isBusiness && !sameAsShipping) {
			billingUtils.orderedAddressFields.forEach((field) => {
				if (field !== "companyName" && billingUtils.isRequiredField(field) && !b2bValue.billingForm[field]) {
					found[`billing.${field}`] = t("addressForm.fieldRequired", {
						field: billingUtils.getFieldLabel(field),
					});
				}
			});
		}
		return { errors: found, result };
	}, [canUseShippingAddress, b2bValue, deliveryCountry, b2b.euMarket, t, billingUtils]);

	/**
	 * Saves the company block through the existing controlled paths and asks for the backend's decision:
	 * billing address (with the company name) → `maky.b2b.input.v1` → evaluateB2B. Returns false when the customer
	 * has to look at something first (the status card says what).
	 *
	 * `acceptTaxedFor` is the taxed quote the customer accepted with "Pokračovať s DPH": the data are saved and
	 * checked first like on the main button, and the customer goes on with VAT only when the answer is that very
	 * quote (same reason, same total). `shippingFields` are the delivery inputs on screen, for Saleor's errors.
	 */
	const saveCompany = useCallback(
		async (
			validated: ReturnType<typeof validateB2bForm>,
			shippingInput: Parameters<typeof checkoutShippingAddressUpdateAction>[0]["shippingAddress"] | null,
			options: { acceptTaxedFor: string | null; shippingFields: readonly string[] },
		): Promise<boolean> => {
			if (!validated.ok) return false;
			const turningOff = !b2bValue.isBusiness;
			// As the company block shows it: "same as delivery" copies the delivery address being saved.
			const sameAsShipping = canUseShippingAddress && b2bValue.billingSameAsShipping;

			const billingInput = turningOff
				? billingWhenCompanyOff(
						b2bValue,
						{ sameAsShippingOffered: canUseShippingAddress, storedBilling: checkout.billingAddress },
						shippingInput ?? null,
					)
				: companyBillingAddressInput(
						{ ...b2bValue, billingSameAsShipping: sameAsShipping },
						validated.companyName,
						shippingInput ?? null,
					);

			if (billingInput) {
				const billingResult = await checkoutBillingAddressUpdateAction(
					{ checkoutId: checkout.id, billingAddress: billingInput },
					locale,
				);
				if (billingResult.error) {
					setFormError(t("b2b.errors.saveFailed"));
					return false;
				}
				const billingErrors = billingResult.data?.checkoutBillingAddressUpdate?.errors ?? [];
				if (billingErrors.some((error) => isCheckoutLockedCode(error.code))) {
					meetPaymentLock();
					return false;
				}
				if (billingErrors.some((error) => isTaxContextChangedCode(error.code))) {
					setFormError(t("payment.orderUpdated"));
					return false;
				}
				if (billingErrors.length) {
					// Saleor's message at the input it is about: the delivery form for "same as delivery", the company
					// block's billing form otherwise; anything else on the form, never on an input that is not shown.
					const placed = placeBillingErrors(
						billingErrors,
						{
							sameAsShipping,
							billingFields:
								turningOff || sameAsShipping
									? []
									: billingUtils.orderedAddressFields.filter((field) => field !== "companyName"),
							shippingFields: options.shippingFields,
						},
						t("errors.invalidValue"),
					);
					setErrors((previous) => ({ ...previous, ...placed.shipping }));
					setB2bErrors(placed.company);
					if (placed.form.length) setFormError(placed.form.join(" "));
					return false;
				}
			}

			const saved = await saveB2bInputAction({ checkoutId: checkout.id, input: validated.input });
			if (!saved.ok) {
				if (saved.code === "CHECKOUT_LOCKED") meetPaymentLock();
				else setFormError(t("b2b.errors.saveFailed"));
				return false;
			}

			// US/CA: a company name and address, no VIES (zadanie 02, §2).
			if (!b2b.euMarket) return true;

			// "Pokračovať s DPH" asks with "confirm": a verified taxed decision that still answers for these data is
			// reused (no new VIES call), so the total the customer accepted does not change under them.
			const evaluation = await b2b.evaluate(options.acceptTaxedFor ? "confirm" : "evaluate");
			if (evaluation && confirmsTaxedQuote(evaluation, options.acceptTaxedFor)) {
				b2b.confirmTaxed(options.acceptTaxedFor);
				return true;
			}
			// No answer (the call failed, or an edit made it stale; the status card then says the state is unconfirmed)
			// is not a green light either.
			if (!evaluation || needsAttention(evaluation.outcome)) {
				if (options.acceptTaxedFor && evaluation?.outcome.kind === "taxed") {
					// Accepted for other data or another total: the card shows the quote as it is now, this says why.
					setFormError(t("payment.orderUpdated"));
				}
				// Leaving the company purchase hides the company block and its status card: say it on the form.
				if (turningOff) {
					const kind = evaluation?.outcome.kind;
					if (kind === "locked") meetPaymentLock();
					else setFormError(t(kind === "changed" ? "payment.orderUpdated" : "payment.finalStateUnconfirmed"));
				}
				setB2bAttention(true);
				return false;
			}
			return true;
		},
		[
			b2bValue,
			checkout.billingAddress,
			checkout.id,
			canUseShippingAddress,
			locale,
			t,
			b2b,
			billingUtils.orderedAddressFields,
			meetPaymentLock,
		],
	);

	// ----- Event Handlers -----
	const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

	const handleEmailChange = (value: string) => {
		setEmail(value);
		if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
	};

	const handleEmailBlur = () => {
		if (email && !validateEmail(email)) {
			setErrors((prev) => ({ ...prev, email: t("info.emailInvalid") }));
		}
	};

	const handleFieldChange = (field: string, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
	};

	const handleCountryChange = (value: string) => {
		setCountryCode(value as CountryCode);
		setFormData((prev) => ({ ...prev, countryArea: "" }));
	};

	const handleShowNewAddressForm = (show: boolean) => {
		setShowNewAddressForm(show);
		if (show) {
			// Clear form for new address entry
			setFormData({
				firstName: "",
				lastName: "",
				streetAddress1: "",
				streetAddress2: "",
				companyName: "",
				city: "",
				postalCode: "",
				countryArea: "",
				cityArea: "",
				phone: "",
			});
			setErrors({});
		} else {
			// Going back to saved addresses - restore from checkout if available
			if (shippingAddress) {
				setCountryCode((shippingAddress.country?.code as CountryCode) || defaultCountry);
				setFormData({
					firstName: shippingAddress.firstName || "",
					lastName: shippingAddress.lastName || "",
					streetAddress1: shippingAddress.streetAddress1 || "",
					streetAddress2: shippingAddress.streetAddress2 || "",
					companyName: shippingAddress.companyName || "",
					city: shippingAddress.city || "",
					postalCode: shippingAddress.postalCode || "",
					countryArea: shippingAddress.countryArea || "",
					cityArea: shippingAddress.cityArea || "",
					phone: shippingAddress.phone || "",
				});
			}
			setErrors({});
		}
	};

	// ----- Submit Logic -----
	/**
	 * Validate, save, ask, go on — the one path for the main button and for "Pokračovať s DPH" (`acceptTaxedFor`, the
	 * quote the customer accepted), so neither can carry the customer on with data that were not saved and checked.
	 */
	const submitInformation = useCallback(
		async (acceptTaxedFor: string | null) => {
			const newErrors: Record<string, string> = {};

			// Validate email (guests only)
			if (!authenticated) {
				if (!email) newErrors.email = t("info.emailRequired");
				else if (!validateEmail(email)) newErrors.email = t("info.emailInvalid");

				if (createAccount) {
					if (!accountPassword) newErrors.password = t("info.passwordRequired");
					else if (accountPassword.length < 8) newErrors.password = t("info.passwordTooShort");
				}
			}

			// Validate shipping address (if required)
			if (checkout.isShippingRequired) {
				if (authenticated && user?.addresses?.length && !showNewAddressForm) {
					if (!selectedAddressId) {
						newErrors.address = t("info.selectShippingAddress");
					}
				} else {
					orderedAddressFields.forEach((field) => {
						if (isRequiredField(field) && !formData[field]) {
							newErrors[field] = t("addressForm.fieldRequired", { field: getFieldLabel(field) });
						}
					});
				}
			}

			setFormError(null);
			setPaymentLock((current) => (current.shown ? { ...current, shown: false } : current));
			const company = b2b.config.uiEnabled ? validateCompany() : null;
			setB2bErrors(company?.errors ?? {});
			if (company && Object.keys(company.errors).length > 0 && Object.keys(newErrors).length === 0) {
				const first = Object.keys(company.errors)[0];
				const id = first.startsWith("billing.")
					? `b2b-billing-${first.slice(8)}`
					: `b2b-${first.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
				(document.getElementById(id) as HTMLElement | null)?.focus();
				setErrors(newErrors);
				return;
			}

			setErrors(newErrors);
			if (Object.keys(newErrors).length > 0) {
				// Focus the first invalid field
				const firstErrorField = Object.keys(newErrors)[0];
				const element = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
				element?.focus();
				return;
			}

			// The delivery inputs on screen (none when a saved address is picked from the list).
			const shippingFields =
				checkout.isShippingRequired && !(authenticated && user?.addresses?.length && !showNewAddressForm)
					? orderedAddressFields
					: [];

			// ----- Save to Saleor -----
			setIsSubmitting(true);
			try {
				// Update email (guests)
				if (!authenticated) {
					const emailResult = await checkoutEmailUpdateAction(
						{
							checkoutId: checkout.id,
							email,
						},
						locale,
					);
					if (emailResult.error) {
						setErrors({ email: t("info.emailSaveFailed") });
						return;
					}
					const emailErrors = emailResult.data?.checkoutEmailUpdate?.errors;
					if (emailErrors?.length) {
						const errorMap: Record<string, string> = {};
						emailErrors.forEach((err) => {
							errorMap[err.field || "email"] = err.message || t("errors.invalidValue");
						});
						setErrors(errorMap);
						return;
					}

					// Create account if requested
					if (createAccount && accountPassword) {
						const registerResult = await userRegisterAction({
							input: {
								email,
								password: accountPassword,
								channel: checkout.channel.slug,
								redirectUrl: window.location.href,
							},
						});
						if (registerResult.data?.accountRegister?.errors?.length) {
							const err = registerResult.data.accountRegister.errors[0];
							if (err.code !== "UNIQUE") {
								setErrors({ password: err.message || t("info.accountCreateFailed") });
								return;
							}
						}
					}
				}

				// Update shipping address
				let savedShippingInput:
					| Parameters<typeof checkoutShippingAddressUpdateAction>[0]["shippingAddress"]
					| null = null;
				if (checkout.isShippingRequired) {
					let addressInput;
					if (authenticated && user?.addresses?.length && selectedAddressId && !showNewAddressForm) {
						const selectedAddress = user.addresses.find((a) => a.id === selectedAddressId);
						if (selectedAddress) {
							addressInput = getAddressInputDataFromAddress(selectedAddress);
						}
					} else {
						addressInput = getAddressInputData({ ...formData, countryCode });
					}

					if (addressInput) {
						const addressResult = await checkoutShippingAddressUpdateAction(
							{
								checkoutId: checkout.id,
								shippingAddress: addressInput,
							},
							locale,
						);

						if (addressResult.error) {
							setErrors({ streetAddress1: t("info.addressSaveFailed") });
							return;
						}
						const addressErrors = addressResult.data?.checkoutShippingAddressUpdate?.errors;
						// A payment in progress is not an invalid address (zadanie 02, §4).
						if (addressErrors?.some((err) => isCheckoutLockedCode(err.code))) {
							meetPaymentLock();
							return;
						}
						if (addressErrors?.length) {
							const errorMap: Record<string, string> = {};
							addressErrors.forEach((err) => {
								const field = err.field || "streetAddress1";
								errorMap[field] = err.message || t("errors.invalidValue");
							});
							setErrors(errorMap);
							return;
						}
						savedShippingInput = addressInput;
					}
				}

				// Company purchase: billing company, input metadata and the backend's decision, in that order.
				if (company && (b2bValue.isBusiness || b2b.input?.isBusiness)) {
					const proceed = await saveCompany(company.result, savedShippingInput, {
						acceptTaxedFor,
						shippingFields,
					});
					if (!proceed) {
						await refetch();
						return;
					}
				} else {
					// An ordinary purchase (no company, or B2B switched off altogether): a billing address that was only a
					// copy of the delivery address (the Payment step's "same as delivery") follows the new delivery address,
					// so a failed payment and a delivery change do not leave the old copy on the invoice. A billing address
					// of the customer's own is never touched.
					const follow = billingToFollowShipping(checkout, savedShippingInput);
					if (follow) {
						const billingResult = await checkoutBillingAddressUpdateAction(
							{ checkoutId: checkout.id, billingAddress: follow },
							locale,
						);
						// Not refetched on a failure: the stored copy is what makes the next attempt follow again.
						if (billingResult.error) {
							setFormError(t("info.addressSaveFailed"));
							return;
						}
						const billingErrors = billingResult.data?.checkoutBillingAddressUpdate?.errors ?? [];
						if (billingErrors.some((error) => isCheckoutLockedCode(error.code))) {
							meetPaymentLock();
							return;
						}
						if (billingErrors.some((error) => isTaxContextChangedCode(error.code))) {
							setFormError(t("payment.orderUpdated"));
							return;
						}
						if (billingErrors.length) {
							const placed = placeBillingErrors(
								billingErrors,
								{ sameAsShipping: true, billingFields: [], shippingFields },
								t("errors.invalidValue"),
							);
							setErrors(placed.shipping);
							if (placed.form.length) setFormError(placed.form.join(" "));
							return;
						}
					}
				}

				// Save succeeded — pull the updated checkout (email + shipping address) into the
				// CheckoutDataProvider BEFORE the shallow step change, so the Shipping step reads the
				// fresh snapshot. B.4.3's shallow `?step=` no longer re-runs the RSC that used to refresh
				// it incidentally. This runs only on a real save (after the mutations), never on a bare
				// stepper jump — the shallow-routing property is preserved.
				if (newsletterConsent) {
					// Durable, auditable consent (checkout metadata -> order metadata). Never blocks
					// the purchase: a failed save is logged, the checkout continues.
					const consentResult = await updateNewsletterConsentAction({
						checkoutId: checkout.id,
						consent: true,
						market: checkout.channel.slug,
						localeSlug: locale,
					});
					if (!consentResult.ok) {
						console.error("Newsletter consent could not be saved");
					}
				}

				await refetch();
				onNext();
			} finally {
				setIsSubmitting(false);
			}
		},
		[
			authenticated,
			email,
			createAccount,
			accountPassword,
			checkout,
			user?.addresses,
			showNewAddressForm,
			selectedAddressId,
			orderedAddressFields,
			isRequiredField,
			getFieldLabel,
			formData,
			countryCode,
			onNext,
			refetch,
			t,
			locale,
			newsletterConsent,
			b2b,
			b2bValue,
			validateCompany,
			saveCompany,
			meetPaymentLock,
		],
	);

	const handleSubmit = useCallback(
		(event?: React.FormEvent) => {
			event?.preventDefault();
			void submitInformation(null);
		},
		[submitInformation],
	);

	// ----- Render: Password Reset -----
	if (contactView === "resetPassword") {
		return (
			<div className="space-y-8">
				<ResetPasswordForm
					onSuccess={() => setContactView("main")}
					onBackToSignIn={() => {
						const newQuery = createQueryString(searchParams, {
							passwordResetToken: null,
							passwordResetEmail: null,
						});
						router.replace(`?${newQuery}`, { scroll: false });
						setContactView("signIn");
					}}
				/>
			</div>
		);
	}

	// ----- Render: Sign In -----
	if (contactView === "signIn") {
		return (
			<div className="space-y-8">
				<SignInForm
					initialEmail={email}
					channelSlug={checkout.channel.slug}
					onSuccess={async () => {
						// BFF cookies are set — bust cached chrome and re-run the RSC loader so
						// CheckoutUserProvider picks up the signed-in user (B.4.5).
						await syncAuthSurfacesAfterSignIn(checkout.channel.slug, router);
						setContactView("main");
					}}
					onGuestCheckout={() => setContactView("main")}
				/>
			</div>
		);
	}

	// ----- Company status (only for what is stored: a value being typed has no status yet) -----
	const b2bStatus =
		b2b.config.uiEnabled && b2bValue.isBusiness && b2b.businessMode && b2b.euMarket
			? b2bStatusMessage({
					outcome: b2b.outcome,
					pending: b2b.pending,
					vies: b2b.vies,
					hasVatId: Boolean(b2b.input?.vatId),
					exemptionAvailable: b2b.exemptionAvailable,
				})
			: null;

	const recheckCompany = async () => {
		const evaluation = await b2b.evaluate("evaluate");
		if (evaluation && !needsAttention(evaluation.outcome)) setB2bAttention(false);
	};

	// The company check found the checkout locked (a started payment): the same panel as a refused save.
	const outcomeLocked = b2bStatus !== null && b2b.outcome?.kind === "locked";
	const showPaymentLock = b2b.config.uiEnabled && (paymentLock.shown || outcomeLocked);
	const onPaymentLockReleased = () => {
		// Stays on screen to say the payment is gone; the customer saves the change again themselves. Nothing is read
		// back here: a new checkout from Saleor would put the stored address back into the form over what the customer
		// typed (the sync effect above). The next save reads the checkout as it always does.
		setPaymentLock((current) => ({ ...current, shown: true }));
		// Locked by the company check: what the customer sent is already stored, so the check can simply run again.
		if (outcomeLocked) void recheckCompany();
	};

	// ----- Render: Main Form -----
	const buttonText = isSubmitting
		? t("common.saving")
		: checkout.isShippingRequired
			? t("info.continueToShipping")
			: t("info.continueToPayment");

	// While the step saves or the company is being checked nothing can be edited, so every answer is about the values
	// that were sent. With B2B off the form behaves as it did before.
	const locked = b2b.config.uiEnabled && (isSubmitting || b2b.pending);

	return (
		<form className="space-y-8" onSubmit={handleSubmit} noValidate aria-busy={locked || undefined}>
			<fieldset disabled={locked} className="m-0 min-w-0 space-y-8 border-0 p-0">
				<ContactSection
					isSignedIn={authenticated}
					user={user}
					onSignOut={() => {}} // User signs out via header
					onSignInClick={() => setContactView("signIn")}
					email={email}
					onEmailChange={handleEmailChange}
					onEmailBlur={handleEmailBlur}
					emailError={errors.email}
					createAccount={createAccount}
					onCreateAccountChange={setCreateAccount}
					password={accountPassword}
					onPasswordChange={setAccountPassword}
					passwordError={errors.password}
				/>

				{/* Newsletter opt-in — persisted via checkout metadata, carried onto the order (auditable). */}
				<div className="flex items-center gap-2">
					<Checkbox
						id="newsletterConsent"
						checked={newsletterConsent}
						onCheckedChange={(checked) => setNewsletterConsent(checked === true)}
					/>
					<Label htmlFor="newsletterConsent" className="text-muted-foreground cursor-pointer text-sm">
						{t("info.newsletterLabel")}
					</Label>
				</div>

				{checkout.isShippingRequired && (
					<ShippingAddressSection
						isAuthenticated={authenticated}
						userAddresses={user?.addresses || []}
						defaultAddressId={user?.defaultShippingAddress?.id}
						selectedAddressId={selectedAddressId}
						onSelectAddress={setSelectedAddressId}
						showNewAddressForm={showNewAddressForm}
						onShowNewAddressForm={handleShowNewAddressForm}
						countryCode={countryCode}
						onCountryChange={handleCountryChange}
						availableCountries={availableShippingCountries}
						formData={formData}
						onFieldChange={handleFieldChange}
						errors={errors}
						orderedAddressFields={orderedAddressFields}
						getFieldLabel={getFieldLabel}
						isRequiredField={isRequiredField}
						rulesKnown={rulesKnown}
						countryAreaChoices={countryAreaChoices}
					/>
				)}

				{b2b.config.uiEnabled ? (
					<B2bCompanyFields
						value={b2bValue}
						onChange={handleB2bChange}
						shippingCountry={deliveryCountry}
						canUseShippingAddress={canUseShippingAddress}
						euMarket={b2b.euMarket}
						availableCountries={availableShippingCountries}
						errors={b2bErrors}
						disabled={isSubmitting || b2b.pending}
					/>
				) : null}

				{b2bStatus && !outcomeLocked ? (
					<B2bStatusNotice
						message={b2bStatus}
						pending={b2b.pending}
						on={{
							// The main button's path: an edit made after the card appeared is saved and checked first.
							continueWithVat: b2bAttention ? () => void submitInformation(b2b.quoteKey) : undefined,
							retry: () => void recheckCompany(),
							recheck: () => void recheckCompany(),
							refreshStatus: () => void recheckCompany(),
						}}
					/>
				) : null}

				{showPaymentLock ? (
					<PaymentLockRecovery
						key={paymentLock.key}
						checkoutId={checkout.id}
						channelSlug={checkout.channel.slug}
						localeSlug={locale}
						subject="details"
						onReleased={onPaymentLockReleased}
						payOriginal={onGoToPayment ? { onClick: onGoToPayment } : undefined}
						finishOrder={onGoToPayment ? { onClick: onGoToPayment } : undefined}
					/>
				) : null}

				{formError ? (
					<p role="alert" className="text-destructive text-sm">
						{formError}
					</p>
				) : null}

				<Button
					type="submit"
					disabled={isSubmitting}
					className="hidden h-14 w-full text-base font-semibold md:flex"
				>
					{buttonText}
				</Button>

				<MobileStickyAction
					step={getStepNumber("INFO", checkout.isShippingRequired)}
					isShippingRequired={checkout.isShippingRequired}
					type="submit"
					onAction={handleSubmit}
					isLoading={isSubmitting}
					loadingText={t("common.saving")}
				/>
			</fieldset>
		</form>
	);
};
