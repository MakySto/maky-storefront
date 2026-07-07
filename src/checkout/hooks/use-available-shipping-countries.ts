import type { CountryCode } from "@/checkout/graphql";
import { useCheckoutData } from "@/checkout/providers/checkout-data";

interface UseAvailableShippingCountries {
	availableShippingCountries: CountryCode[];
}

/**
 * Countries the checkout channel ships to. Fetched once server-side by the RSC loader and read
 * from context here (replaces the urql `useChannelQuery`).
 */
export const useAvailableShippingCountries = (): UseAvailableShippingCountries => {
	const { shippingCountries } = useCheckoutData();

	return { availableShippingCountries: shippingCountries };
};
