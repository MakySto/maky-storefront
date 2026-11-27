"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface CartContextType {
	isOpen: boolean;
	openCart: () => void;
	closeCart: () => void;
	toggleCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);

	const openCart = useCallback(() => setIsOpen(true), []);
	const closeCart = useCallback(() => setIsOpen(false), []);
	const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);

	return (
		<CartContext.Provider
			value={{
				isOpen,
				openCart,
				closeCart,
				toggleCart,
			}}
		>
			{children}
		</CartContext.Provider>
	);
}

/**
 * Opens the cart drawer, or `null` where there is no drawer to open.
 *
 * For a component that is also rendered outside the shop's main layout (a preview, a test, a
 * route that has no header): `useCart` throws there, and an add-to-cart form must not stop
 * working because the drawer it would have opened does not exist.
 */
export function useOpenCart(): (() => void) | null {
	return useContext(CartContext)?.openCart ?? null;
}

export function useCart() {
	const context = useContext(CartContext);
	if (!context) {
		throw new Error("useCart must be used within a CartProvider");
	}
	return context;
}
