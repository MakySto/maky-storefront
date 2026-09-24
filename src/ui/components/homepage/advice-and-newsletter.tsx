import { type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
	ArrowRightIcon,
	CarIcon,
	ChevronRightIcon,
	ClipboardCheckIcon,
	MailIcon,
	MessageCircleQuestionIcon,
	SearchCheckIcon,
	type LucideIcon,
} from "lucide-react";
import { getLocaleFromChannel } from "@/config/locale";
import { marketHref } from "@/lib/channel-map";
import { visibleNavLinks } from "@/lib/cms/availability";
import { getAdviceGuide, type AdviceGuide } from "@/lib/cms/advice-guide";
import type { SceneryImage } from "@/lib/homepage/scenery";
import { ADVICE_NAV } from "@/ui/components/header/header.config";
import { cn } from "@/lib/utils";

/** An icon per topic, by position — the guide's sections have no pictures of their own. */
const TOPIC_ICONS: readonly LucideIcon[] = [
	CarIcon,
	SearchCheckIcon,
	ClipboardCheckIcon,
	MessageCircleQuestionIcon,
];

/**
 * "Poradňa a tipy": the guide as a large photo card, its sections as a list beside it, and the
 * newsletter card (second pass, 2026-09-24, as the approved homepage lays it out).
 *
 * Only real content. The card and the list come from the published `poradna` page in Payload
 * (`getAdviceGuide`): its title and lead, and each anchored section as a topic linking to its
 * place on the page. Payload's `posts` collection holds no article yet and the storefront has no
 * article route, so there is nothing else to list. The whole advice half shows only where the
 * market has the page (`visibleNavLinks`, the header's rule); a CMS fault keeps the card with the
 * shop's own words and drops the list.
 *
 * The newsletter has no backend yet. It keeps its place with an honest state — the field, the
 * consent and the button are disabled and a line says sign-up is being prepared — and never
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

	let guide: AdviceGuide | null = null;
	if (advice) {
		try {
			guide = await getAdviceGuide(channel);
		} catch (error) {
			console.warn(
				`[Homepage] advice guide left out for ${channel}:`,
				error instanceof Error ? error.message : error,
			);
		}
	}
	const adviceHref = advice ? marketHref(channel, advice.href) : null;
	const topics = guide?.topics.slice(0, 4) ?? [];

	return (
		<section className="max-w-page mx-auto px-4 pt-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
			{adviceHref && (
				<h2 className="text-text-primary text-2xl font-extrabold tracking-[-0.025em] sm:text-[1.875rem]">
					{t("adviceSectionTitle")}
				</h2>
			)}
			<div
				className={cn(
					"mt-6 grid gap-4 lg:gap-5",
					adviceHref && topics.length > 0
						? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1.05fr)_minmax(0,1fr)]"
						: adviceHref
							? "lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]"
							: "",
				)}
			>
				{adviceHref && (
					<Link
						href={adviceHref}
						className="group bg-scrim text-text-inverse focus-visible:ring-ring relative isolate flex min-h-[20rem] flex-col justify-end overflow-hidden rounded-sm p-6 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden sm:p-8"
					>
						{photo && (
							<Image
								src={photo.url}
								alt=""
								fill
								sizes="(min-width: 1280px) 40vw, (min-width: 1024px) 60vw, 100vw"
								style={{ "--advice-pos": photo.position } as CSSProperties}
								className="-z-10 object-cover object-[var(--advice-pos)] brightness-[1.05] saturate-[1.12] sepia-[0.1] transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
							/>
						)}
						<div
							aria-hidden="true"
							className="from-scrim/90 via-scrim/55 sm:to-scrim/5 absolute inset-0 -z-10 bg-linear-to-t to-transparent sm:bg-linear-to-r"
						/>
						<span className="bg-copper-600 text-brand-text rounded-2xs w-fit px-2.5 py-1 text-[0.6875rem] font-bold tracking-[0.12em] uppercase">
							{t("adviceBadge")}
						</span>
						<h3 className="mt-4 max-w-md text-2xl leading-tight font-extrabold tracking-[-0.02em] sm:text-[1.75rem]">
							{guide?.title ?? t("adviceTitle")}
						</h3>
						<p className="text-text-inverse/85 mt-3 line-clamp-3 max-w-md text-[0.9375rem] leading-relaxed">
							{guide?.lead ?? t("adviceText")}
						</p>
						<span className="bg-text-inverse text-text-primary group-hover:bg-sand-100 mt-6 inline-flex h-11 w-fit items-center gap-2 rounded-xs px-5 text-sm font-semibold transition-colors">
							{t("adviceRead")}
							<ArrowRightIcon
								className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
								strokeWidth={2.25}
								aria-hidden="true"
							/>
						</span>
					</Link>
				)}

				{adviceHref && topics.length > 0 && (
					<ul className="grid content-start gap-3">
						{topics.map((topic, index) => {
							const Icon = TOPIC_ICONS[index % TOPIC_ICONS.length]!;
							return (
								<li key={topic.anchor}>
									<Link
										href={`${adviceHref}#${topic.anchor}`}
										prefetch={false}
										className="group border-border-subtle bg-surface-card hover:border-border-default focus-visible:ring-ring flex items-center gap-4 rounded-sm border p-3 pr-4 shadow-xs transition-[box-shadow,border-color] hover:shadow-md focus-visible:ring-2 focus-visible:outline-hidden"
									>
										<span className="bg-surface-muted text-brand flex h-16 w-20 shrink-0 items-center justify-center rounded-xs">
											<Icon className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" />
										</span>
										<span className="min-w-0 flex-1">
											<span className="text-text-primary line-clamp-2 block text-[0.9375rem] leading-snug font-bold">
												{topic.title}
											</span>
											{topic.text && (
												<span className="text-text-secondary mt-0.5 line-clamp-1 block text-[0.8125rem]">
													{topic.text}
												</span>
											)}
										</span>
										<ChevronRightIcon
											className="text-text-tertiary group-hover:text-brand h-5 w-5 shrink-0 transition-colors"
											strokeWidth={2.25}
											aria-hidden="true"
										/>
									</Link>
								</li>
							);
						})}
					</ul>
				)}

				<div
					className={cn(
						"border-border-subtle bg-surface-card relative isolate flex flex-col items-center justify-center overflow-hidden rounded-sm border p-6 text-center shadow-xs sm:p-8",
						adviceHref && topics.length > 0 && "lg:col-span-2 xl:col-span-1",
					)}
				>
					<div
						aria-hidden="true"
						className="art-mountains bg-sand-300 absolute right-0 bottom-0 -z-10 h-2/5 w-full opacity-90"
					/>
					<MailIcon className="text-brand h-9 w-9" strokeWidth={2} aria-hidden="true" />
					<h2 className="text-text-primary mt-3 text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">
						{t("newsletterTitle")}
					</h2>
					<p className="text-text-secondary mt-2 max-w-xs text-[0.9375rem]">{t("newsletterText")}</p>
					<form className="mt-5 flex w-full max-w-sm flex-col gap-2.5" aria-describedby="newsletter-soon">
						<label className="min-w-0">
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
							className="bg-cta text-cta-text inline-flex h-12 items-center justify-center gap-2 rounded-xs px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
						>
							{tFooter("subscribe")}
							<ArrowRightIcon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
						</button>
						<label className="text-text-tertiary flex items-center justify-center gap-2 text-xs">
							<input type="checkbox" disabled className="border-border-default rounded-2xs h-4 w-4" />
							{t("newsletterConsent")}
						</label>
					</form>
					<p id="newsletter-soon" className="text-text-secondary mt-3 text-[0.8125rem] font-medium">
						{t("newsletterSoon")}
					</p>
				</div>
			</div>
		</section>
	);
}
