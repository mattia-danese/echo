import Link from "next/link";
import Hero from "@/components/Hero";

export default function AboutUs() {
  return (
    <div className="flex-1 bg-black">
      <Hero />

      <div className="max-w-4xl mx-auto px-6 py-8 text-white">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">contact us</h1>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
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
