import { type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon, MailIcon } from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";
import { marketHref } from "@/lib/channel-map";
import { visibleNavLinks } from "@/lib/cms/availability";
import type { SceneryImage } from "@/lib/homepage/scenery";
import { ADVICE_NAV } from "@/ui/components/header/header.config";
import { cn } from "@/lib/utils";

/**
 * The homepage's last row: the way into the advice pages beside the newsletter card.
 *
 * The advice card is one entry to the real `/poradna`, shown only where the market has that
 * page (`visibleNavLinks`, the header's own rule). No list of articles: the CMS publishes no
 * article list yet, and a card for an article that does not exist would be a dead end.
 *
 * The newsletter has no backend yet. It keeps its place in the design with an honest state —
 * the field and the button are disabled and a line says sign-up is being prepared — and never
 * pretends a sign-up happened. Nothing typed here is sent or stored anywhere.
 */
export async function AdviceAndNewsletter({
	channel,
	photo,
}: {
	channel: string;
	photo: SceneryImage | null;
}) {
	const locale = getLocaleFromChannel(channel);
	const [t, tFooter, [advice]] = await Promise.all([
		getTranslations({ locale, namespace: "home" }),
		getTranslations({ locale, namespace: "footer" }),
		visibleNavLinks(channel, [ADVICE_NAV]),
	]);

	return (
		<section className="max-w-page mx-auto grid gap-4 px-4 pb-16 sm:px-6 sm:pb-20 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-6 lg:px-8">
			{advice && (
				<Link
					href={marketHref(channel, advice.href)}
					className="group bg-scrim text-text-inverse focus-visible:ring-ring relative isolate flex min-h-[21rem] flex-col justify-end overflow-hidden rounded-sm p-6 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden sm:p-8"
				>
					{photo && (
						<Image
							src={photo.url}
							alt=""
							fill
							sizes="(min-width: 1024px) 60vw, 100vw"
							style={{ "--advice-pos": photo.position } as CSSProperties}
							className="-z-10 object-cover object-[var(--advice-pos)] transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
						/>
					)}
					<div
						aria-hidden="true"
						className="from-scrim/90 via-scrim/55 sm:to-scrim/5 absolute inset-0 -z-10 bg-linear-to-t to-transparent sm:bg-linear-to-r"
					/>
					<span className="bg-brand text-brand-text rounded-2xs w-fit px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">
						{t("adviceBadge")}
					</span>
					<h2 className="mt-4 max-w-md text-2xl leading-tight font-bold tracking-[-0.02em] sm:text-[1.75rem]">
						{t("adviceTitle")}
					</h2>
					<p className="text-text-inverse/85 mt-3 max-w-md text-[0.9375rem] leading-relaxed">
						{t("adviceText")}
					</p>
					<span className="bg-text-inverse text-text-primary group-hover:bg-sand-100 mt-6 inline-flex h-11 w-fit items-center gap-2 rounded-xs px-5 text-sm font-semibold transition-colors">
						{t("adviceCta")}
						<ArrowRightIcon
							className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
							aria-hidden="true"
						/>
					</span>
				</Link>
			)}

			<div
				className={cn(
					"border-border-subtle bg-surface-card relative isolate flex flex-col justify-center overflow-hidden rounded-sm border p-6 shadow-sm sm:p-8",
					!advice && "lg:col-span-2",
				)}
			>
				<div
					aria-hidden="true"
					className="art-mountains bg-sand-300 absolute right-0 bottom-0 -z-10 h-2/5 w-full opacity-90"
				/>
				<span className="bg-surface-accent text-brand flex h-12 w-12 items-center justify-center rounded-full">
					<MailIcon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
				</span>
				<h2 className="text-text-primary mt-4 text-xl font-bold tracking-[-0.02em] sm:text-2xl">
					{t("newsletterTitle")}
				</h2>
				<p className="text-text-secondary mt-2 text-[0.9375rem]">{t("newsletterText")}</p>
				<form
					className="mt-5 flex flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row"
					aria-describedby="newsletter-soon"
				>
					<label className="min-w-0 flex-1">
						<span className="sr-only">{tFooter("newsletterPlaceholder")}</span>
						<input
							type="email"
							disabled
							placeholder={tFooter("newsletterPlaceholder")}
							className="border-border-default bg-surface-card text-text-primary placeholder:text-text-tertiary h-12 w-full rounded-xs border px-4 text-sm disabled:cursor-not-allowed"
						/>
					</label>
					<button
						type="button"
						disabled
						className="bg-cta text-cta-text h-12 shrink-0 rounded-xs px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
					>
						{tFooter("subscribe")}
					</button>
				</form>
				<p id="newsletter-soon" className="text-text-secondary mt-3 text-[0.8125rem]">
					{t("newsletterSoon")}
				</p>
			</div>
		</section>
	);
}
