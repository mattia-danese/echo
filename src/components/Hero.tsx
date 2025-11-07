import Image from "next/image";

interface HeroProps {
  showText?: boolean;
}
export default function Hero({ showText = true }: HeroProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      {/* Logo */}
      {/* <Image
        src="/name.png"
        alt="Echo"
        width={256} // 2x of 8rem (128px) for retina
        height={256}
        sizes="8rem"
        quality={100}
        className="h-32 w-auto"
        priority
      /> */}

      {/** biome-ignore lint/performance/noImgElement: <explanation> */}
      <img
        src="/name.svg"
        alt="Echo"
        width={256}
        height={256}
        className="h-32 w-auto"
        loading="eager"
        decoding="sync"
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
