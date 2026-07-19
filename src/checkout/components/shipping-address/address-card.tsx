"use client";

import { type FC } from "react";
import { useTranslations } from "next-intl";
import { MapPin, ChevronRight, Check } from "lucide-react";
import { type AddressFragment } from "@/checkout/graphql";
import { cn } from "@/lib/utils";
import { localizeCountryName } from "@/checkout/lib/utils/locale";
import { useLocale } from "@/providers/locale-provider";

export interface AddressCardProps {
	/** The address to display */
	address: AddressFragment;
	/** Whether this is the selected address */
	isSelected?: boolean;
	/** Whether this is the default address */
	isDefault?: boolean;
	/** Called when the card is clicked */
	onClick?: () => void;
	/** Called when "Change" is clicked */
	onChangeClick?: () => void;
	/** Compact mode shows less detail */
	compact?: boolean;
	/** Additional class names */
	className?: string;
}

/**
 * Compact address card showing address preview.
 * Used as the collapsed state when there are many addresses.
 */
export const AddressCard: FC<AddressCardProps> = ({
	address,
	isSelected = false,
	isDefault = false,
	onClick,
	onChangeClick,
	compact = false,
	className,
}) => {
	const t = useTranslations("checkout");
	const { locale } = useLocale();

	const handleChangeClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onChangeClick?.();
	};

	return (
		<div
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			onClick={onClick}
			onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
			className={cn(
				"relative flex items-start gap-3 rounded-lg border p-4 transition-colors",
				onClick && "hover:border-muted-foreground/50 cursor-pointer",
				isSelected && "bg-muted/30 border-foreground",
				!isSelected && "border-border",
				className,
			)}
		>
			{/* Icon or check mark */}
			<div
				className={cn(
					"flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
					isSelected ? "bg-foreground text-background" : "bg-muted",
				)}
			>
				{isSelected ? <Check className="h-4 w-4" /> : <MapPin className="text-muted-foreground h-4 w-4" />}
			</div>

			{/* Address content */}
			<div className="min-w-0 flex-1">
				<div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
					<span className="font-medium">
						{address.firstName} {address.lastName}
					</span>
					{isDefault && (
						<span className="bg-muted text-muted-foreground w-fit rounded px-1.5 py-0.5 text-xs font-medium">
							{t("addressForm.defaultBadge")}
						</span>
					)}
				</div>

				{compact ? (
					<p className="text-muted-foreground mt-0.5 truncate text-sm">
						{address.streetAddress1}, {address.city} {address.postalCode}
					</p>
				) : (
					<>
						<p className="text-muted-foreground mt-0.5 text-sm">
							{address.streetAddress1}
							{address.streetAddress2 && `, ${address.streetAddress2}`}
						</p>
						<p className="text-muted-foreground text-sm">
							{address.city}
							{address.countryArea && `, ${address.countryArea}`} {address.postalCode}
						</p>
						<p className="text-muted-foreground text-sm">
							{localizeCountryName(address.country?.code, address.country?.country, locale)}
						</p>
					</>
				)}
			</div>

			{/* Change button */}
			{onChangeClick && (
				<button
					type="button"
					onClick={handleChangeClick}
					className="text-muted-foreground hover:bg-muted hover:text-foreground flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors"
				>
					{t("common.change")}
					<ChevronRight className="h-4 w-4" />
				</button>
			)}
		</div>
	);
};
