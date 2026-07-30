"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
	type WithdrawalFormState,
	type WithdrawalReceipt,
} from "@/app/[channel]/(main)/odstupenie-od-zmluvy/actions";
import { type OwnedOrder } from "@/lib/withdrawal/account-orders";
import { WithdrawalReceiptPanel } from "./withdrawal-receipt";

/**
 * The § 20a online withdrawal function.
 *
 * One form, two modes. A guest types an order number and, for a partial withdrawal,
 * lists the items by hand; a signed-in customer picks from their own orders and ticks
 * individual lines. Both produce the same body and the same record — the account mode
 * saves typing, it does not grant a different right, and nothing here may make signing
 * in feel like a precondition.
 *
 * That is why the manual item rows exist at all. Describing the goods in the note was
 * not equivalent: the backend requires `items[]` when the scope is `selectedItems`, so
 * a guest without structured rows simply could not make a partial withdrawal — a right
 * the law gives them regardless of whether they have an account.
 *
 * The result is rendered from action state rather than by navigating to a success URL.
 * A URL would put a submission number and, in any careless version, the notice itself
 * into browser history, referrers and any shared link.
 */

export interface WithdrawalFormProps {
	/** Freshly minted on the server for this render. One id per form attempt. */
	readonly submissionId: string;
	readonly action: (state: WithdrawalFormState, formData: FormData) => Promise<WithdrawalFormState>;
	readonly prefill: {
		readonly name: string;
		readonly email: string;
		readonly phone: string | null;
	} | null;
	readonly orders: readonly OwnedOrder[];
	readonly alternatives: { readonly email: string; readonly postalAddress: string };
	readonly modelFormHref: string;
}

const MANUAL = "__manual__";

interface ManualItem {
	readonly key: string;
	productName: string;
	quantity: number;
	sku: string;
}

const inputBase =
	"border-border-default bg-surface-primary text-text-primary focus-visible:ring-focus-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";
const invalidRing = "border-status-danger";
const buttonSecondary =
	"border-border-default bg-surface-primary text-text-primary hover:bg-surface-muted focus-visible:ring-focus-ring inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none";

function Field({
	id,
	label,
	hint,
	error,
	required,
	children,
}: {
	id: string;
	label: string;
	hint?: string;
	error?: string;
	required?: boolean;
	children: (describedBy: string | undefined, invalid: boolean) => React.ReactNode;
}) {
	const hintId = `${id}-hint`;
	const errorId = `${id}-error`;
	const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

	return (
		<div className="space-y-1.5">
			{/* Persistent label, never a placeholder standing in for one. */}
			<label htmlFor={id} className="text-text-primary block text-sm font-medium">
				{label}
				{required ? (
					<span className="text-status-danger ml-0.5" aria-hidden="true">
						*
					</span>
				) : (
					<span className="text-text-tertiary ml-1 font-normal">(nepovinné)</span>
				)}
			</label>
			{hint ? (
				<p id={hintId} className="text-text-tertiary text-xs">
					{hint}
				</p>
			) : null}
			{children(describedBy, Boolean(error))}
			{error ? (
				<p id={errorId} className="text-status-danger text-xs font-medium">
					{error}
				</p>
			) : null}
		</div>
	);
}

function SubmitButton() {
	// useFormStatus is the double-click guard. It is a courtesy only — the authoritative
	// idempotency gate is the unique submissionId index in the database, because a
	// disabled button does nothing about a retry after a timeout or a second tab.
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
			className="bg-action-primary text-action-primary-text hover:bg-action-primary-hover focus-visible:ring-focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-md px-6 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60 sm:w-auto"
		>
			{pending ? "Odosielam…" : "Potvrdiť odstúpenie od zmluvy"}
		</button>
	);
}

