"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type ConsentValue = "granted" | "denied";

type StoredConsent = {
	v: number;
	ts: number;
	consent: {
		analytics_storage: ConsentValue;
		ad_storage: ConsentValue;
		ad_user_data: ConsentValue;
		ad_personalization: ConsentValue;
        personalization_storage: ConsentValue;
	};
};

const STORAGE_KEY = "maky-consent";

function buildConsent(analytics: boolean, marketing: boolean) {
	const a: ConsentValue = analytics ? "granted" : "denied";
	const m: ConsentValue = marketing ? "granted" : "denied";
	return { analytics_storage: a, ad_storage: m, ad_user_data: m, ad_personalization: m, personalization_storage: m, };
}

export function CookieConsent() {
	const t = useTranslations("cookieConsent");
	const [mounted, setMounted] = useState(false);
	const [visible, setVisible] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [analytics, setAnalytics] = useState(false);
	const [marketing, setMarketing] = useState(false);

	useEffect(() => {
		setMounted(true);

		let saved: StoredConsent | null = null;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) saved = JSON.parse(raw) as StoredConsent;
		} catch {
			saved = null;
		}

		if (!saved) {
			setVisible(true);
		} else {
			setAnalytics(saved.consent?.analytics_storage === "granted");
			setMarketing(saved.consent?.ad_storage === "granted");
		}

		const open = () => {
			setShowSettings(true);
			setVisible(true);
		};
		window.addEventListener("maky:open-consent", open);
		return () => window.removeEventListener("maky:open-consent", open);
	}, []);

	function persistAndApply(nextAnalytics: boolean, nextMarketing: boolean) {
		const consent = buildConsent(nextAnalytics, nextMarketing);
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ v: 1, ts: Date.now(), consent } satisfies StoredConsent),
			);
		} catch {
			// localStorage nedostupné – ticho ignoruj
		}

		const w = window as unknown as { gtag?: (...args: unknown[]) => void };
		if (typeof w.gtag === "function") {
			w.gtag("consent", "update", consent);
		}

		setVisible(false);
		setShowSettings(false);
	}

	if (!mounted || !visible) return null;

	const acceptAll = () => persistAndApply(true, true);
	const rejectAll = () => persistAndApply(false, false);
	const savePrefs = () => persistAndApply(analytics, marketing);

	const btnAccept =
		"inline-flex h-11 items-center justify-center rounded-sm bg-copper-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-copper-700";
	const btnSecondary =
		"inline-flex h-11 items-center justify-center rounded-sm border border-sand-300 bg-white px-5 text-sm font-semibold text-gray-900 transition-colors hover:bg-sand-100";

	return (
		<div
			role="dialog"
			aria-label={t("manageTitle")}
			className="fixed inset-x-0 bottom-0 z-50 border-t border-sand-300 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.07)] backdrop-blur-sm"
		>
			<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
				{!showSettings ? (
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div className="lg:max-w-2xl">
							<p className="text-sm font-semibold text-gray-900">{t("title")}</p>
							<p className="mt-1 text-sm leading-relaxed text-gray-600">{t("description")}</p>
						</div>
						<div className="flex flex-wrap items-center gap-2 sm:gap-3">
							<button
								type="button"
								onClick={() => setShowSettings(true)}
								className="text-sm font-medium text-gray-600 underline underline-offset-2 transition-colors hover:text-gray-900"
							>
								{t("settings")}
							</button>
							<button type="button" onClick={rejectAll} className={btnSecondary}>
								{t("rejectAll")}
							</button>
							<button type="button" onClick={acceptAll} className={btnAccept}>
								{t("acceptAll")}
							</button>
						</div>
					</div>
				) : (
					<div>
						<p className="mb-3 text-sm font-semibold text-gray-900">{t("manageTitle")}</p>
						<div className="space-y-3">
							<div className="flex items-start justify-between gap-4 rounded-sm border border-sand-200 bg-sand-50 p-3">
								<div>
									<p className="text-sm font-medium text-gray-900">{t("necessary")}</p>
									<p className="mt-0.5 text-xs leading-relaxed text-gray-600">{t("necessaryDesc")}</p>
								</div>
								<span className="shrink-0 pt-0.5 text-xs font-medium text-forest-600">{t("alwaysOn")}</span>
							</div>

							<div className="flex items-start justify-between gap-4 rounded-sm border border-sand-200 p-3">
								<div>
									<p className="text-sm font-medium text-gray-900">{t("analytics")}</p>
									<p className="mt-0.5 text-xs leading-relaxed text-gray-600">{t("analyticsDesc")}</p>
								</div>
								<ConsentToggle checked={analytics} onChange={setAnalytics} label={t("analytics")} />
							</div>

							<div className="flex items-start justify-between gap-4 rounded-sm border border-sand-200 p-3">
								<div>
									<p className="text-sm font-medium text-gray-900">{t("marketing")}</p>
									<p className="mt-0.5 text-xs leading-relaxed text-gray-600">{t("marketingDesc")}</p>
								</div>
								<ConsentToggle checked={marketing} onChange={setMarketing} label={t("marketing")} />
							</div>
						</div>

						<div className="mt-4 flex flex-wrap items-center justify-end gap-2 sm:gap-3">
							<button type="button" onClick={rejectAll} className={btnSecondary}>
								{t("rejectAll")}
							</button>
							<button type="button" onClick={savePrefs} className={btnSecondary}>
								{t("savePreferences")}
							</button>
							<button type="button" onClick={acceptAll} className={btnAccept}>
								{t("acceptAll")}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function ConsentToggle({
	checked,
	onChange,
	label,
}: {
	checked: boolean;
	onChange: (next: boolean) => void;
	label: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className="flex h-11 w-14 shrink-0 items-center justify-center"
		>
			<span
				className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
					checked ? "bg-copper-600" : "bg-sand-400"
				}`}
			>
				<span
					className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
						checked ? "translate-x-6" : "translate-x-1"
					}`}
				/>
			</span>
		</button>
	);
}