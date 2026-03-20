/**
 * MAKY.STORE Logo Component
 *
 * Temporary text logo — replace with SVG/PNG when ready.
 * Expected logo files: /public/logo.svg (160x36) and /public/logo-dark.svg (160x36, white)
 */

interface LogoProps {
  className?: string;
  ariaLabel?: string;
  inverted?: boolean;
}

export const Logo = ({ className, ariaLabel = "MAKY.STORE", inverted = false }: LogoProps) => {
  return (
    <span
      className={[
        "inline-block font-sans text-xl font-bold tracking-tight",
        inverted ? "text-white" : "text-foreground",
        className ?? "",
      ].join(" ")}
      aria-label={ariaLabel}
    >
      MAKY.STORE
    </span>
  );
};
