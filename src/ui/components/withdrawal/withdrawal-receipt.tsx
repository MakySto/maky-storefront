"use client";

import { useEffect, useRef } from "react";
import { type WithdrawalReceipt } from "@/app/[channel]/(main)/odstupenie-od-zmluvy/actions";

/**
 * Proof that the notice was received.
 *
 * § 20a wants the confirmation to carry the submitted notice and the time it was
 * submitted, on a durable medium. The e-mail Payload sends is the durable copy; this
 * panel is the immediate one, and it must stand on its own — the e-mail may not have
 * gone out, and that is a delivery problem, not a reason the withdrawal is any less
 * given.
 *
 * Everything shown here comes from the record Payload stored: the submission number and
 * timestamp it generated, and a rendering of the canonical snapshot it holds. Nothing is
 * reconstructed from the form the customer filled in, so the receipt, the database row
 * and the confirmation e-mail cannot say three different things.
 *
 * Rendered from server-action state, so nothing here has a URL. Print and download work
 * offline from the same text.
 */

function download(receipt: WithdrawalReceipt): void {
	const blob = new Blob([receipt.notice], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `odstupenie-${receipt.submissionNumber}.txt`;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

export function WithdrawalReceiptPanel({
	receipt,
	alternatives,
}: {
	receipt: WithdrawalReceipt;
	alternatives: { email: string; postalAddress: string };
}) {
	const headingRef = useRef<HTMLHeadingElement>(null);

	// The form is gone and the page did not navigate, so without this a keyboard or
	// screen-reader user would be left with focus on a button that no longer exists.
	useEffect(() => {
		headingRef.current?.focus();
	}, []);

	const formatted = new Intl.DateTimeFormat("sk-SK", {
		dateStyle: "long",
		timeStyle: "short",
		timeZone: "Europe/Bratislava",
	}).format(new Date(receipt.submittedAt));

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
					Toto odstúpenie sme už evidovali — nižšie je pôvodné podanie vrátane času, kedy sme ho prijali. Nové
					podanie sa nevytvorilo.
				</p>
			) : null}

			<dl className="mt-4 space-y-2 text-sm">
				<div className="flex flex-wrap gap-x-2">
					<dt className="text-text-secondary">Číslo podania:</dt>
					<dd className="text-text-primary font-semibold">{receipt.submissionNumber}</dd>
				</div>
				<div className="flex flex-wrap gap-x-2">
					<dt className="text-text-secondary">Dátum a čas prijatia:</dt>
					<dd className="text-text-primary font-semibold">
						<time dateTime={receipt.submittedAt}>{formatted}</time>
					</dd>
				</div>
				<div className="flex flex-wrap gap-x-2">
					<dt className="text-text-secondary">Označenie zmluvy:</dt>
					<dd className="text-text-primary">{receipt.orderNumber}</dd>
				</div>
			</dl>

			<h3 className="text-text-primary mt-6 text-sm font-semibold">Znenie odoslaného oznámenia</h3>
			<pre className="border-border-default bg-surface-primary text-text-primary mt-2 overflow-x-auto rounded-md border p-4 text-xs whitespace-pre-wrap print:border-black">
				{receipt.notice}
			</pre>

			{/* Three states, and the difference matters. "sent" is a promise we can keep;
			    "failed" is an operational problem the customer should know about; "unknown"
			    is neither, and claiming either one would be a small lie. */}
			{receipt.customerEmail === "sent" ? (
				<p className="text-text-secondary mt-4 text-sm print:hidden">
					Potvrdenie sme odoslali aj e-mailom. Ak vám nepríde do niekoľkých minút, skontrolujte prosím
					priečinok s nevyžiadanou poštou.
				</p>
			) : null}

			{receipt.customerEmail === "failed" ? (
				<p className="border-status-warning bg-status-warning-bg text-text-primary mt-4 rounded-md border p-3 text-sm print:hidden">
					<strong>Odstúpenie je prijaté a zaevidované.</strong> Potvrdenie e-mailom sa nám zatiaľ nepodarilo
					odoslať. Uložte si alebo vytlačte toto potvrdenie — je plnohodnotným dokladom. Pokúsime sa ho
					odoslať znova; ak ho nedostanete, ozvite sa na {alternatives.email}.
				</p>
			) : null}

			{receipt.customerEmail === "unknown" ? (
				<p className="text-text-secondary mt-4 text-sm print:hidden">
					Potvrdenie vám pošleme aj e-mailom. Toto potvrdenie si môžete uložiť alebo vytlačiť už teraz — je
					plnohodnotným dokladom.
				</p>
			) : null}

			<div className="mt-6 flex flex-wrap gap-3 print:hidden">
				<button
					type="button"
					onClick={() => window.print()}
					className="border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted focus-visible:ring-focus-ring inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
				>
					Vytlačiť
				</button>
				<button
					type="button"
					onClick={() => download(receipt)}
					className="border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted focus-visible:ring-focus-ring inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
				>
					Stiahnuť potvrdenie
				</button>
			</div>
		</section>
	);
}
