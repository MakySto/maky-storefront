"use client";

import * as React from "react";
import Image, { type ImageProps } from "next/image";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

const DEFAULT_RETRY_DELAY_MS = 3_000;
const RETRY_QUERY_PARAM = "_maky_image_retry";

/** Saleor can temporarily return 503 while an externally imported thumbnail is prepared. */
export function isRetryableSaleorThumbnail(src: string): boolean {
	try {
		const url = new URL(src);
		return url.hostname === "api.maky.store" && url.pathname.startsWith("/thumbnail/");
	} catch {
		return false;
	}
}

/** A distinct URL also prevents the browser and Next image optimizer from reusing the failed request. */
export function withImageRetryToken(src: string, attempt: number): string {
	if (attempt < 1 || !isRetryableSaleorThumbnail(src)) return src;

	const url = new URL(src);
	url.searchParams.set(RETRY_QUERY_PARAM, String(attempt));
	return url.toString();
}

interface ResilientProductImageProps extends Omit<ImageProps, "src"> {
	src: string;
	fallback?: React.ReactNode;
	fallbackClassName?: string;
	retryDelayMs?: number;
}

function ResilientProductImageState({
	src,
	alt,
	fallback,
	fallbackClassName,
	retryDelayMs = DEFAULT_RETRY_DELAY_MS,
	onError,
	...imageProps
}: ResilientProductImageProps) {
	const [attempt, setAttempt] = React.useState(0);
	const [showFallback, setShowFallback] = React.useState(false);
	const retryTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryScheduled = React.useRef(false);

	React.useEffect(
		() => () => {
			if (retryTimer.current) clearTimeout(retryTimer.current);
		},
		[],
	);

	const handleError: NonNullable<ImageProps["onError"]> = (event) => {
		onError?.(event);
		setShowFallback(true);

		if (attempt > 0 || retryScheduled.current || !isRetryableSaleorThumbnail(src)) return;

		retryScheduled.current = true;
		retryTimer.current = setTimeout(() => {
			retryScheduled.current = false;
			retryTimer.current = null;
			setAttempt(1);
			setShowFallback(false);
		}, retryDelayMs);
	};

	if (showFallback) {
		return (
			fallback ?? (
				<span
					className={cn(
						"bg-muted text-muted-foreground flex h-full w-full items-center justify-center",
						fallbackClassName,
					)}
					role={alt ? "img" : undefined}
					aria-label={alt || undefined}
					aria-hidden={alt ? undefined : true}
				>
					<ImageOff className="h-5 w-5" aria-hidden="true" />
				</span>
			)
		);
	}

	return (
		<Image
			key={attempt}
			{...imageProps}
			src={withImageRetryToken(src, attempt)}
			alt={alt}
			onError={handleError}
		/>
	);
}

/**
 * Product image with a bounded retry for Saleor's transient thumbnail 503 state.
 * A changed source remounts the stateful child and starts with a clean attempt budget.
 */
export function ResilientProductImage(props: ResilientProductImageProps) {
	return <ResilientProductImageState key={props.src} {...props} />;
}
