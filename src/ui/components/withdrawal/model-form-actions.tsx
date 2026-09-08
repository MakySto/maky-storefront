"use client";

/**
 * Print and download for the statutory model form.
 *
 * Both work from the same string the page renders, so the printed sheet and the
 * downloaded file cannot say different things. Plain text rather than a generated PDF:
 * a PDF would mean a new dependency, and a text file is the more accessible artefact
 * anyway — it opens everywhere, reflows, and a screen reader can read it.
 */
export function ModelFormActions({
	text,
	fileName = "vzorovy-formular-odstupenie-od-zmluvy.txt",
	printLabel = "Vytlačiť formulár",
	downloadLabel = "Stiahnuť formulár (.txt)",
}: {
	text: string;
	/** Download filename. Defaults to the Slovak one so existing callers are unchanged. */
	fileName?: string;
	printLabel?: string;
	downloadLabel?: string;
}) {
	function download() {
		const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = fileName;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
	}

	const buttonClass =
		"border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted focus-visible:ring-focus-ring inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none";

	return (
		<div className="not-prose mb-6 flex flex-wrap gap-3 print:hidden">
			<button type="button" onClick={() => window.print()} className={buttonClass}>
				{printLabel}
			</button>
			<button type="button" onClick={download} className={buttonClass}>
				{downloadLabel}
			</button>
		</div>
	);
}
