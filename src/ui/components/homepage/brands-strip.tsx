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
              className="text-lg font-semibold tracking-tight text-gray-400 transition hover:text-gray-600"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
