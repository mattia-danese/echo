import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-black text-white py-8 px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left section - Policy links */}
          <div className="flex-1 space-y-2">
            <div>
              <Link
                href="/privacy-policy"
                className="text-sm hover:text-gray-300 cursor-pointer"
              >
                privacy policy
              </Link>
            </div>
            <div>
              <Link
                href="/terms-of-service"
                className="text-sm hover:text-gray-300 cursor-pointer"
              >
                terms of service
              </Link>
            </div>
            <div className="text-sm hover:text-gray-300 cursor-pointer">
              cookie policy
            </div>
          </div>

          {/* Middle section - General info links */}
          <div className="flex-1 space-y-2">
            <div className="text-sm hover:text-gray-300 cursor-pointer">
              <Link
                href="/about-us"
                className="text-sm hover:text-gray-300 cursor-pointer"
              >
                about us
              </Link>
            </div>
            <div className="text-sm hover:text-gray-300 cursor-pointer">
              <Link
                href="/contact-us"
                className="text-sm hover:text-gray-300 cursor-pointer"
              >
                contact us
              </Link>
            </div>
          </div>

          {/* Right section - Company details */}
          <div className="flex-1 space-y-2">
            <div className="text-sm whitespace-nowrap">
              1347 jackson street, san francisco, california, 94109, usa
            </div>
            <div className="text-sm">
              2025 Echo Music Discovery, Inc. all rights reserved.
            </div>
            <div className="text-sm">
              built with ❤️ in san francisco & new york
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
