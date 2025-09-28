/* eslint-disable react/no-unescaped-entities */
import Hero from "@/components/Hero";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black">
      <Hero />
      
      <div className="max-w-4xl mx-auto px-6 py-12 text-white">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">privacy policy</h1>
          <p className="text-lg text-gray-300 mb-4">Effective September 27, 2025</p>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          {/* Introduction */}
          <section className="mb-8">
            <p className="mb-4">
              Echo Music Discovery, Inc. ("Echo," "we," "our," or "us") values your privacy. This Privacy Policy explains how we collect, use, share, and protect your personal information when you use the Echo Services.
            </p>
            <p className="mb-4">
              By using the Echo Services, you consent to the practices described in this Privacy Policy.
            </p>
          </section>

          {/* Information We Collect */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              INFORMATION WE COLLECT
            </h2>
            <p className="mb-4">
              When you use Echo, we collect the following information:
            </p>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Account Information:</h3>
              <p className="mb-4">
                Your name and phone number when you create an Echo Account.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Music Service Information:</h3>
              <p className="mb-4">
                Data from Spotify and Apple Music that you authorize us to access, such as your listening history, playlists, and favorite songs.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Friend Connections:</h3>
              <p className="mb-4">
                Information about the friends you connect with on Echo.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Recommendations:</h3>
              <p className="mb-4">
                Songs you recommend and recommendations you receive.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Usage Information:</h3>
              <p className="mb-4">
                Technical data such as IP address, browser type, device information, and site usage activity.
              </p>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              HOW WE USE YOUR INFORMATION
            </h2>
            <p className="mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Provide, maintain, and improve the Echo Services.</li>
              <li className="mb-2">Deliver song recommendations from your friends.</li>
              <li className="mb-2">Personalize your experience.</li>
              <li className="mb-2">Communicate with you about your account or updates to the Echo Services.</li>
              <li className="mb-2">Ensure compliance with our Terms of Service.</li>
              <li className="mb-2">Detect, prevent, and address technical issues, fraud, or security incidents.</li>
            </ul>
          </section>

          {/* How We Share Your Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              HOW WE SHARE YOUR INFORMATION
            </h2>
            <p className="mb-4">
              We may share your information in the following circumstances:
            </p>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">With Friends on Echo:</h3>
              <p className="mb-4">
                Recommendations you make will be visible to your Echo friends. They are not shared outside your Echo network.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">With Third-Party Services:</h3>
              <p className="mb-4">
                When you connect Spotify or Apple Music, you authorize us to share information as necessary to enable Echo functionality.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">With Service Providers:</h3>
              <p className="mb-4">
                We may share information with vendors that support our operations (e.g., hosting, analytics, customer support).
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">For Legal Reasons:</h3>
              <p className="mb-4">
                If required by law, regulation, legal process, or governmental request.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">In a Business Transfer:</h3>
              <p className="mb-4">
                In the event of a merger, acquisition, reorganization, or sale of assets.
              </p>
            </div>
          </section>

          {/* Your Choices and Rights */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              YOUR CHOICES AND RIGHTS
            </h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Access and Updates:</h3>
              <p className="mb-4">
                You may access and update your account information at any time via your Echo profile settings.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Spotify/Apple Music Permissions:</h3>
              <p className="mb-4">
                You can manage or revoke Echo's access through your Spotify and Apple Music account settings.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Account Deletion:</h3>
            <p className="mb-4">
                You may close your Echo Account at any time. Upon closure, we will delete or anonymize your personal information, except where retention is required by law.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Opt-Out of Communications:</h3>
            <p className="mb-4">
                You may opt out of text messages by replying "STOP" to the echo phone number.
              </p>
            </div>
          </section>

          {/* Data Security */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              DATA SECURITY
            </h2>
            <p className="mb-4">
              We implement reasonable technical, organizational, and administrative measures to protect your information. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          {/* Children's Privacy */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              CHILDREN'S PRIVACY
            </h2>
            <p className="mb-4">
              Echo is not directed to children under 13. If we learn that we have collected personal data from a child under 13 without parental consent, we will delete that information.
            </p>
          </section>

          {/* International Users */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              INTERNATIONAL USERS
            </h2>
            <p className="mb-4">
              Echo is based in the United States. If you access the Echo Services from outside the U.S., you consent to the transfer of your data to the U.S. and the processing of your data in accordance with this Privacy Policy.
            </p>
          </section>

          {/* Changes to This Privacy Policy */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              CHANGES TO THIS PRIVACY POLICY
            </h2>
            <p className="mb-4">
              We may update this Privacy Policy from time to time. If we make material changes, we will notify you by posting the revised policy on our website with a new "Effective Date."
            </p>
          </section>

          {/* Contact Us */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              CONTACT US
            </h2>
            <p className="mb-4">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <div className="mb-4">
              <p className="mb-2">Echo Music Discovery, Inc.</p>
              <p className="mb-2">300 Delaware Ave, Ste 210 #721</p>
              <p className="mb-2">Wilmington, DE 19801</p>
              <p className="mb-2">Email: text.echo.music@gmail.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
