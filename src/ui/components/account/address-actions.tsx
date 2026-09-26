"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Star } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { deleteAddress, setDefaultAddress } from "@/app/[channel]/(main)/account/actions";

type DeleteProps = {
	addressId: string;
};

export function DeleteAddressButton({ addressId }: DeleteProps) {
	const t = useTranslations("account.address");
	const tCommon = useTranslations("common");
	const [isPending, startTransition] = useTransition();
	const [showConfirm, setShowConfirm] = useState(false);

	function handleDelete() {
		startTransition(async () => {
			const formData = new FormData();
			formData.set("id", addressId);
			await deleteAddress(formData);
		});
	}

	if (showConfirm) {
		return (
			<div className="flex items-center gap-1">
				<Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
					{isPending ? "…" : tCommon("delete")}
				</Button>
				<Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>
					{tCommon("cancel")}
				</Button>
			</div>
		);
	}

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={() => setShowConfirm(true)}
			disabled={isPending}
			aria-label={t("delete")}
		>
			<Trash2 className="text-muted-foreground h-3.5 w-3.5" />
		</Button>
	);
}

type SetDefaultProps = {
	addressId: string;
	type: "SHIPPING" | "BILLING";
};

export function SetDefaultAddressButton({ addressId, type }: SetDefaultProps) {
	const t = useTranslations("checkout.addressForm");
	const [isPending, startTransition] = useTransition();

	function handleSetDefault() {
		startTransition(async () => {
			const formData = new FormData();
			formData.set("id", addressId);
			formData.set("type", type);
			await setDefaultAddress(formData);
		});
	}

	const label = type === "SHIPPING" ? t("setAsDefaultShipping") : t("setAsDefaultBilling");

	return (
		<Button variant="ghost" size="sm" onClick={handleSetDefault} disabled={isPending} aria-label={label}>
			<Star className="text-muted-foreground h-3.5 w-3.5" />
		</Button>
	);
}
