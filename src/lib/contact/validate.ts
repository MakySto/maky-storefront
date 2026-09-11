import { CONTACT_TOPICS, type ContactTopic } from "@/lib/forms/contact-contract";

/**
 * Field validation for the contact form.
 *
 * Emits stable CODES, never sentences. The wording is a presentation concern and lives
 * in the message catalogues, which is what lets one validator serve twelve markets —
 * the same split the withdrawal form uses.
 */

export const CONTACT_FIELDS = ["name", "email", "phone", "topic", "order", "message"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

/** Generous upper bounds. The provider enforces its own; these stop absurd input early. */
export const CONTACT_FIELD_LIMITS = {
	name: 120,
	email: 254,
	phone: 40,
	order: 64,
	message: 5000,
} as const;

export interface ContactInput {
	readonly name: string;
	readonly email: string;
	readonly phone: string;
	readonly topic: string;
	readonly order: string;
	readonly message: string;
}

export interface ContactValid {
	readonly name: string;
	readonly email: string;
	readonly phone: string | null;
	readonly topic: ContactTopic;
	readonly order: string | null;
	readonly message: string;
}

export type ContactErrors = Partial<Record<ContactField, string>>;

/**
 * Deliberately permissive: one `@`, something either side, a dot in the domain.
 *
 * A stricter pattern rejects addresses that exist. The provider validates too, and the
 * only cost of accepting a typo here is a bounced confirmation — whereas refusing a
 * real address costs the message.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(
	input: ContactInput,
): { ok: true; value: ContactValid } | { ok: false; errors: ContactErrors; focus: ContactField } {
	const errors: ContactErrors = {};
	const name = input.name.trim();
	const email = input.email.trim().toLowerCase();
	const phone = input.phone.trim();
	const order = input.order.trim();
	const message = input.message.trim();

	if (!name) errors.name = "name:required";
	else if (name.length > CONTACT_FIELD_LIMITS.name) errors.name = "name:tooLong";

	if (!email) errors.email = "email:required";
	else if (email.length > CONTACT_FIELD_LIMITS.email) errors.email = "email:tooLong";
	else if (!EMAIL.test(email)) errors.email = "email:invalid";

	if (phone.length > CONTACT_FIELD_LIMITS.phone) errors.phone = "phone:tooLong";

	if (!input.topic) errors.topic = "topic:required";
	else if (!(CONTACT_TOPICS as readonly string[]).includes(input.topic)) errors.topic = "topic:invalid";

	if (order.length > CONTACT_FIELD_LIMITS.order) errors.order = "order:tooLong";

	if (!message) errors.message = "message:required";
	else if (message.length > CONTACT_FIELD_LIMITS.message) errors.message = "message:tooLong";

	const focus = CONTACT_FIELDS.find((field) => errors[field]);
	if (focus) return { ok: false, errors, focus };

	return {
		ok: true,
		value: {
			name,
			email,
			// Empty is `null` on the wire, not "". The provider's schema distinguishes
			// "not given" from "given as blank", and so should we.
			phone: phone || null,
			topic: input.topic as ContactTopic,
			order: order || null,
			message,
		},
	};
}
