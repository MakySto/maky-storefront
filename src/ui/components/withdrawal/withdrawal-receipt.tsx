"use client";

import { useEffect, useRef } from "react";
import { type WithdrawalReceipt } from "@/app/[channel]/(main)/odstupenie-od-zmluvy/actions";

function downloadHTML(html: string, filename: string): void {
	const blob = new Blob([html], { type: "text/html;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

/**
 * Immediate V2 acknowledgement.
 *
 * Payload returns only customer-safe, immutable artifacts: the ODS number, the A4
 * confirmation and an optional parcel slip. The A4 is rendered in a sandboxed child
 * document, never injected into the storefront DOM. Scripts, forms and top-level
 * navigation remain disabled; same-origin access is enabled only so the print button
 * can invoke the browser's print dialog for this frame.
 */
export function WithdrawalReceiptPanel({ receipt }: { receipt: WithdrawalReceipt }) {
	const headingRef = useRef<HTMLHeadingElement>(null);
	const confirmationFrameRef = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		headingRef.current?.focus();
	}, []);

	function printConfirmation(): void {
		confirmationFrameRef.current?.contentWindow?.focus();
		confirmationFrameRef.current?.contentWindow?.print();
	}

	return (
		<section
			aria-live="polite"
			className="border-status-success bg-status-success-bg rounded-lg border p-5 print:border-black print:bg-white"
		>
			<h2 ref={headingRef} tabIndex={-1} className="text-text-primary text-xl font-semibold outline-none">
				Odstúpenie od zmluvy sme prijali
			</h2>

			{receipt.duplicate ? (
				<p className="text-text-secondary mt-2 text-sm">
					Toto podanie sme už evidovali. Zobrazujeme pôvodné, nemenné potvrdenie; nové podanie nevzniklo.
				</p>
			) : null}

			<p className="text-text-secondary mt-3 text-sm">
				Číslo podania: <strong className="text-text-primary">{receipt.submissionNumber}</strong>
			</p>
			<p className="text-text-secondary mt-2 text-sm">
				Ak sme vám neponúkli vyzdvihnutie, tovar odošlite alebo odovzdajte do 14 dní od odstúpenia. Ak chcete,
				aby sme zvoz zabezpečili my, napíšte nám — cenu a návrh termínu vám pošleme vopred a platený zvoz
				objednáme až po vašom výslovnom súhlase.
			</p>

			<h3 className="text-text-primary mt-6 text-sm font-semibold">Vaše potvrdenie</h3>
			<iframe
				ref={confirmationFrameRef}
				title={`Potvrdenie odstúpenia ${receipt.submissionNumber}`}
				srcDoc={receipt.printConfirmationHTML}
				sandbox="allow-modals allow-same-origin"
				referrerPolicy="no-referrer"
				className="border-border-default mt-2 min-h-[48rem] w-full rounded-md border bg-white"
			/>

			<div className="mt-6 flex flex-wrap gap-3 print:hidden">
				<button
					type="button"
					onClick={printConfirmation}
					className="border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted focus-visible:ring-focus-ring inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
				>
					Vytlačiť potvrdenie
				</button>
				<button
					type="button"
					onClick={() =>
						downloadHTML(
							receipt.printConfirmationHTML,
							`potvrdenie-odstupenia-${receipt.submissionNumber}.html`,
						)
					}
					className="border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted focus-visible:ring-focus-ring inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
				>
					Stiahnuť potvrdenie
				</button>
				{receipt.parcelSlipHTML ? (
					<button
						type="button"
						onClick={() =>
							downloadHTML(
								receipt.parcelSlipHTML as string,
								`sprievodny-listok-${receipt.submissionNumber}.html`,
							)
						}
						className="border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted focus-visible:ring-focus-ring inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
					>
						Stiahnuť sprievodný lístok
					</button>
				) : null}
			</div>
		</section>
	);
}
