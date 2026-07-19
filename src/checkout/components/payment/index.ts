/** Payment components: provider-resolved payment UI, gateway alerts, billing address. */

export { PaymentGatewayAlerts } from "./payment-gateway-alerts";
export { PaymentMethodArea } from "./payment-method-area";
export { PaymentError } from "./payment-error";
export { DummyPaymentPlaceholder, type DummyPaymentPlaceholderProps } from "./dummy-payment-placeholder";
export { StripePayment, type StripeBillingContext } from "./stripe/stripe-payment";

export {
	BillingAddressSection,
	useBillingAddressValidation,
	type BillingAddressData,
	type BillingAddressSectionProps,
} from "./billing-address-section";
