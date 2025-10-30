import Image from "next/image";

interface HeroProps {
  showText?: boolean;
}
export default function Hero({ showText = true }: HeroProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      {/* Logo */}
      <Image
        src="/name.png"
        alt="Echo"
        className="h-32 w-auto"
        width={128}
        height={128}
        priority
      />

      {/* Tagline */}
      {showText && (
        <div className="text-white text-3xl text-center">
          <span>discover music</span>
          <br className="md:hidden" />
          <span> through friends.</span>
        </div>
      )}
    </div>
  );
}
