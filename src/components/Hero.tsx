interface HeroProps {
    showText?: boolean;
}
export default function Hero({ showText = true }: HeroProps) {
    return (
        <div className="flex flex-col items-center justify-center">
            {/* Logo */}
          <h1 className="text-9xl font-bold text-blue-400">echo</h1>

          {/* Tagline */}
          {showText && <div className="text-white text-3xl">Discover music through friends.</div>}
        </div>
    )
}