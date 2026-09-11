"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { CONTACT_TOPICS } from "@/lib/forms/contact-contract";
import { CONTACT_FIELD_LIMITS, type ContactField } from "@/lib/contact/validate";
import { submitContactAction, type ContactFormState } from "@/app/[channel]/(main)/kontakt/actions";

/**
 * The contact form.
 *
 * ## What it promises, and what it does not
 *
 * On a confirmed persist it says the message was RECEIVED and shows the reference. It
 * never says an e-mail has arrived: the provider reports delivery per channel and both
 * start `pending`, so "we have sent you a confirmation" would be a claim about
 * something that has not happened yet. The note under the acknowledgement says the
 * confirmation is on its way and that the message is on file either way.
 *
 * ## Retry keeps the same identity
 *
 * `submissionId` is generated once by the server when the page renders and travels
 * unchanged with every attempt, so the provider's unique index turns a retry into a
 * replay. That is why an unclear outcome tells the customer to try again rather than
 * to start a new message: a new one would be a second message, which is the duplicate
 * this prevents.
 *
 * ## The input survives a failure
 *
 * The form is uncontrolled and never reset on a failed attempt, so what the customer
 * typed is still there. Nothing is written to storage or to the URL — personal data
 * belongs in neither.
 */

const INITIAL: ContactFormState = { status: "idle" };

function SubmitButton({ label, busyLabel }: { label: string; busyLabel: string }) {
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
			aria-busy={pending}
			className="bg-action-primary text-text-inverse hover:bg-action-primary/90 focus-visible:ring-focus-ring inline-flex min-h-11 items-center justify-center rounded-md px-6 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
		>
			{pending ? busyLabel : label}
		</button>
	);
}

export function ContactForm({ channel }: { channel: string }) {
	// Minted once, in a lazy initialiser, so it is stable for the life of this form and
	// every retry carries it unchanged — which is what lets the provider's unique index
	// turn a retry into a replay. It cannot be minted on the server: `randomUUID()` in a
	// prerendered Server Component is a build error under `cacheComponents`, and making
	// the page dynamic to obtain one would be a large cost for an idempotency key that
	// needs to be unique, not secret.
	const [submissionId] = useState(() => crypto.randomUUID());
	const t = useTranslations("contact");
	const [state, action] = useActionState(submitContactAction, INITIAL);
	const formRef = useRef<HTMLFormElement>(null);
	const statusRef = useRef<HTMLDivElement>(null);
	const baseId = useId();

	const fieldId = (field: string) => `${baseId}-${field}`;
	const errorId = (field: string) => `${baseId}-${field}-error`;
	const errors = state.status === "invalid" ? state.errors : {};

	// Move focus where the server says the first problem is — the browser cannot know
	// the server's field order, and an error nobody is taken to is an error nobody fixes.
	useEffect(() => {
		if (state.status === "invalid") {
			formRef.current?.querySelector<HTMLElement>(`[name="${state.focus}"]`)?.focus();
		} else if (state.status !== "idle") {
			statusRef.current?.focus();
		}
	}, [state]);

	if (state.status === "received") {
		return (
			<div
				ref={statusRef}
				tabIndex={-1}
				role="status"
				className="border-border-default bg-surface-muted rounded-md border p-6"
			>
				<p className="text-text-primary text-base font-semibold">{t("received")}</p>
				<p className="text-text-primary mt-2 text-sm">
					{t("reference", { number: state.acknowledgement.submissionNumber })}
				</p>
				{state.acknowledgement.duplicate && (
					<p className="text-text-secondary mt-2 text-sm">{t("alreadyReceived")}</p>
				)}
				{/* Not "we have emailed you": delivery is pending at this point. */}
				<p className="text-text-secondary mt-2 text-sm">{t("emailNote")}</p>
			</div>
		);
	}

	const problem =
		state.status === "failed"
			? t(state.kind)
			: state.status === "blocked"
				? t("blocked", { seconds: state.retryAfterSeconds })
				: state.status === "invalid"
					? t("fixErrors")
					: null;

	const field = (
		name: ContactField,
		type: "text" | "email" | "tel",
		required: boolean,
		maxLength: number,
	) => (
		<div>
			<label htmlFor={fieldId(name)} className="text-text-primary block text-sm font-medium">
				{t(name)}
			</label>
			<input
				id={fieldId(name)}
				name={name}
				type={type}
				required={required}
				maxLength={maxLength}
				autoComplete={
					name === "name" ? "name" : name === "email" ? "email" : name === "phone" ? "tel" : "off"
				}
				aria-invalid={errors[name] ? true : undefined}
				aria-describedby={errors[name] ? errorId(name) : undefined}
				className="border-border-default bg-surface-primary text-text-primary focus-visible:ring-focus-ring mt-1 min-h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none aria-[invalid]:border-red-600"
			/>
			{errors[name] && (
				<p id={errorId(name)} className="mt-1 text-sm text-red-700">
					{t(`err.${errors[name]}`)}
				</p>
			)}
		</div>
	);

	return (
		<form ref={formRef} action={action} className="not-prose mt-6 space-y-5" noValidate>
			{/* Server-owned. The market is derived from the channel, never from the form. */}
			<input type="hidden" name="channel" value={channel} />
			<input type="hidden" name="submissionId" value={submissionId} />

			{problem && (
				<div
					ref={statusRef}
					tabIndex={-1}
					role="alert"
					className="rounded-md border border-red-300 bg-red-50 p-4"
				>
					<p className="text-sm font-semibold text-red-800">{t("errorTitle")}</p>
					<p className="mt-1 text-sm text-red-800">{problem}</p>
				</div>
			)}

			<div className="grid gap-5 sm:grid-cols-2">
				{field("name", "text", true, CONTACT_FIELD_LIMITS.name)}
				{field("email", "email", true, CONTACT_FIELD_LIMITS.email)}
				{field("phone", "tel", false, CONTACT_FIELD_LIMITS.phone)}
				<div>
					<label htmlFor={fieldId("topic")} className="text-text-primary block text-sm font-medium">
						{t("topic")}
					</label>
					<select
						id={fieldId("topic")}
						name="topic"
						required
						defaultValue=""
						aria-invalid={errors.topic ? true : undefined}
						aria-describedby={errors.topic ? errorId("topic") : undefined}
						className="border-border-default bg-surface-primary text-text-primary focus-visible:ring-focus-ring mt-1 min-h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
					>
						<option value="" disabled />
						{CONTACT_TOPICS.map((topic) => (
							<option key={topic} value={topic}>
								{t(`topics.${topic}`)}
							</option>
						))}
					</select>
					{errors.topic && (
						<p id={errorId("topic")} className="mt-1 text-sm text-red-700">
							{t(`err.${errors.topic}`)}
						</p>
					)}
				</div>
			</div>

			{field("order", "text", false, CONTACT_FIELD_LIMITS.order)}

			<div>
				<label htmlFor={fieldId("message")} className="text-text-primary block text-sm font-medium">
					{t("message")}
				</label>
				<textarea
					id={fieldId("message")}
					name="message"
					required
					rows={6}
					maxLength={CONTACT_FIELD_LIMITS.message}
					aria-invalid={errors.message ? true : undefined}
					aria-describedby={errors.message ? errorId("message") : undefined}
					className="border-border-default bg-surface-primary text-text-primary focus-visible:ring-focus-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
				/>
				{errors.message && (
					<p id={errorId("message")} className="mt-1 text-sm text-red-700">
						{t(`err.${errors.message}`)}
					</p>
				)}
			</div>

			<SubmitButton label={t("send")} busyLabel={t("sending")} />
		</form>
	);
}
