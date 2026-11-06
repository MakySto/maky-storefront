import { tyreChoiceFromMetadata, tyreChoiceKey, type MetadataItem } from "@/lib/tyre-size/line-metadata";

/**
 * What the add-to-cart action reads from a checkout it was handed: the lines, their quantities, and for a snow
 * chain or sock the tyre size each line holds.
 *
 * Kept out of `actions.ts` because that file is `"use server"`, which may export async functions only, and these
 * are plain functions a test should reach without a server action's shell.
 */
export type CartLineLike = {
	id?: string;
	quantity: number;
	/** The line's public metadata. Absent on a checkout that was just created (it has no lines yet). */
	metadata?: readonly MetadataItem[] | null;
	variant?: { id?: string } | null;
};

export type LinesHolder = { lines?: readonly CartLineLike[] | null };

/** The tyre choice a line holds, as a comparable key; `""` for a line that holds none. */
export function choiceKeyOfLine(line: CartLineLike): string {
	return tyreChoiceKey(tyreChoiceFromMetadata(line.metadata));
}

/**
 * How many of a variant the cart holds.
 *
 * `choiceKey` null is every other product in the shop: all lines of the variant, summed, as before. With a key it
 * is a snow chain or sock, and only the lines holding that very size count: 2 pieces of 205/55 R16 and 1 piece of
 * 195/65 R15 on one code are two lines, and asking "did my line land" about the first must not be answered by the
 * second. `variantId` must already be decoded.
 */
export function quantityOfVariant(
	checkout: LinesHolder | null | undefined,
	variantId: string,
	choiceKey: string | null = null,
): number {
	return (checkout?.lines ?? [])
		.filter((line) => line.variant?.id === variantId)
		.filter((line) => choiceKey === null || choiceKeyOfLine(line) === choiceKey)
		.reduce((total, line) => total + line.quantity, 0);
}

/** The cart line of a variant that holds exactly this tyre choice, or `null`. The first one, were there ever two. */
export function lineOfChoice(
	checkout: LinesHolder | null | undefined,
	variantId: string,
	choiceKey: string,
): (CartLineLike & { id: string }) | null {
	for (const line of checkout?.lines ?? []) {
		if (line.id && line.variant?.id === variantId && choiceKeyOfLine(line) === choiceKey) {
			return line as CartLineLike & { id: string };
		}
	}
	return null;
}
