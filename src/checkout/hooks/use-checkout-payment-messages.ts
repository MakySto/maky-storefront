"use client";

import { useMemo } from "react";

/**
 * User-facing payment copy for checkout pay flows.
 *
 * MAKY (D1/B.7): hardcoded SK map instead of upstream's next-intl `checkout.payment`
 * namespace — same export name + path, so a later i18n pass swaps the body for
 * next-intl without touching consumers. Copy translated to Slovak (B.7).
 */
export function useCheckoutPaymentMessages() {
	return useMemo(
		() => ({
			unavailable: "Platobný systém nie je dostupný. Skúste to znova.",
			initFailed: "Platobný systém sa nepodarilo inicializovať.",
			loadingGateway: (gateway: string) => `Načítavame platobný formulár ${gateway}…`,
			confirmingPayment: "Potvrdzujeme vašu platbu…",
			doNotClose: "Prosím, nezatvárajte ani neobnovujte túto stránku.",
			completeOrderFailed: "Objednávku sa nepodarilo dokončiť. Skúste to znova.",
			placeOrderFailed: "Objednávku sa nepodarilo odoslať. Skúste to znova alebo kontaktujte podporu.",
			totalsRefreshFailed: "Nepodarilo sa obnoviť celkovú cenu objednávky. Skúste to znova.",
			totalUnavailable: "Celková cena objednávky nie je dostupná. Obnovte stránku a skúste to znova.",
			currencyUnavailable: "Mena objednávky nie je dostupná. Obnovte stránku a skúste to znova.",
			validationFailed: "Overenie platby zlyhalo",
			totalChanged: "Celková cena objednávky sa zmenila. Skontrolujte aktualizovanú sumu a skúste to znova.",
			unexpectedError: "Pri dokončovaní platby nastala neočakávaná chyba.",
			dummyGateway: "Testovacia platba",
			failed: "Platba zlyhala",
			freeOrderBody: (total: string) =>
				`Celková cena vašej objednávky je ${total}. Platba nie je potrebná — objednávku dokončíte potvrdením nižšie.`,
			dummyTestMode:
				"Testovací režim. Údaje o karte nie sú potrebné — testovaciu objednávku dokončíte tlačidlom „Objednať s povinnosťou platby“.",
		}),
		[],
	);
}

export type CheckoutPaymentMessages = ReturnType<typeof useCheckoutPaymentMessages>;
