"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { type AddressDetailsFragment } from "@/gql/graphql";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetCloseButton,
} from "@/ui/components/ui/sheet";
import { createAddress, updateAddress } from "@/app/[channel]/(main)/account/actions";
import { accountErrorKey } from "@/ui/components/account/account-error";
import { CHANNEL_MAP, REVERSE_MAP } from "@/lib/channel-map";

type Props = {
	address?: AddressDetailsFragment;
};

export function AddressFormDialog({ address }: Props) {
	const [open, setOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState("");

	const isEditing = !!address;
	const t = useTranslations("account.address");
	const tr = useTranslations();
	const tCheckout = useTranslations("checkout");
	const optional = (label: string) => `${label} ${tCheckout("common.optional")}`;
	// The example in the country field is the market's own country (it was "US" everywhere).
	const { channel } = useParams<{ channel: string }>();
	const marketCountry = CHANNEL_MAP[REVERSE_MAP[channel] ?? ""]?.country ?? "SK";

	/** The label of each field, so a field Saleor rejects can be named in the error. */
	const labels: Readonly<Record<string, string>> = useMemo(
		() => ({
			firstName: tCheckout("firstName"),
			lastName: tCheckout("lastName"),
			companyName: tCheckout("addressForm.fields.companyName"),
			streetAddress1: tCheckout("address"),
			streetAddress2: tCheckout("addressForm.fields.streetAddress2"),
			city: tCheckout("city"),
			postalCode: tCheckout("postalCode"),
			countryArea: tCheckout("addressForm.fields.countryArea"),
			country: t("countryCode"),
			phone: tCheckout("phone"),
		}),
		[t, tCheckout],
	);

	const handleSubmit = useCallback(
		(formData: FormData) => {
			setError("");
			const action = isEditing ? updateAddress : createAddress;

			startTransition(async () => {
				const result = await action(formData);
				if (!result.success) {
					const field = result.field ? labels[result.field] : undefined;
					setError(
						field
							? tr("account.errors.invalidField", { field })
							: tr(accountErrorKey("address", result.code)),
					);
				} else {
					setOpen(false);
				}
			});
		},
		[isEditing, startTransition, labels, tr],
	);

	return (
		<>
			{isEditing ? (
				<Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={t("edit")}>
					<Pencil className="h-3.5 w-3.5" />
				</Button>
			) : (
				<Button variant="outline-solid" size="sm" onClick={() => setOpen(true)}>
					<Plus className="mr-1 h-4 w-4" />
					{t("add")}
				</Button>
			)}
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent side="right" className="overflow-y-auto p-6">
					<SheetHeader className="mb-6">
						<SheetTitle>{isEditing ? t("edit") : tCheckout("addressForm.addNewAddress")}</SheetTitle>
						<SheetDescription className="sr-only">
							{isEditing ? t("editDescription") : t("addDescription")}
						</SheetDescription>
						<SheetCloseButton />
					</SheetHeader>

					<form action={handleSubmit} className="space-y-4">
						{isEditing && <input type="hidden" name="id" value={address.id} />}

						{error && (
							<p role="alert" className="text-destructive text-sm">
								{error}
							</p>
						)}

						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label htmlFor="addr-firstName">{labels.firstName}</Label>
								<Input
									id="addr-firstName"
									name="firstName"
									autoComplete="given-name"
									defaultValue={address?.firstName}
									required
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="addr-lastName">{labels.lastName}</Label>
								<Input
									id="addr-lastName"
									name="lastName"
									autoComplete="family-name"
									defaultValue={address?.lastName}
									required
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="addr-companyName">{optional(labels.companyName)}</Label>
							<Input
								id="addr-companyName"
								name="companyName"
								autoComplete="organization"
								defaultValue={address?.companyName}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="addr-streetAddress1">{labels.streetAddress1}</Label>
							<Input
								id="addr-streetAddress1"
								name="streetAddress1"
								autoComplete="address-line1"
								defaultValue={address?.streetAddress1}
								required
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="addr-streetAddress2">{optional(labels.streetAddress2)}</Label>
							<Input
								id="addr-streetAddress2"
								name="streetAddress2"
								autoComplete="address-line2"
								defaultValue={address?.streetAddress2}
							/>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label htmlFor="addr-city">{labels.city}</Label>
								<Input
									id="addr-city"
									name="city"
									autoComplete="address-level2"
									defaultValue={address?.city}
									required
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="addr-postalCode">{labels.postalCode}</Label>
								<Input
									id="addr-postalCode"
									name="postalCode"
									autoComplete="postal-code"
									defaultValue={address?.postalCode}
									required
								/>
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label htmlFor="addr-countryArea">{labels.countryArea}</Label>
								<Input
									id="addr-countryArea"
									name="countryArea"
									autoComplete="address-level1"
									defaultValue={address?.countryArea}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="addr-country">{labels.country}</Label>
								<Input
									id="addr-country"
									name="country"
									autoComplete="country"
									defaultValue={address?.country.code}
									placeholder={marketCountry}
									maxLength={2}
									required
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="addr-phone">{optional(labels.phone)}</Label>
							<Input
								id="addr-phone"
								name="phone"
								type="tel"
								autoComplete="tel"
								defaultValue={address?.phone ?? ""}
							/>
						</div>

						<div className="flex gap-2 pt-2">
							<Button type="submit" disabled={isPending} className="flex-1">
								{isPending ? tCheckout("common.saving") : isEditing ? t("save") : t("add")}
							</Button>
						</div>
					</form>
				</SheetContent>
			</Sheet>
		</>
	);
}
