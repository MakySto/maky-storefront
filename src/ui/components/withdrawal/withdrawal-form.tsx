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
 * One form, two modes. A guest types an order number; a signed-in customer picks from
 * their own orders and, if they want, individual lines. Both produce the same body and
 * the same record — the account mode saves typing, it does not grant a different right,
 * and nothing here may make signing in feel like a precondition.
 *
 * The result is rendered from action state rather than by navigating to a success URL.
 * A URL would put a submission number and, in any careless version, the notice itself
 * into browser history, referrers and any shared link.
 */

export interface WithdrawalFormProps {
	/** Freshly minted on the server for this render. One id per form attempt. */
	readonly submissionId: string;
	readonly action: (state: WithdrawalFormState, formData: FormData) => Promise<WithdrawalFormState>;
	readonly prefill: { readonly name: string; readonly email: string } | null;
	readonly orders: readonly OwnedOrder[];
	readonly alternatives: { readonly email: string; readonly postalAddress: string };
	readonly modelFormHref: string;
}

const MANUAL = "__manual__";

const inputBase =
	"border-border-default bg-surface-primary text-text-primary focus-visible:ring-focus-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";
const invalidRing = "border-status-danger";

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

	const itemsPayload =
		scope === "selectedItems" && selectedOrder
			? JSON.stringify(
					selectedOrder.lines
						.filter((line) => (lineQuantities[line.id] ?? 0) > 0)
						.map((line) => ({
							orderLineId: line.id,
							productName: line.productName,
							quantity: lineQuantities[line.id] ?? 0,
						})),
				)
			: "[]";

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
					<p className="font-semibold">Odstúpenie sa nepodarilo uložiť.</p>
					<p className="mt-1">
						Vaše oznámenie sme <strong>neprijali</strong>. Skúste to prosím znova, alebo nám odstúpenie
						pošlite e-mailom na{" "}
						<a className="underline" href={`mailto:${alternatives.email}`}>
							{alternatives.email}
						</a>{" "}
						alebo poštou na adresu {alternatives.postalAddress}. Obe cesty sú rovnocenné.
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

				<Field id={id("phone")} label="Telefón" error={errors?.customerPhone}>
					{(describedBy, invalid) => (
						<input
							id={id("phone")}
							name="customerPhone"
							data-field="customerPhone"
							type="tel"
							autoComplete="tel"
							maxLength={40}
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
									if (event.target.value === MANUAL) setScope("wholeOrder");
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
							maxLength={64}
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
						disabled={!selectedOrder}
						className="mt-1"
					/>
					<span>
						Odstupujem len od vybraných položiek
						{!selectedOrder ? (
							<span className="text-text-tertiary block text-xs">
								Dostupné po výbere objednávky. Bez prihlásenia položky opíšte v poznámke nižšie.
							</span>
						) : null}
					</span>
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
			</fieldset>

			<Field
				id={id("note")}
				label="Poznámka"
				hint="Napríklad opis tovaru, ak sa objednávku nepodarilo načítať. Dôvod odstúpenia uvádzať nemusíte."
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
