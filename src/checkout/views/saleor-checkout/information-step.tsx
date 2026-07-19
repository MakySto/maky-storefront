"use client";

import { useState, useEffect, useCallback, type FC } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "@/providers/locale-provider";
import { Button } from "@/ui/components/ui/button";
import { type CheckoutFragment, type CountryCode } from "@/checkout/graphql";
import {
	checkoutEmailUpdateAction,
	checkoutShippingAddressUpdateAction,
	userRegisterAction,
	updateNewsletterConsentAction,
} from "@/checkout/lib/actions";
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
}

// =============================================================================
// Main Component
// =============================================================================

export const InformationStep: FC<InformationStepProps> = ({ checkout, onNext }) => {
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

	// Country-specific address configuration
	const { orderedAddressFields, getFieldLabel, isRequiredField, countryAreaChoices } =
		useAddressFormUtils(countryCode);

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
	const handleSubmit = useCallback(
		async (event?: React.FormEvent) => {
			if (event) {
				event.preventDefault();
			}

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

			setErrors(newErrors);
			if (Object.keys(newErrors).length > 0) {
				// Focus the first invalid field
				const firstErrorField = Object.keys(newErrors)[0];
				const element = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
				element?.focus();
				return;
			}

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
						if (addressErrors?.length) {
							const errorMap: Record<string, string> = {};
							addressErrors.forEach((err) => {
								const field = err.field || "streetAddress1";
								errorMap[field] = err.message || t("errors.invalidValue");
							});
							setErrors(errorMap);
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
			checkout.isShippingRequired,
			checkout.id,
			checkout.channel.slug,
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
		],
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

	// ----- Render: Main Form -----
	const buttonText = isSubmitting
		? t("common.saving")
		: checkout.isShippingRequired
			? t("info.continueToShipping")
			: t("info.continueToPayment");

	return (
		<form className="space-y-8" onSubmit={handleSubmit} noValidate>
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
					countryAreaChoices={countryAreaChoices}
				/>
			)}

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
		</form>
	);
};
