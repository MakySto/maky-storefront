/**
 * Takes the customer to the first input that has an error: the one highest on the page among `ids`, focused and
 * brought into view. On a phone the button that sends the form is fixed to the bottom of the screen, so without this
 * an error at the top of a long form is said where nobody is looking. An id with no element (an error that belongs
 * to no input) is skipped.
 */
export function focusFirstInvalidField(ids: readonly string[]): void {
	if (typeof document === "undefined") return;
	const elements = ids
		.map((id) => document.getElementById(id))
		.filter((element): element is HTMLElement => element !== null);
	if (!elements.length) return;
	elements.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
	const first = elements[0];
	first.focus({ preventScroll: true });
	first.scrollIntoView({ block: "center" });
}
