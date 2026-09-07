import { connection } from "next/server";

import { listProductApplications } from "@/lib/fitment/application-actions";
import { loadFitmentDataset } from "@/lib/fitment/provider";
import { datasetSpeaksForProduct } from "@/lib/fitment/resolve";
import { ProductVehicleApplications } from "./product-vehicle-applications";

/**
 * "Which vehicles is this product made for?" on the product page.
 *
 * The server half: it fetches the first page so the question is answered in the initial
 * HTML, and the client component pages and searches from there.
 *
 * Same scope gate as the compatibility box, and for the same reason: a product the
 * dataset has no row for gets no section at all. Rendering the component's own
 * `applicationsEmpty` state ("this product has no listed vehicles") on a snow chain
 * would read as a fact about the product, when it is a fact about our data.
 *
 * Failing into silence, for the same reason as the compatibility box: a vehicle list
 * that cannot load is not a reason to take a product page down.
 */
export async function PdpVehicleApplications({ saleorProductId }: { saleorProductId: string }) {
	try {
		return await renderApplications(saleorProductId);
	} catch (error) {
		console.error("[fitment] PDP applications failed:", error);
		return null;
	}
}

async function renderApplications(saleorProductId: string) {
	await connection();

	const { dataset } = await loadFitmentDataset();
	if (!dataset) return null;
	if (!datasetSpeaksForProduct(dataset, saleorProductId)) return null;

	const initial = await listProductApplications(saleorProductId);
	if (initial.unavailable) return null;

	return <ProductVehicleApplications saleorProductId={saleorProductId} initial={initial} />;
}
