import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-black text-white py-8 px-8 overflow-x-hidden">
      <div className="max-w-6xl mx-auto transform-gpu origin-top md:scale-100 scale-[1.06]">
        {/* Mobile layout: two columns + full-width company details */}
        <div className="md:hidden">
          <div className="grid grid-cols-2 gap-8">
            {/* Left column - Policy links */}
            <div className="space-y-2">
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
              <div>
                <Link
                  href="/cookie-policy"
                  className="text-sm hover:text-gray-300 cursor-pointer"
                >
                  cookie policy
                </Link>
              </div>
            </div>

            {/* Right column - General info links */}
            <div className="flex flex-col items-end space-y-2 text-right">
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
          </div>

          {/* Company details - full width under both columns */}
          <div className="w-full space-y-2 mt-6">
            <div className="text-sm break-words">
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

        {/* Desktop layout: original three columns */}
        <div className="hidden md:flex md:flex-row gap-8">
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
            <div>
              <Link
                href="/cookie-policy"
                className="text-sm hover:text-gray-300 cursor-pointer"
              >
                cookie policy
              </Link>
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
