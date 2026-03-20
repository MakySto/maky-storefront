"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";

const CATEGORIES = [
  { key: "roofRacks" as const, icon: RoofRackIcon, href: "/categories/stresne-nosice", color: "bg-sky-50 text-sky-700" },
  { key: "roofBoxes" as const, icon: RoofBoxIcon, href: "/categories/stresne-boxy", color: "bg-amber-50 text-amber-700" },
  { key: "bikeCarriers" as const, icon: BikeIcon, href: "/categories/nosice-bicyklov", color: "bg-green-50 text-green-700" },
  { key: "skiCarriers" as const, icon: SkiIcon, href: "/categories/nosice-lyz", color: "bg-blue-50 text-blue-700" },
  { key: "snowChains" as const, icon: ChainIcon, href: "/categories/snehove-retaze", color: "bg-slate-50 text-slate-700" },
  { key: "carFridges" as const, icon: FridgeIcon, href: "/categories/autochladnicky", color: "bg-cyan-50 text-cyan-700" },
  { key: "towBars" as const, icon: TowBarIcon, href: "/categories/tazne-zariadenia", color: "bg-orange-50 text-orange-700" },
];

export function CategoryGrid() {
  const t = useTranslations("nav");
  const params = useParams<{ channel: string }>();
  const channel = params.channel;

  return (
    <section id="categories" className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        {t("allCategories")}
      </h2>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {CATEGORIES.map(({ key, icon: Icon, href, color }) => (
          <Link
            key={key}
            href={`/${channel}${href}`}
            className="group flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:border-gray-200 hover:shadow-md"
          >
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${color} transition group-hover:scale-110`}>
              <Icon className="h-7 w-7" />
            </div>
            <span className="text-sm font-medium text-gray-900">{t(key)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Inline SVG Icons ── */

function RoofRackIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" d="M3 8h18M3 8l2-4h14l2 4M6 8v4M18 8v4M3 12h18" />
    </svg>
  );
}

function RoofBoxIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <rect x="2" y="8" width="20" height="8" rx="2" strokeLinecap="round" />
      <path strokeLinecap="round" d="M5 8V6a2 2 0 012-2h10a2 2 0 012 2v2M12 8v8" />
    </svg>
  );
}

function BikeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" />
      <path strokeLinecap="round" d="M6 17l3-7h4l2 3h3M9 10l-1-3h3" />
    </svg>
  );
}

function SkiIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" d="M4 20L20 4M7 17l2-2M13 11l2-2M9 3v6M15 15v6" />
    </svg>
  );
}

function ChainIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function FridgeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2" /><path strokeLinecap="round" d="M4 10h16M8 6v2M8 14v4" />
    </svg>
  );
}

function TowBarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <circle cx="12" cy="18" r="2" /><path strokeLinecap="round" d="M12 16V8M8 8h8M6 4h12v4H6z" />
    </svg>
  );
}
