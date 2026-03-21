import Image from "next/image";

interface LogoProps {
  className?: string;
  inverted?: boolean;
  showSlogan?: boolean;
  slogan?: string;
}

export const Logo = ({
  className,
  inverted = false,
  showSlogan = false,
  slogan,
}: LogoProps) => {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <Image
        src="/logo-deer.webp"
        alt=""
        width={44}
        height={44}
        className={`h-11 w-11 ${inverted ? "brightness-0 invert" : ""}`}
        priority
      />
      <div className="flex flex-col">
        <span
          className={`text-xl font-bold tracking-tight leading-tight ${
            inverted ? "text-white" : "text-copper-600"
          }`}
        >
          MAKY.STORE
        </span>
        {showSlogan && slogan && (
          <span
            className={`text-[0.6875rem] font-medium tracking-wide leading-tight ${
              inverted ? "text-neutral-400" : "text-copper-600"
            }`}
          >
            {slogan}
          </span>
        )}
      </div>
    </div>
  );
};