const FAILURE_TEXT: Record<string, { title: string; body: string }> = {
	conflict: {
		title: "Formulár je neaktuálny.",
		body: "Vyzerá to, že táto stránka bola otvorená dlhšie a údaje sa medzitým zmenili. Načítajte ju prosím znova a odošlite odstúpenie ešte raz.",
	},
	tooLarge: {
		title: "Formulár je príliš dlhý.",
		body: "Skráťte prosím poznámku alebo zoznam položiek a skúste to znova.",
	},
	unavailable: {
		title: "Odstúpenie sa nepodarilo uložiť.",
		body: "Vaše oznámenie sme neprijali. Skúste to prosím znova, alebo nám odstúpenie pošlite jednou z ciest nižšie — sú rovnocenné.",
	},
};

export function WithdrawalForm({
	submissionId,
	action,
	prefill,
	orders,
	alternatives,
	modelFormHref,
}: WithdrawalFormProps) {
	const [state, formAction] = useActionState<WithdrawalFormState, FormData>(action, { status: "idle" });
	const baseId = useId();
	const formRef = useRef<HTMLFormElement>(null);

	const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id ?? MANUAL);
	const [scope, setScope] = useState<"wholeOrder" | "selectedItems">("wholeOrder");
	const [lineQuantities, setLineQuantities] = useState<Record<string, number>>({});
	const [manualItems, setManualItems] = useState<ManualItem[]>([
		{ key: "m0", productName: "", quantity: 1, sku: "" },
	]);
	const manualCounter = useRef(1);

	const selectedOrder = useMemo(
		() => orders.find((order) => order.id === selectedOrderId) ?? null,
		[orders, selectedOrderId],
	);

	const errors = state.status === "invalid" ? state.errors : undefined;

	// Focus the first field the server rejected. The server decides which one, because
	// only it knows the authoritative order of validation.
	useEffect(() => {
		if (state.status !== "invalid") return;
		const target = formRef.current?.querySelector<HTMLElement>(`[data-field="${state.focus}"]`);
		target?.focus();
	}, [state]);

	if (state.status === "received") {
		return (
			<WithdrawalReceiptPanel receipt={state.receipt as WithdrawalReceipt} alternatives={alternatives} />
		);
	}

	const id = (name: string) => `${baseId}-${name}`;

	// Account lines when an owned order is selected; hand-typed rows otherwise. Both
	// produce the same shape, because the backend contract is the same either way.
	const itemsPayload =
		scope !== "selectedItems"
			? "[]"
			: selectedOrder
				? JSON.stringify(
						selectedOrder.lines
							.filter((line) => (lineQuantities[line.id] ?? 0) > 0)
							.map((line) => ({
								orderLineId: line.id,
								productName: line.productName,
								quantity: lineQuantities[line.id] ?? 0,
							})),
					)
				: JSON.stringify(
						manualItems
							.filter((item) => item.productName.trim().length > 0)
							.map((item) => ({
								orderLineId: null,
								productName: item.productName.trim(),
								// Optional. Sent when the customer typed one, `null` otherwise —
								// account lines have no SKU to send at all in V1.
								sku: item.sku.trim() || null,
								quantity: item.quantity,
							})),
					);

	return (
		<form ref={formRef} action={formAction} noValidate className="space-y-6">
			<input type="hidden" name="submissionId" value={submissionId} />
			<input type="hidden" name="scope" value={scope} />
			<input type="hidden" name="items" value={itemsPayload} />
			{selectedOrder ? <input type="hidden" name="saleorOrderId" value={selectedOrder.id} /> : null}

			{/* Honeypot. Off-screen rather than display:none so a headless bot that skips
			    hidden fields still fills it; aria-hidden + tabIndex keep it away from
			    keyboard and screen-reader users. */}
			<div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
				<label htmlFor={id("website")}>Nevypĺňajte</label>
				<input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" />
			</div>

			{/* One announcement for the whole form. Assertive, because the user has just
			    pressed a button and is waiting for the answer. */}
			<div aria-live="assertive" role="status" className="sr-only">
				{state.status === "invalid" ? "Formulár obsahuje chyby. Skontrolujte označené polia." : null}
				{state.status === "failed" ? "Odstúpenie sa nepodarilo odoslať." : null}
				{state.status === "blocked" ? "Odoslanie bolo dočasne zablokované." : null}
			</div>

			{state.status === "failed" ? (
				<div className="border-status-danger bg-status-danger-bg text-text-primary rounded-md border p-4 text-sm">
					<p className="font-semibold">{FAILURE_TEXT[state.kind]?.title}</p>
					<p className="mt-1">{FAILURE_TEXT[state.kind]?.body}</p>
					<p className="mt-2">
						E-mail:{" "}
						<a className="underline" href={`mailto:${alternatives.email}`}>
							{alternatives.email}
						</a>
						{" · "}Pošta: {alternatives.postalAddress}
					</p>
				</div>
			) : null}

			{state.status === "blocked" ? (
				<div className="border-status-warning bg-status-warning-bg text-text-primary rounded-md border p-4 text-sm">
					<p className="font-semibold">Odoslanie je dočasne zablokované.</p>
					<p className="mt-1">
						Aby ste o svoje právo neprišli, pošlite odstúpenie e-mailom na{" "}
						<a className="underline" href={`mailto:${alternatives.email}`}>
							{alternatives.email}
						</a>{" "}
						alebo poštou na adresu {alternatives.postalAddress}. Môžete použiť aj{" "}
						<a className="underline" href={modelFormHref}>
							vzorový formulár
						</a>
						.
					</p>
				</div>
			) : null}

			<fieldset className="space-y-4">
				<legend className="text-text-primary text-base font-semibold">Vaše údaje</legend>

				<Field id={id("name")} label="Meno a priezvisko" required error={errors?.customerName}>
					{(describedBy, invalid) => (
						<input
							id={id("name")}
							name="customerName"
							data-field="customerName"
							type="text"
							autoComplete="name"
							defaultValue={prefill?.name ?? ""}
							maxLength={120}
							aria-required="true"
							aria-invalid={invalid || undefined}
							aria-describedby={describedBy}
							className={`${inputBase} ${invalid ? invalidRing : ""}`}
						/>
					)}
				</Field>

				<Field
					id={id("email")}
					label="E-mail"
					required
					hint="Na túto adresu pošleme potvrdenie o prijatí odstúpenia."
					error={errors?.customerEmail}
				>
					{(describedBy, invalid) => (
						<input
							id={id("email")}
							name="customerEmail"
							data-field="customerEmail"
							type="email"
							autoComplete="email"
							defaultValue={prefill?.email ?? ""}
							maxLength={254}
							aria-required="true"
							aria-invalid={invalid || undefined}
							aria-describedby={describedBy}
							className={`${inputBase} ${invalid ? invalidRing : ""}`}
						/>
					)}
				</Field>

				<Field
					id={id("phone")}
					label="Telefón"
					hint="Použijeme ho iba vtedy, ak potrebujeme rýchlo upresniť údaje k tomuto odstúpeniu. Odstúpenie môžete odoslať aj bez telefónu."
					error={errors?.customerPhone}
				>
					{(describedBy, invalid) => (
						<input
							id={id("phone")}
							name="customerPhone"
							data-field="customerPhone"
							type="tel"
							autoComplete="tel"
							inputMode="tel"
							defaultValue={prefill?.phone ?? ""}
							// The browser counts UTF-16 code units and the contract counts
							// Unicode code points, so this is the stricter of the two for
							// astral input. That is the safe direction, and it is only a
							// typing guard — the server decides.
							maxLength={32}
							aria-invalid={invalid || undefined}
							aria-describedby={describedBy}
							className={`${inputBase} ${invalid ? invalidRing : ""}`}
						/>
					)}
				</Field>
			</fieldset>

			<fieldset className="space-y-4">
				<legend className="text-text-primary text-base font-semibold">
					Ktorej objednávky sa odstúpenie týka
				</legend>

				{orders.length > 0 ? (
					<Field
						id={id("order")}
						label="Objednávka"
						required
						hint="Ak vašu objednávku nevidíte v zozname, vyberte poslednú možnosť a číslo zadajte ručne."
					>
						{(describedBy) => (
							<select
								id={id("order")}
								data-field="orderSelect"
								value={selectedOrderId}
								onChange={(event) => {
									setSelectedOrderId(event.target.value);
									setLineQuantities({});
								}}
								aria-describedby={describedBy}
								className={inputBase}
							>
								{orders.map((order) => (
									<option key={order.id} value={order.id}>
										{`Objednávka ORD-${order.number}`}
									</option>
								))}
								<option value={MANUAL}>Moja objednávka tu nie je — zadám číslo ručne</option>
							</select>
						)}
					</Field>
				) : null}

				{/* Always reachable: the manual identifier is what makes the guest mode and
				    the "order not listed" fallback the same code path. */}
				<Field
					id={id("orderNumber")}
					label="Číslo objednávky alebo iné označenie zmluvy"
					required={!selectedOrder}
					hint={
						selectedOrder
							? "Predvyplnené z vybranej objednávky."
							: "Nájdete ho v potvrdzovacom e-maile. Ak si ním nie ste istí, uveďte, čo viete — oznámenie prijmeme aj tak."
					}
					error={errors?.orderNumber}
				>
					{(describedBy, invalid) => (
						<input
							id={id("orderNumber")}
							name="orderNumber"
							data-field="orderNumber"
							type="text"
							maxLength={128}
							readOnly={Boolean(selectedOrder)}
							defaultValue={selectedOrder ? `ORD-${selectedOrder.number}` : ""}
							key={selectedOrder?.id ?? MANUAL}
							aria-invalid={invalid || undefined}
							aria-describedby={describedBy}
							className={`${inputBase} ${invalid ? invalidRing : ""} ${
								selectedOrder ? "bg-surface-muted" : ""
							}`}
						/>
					)}
				</Field>
			</fieldset>

			<fieldset className="space-y-3">
				<legend className="text-text-primary text-base font-semibold">Rozsah odstúpenia</legend>
				{errors?.scope ? <p className="text-status-danger text-xs font-medium">{errors.scope}</p> : null}

				<label className="flex items-start gap-3 text-sm">
					<input
						type="radio"
						name="scopeChoice"
						data-field="scope"
						value="wholeOrder"
						checked={scope === "wholeOrder"}
						onChange={() => setScope("wholeOrder")}
						className="mt-1"
					/>
					<span>Odstupujem od celej objednávky</span>
				</label>

				<label className="flex items-start gap-3 text-sm">
					<input
						type="radio"
						name="scopeChoice"
						value="selectedItems"
						checked={scope === "selectedItems"}
						onChange={() => setScope("selectedItems")}
						className="mt-1"
					/>
					<span>Odstupujem len od vybraných položiek</span>
				</label>

				{scope === "selectedItems" && selectedOrder ? (
					<div className="border-border-default space-y-3 rounded-md border p-4">
						{errors?.items ? <p className="text-status-danger text-xs font-medium">{errors.items}</p> : null}
						{selectedOrder.lines.map((line) => {
							const quantity = lineQuantities[line.id] ?? 0;
							return (
								<div key={line.id} className="flex flex-wrap items-center gap-3 text-sm">
									<label className="flex flex-1 items-center gap-3">
										<input
											type="checkbox"
											checked={quantity > 0}
											onChange={(event) =>
												setLineQuantities((current) => ({
													...current,
													[line.id]: event.target.checked ? line.quantity : 0,
												}))
											}
										/>
										<span>{line.productName}</span>
									</label>
									<label className="flex items-center gap-2">
										<span className="text-text-tertiary text-xs">Počet</span>
										<input
											type="number"
											min={1}
											max={line.quantity}
											value={quantity > 0 ? quantity : 1}
											disabled={quantity === 0}
											onChange={(event) =>
												setLineQuantities((current) => ({
													...current,
													[line.id]: Math.min(line.quantity, Math.max(1, Number(event.target.value) || 1)),
												}))
											}
											className="border-border-default w-20 rounded-md border px-2 py-1 text-sm"
											aria-label={`Počet kusov — ${line.productName}`}
										/>
									</label>
								</div>
							);
						})}
					</div>
				) : null}

				{/* Manual rows. Reachable without an account, because a partial withdrawal
				    is a right that does not depend on having one. */}
				{scope === "selectedItems" && !selectedOrder ? (
					<div className="border-border-default space-y-4 rounded-md border p-4" data-testid="manual-items">
						<p className="text-text-tertiary text-xs">
							Uveďte tovar, ktorého sa odstúpenie týka. Stačí názov a počet kusov.
						</p>
						{errors?.items ? <p className="text-status-danger text-xs font-medium">{errors.items}</p> : null}

						{manualItems.map((item, index) => (
							<div key={item.key} className="grid gap-3 sm:grid-cols-[1fr_5rem_7rem_auto] sm:items-end">
								<Field id={id(`item-name-${item.key}`)} label={`Tovar ${index + 1}`} required>
									{() => (
										<input
											id={id(`item-name-${item.key}`)}
											data-field="items"
											type="text"
											maxLength={300}
											value={item.productName}
											onChange={(event) =>
												setManualItems((current) =>
													current.map((row) =>
														row.key === item.key ? { ...row, productName: event.target.value } : row,
													),
												)
											}
											className={inputBase}
										/>
									)}
								</Field>

								<Field id={id(`item-qty-${item.key}`)} label="Počet" required>
									{() => (
										<input
											id={id(`item-qty-${item.key}`)}
											type="number"
											min={1}
											max={999}
											value={item.quantity}
											onChange={(event) =>
												setManualItems((current) =>
													current.map((row) =>
														row.key === item.key
															? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) }
															: row,
													),
												)
											}
											className={inputBase}
										/>
									)}
								</Field>

								<Field id={id(`item-sku-${item.key}`)} label="Kód (SKU)">
									{() => (
										<input
											id={id(`item-sku-${item.key}`)}
											type="text"
											maxLength={128}
											value={item.sku}
											onChange={(event) =>
												setManualItems((current) =>
													current.map((row) =>
														row.key === item.key ? { ...row, sku: event.target.value } : row,
													),
												)
											}
											className={inputBase}
										/>
									)}
								</Field>

								<button
									type="button"
									onClick={() =>
										setManualItems((current) =>
											current.length > 1 ? current.filter((row) => row.key !== item.key) : current,
										)
									}
									disabled={manualItems.length === 1}
									className={`${buttonSecondary} disabled:opacity-50`}
									aria-label={`Odstrániť položku ${index + 1}`}
								>
									Odstrániť
								</button>
							</div>
						))}

						<button
							type="button"
							onClick={() =>
								setManualItems((current) => [
									...current,
									{ key: `m${manualCounter.current++}`, productName: "", quantity: 1, sku: "" },
								])
							}
							className={buttonSecondary}
						>
							Pridať ďalšiu položku
						</button>
					</div>
				) : null}
			</fieldset>

			<Field
				id={id("note")}
				label="Poznámka"
				hint="Napríklad doplňujúce informácie k objednávke. Dôvod odstúpenia uvádzať nemusíte."
				error={errors?.note}
			>
				{(describedBy, invalid) => (
					<textarea
						id={id("note")}
						name="note"
						data-field="note"
						rows={4}
						maxLength={2000}
						aria-invalid={invalid || undefined}
						aria-describedby={describedBy}
						className={`${inputBase} ${invalid ? invalidRing : ""}`}
					/>
				)}
			</Field>

			<SubmitButton />
		</form>
	);
}
