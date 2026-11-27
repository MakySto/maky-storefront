import { Fragment } from "react";

import { keepTogetherParts } from "@/lib/text/keep-together";

/**
 * Prints `text` so that a model designation or a tyre size in it stays on one line: "CX-60",
 * "T-Roc", "205/55" (`lib/text/keep-together.ts` says which tokens and why).
 *
 * The characters are the text's own; only the wrapping changes. No hooks, so it renders on either
 * side of the client boundary.
 */
export function KeepTogether({ text }: { text: string }) {
	const parts = keepTogetherParts(text);
	if (parts.length === 1 && !parts[0].keep) return <>{text}</>;
	return (
		<>
			{parts.map((part, index) =>
				part.keep ? (
					<span key={index} className="whitespace-nowrap">
						{part.text}
					</span>
				) : (
					<Fragment key={index}>{part.text}</Fragment>
				),
			)}
		</>
	);
}
