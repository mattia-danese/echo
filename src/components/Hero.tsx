interface HeroProps {
    showText?: boolean;
}
export default function Hero({ showText = true }: HeroProps) {
    return (
        <div className="flex flex-col items-center justify-center">
            {/* Logo */}
          <img 
            src="/name.svg" 
            alt="Echo" 
            className="h-32 w-auto"
            width={128}
            height={128}
            />
 
            {/* Tagline */}
            {showText && <div className="text-white text-3xl">discover music through friends.</div>}
        </div>
    )
}