/**
 * One place that turns a resolved garage vehicle into the string a shopper reads.
 *
 * The header, the configurator's summary and the garage list all print the same car.
 * Three inline `[make, model, generation].join(" ")` expressions are three chances for
 * them to drift, and a header saying "Škoda Octavia" above a garage saying
 * "Škoda Octavia IV (NX)" is the same shopper being told two things about one car.
 *
 * An unresolved vehicle returns null rather than a partial name: its ids mean nothing to
 * the current dataset, so any name assembled from them would be a guess.
 */

export type VehicleNameParts = {
	makeName: string | null;
	modelName: string | null;
	generationName: string | null;
	unresolved: boolean;
};

export function vehicleDisplayName(vehicle: VehicleNameParts | null | undefined): string | null {
	if (!vehicle || vehicle.unresolved) return null;
	const label = [vehicle.makeName, vehicle.modelName, vehicle.generationName]
		.filter((part): part is string => Boolean(part && part.trim()))
		.join(" ");
	return label.length > 0 ? label : null;
}
