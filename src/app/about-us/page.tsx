import Link from "next/link";
import Hero from "@/components/Hero";

export default function AboutUs() {
  return (
    <div className="bg-black flex-1">
      <Hero />

      <div className="max-w-4xl mx-auto px-6 py-12 text-white">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">about us</h1>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          {/* Main Description */}
          <section className="mb-8">
            <p className="mb-6 text-lg leading-relaxed">
              Echo Music Discovery is a social music discovery platform serving
              primarily New York and California. Specifically, it helps you find
              your next favorite song, recommended by your friends. By
              connecting your spotify or apple music account, echo lets you
              share, receive, and explore music in a more personal and social
              way.
            </p>
          </section>

          {/* Company Information */}
          <section className="mb-8">
            <div className="space-y-4">
              <div>
                <p className="font-medium">Legal/DBA: Echo Music Discovery</p>
              </div>

              <div>
                <p className="font-medium">
                  Legal Address: 300 Delaware Ave, Ste 210 #721, Wilmington,
                  Delaware, 19801, USA
                </p>
              </div>

              <div>
                <p className="font-medium">
                  Office Address: 1347 Jackson Street, San Francisco,
                  California, 94109, USA (remote; visits by appointment)
                </p>
              </div>

              <div>
                <p className="font-medium">
                  Support:{" "}
                  <a
                    href="mailto:support@text-echo.com"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    support@text-echo.com
                  </a>{" "}
                  ·{" "}
                  <a
                    href="tel:781-518-6434"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    781-518-6434
                  </a>
                </p>
              </div>

              <div>
                <p className="font-medium">
                  Policies:{" "}
                  <Link
                    href="/terms-of-service"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  &{" "}
                  <Link
                    href="/privacy-policy"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Privacy Policy
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
