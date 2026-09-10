import { getTranslations } from "next-intl/server";
import { AccountAddressCard } from "@/ui/components/account/address-card";
import { AddressFormDialog } from "@/ui/components/account/address-form-dialog";
import { DeleteAddressButton, SetDefaultAddressButton } from "@/ui/components/account/address-actions";
import { getCurrentUser } from "../get-current-user";

export default async function AddressesPage() {
	const t = await getTranslations("account");
	const tCheckout = await getTranslations("checkout.addressForm");
	const user = await getCurrentUser();
	if (!user) return null;

	const { addresses } = user;
	const defaultShippingId = user.defaultShippingAddress?.id;
	const defaultBillingId = user.defaultBillingAddress?.id;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">{t("addresses")}</h1>
					<p className="text-muted-foreground mt-1 text-sm">{t("manageAddresses")}</p>
				</div>
				<AddressFormDialog />
			</div>

			{addresses.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center">
					<p className="text-muted-foreground">{tCheckout("noSavedAddressesYet")}</p>
					<div className="mt-4">
						<AddressFormDialog />
					</div>
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2">
					{addresses.map((address) => {
						const isDefaultShipping = address.id === defaultShippingId;
						const isDefaultBilling = address.id === defaultBillingId;

						return (
							<AccountAddressCard
								key={address.id}
								address={address}
								isDefaultShipping={isDefaultShipping}
								isDefaultBilling={isDefaultBilling}
							>
								<AddressFormDialog address={address} />
								{!isDefaultShipping && <SetDefaultAddressButton addressId={address.id} type="SHIPPING" />}
								{!isDefaultBilling && <SetDefaultAddressButton addressId={address.id} type="BILLING" />}
								<DeleteAddressButton addressId={address.id} />
							</AccountAddressCard>
						);
					})}
				</div>
			)}
		</div>
	);
}
