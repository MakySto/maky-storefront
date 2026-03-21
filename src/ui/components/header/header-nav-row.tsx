import { Suspense } from "react";
import { AllCategoriesTrigger } from "./all-categories-trigger";
import { HeaderMarketControls } from "./header-market-controls";
import { HeaderPrimaryNav } from "./header-primary-nav";
import { VehicleSelectorTrigger } from "./vehicle-selector-trigger";

export async function HeaderNavRow({ channel }: { channel: string }) {
  return (
    <div className="flex h-12 items-center justify-between">
      <div className="flex items-center gap-3">
        <AllCategoriesTrigger />

        <Suspense>
          <HeaderPrimaryNav channel={channel} />
        </Suspense>
      </div>

      <div className="flex items-center gap-2">
        <HeaderMarketControls />
        <VehicleSelectorTrigger />
      </div>
    </div>
  );
}
