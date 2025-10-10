import Hero from "@/components/Hero";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-black">
      <Hero />

      <div className="max-w-4xl mx-auto px-6 py-12 text-white">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">cookie policy</h1>
          <p className="text-lg text-gray-300 mb-4">
            Effective September 27, 2025
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          {/* Introduction */}
          <section className="mb-8">
            <p className="mb-4">
              This Cookie Policy explains how Echo Music Discovery, Inc.
              ("Echo," "we," "our," or "us") uses cookies and similar
              technologies when you visit our website or use the Echo Services.
              It should be read alongside our Privacy Policy and Terms of
              Service, which explain how we collect, use, and share your
              personal information.
            </p>
            <p className="mb-4">
              By continuing to use the Echo Services, you agree to the use of
              cookies as described in this policy.
            </p>
          </section>

          {/* What Are Cookies */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">WHAT ARE COOKIES?</h2>
            <p className="mb-4">
              Cookies are small data files stored on your device (computer,
              smartphone, tablet) when you visit a website or use a web
              application. Cookies help us understand how you interact with our
              services, personalize your experience, and improve performance and
              security.
            </p>
          </section>

          {/* Types of Cookies We Use */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">TYPES OF COOKIES WE USE</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">
                1. Essential Cookies
              </h3>
              <p className="mb-4">
                These cookies are necessary for the Echo Services to function
                properly. They allow you to log in, use essential features, and
                access secure areas.
              </p>
              <p className="mb-4">
                Example: Authentication cookies that keep you logged in to your
                Echo account.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">
                2. Performance & Analytics Cookies
              </h3>
              <p className="mb-4">
                These cookies collect information about how you use Echo (e.g.,
                pages visited, time spent, errors encountered). We use this data
                to improve the functionality and performance of the Echo
                platform.
              </p>
              <p className="mb-4">
                Tools used may include Google Analytics or similar services.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">
                3. Functionality Cookies
              </h3>
              <p className="mb-4">
                These cookies remember your preferences and enhance your
                experience. For example, they may remember your language
                settings or recently recommended songs.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">
                4. Third-Party Cookies
              </h3>
              <p className="mb-4">
                When you connect third-party music services like Spotify or
                Apple Music, those platforms may set cookies in accordance with
                their own privacy and cookie policies.
              </p>
              <p className="mb-4">
                Additionally, vendors that provide services such as cloud
                hosting, customer support, or analytics may set cookies on our
                behalf.
              </p>
            </div>
          </section>

          {/* How We Use Cookies */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">HOW WE USE COOKIES</h2>
            <p className="mb-4">We use cookies and similar technologies to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">
                Authenticate users and maintain session state
              </li>
              <li className="mb-2">
                Analyze usage patterns and improve the Echo experience
              </li>
              <li className="mb-2">
                Deliver friend-based song recommendations
              </li>
              <li className="mb-2">
                Monitor and prevent security risks or technical issues
              </li>
              <li className="mb-2">Store your preferences and settings</li>
            </ul>
          </section>

          {/* Your Choices */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">YOUR CHOICES</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Cookie Settings</h3>
              <p className="mb-4">
                Most web browsers allow you to manage your cookie preferences.
                You can usually:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li className="mb-2">
                  Delete or block cookies by adjusting your browser settings
                </li>
                <li className="mb-2">
                  Set your browser to notify you when a cookie is placed
                </li>
              </ul>
              <p className="mb-4">
                Please note that disabling some cookies may limit your ability
                to use certain features of the Echo Services.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Do Not Track</h3>
              <p className="mb-4">
                Some browsers offer a "Do Not Track" (DNT) signal. Echo does not
                currently respond to DNT signals, as there is no consistent
                industry standard for compliance.
              </p>
            </div>
          </section>

          {/* Third-Party Cookies and Tracking */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              THIRD-PARTY COOKIES AND TRACKING
            </h2>
            <p className="mb-4">
              When you interact with third-party platforms (e.g., Spotify, Apple
              Music), your data is subject to their cookie and privacy policies.
              We encourage you to review their respective policies:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">
                <a
                  href="https://www.spotify.com/legal/cookies-policy/"
                  className="text-blue-400 hover:text-blue-300 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Spotify Cookie Policy
                </a>
              </li>
              <li className="mb-2">
                <a
                  href="https://www.apple.com/legal/privacy/"
                  className="text-blue-400 hover:text-blue-300 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apple Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          {/* Updates to This Cookie Policy */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              UPDATES TO THIS COOKIE POLICY
            </h2>
            <p className="mb-4">
              We may update this Cookie Policy from time to time to reflect
              changes in technology or legal requirements. If we make
              significant changes, we will notify you through the Echo Services
              or by updating the "Effective Date" above.
            </p>
          </section>

          {/* Contact Us */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">CONTACT US</h2>
            <p className="mb-4">
              If you have any questions about this Cookie Policy, please contact
              us at:
            </p>
            <div className="mb-4">
              <p className="mb-2">Echo Music Discovery, Inc.</p>
              <p className="mb-2">300 Delaware Ave, Ste 210 #721</p>
              <p className="mb-2">Wilmington, DE 19801</p>
              <p className="mb-2">Email: support@text-echo.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
