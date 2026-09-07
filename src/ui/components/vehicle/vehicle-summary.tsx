import { getTranslations } from "next-intl/server";
import { Car } from "lucide-react";

import { getLocaleFromChannel } from "@/config/locale";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { cn } from "@/lib/utils";
import { VehicleSelectorLauncher } from "./vehicle-selector-launcher";

/**
 * The configurator's header: which car we are shopping for. Nothing more.
 *
 * It deliberately makes no compatibility claim. The first version put a large green
 * "Overená kompatibilita — táto zostava je overená" panel here, above a list of sets,
 * before any set had been chosen: a verdict about a product, rendered where no product
 * exists. The mirror-image bug was an empty list under "Nepasuje na vaše vozidlo",
 * answering a question about a product nobody had selected.
 *
 * Verdicts and mounting conditions belong to a specific set, so they live on its card.
 */
export async function VehicleSummary({
	channel,
	makeName,
	modelName,
	generationName,
	year,
	qualifiers,
	isDemo,
	className,
}: {
	channel: string;
	makeName: string | null;
	modelName: string | null;
	generationName: string | null;
	year: number | null;
	/** Already-translated qualifier labels, e.g. ["Kombi", "Integrované pozdĺžniky"]. */
	qualifiers: string[];
	isDemo: boolean;
	className?: string;
}) {
	const locale = getLocaleFromChannel(channel);
	const t = await getTranslations({ locale, namespace: "configurator" });
	const tf = await getTranslations({ locale, namespace: "fitment" });

	const label = [makeName, modelName, generationName].filter(Boolean).join(" ");
	const details = [year ? String(year) : null, ...qualifiers].filter(Boolean).join(" · ");

	return (
		<section
			className={cn("border-border-default rounded-lg border p-4", className)}
			aria-label={t("yourVehicle")}
		>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
				<Car className="text-text-tertiary h-5 w-5 shrink-0" aria-hidden="true" />
				<div className="min-w-0 flex-1">
					<p className="text-text-tertiary text-xs font-medium tracking-wide uppercase">{t("yourVehicle")}</p>
					<p className="text-text-primary truncate text-sm font-semibold">{label || "—"}</p>
					{details && <p className="text-text-secondary truncate text-sm">{details}</p>}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<VehicleSelectorLauncher variant="inline" vehicleLabel={label || null} />
					<LinkWithChannel
						href="/garage"
						className="text-text-secondary hover:text-text-primary text-sm underline underline-offset-4"
					>
						{tf("myGarage")}
					</LinkWithChannel>
				</div>
			</div>

			{isDemo && (
				<p className="bg-fitment-unconfirmed-bg text-fitment-unconfirmed mt-3 rounded-md px-3 py-2 text-xs font-medium">
					{tf("demoNotice")}
				</p>
			)}
		</section>
	);
}
