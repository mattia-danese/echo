/* eslint-disable react/no-unescaped-entities */
import Hero from "@/components/Hero";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-black">
      <Hero />
      
      <div className="max-w-4xl mx-auto px-6 py-12 text-white">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">terms of service</h1>
        <p className="text-lg text-gray-300 mb-4">Effective September 27, 2025</p>
      </div>

      {/* Content */}
      <div className="prose prose-lg max-w-none">
        {/* ACCEPTANCE */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            ACCEPTANCE
          </h2>
          <p className="mb-4">
            Your access, browsing, and use of Echo's website and Echo's products and services (collectively, the "Echo Services") are subject to the following terms and conditions, which include your agreement to arbitrate claims (the "Terms of Service"). References to "You" or "Your" mean the individual users of the Echo Services.
          </p>
          <p className="mb-4 font-semibold">
            <strong>BY CLICKING "I AGREE," ACCESSING, AND/OR USING THE ECHO SERVICES, YOU ARE FULLY ACCEPTING AND AGREEING TO THESE TERMS, CONDITIONS, AND DISCLAIMERS CONTAINED IN THESE TERMS OF SERVICE AND ECHO'S PRIVACY POLICY. IF YOU DO NOT AGREE, YOU MAY NOT USE THE ECHO SERVICES.</strong>
          </p>
          <p className="mb-4">
            Echo Services may integrate with products or services of third parties not affiliated with Echo (the "3rd Party Services"), including Spotify and Apple Music. Your use of those services is subject to their own terms and conditions, which you must also review and accept.
          </p>
        </section>

        {/* INFORMATION ON THIS WEBSITE */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            INFORMATION ON THIS WEBSITE
          </h2>
          <p className="mb-4">
            The contents of the Echo Services are the sole and exclusive property of Echo, protected by law, including U.S. copyright law and international treaties. The content and functionality are provided for information and convenience purposes only. Echo makes no representation that the materials on the Echo Services are accurate, appropriate, or available for use in all locations. The contents may change without notice.
          </p>
        </section>

        {/* ECHO ACCOUNT SETUP */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            ECHO ACCOUNT SETUP
          </h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Eligibility</h3>
            <p className="mb-4">
              To be eligible to use the Echo Services, You must be at least 13 years old. Accounts are available only to individuals.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Registration</h3>
            <p className="mb-4">
              You must register for an Echo account (an "Echo Account") to use the Echo Services. By registering, You represent that all information provided is accurate and that the Echo Account is created for Yourself. You are fully responsible for all activity under Your Echo Account. Echo may, at its discretion, refuse to open, suspend, or terminate any Echo Account.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Data Collection</h3>
            <p className="mb-4">
              During registration and ongoing use, You agree to provide Echo with information necessary for account setup, identity verification, and delivery of Echo Services. Echo collects and processes personal information including Your name, phone number, listening history, and friend connections. Recommendations made by You and received from friends will be stored but not shared outside Your Echo friend network. See our Privacy Policy for details.
            </p>
          </div>
        </section>

        {/* ACCESS TO ECHO SERVICES */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            ACCESS TO ECHO SERVICES
          </h2>
          <p className="mb-4">
            The Echo Services are free to use and accessible via the Echo website. Access may be degraded or unavailable during high volume periods. Echo does not guarantee uninterrupted availability and shall not be liable for delays, interruptions, or failures in service.
          </p>
        </section>

        {/* USE RESTRICTIONS */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            USE RESTRICTIONS
          </h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Prohibited Use</h3>
            <p className="mb-4">
              You agree You will not:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Use Echo Services in violation of any third-party rights or applicable laws.</li>
              <li className="mb-2">Attempt to modify, decompile, reverse engineer, or create derivative works of the Echo Services.</li>
              <li className="mb-2">Use Echo Services in a manner intended to harm, disable, or impair the Echo Services.</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Limitations on Use</h3>
            <p className="mb-4">
              You may not reproduce, resell, or distribute the Echo Services or data generated by the Echo Services. You may not use Echo to build a competing music recommendation product or service.
            </p>
          </div>
        </section>

        {/* INTELLECTUAL PROPERTY */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            INTELLECTUAL PROPERTY
          </h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Copyrights</h3>
            <p className="mb-4">
              Echo owns all copyrights in materials provided in the Echo Services. No material may be copied, distributed, republished, downloaded, displayed, or transmitted in any form without prior written permission from Echo.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Trademarks</h3>
            <p className="mb-4">
              The trademarks, service marks, and logos (the "Trademarks") used on the Echo Services are the property of Echo and others. Nothing grants you a license to use any Trademark displayed on the Echo Services without prior written permission.
            </p>
          </div>
        </section>

        {/* DISCLAIMER OF WARRANTIES */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            DISCLAIMER OF WARRANTIES
          </h2>
          <p className="mb-4 font-semibold">
            ALL CONTENT, INFORMATION, AND SERVICES PROVIDED BY ECHO ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. USE OF ECHO SERVICES IS SOLELY AT YOUR OWN RISK. ECHO DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING ANY WARRANTIES OF TITLE, MERCHANTABILITY, NON-INFRINGEMENT, OR FITNESS FOR A PARTICULAR PURPOSE.
          </p>
        </section>

        {/* INDEMNIFICATION */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            INDEMNIFICATION
          </h2>
          <p className="mb-4">
            You agree to indemnify and hold Echo, its employees, directors, agents, and affiliates harmless from any claims, damages, or expenses arising from (a) Your use of Echo Services, (b) Your violation of these Terms of Service, or (c) Your violation of any third-party rights.
          </p>
        </section>

        {/* LIMITATION OF LIABILITY */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            LIMITATION OF LIABILITY
          </h2>
          <p className="mb-4 font-semibold">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL ECHO OR ITS AFFILIATES BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES ARISING OUT OF YOUR USE OF THE ECHO SERVICES. IN NO EVENT SHALL ECHO'S AGGREGATE LIABILITY EXCEED THE GREATER OF (i) $100 OR (ii) THE AMOUNT YOU HAVE PAID TO ECHO IN THE PAST 12 MONTHS.
          </p>
        </section>

        {/* CLASS ACTION WAIVER */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            CLASS ACTION WAIVER
          </h2>
          <p className="mb-4">
            All disputes will be conducted solely on an individual basis. You waive any right to participate in a class action or consolidated arbitration against Echo.
          </p>
        </section>

        {/* TERMS OF SERVICE REVISIONS */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            TERMS OF SERVICE REVISIONS
          </h2>
          <p className="mb-4">
            Echo may revise these Terms of Service at any time by updating this page. Continued use of the Echo Services constitutes Your agreement to any revisions.
          </p>
        </section>

        {/* JURISDICTION */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            JURISDICTION
          </h2>
          <p className="mb-4">
            These Terms of Service shall be governed by the laws of the State of California, without regard to its conflict of laws provisions. Any disputes shall be adjudicated in the state or federal courts located in San Francisco, California.
          </p>
        </section>

        {/* DISPUTE RESOLUTION & ARBITRATION */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            DISPUTE RESOLUTION & ARBITRATION
          </h2>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Informal Dispute Resolution</h3>
            <p className="mb-4">
              Before arbitration, both parties agree to attempt to resolve disputes informally by written Notice. Notices to Echo should be sent to:
            </p>
            <div className="mb-4">
              <p className="mb-2">Echo Music Discovery, Inc.</p>
              <p className="mb-2">300 Delaware Ave, Ste 210 #721</p>
              <p className="mb-2">Wilmington, DE 19801</p>
            </div>
            <p className="mb-4">
              Both parties will attempt to resolve disputes within 60 days of the Notice.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Scope of Arbitration</h3>
            <p className="mb-4">
              If not resolved, disputes will be settled by binding arbitration before a single arbitrator administered by the American Arbitration Association in accordance with its Commercial Arbitration Rules.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Small Claims Court</h3>
            <p className="mb-4">
              Either party may bring a claim in small claims court instead of arbitration if eligible.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Arbitration Procedures</h3>
            <p className="mb-4">
              Any arbitration hearing will take place in San Francisco, California, or via telephone/videoconference if both parties agree. The arbitrator's decision will be binding and enforceable in court.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Opt Out</h3>
            <p className="mb-4">
              You may reject this arbitration provision by sending an opt-out notice within 30 days of creating an Echo Account.
            </p>
          </div>
        </section>

        {/* GENERAL */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            GENERAL
          </h2>
          <p className="mb-4">
            You may not assign Your rights or obligations under this Agreement without prior written consent from Echo. Echo may assign its rights and obligations freely. These Terms are binding upon the parties and their respective successors and permitted assigns.
          </p>
        </section>
      </div>
      </div>
    </div>
  );
}
