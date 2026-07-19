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
			securingWithStripe: "Zabezpečujeme vašu platbu cez Stripe. Zvyčajne to trvá pár sekúnd.",
			methodRequired: "Nepodarilo sa určiť vybraný spôsob platby. Vyberte spôsob platby a skúste to znova.",
			detailsUnavailable: "Nepodarilo sa načítať údaje o platbe. Skúste to znova.",
			expressReset:
				"Tlačidlá expresnej platby sa obnovili skôr, než sa platba stihla potvrdiť. Skúste to znova.",
			formReset:
				"Platobný formulár sa obnovil skôr, než sa karta stihla potvrdiť. Skúste zaplatiť znova bez obnovenia stránky.",
			bankDeclined: "Vaša banka platbu zamietla. Skúste to znova alebo použite inú kartu.",
			sessionExpired: "Platnosť platobnej relácie po presmerovaní vypršala. Skúste to znova.",
			channelUnresolved: "Po platbe sa nepodarilo určiť predajný kanál objednávky. Kontaktujte podporu.",
			stripeConfigFailed: "Konfigurácia platobnej brány Stripe zlyhala",
			stripeKeyMissing:
				"Chýba publikovateľný kľúč Stripe. Skontrolujte konfiguráciu aplikácie Stripe v Saleor Dashboarde.",
			stripeLoadTitle: "Stripe sa nepodarilo načítať",
			interruptedBeforeCharge:
				"Platba bola prerušená ešte pred zaúčtovaním. Môžete to bezpečne skúsiť znova.",
			interruptedAfterAuthorize:
				"Vaša platba prebehla, ale objednávka ešte nebola vytvorená. Neplaťte znova — dokončite ju tlačidlom „Dokončiť objednávku“ nižšie.",
			verificationUnavailable:
				"Nepodarilo sa overiť váš predchádzajúci pokus o platbu. Obnovte stránku — neplaťte znova, kým sa stav neoverí.",
			authorizedTitle: "Platba je autorizovaná — dokončite objednávku",
			authorizedBody:
				"Vaša platba je autorizovaná (zaúčtuje sa pri vybavení objednávky). Objednávku dokončite tlačidlom nižšie — pri dokončení nebudete platiť znova.",
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
