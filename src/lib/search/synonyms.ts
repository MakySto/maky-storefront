/**
 * The other words customers use for a shelf, per language.
 *
 * The menu calls the roof racks "Dachträger"; a German customer also types "Grundträger",
 * "Dachgepäckträger" or "Relingträger". The catalogue's own texts (CFM, through Saleor) name each
 * product and each category once, in the word the shop chose. This list is the rest: what the
 * trade and the customers say for the same shelf. It is read in two places, and nowhere is it
 * shown: the search index adds the words to every product of the shelf, and the signpost above
 * the results (`category-shortcuts.ts`) knows the shelf by them.
 *
 * Keyed by the catalogue LANGUAGE (`sk`, `cs`, `de`…, as `catalogLanguageForChannel` answers) and
 * the shelf's base slug. Austria reads the German list and Canada the English one: a search word
 * is not a text of the market, and nothing here is printed.
 *
 * Keep it to words that MEAN the shelf. A word that is only often seen beside it ("auto", "Thule")
 * would put every product of the shelf into unrelated answers.
 */
export const CATEGORY_SYNONYMS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
	sk: {
		"stresne-nosice": ["priečniky", "strešný nosič", "nosič na strechu", "hagusy", "strešák"],
		"stresne-boxy": ["strešný box", "autobox", "box na strechu", "strešný kufor", "rakva"],
		"nosice-bicyklov": [
			"nosič bicyklov",
			"nosič na bicykle",
			"nosič bicykla",
			"nosič na bajky",
			"cyklonosič",
		],
		"nosice-lyzi": ["nosič lyží", "nosič na lyže", "nosič snowboardov", "lyžiarsky nosič"],
		"snehove-retaze": ["snehové reťaze", "reťaze na kolesá", "snehové ponožky", "zimné reťaze"],
		autochladnicky: ["autochladnička", "chladnička do auta", "chladiaci box", "kompresorová chladnička"],
		"stresne-stany": ["strešný stan", "autostan", "stan na auto", "stan na strechu"],
		"preprava-zvierat": ["klietka pre psa", "prepravka pre psa", "box pre psa", "klietka do auta"],
	},
	cs: {
		"stresne-nosice": ["příčníky", "střešní nosič", "nosič na střechu", "zahrádka", "hagusy"],
		"stresne-boxy": ["střešní box", "autobox", "box na střechu", "střešní kufr", "rakev"],
		"nosice-bicyklov": ["nosič kol", "nosič na kola", "nosič jízdních kol", "cyklonosič"],
		"nosice-lyzi": ["nosič lyží", "nosič na lyže", "nosič snowboardů"],
		"snehove-retaze": ["sněhové řetězy", "řetězy na kola", "sněhové ponožky", "zimní řetězy"],
		autochladnicky: [
			"autochladnička",
			"autolednice",
			"lednice do auta",
			"chladicí box",
			"chladnička do auta",
		],
		"stresne-stany": ["střešní stan", "autostan", "stan na auto", "stan na střechu"],
		"preprava-zvierat": ["klec pro psa", "přepravka pro psa", "box pro psa"],
	},
	de: {
		"stresne-nosice": [
			"Dachträger",
			"Grundträger",
			"Dachgepäckträger",
			"Relingträger",
			"Querträger",
			"Lastenträger",
			"Dachreling Träger",
		],
		"stresne-boxy": ["Dachbox", "Dachkoffer", "Skibox", "Autodachbox"],
		"nosice-bicyklov": [
			"Fahrradträger",
			"Fahrradheckträger",
			"Heckträger",
			"Kupplungsträger",
			"Radträger",
			"Veloträger",
			"E-Bike Träger",
		],
		"nosice-lyzi": ["Skiträger", "Skihalter", "Snowboardträger"],
		"snehove-retaze": ["Schneeketten", "Schneesocken", "Anfahrhilfe"],
		autochladnicky: ["Kühlbox", "Kompressorkühlbox", "Autokühlschrank", "Kühlschrank Auto", "Auto Kühlbox"],
		"stresne-stany": ["Dachzelt", "Autodachzelt", "Autozelt"],
		"preprava-zvierat": ["Hundebox", "Hundetransportbox", "Hundekäfig", "Transportbox Hund"],
	},
	pl: {
		"stresne-nosice": ["bagażnik dachowy", "belki dachowe", "bagażnik bazowy", "belki na dach", "relingi"],
		"stresne-boxy": ["box dachowy", "boks dachowy", "kufer dachowy", "box na dach"],
		"nosice-bicyklov": [
			"bagażnik rowerowy",
			"bagażnik na rowery",
			"uchwyt rowerowy",
			"platforma rowerowa",
			"uchwyt na rower",
		],
		"nosice-lyzi": ["uchwyt na narty", "bagażnik na narty", "uchwyt narciarski"],
		"snehove-retaze": ["łańcuchy śniegowe", "łańcuchy na koła", "skarpety śniegowe"],
		autochladnicky: ["lodówka samochodowa", "lodówka turystyczna", "lodówka kompresorowa"],
		"stresne-stany": ["namiot dachowy", "namiot na dach"],
		"preprava-zvierat": ["klatka dla psa", "transporter dla psa", "box dla psa"],
	},
	hu: {
		"stresne-nosice": ["tetőcsomagtartó", "csomagtartó", "keresztrúd", "tetőcsomagtartó rúd", "tetősín"],
		"stresne-boxy": ["tetőbox", "síbox", "tetődoboz"],
		"nosice-bicyklov": ["kerékpártartó", "kerékpárszállító", "biciklitartó", "bicikliszállító"],
		"nosice-lyzi": ["síléctartó", "sítartó", "snowboardtartó"],
		"snehove-retaze": ["hólánc", "hózokni"],
		autochladnicky: ["autós hűtő", "hűtőláda", "kompresszoros hűtő", "autóhűtő"],
		"stresne-stany": ["tetősátor", "autósátor"],
		"preprava-zvierat": ["kutyaszállító", "kutyabox", "szállítóketrec"],
	},
	it: {
		"stresne-nosice": ["barre portatutto", "portapacchi", "barre tetto", "portatutto", "barre da tetto"],
		"stresne-boxy": ["box tetto", "box da tetto", "baule da tetto", "box auto"],
		"nosice-bicyklov": ["portabici", "portabiciclette", "porta bici"],
		"nosice-lyzi": ["portasci", "porta sci", "portasnowboard"],
		"snehove-retaze": ["catene da neve", "catene neve", "calze da neve"],
		autochladnicky: ["frigo portatile", "frigorifero auto", "frigo auto", "frigo a compressore"],
		"stresne-stany": ["tenda da tetto", "tenda auto"],
		"preprava-zvierat": ["trasportino cane", "gabbia per cani", "box cane"],
	},
	fr: {
		"stresne-nosice": ["barres de toit", "barre de toit", "galerie de toit", "porte-bagages"],
		"stresne-boxy": ["coffre de toit", "coffre toit"],
		"nosice-bicyklov": ["porte-vélos", "porte-vélo", "porte vélos"],
		"nosice-lyzi": ["porte-skis", "porte skis", "porte-snowboard"],
		"snehove-retaze": ["chaînes neige", "chaînes à neige", "chaussettes neige"],
		autochladnicky: ["glacière", "réfrigérateur voiture", "frigo voiture", "glacière à compresseur"],
		"stresne-stany": ["tente de toit"],
		"preprava-zvierat": ["cage de transport chien", "caisse de transport chien"],
	},
	es: {
		"stresne-nosice": ["barras de techo", "barras portaequipajes", "baca", "portaequipajes"],
		"stresne-boxy": ["cofre de techo", "baúl de techo", "cofre portaequipajes"],
		"nosice-bicyklov": ["portabicicletas", "portabicis", "porta bicicletas"],
		"nosice-lyzi": ["portaesquís", "porta esquís"],
		"snehove-retaze": ["cadenas de nieve", "fundas de nieve"],
		autochladnicky: ["nevera portátil", "nevera coche", "nevera de compresor"],
		"stresne-stany": ["tienda de techo"],
		"preprava-zvierat": ["transportín perro", "jaula para perros"],
	},
	ro: {
		"stresne-nosice": ["bare transversale", "bare portbagaj", "portbagaj", "bare plafon"],
		"stresne-boxy": ["cutie portbagaj", "cutie plafon", "cutie auto"],
		"nosice-bicyklov": ["suport biciclete", "suport bicicleta", "suport bicicletă"],
		"nosice-lyzi": ["suport schiuri", "suport ski"],
		"snehove-retaze": ["lanțuri zăpadă", "lanțuri antiderapante", "lanțuri de zăpadă"],
		autochladnicky: ["frigider auto", "ladă frigorifică", "frigider cu compresor"],
		"stresne-stany": ["cort auto", "cort plafon"],
		"preprava-zvierat": ["cușcă câine", "cușcă transport câini"],
	},
	en: {
		"stresne-nosice": ["roof rack", "roof bars", "crossbars", "cross bars", "roof rails"],
		"stresne-boxy": ["roof box", "cargo box", "rooftop carrier"],
		"nosice-bicyklov": ["bike rack", "bike carrier", "bicycle rack", "hitch rack"],
		"nosice-lyzi": ["ski rack", "ski carrier", "snowboard rack"],
		"snehove-retaze": ["snow chains", "tire chains", "tyre chains", "snow socks"],
		autochladnicky: ["car fridge", "portable fridge", "car cooler", "compressor fridge"],
		"stresne-stany": ["roof tent", "rooftop tent"],
		"preprava-zvierat": ["dog crate", "dog cage", "dog box"],
	},
};

/** The other words for one shelf in one language. Empty for a shelf or language the list does not know. */
export function categorySynonyms(language: string | null | undefined, baseSlug: string): readonly string[] {
	return (language ? CATEGORY_SYNONYMS[language]?.[baseSlug] : undefined) ?? [];
}
