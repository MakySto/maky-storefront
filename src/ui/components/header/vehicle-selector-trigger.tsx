"use client";

import { CarIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  vehicleLabel?: string | null;
};

export function VehicleSelectorTrigger({ vehicleLabel }: Props) {
  const t = useTranslations("nav");
  const label = vehicleLabel?.trim() || t("selectVehicle");

  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-10 items-center gap-2 rounded-sm border border-forest-200 bg-forest-50 px-3 text-sm font-medium text-forest-700 transition-colors hover:border-forest-300 hover:bg-forest-100"
    >
      <CarIcon className="h-4 w-4" aria-hidden />
      <span className="hidden max-w-[10rem] truncate xl:inline">{label}</span>
      <ChevronDownIcon className="h-3.5 w-3.5 opacity-60" aria-hidden />
    </button>
  );
}
