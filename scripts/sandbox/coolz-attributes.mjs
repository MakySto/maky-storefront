// The car-fridge attributes of the five CoolZ coolers, for the LOCAL sandbox Saleor only.
//
// What is real here: the keys (the `cfm:attribute:<key>` external references CFM writes, see
// `ATTRIBUTE_TO_SPEC` in the CFM CoolZ content builder), the input types (CFM maps its `number`,
// `boolean` and `text` data types to Saleor NUMERIC, BOOLEAN and PLAIN_TEXT, see
// `serialize_attribute_value`) and the numbers (the onboarding manifest's specifications).
//
// What is an ASSUMPTION, and why this file proves nothing about production: the display names and
// the text values. The production attribute rows were not read. CFM sends `value_text` as stored,
// and the code suggests the stored text of some rows is the manifest's English ("compressor",
// "2 wire baskets | 1 rack"). Here they are written in Slovak, as the approved comparison table
// prints them, so the preview shows the page as it should read once the values are Slovak.
// Read the real rows before anything here is taken for how the live page will look.

/** [key, display name, Saleor input type] */
export const FRIDGE_ATTRIBUTES = [
	["volume", "Objem", "NUMERIC"],
	["net_volume", "Čistý objem", "NUMERIC"],
	["cooling_system", "Chladiaci systém", "PLAIN_TEXT"],
	["dual_zone", "Dual Zone", "BOOLEAN"],
	["refrigerant", "Chladivo", "PLAIN_TEXT"],
	["temperature_min", "Najnižšia teplota", "NUMERIC"],
	["temperature_max", "Najvyššia teplota", "NUMERIC"],
	["cooling_modes", "Režimy chladenia", "PLAIN_TEXT"],
	["climate_class", "Klimatická trieda", "PLAIN_TEXT"],
	["noise_level", "Hlučnosť", "PLAIN_TEXT"],
	["dc_power_input", "Vstup DC", "PLAIN_TEXT"],
	["ac_power_input", "Vstup AC", "PLAIN_TEXT"],
	["rated_power", "Príkon", "NUMERIC"],
	["input_current_ac", "Vstupný prúd AC", "NUMERIC"],
	["input_current_dc", "Vstupný prúd DC (12 V / 24 V)", "PLAIN_TEXT"],
	["interior_height", "Výška vnútorného priestoru", "NUMERIC"],
	["package_dimensions_text", "Rozmery balenia", "PLAIN_TEXT"],
	["package_weight", "Hmotnosť balenia", "NUMERIC"],
	["interior_components", "Vnútorné vybavenie", "PLAIN_TEXT"],
	["bluetooth_app_control", "Ovládanie cez Bluetooth", "BOOLEAN"],
	["battery_protection", "Ochrana autobatérie", "BOOLEAN"],
	["built_in_led_light", "Vstavané LED osvetlenie", "BOOLEAN"],
	["bottle_opener", "Otvárač fliaš", "BOOLEAN"],
	["removable_wire_rack", "Vyberateľný drôtený kôš", "BOOLEAN"],
	["warranty_years", "Záruka", "NUMERIC"],
];

const COMMON = {
	cooling_system: "Kompresor",
	refrigerant: "R600a",
	temperature_min: "-20",
	temperature_max: "20",
	cooling_modes: "Rýchle chladenie | Úsporný režim",
	climate_class: "T / ST / N",
	noise_level: "<45 dB",
	dc_power_input: "12/24 V DC",
	ac_power_input: "100-240 V AC",
	bluetooth_app_control: true,
	battery_protection: true,
	built_in_led_light: true,
	bottle_opener: true,
	removable_wire_rack: true,
	warranty_years: "3",
};

/** The per-model numbers of the onboarding manifest (`specifications`), in Slovak writing. */
const BY_SKU = {
	TK20409: {
		volume: "19",
		rated_power: "45",
		input_current_ac: "0.2",
		input_current_dc: "3,75 / 1,88",
		package_dimensions_text: "548 × 396 × 484 mm",
		package_weight: "10.8",
		interior_height: "330",
	},
	TK20410: {
		volume: "32",
		rated_power: "60",
		input_current_ac: "0.26",
		input_current_dc: "5 / 2,5",
		package_dimensions_text: "698 × 440 × 455 mm",
		package_weight: "15.1",
		interior_height: "287",
	},
	TK20411: {
		volume: "40",
		rated_power: "60",
		input_current_ac: "0.26",
		input_current_dc: "5 / 2,5",
		package_dimensions_text: "698 × 440 × 517 mm",
		package_weight: "16.1",
		interior_height: "352",
	},
	TK20412: {
		volume: "65",
		rated_power: "60",
		input_current_ac: "0.26",
		input_current_dc: "5 / 2,5",
		package_dimensions_text: "798 × 508 × 536 mm",
		package_weight: "19.7",
		interior_height: "366",
	},
	TK20413: {
		volume: "83",
		net_volume: "82.5",
		cooling_system: "Dvojzónový kompresor",
		dual_zone: true,
		interior_components: "2 drôtené koše | 1 rošt",
		rated_power: "80",
		input_current_ac: "0.35",
		input_current_dc: "6,67 / 3,33",
		package_dimensions_text: "967 × 540 × 555 mm",
		package_weight: "23.3",
		interior_height: "393",
	},
};

/** The attribute values of one cooler, as `{ key: value }` (a string, or a boolean for BOOLEAN). */
export function fridgeValues(sku) {
	const own = BY_SKU[sku];
	if (!own) throw new Error(`no fridge attributes for ${sku}`);
	return { ...COMMON, ...own };
}
