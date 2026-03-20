"use client";

import { useTranslations } from "next-intl";

const TRUST_ITEMS = [
  {
    icon: TruckIcon,
    titleKey: "freeShipping",
    descKey: "freeShippingDesc",
  },
  {
    icon: ShieldIcon,
    titleKey: "warranty",
    descKey: "warrantyDesc",
  },
  {
    icon: WrenchIcon,
    titleKey: "expertise",
    descKey: "expertiseDesc",
  },
  {
    icon: HeadsetIcon,
    titleKey: "support",
    descKey: "supportDesc",
  },
];

export function WhyMaky() {
  const t = useTranslations("trust");

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{t(titleKey)}</h3>
                <p className="mt-1 text-sm text-gray-500">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h.008M13.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H2.25M13.5 7.5h4.875c.378 0 .725.188.936.498l2.19 3.232a1.125 1.125 0 01.189.626V14.25" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1 5.1a2.121 2.121 0 01-3-3l5.1-5.1m0 0L15 4.5a5.25 5.25 0 017.5 7.5l-7.58 7.58m-4.92-4.91l4.92 4.91" />
    </svg>
  );
}

function HeadsetIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75a9 9 0 0119.5 0v1.5a.75.75 0 01-.75.75h-.75a3 3 0 00-3 3v1.5a3 3 0 003 3h.75a.75.75 0 01.75.75V18a3.75 3.75 0 01-3.75 3.75h-3a.75.75 0 01-.75-.75v-.75a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v.75a.75.75 0 01-.75.75h0A5.25 5.25 0 012.25 16.5V6.75z" />
    </svg>
  );
}
