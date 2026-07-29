"use client";

/**
 * Homepage brand strip.
 *
 * Every name here must clear two tests, and the previous list cleared neither.
 *
 * 1. Approved for the homepage — CLAUDE.md §6 names Thule, Nordrive, Menabo, Yakima,
 *    Peruzzo, Pro-USER, Spinder, Green Valley, SnowDrive and DAC, and explicitly says
 *    NOT to show Cruz, HAK-SYSTEM, GALIA, ORIS or JAEGER until approved. All five
 *    prohibited names were live.
 * 2. Actually stocked. Checked against the `cfm:attribute:manufacturer` values in
 *    Saleor: those same five appear NOWHERE in the catalogue, so the homepage was
 *    advertising five brands the shop does not sell.
 *
 * SnowDrive is approved but has no catalogue products either, so it is left out until
 * it does. An approved brand is still a claim.
 */
const BRANDS = [
	{ name: "Thule", slug: "thule" },
	{ name: "Menabo", slug: "menabo" },
	{ name: "Nordrive", slug: "nordrive" },
	{ name: "Yakima", slug: "yakima" },
	{ name: "Peruzzo", slug: "peruzzo" },
	{ name: "Pro-USER", slug: "pro-user" },
	{ name: "Spinder", slug: "spinder" },
	{ name: "Green Valley", slug: "green-valley" },
	{ name: "DAC", slug: "dac" },
];

export function BrandsStrip() {
	return (
		<section className="border-y border-gray-100 bg-white py-10">
			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				<div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
					{BRANDS.map(({ name }) => (
						<span
							key={name}
							// gray-400 measured 2.44:1 on white. These are 18px semibold, which is
							// NOT "large text" under WCAG (that needs 18.66px bold or 24px), so they
							// owe the full 4.5:1. text-tertiary keeps the strip deliberately quiet at
							// 4.84:1 instead of illegible.
							className="text-text-tertiary hover:text-text-primary text-lg font-semibold tracking-tight transition"
						>
							{name}
						</span>
					))}
				</div>
			</div>
		</section>
	);
}
