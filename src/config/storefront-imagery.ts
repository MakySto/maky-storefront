/**
 * The scenery photos: the homepage hero, the homepage category tiles and the category banners.
 *
 * These are the shop's own product photos from Saleor, chosen by id (a product's slug changes
 * whenever the catalogue renames it; its id and its media ids do not). The owner approved the
 * Thule photos in Saleor for the homepage, hero included, on 2026-09-24; where no Thule photo
 * shows a category, the Menabo or Carcamp photo from the same shelf does.
 *
 * They are the FALLBACK. The owner's banner set is to be managed in Payload
 * (`src/lib/cms/scenery.ts`), and an image published there for a placement wins over the entry
 * here. A placement with neither falls back once more, to the category's own Saleor image.
 *
 * `position` is the CSS object-position of the subject — the car and what is on its roof — so a
 * wide crop of a square photo keeps the part that explains the category. `mobilePosition` is the
 * same for the tall phone crop, when it differs.
 */

export type SceneryPhoto = {
	readonly productId: string;
	readonly mediaId: string;
	readonly position?: string;
	readonly mobilePosition?: string;
};

export type HeroScenery = {
	readonly photo: SceneryPhoto;
	/**
	 * The photo shows this very product (it comes from the product's own gallery), so the floating
	 * card over it may say "Na fotke". A photo that only illustrates would get a recommendation card
	 * without that claim, or none.
	 */
	readonly showsProduct: boolean;
};

/** Thule Motion 3 L Black Glossy on a dark SUV, mist over the mountains (product 302). */
export const HERO_SCENERY: HeroScenery = {
	photo: {
		productId: "UHJvZHVjdDozMDI=",
		mediaId: "UHJvZHVjdE1lZGlhOjc5OA==",
		// Anchored higher than centre: from ~1600px the hero's fixed height crops the photo's top,
		// and at "50% 60%" the roof box — the product on the card — lost its lid (owner, 2026-09-24);
		// "50% 32%" overshot and dropped the car under the benefits row at 1920px.
		position: "50% 45%",
		mobilePosition: "50% 62%",
	},
	showsProduct: true,
};

/**
 * Homepage category tiles, by the category's base slug. A slug missing here shows the category's
 * own Saleor image (a product cut-out) until a photo is published for it.
 */
export const TILE_SCENERY: Readonly<Partial<Record<string, SceneryPhoto>>> = {
	// Thule Force 3 in a forest, a family packing beside the car (product 436).
	"stresne-boxy": { productId: "UHJvZHVjdDo0MzY=", mediaId: "UHJvZHVjdE1lZGlhOjE1NDg=", position: "30% 50%" },
	// Thule Epos with two bikes, a forest track in low sun (product 299).
	"nosice-bicyklov": {
		productId: "UHJvZHVjdDoyOTk=",
		mediaId: "UHJvZHVjdE1lZGlhOjc3Mw==",
		position: "50% 55%",
	},
	// Nordrive Pro-SLIDE EVO on a car roof under snowy peaks (product 42, media 1776) — the ski
	// shelf's one real mountain scene; Thule SnowPack's roof shot stands on a white sky.
	"nosice-lyzi": { productId: "UHJvZHVjdDo0Mg==", mediaId: "UHJvZHVjdE1lZGlhOjE3NzY=", position: "55% 55%" },
	// Carcamp Alba 2 on a Land Rover in the dust (product 465).
	"stresne-stany": {
		productId: "UHJvZHVjdDo0NjU=",
		mediaId: "UHJvZHVjdE1lZGlhOjE2MjM=",
		position: "58% 50%",
	},
};

/**
 * Category banners, by the category's base slug. A sub-category without its own entry uses its
 * parent's; a category with neither gets the designed banner without a photo.
 */
export const BANNER_SCENERY: Readonly<Partial<Record<string, SceneryPhoto>>> = {
	// Thule Motion 3 L on a dark SUV, mist over the mountains (product 302) — the car and the box
	// stand right of centre, the words go over the mist.
	"stresne-boxy": {
		productId: "UHJvZHVjdDozMDI=",
		mediaId: "UHJvZHVjdE1lZGlhOjc5OA==",
		position: "50% 52%",
		mobilePosition: "62% 58%",
	},
	// Menabo Orbit 3 with three bikes and a roof box, a quarry in the hills (product 442).
	"nosice-bicyklov": {
		productId: "UHJvZHVjdDo0NDI=",
		mediaId: "UHJvZHVjdE1lZGlhOjE1ODQ=",
		position: "60% 55%",
	},
	// Thule Epos on a silver car by a lake (product 299).
	"nosice-bicyklov-na-tazne-zariadenie": {
		productId: "UHJvZHVjdDoyOTk=",
		mediaId: "UHJvZHVjdE1lZGlhOjc3NA==",
		position: "50% 62%",
	},
	// Carcamp Alba 2 in the dust (product 465).
	"stresne-stany": {
		productId: "UHJvZHVjdDo0NjU=",
		mediaId: "UHJvZHVjdE1lZGlhOjE2MjM=",
		position: "60% 52%",
	},
	// Thule SnowPack, skis on the roof (product 242).
	"nosice-lyzi": { productId: "UHJvZHVjdDoyNDI=", mediaId: "UHJvZHVjdE1lZGlhOjU2OA==", position: "50% 70%" },
};

/** The photo behind the homepage's entry to the advice pages. Thule Epos in a pine forest (product 310). */
export const ADVICE_SCENERY: SceneryPhoto = {
	productId: "UHJvZHVjdDozMTA=",
	mediaId: "UHJvZHVjdE1lZGlhOjg2MA==",
	position: "55% 45%",
};

/** Every product whose gallery the scenery reads, for one query. */
export function sceneryProductIds(): string[] {
	const photos = [
		HERO_SCENERY.photo,
		ADVICE_SCENERY,
		...Object.values(TILE_SCENERY),
		...Object.values(BANNER_SCENERY),
	];
	return [
		...new Set(photos.filter((photo): photo is SceneryPhoto => Boolean(photo)).map((p) => p.productId)),
	];
}
