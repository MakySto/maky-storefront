import { Suspense } from "react";
import { AllCategoriesTrigger } from "./all-categories-trigger";
import { HeaderPrimaryNav } from "./header-primary-nav";
import { HeaderMarketControls } from "./header-market-controls";
import { VehicleSelectorTrigger } from "./vehicle-selector-trigger";

export async function HeaderNavRow({ channel }: { channel: string }) {
  return (
    <div className="hidden h-12 items-center justify-between border-t border-sand-200 lg:flex">
      {/* Left: All categories */}
      <AllCategoriesTrigger />

      {/* Center: Primary nav */}
      <Suspense>
        <HeaderPrimaryNav channel={channel} />
      </Suspense>

      {/* Right: Market controls + Vehicle selector */}
      <div className="flex items-center gap-2">
        <HeaderMarketControls />
        <VehicleSelectorTrigger />
      </div>
    </div>
  );
}
