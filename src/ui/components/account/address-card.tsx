import { getTranslations } from "next-intl/server";
import { type AddressDetailsFragment } from "@/gql/graphql";
import { cn } from "@/lib/utils";

type Props = {
	address: AddressDetailsFragment;
	/** The market's locale, for the "default" badges. */
	locale: string;
	isDefaultShipping?: boolean;
	isDefaultBilling?: boolean;
	className?: string;
	children?: React.ReactNode;
};

export async function AccountAddressCard({
	address,
	locale,
	isDefaultShipping,
	isDefaultBilling,
	className,
	children,
}: Props) {
	const t = await getTranslations({ locale, namespace: "account.address" });
	return (
		<div className={cn("rounded-lg border p-4", className)}>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-semibold">
							{address.firstName} {address.lastName}
						</span>
						{isDefaultShipping && (
							<span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-xs font-medium">
								{t("defaultShipping")}
							</span>
						)}
						{isDefaultBilling && (
							<span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-xs font-medium">
								{t("defaultBilling")}
							</span>
						)}
					</div>
					<p className="text-muted-foreground text-sm">{address.streetAddress1}</p>
					{address.streetAddress2 && (
						<p className="text-muted-foreground text-sm">{address.streetAddress2}</p>
					)}
					<p className="text-muted-foreground text-sm">
						{address.city}
						{address.countryArea && `, ${address.countryArea}`} {address.postalCode}
					</p>
					<p className="text-muted-foreground text-sm">{address.country.country}</p>
					{address.phone && <p className="text-muted-foreground mt-2 text-sm">{address.phone}</p>}
				</div>
				{children && <div className="flex shrink-0 items-center gap-1">{children}</div>}
			</div>
		</div>
	);
}
