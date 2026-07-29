"use client";

const BRANDS = [
	{ name: "Thule", slug: "thule" },
	{ name: "Cruz", slug: "cruz" },
	{ name: "Menabo", slug: "menabo" },
	{ name: "Nordrive", slug: "nordrive" },
	{ name: "HAK-SYSTEM", slug: "hak-system" },
	{ name: "ORIS", slug: "oris" },
	{ name: "JAEGER", slug: "jaeger" },
	{ name: "Galia", slug: "galia" },
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
