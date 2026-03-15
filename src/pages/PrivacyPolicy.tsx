import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-28 pb-20 px-4">
        <div className="container max-w-3xl mx-auto">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Legal
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold font-display mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground mb-12">
            Last updated: March 15, 2026
          </p>

          <div className="prose-legal space-y-8 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Introduction</h2>
              <p>
                AW3 Technology, Inc. ("Company," "we," "us," or "our") operates the OpenEye software and the openeye.sh website. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. By using the Service, you consent to the practices described in this policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Information We Collect</h2>
              
              <h3 className="text-base font-medium text-foreground mt-4 mb-2">Information You Provide</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account registration information (email address, display name)</li>
                <li>Communications you send to us (support requests, feedback)</li>
                <li>Any content you submit through the Service</li>
              </ul>

              <h3 className="text-base font-medium text-foreground mt-4 mb-2">Automatically Collected Information</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Device and browser information (type, version, operating system)</li>
                <li>IP address and approximate location</li>
                <li>Usage data (pages visited, features used, timestamps)</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>

              <h3 className="text-base font-medium text-foreground mt-4 mb-2">Information We Do Not Collect</h3>
              <p>
                OpenEye is designed with privacy in mind. When you use the self-hosted CLI tool, <strong className="text-foreground">no image data, camera feeds, inference results, or perception data is transmitted to our servers</strong>. All inference runs locally on your hardware. We do not collect or have access to any visual data processed by OpenEye in self-hosted deployments.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide, maintain, and improve the Service</li>
                <li>Create and manage your account</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Send administrative communications (service updates, security alerts)</li>
                <li>Monitor and analyze usage trends to improve user experience</li>
                <li>Detect, prevent, and address technical issues and security threats</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Data Sharing and Disclosure</h2>
              <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong className="text-foreground">Service Providers:</strong> With third-party vendors who assist in operating the Service (e.g., hosting, analytics), bound by confidentiality obligations</li>
                <li><strong className="text-foreground">Legal Requirements:</strong> When required by law, legal process, or government request</li>
                <li><strong className="text-foreground">Safety:</strong> To protect the rights, property, or safety of AW3 Technology, Inc., our users, or the public</li>
                <li><strong className="text-foreground">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Security</h2>
              <p>
                We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is completely secure. We cannot guarantee absolute security of your data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Retention</h2>
              <p>
                We retain your personal information for as long as your account is active or as needed to provide you with the Service. We may retain certain information as required by law or for legitimate business purposes, such as resolving disputes and enforcing our agreements.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate personal information</li>
                <li>Request deletion of your personal information</li>
                <li>Object to or restrict certain processing of your data</li>
                <li>Data portability (receive your data in a structured format)</li>
                <li>Withdraw consent where processing is based on consent</li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, please contact us at{" "}
                <a href="mailto:privacy@openeye.sh" className="text-primary hover:underline">privacy@openeye.sh</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Cookies</h2>
              <p>
                We use essential cookies to enable core functionality of the Service (e.g., authentication, preferences). We may also use analytics cookies to understand how the Service is used. You can control cookie preferences through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">9. Third-Party Links</h2>
              <p>
                The Service may contain links to third-party websites or services (e.g., GitHub, HuggingFace). We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">10. Children's Privacy</h2>
              <p>
                The Service is not intended for individuals under the age of 16. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child under 16, we will take steps to delete it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">11. International Data Transfers</h2>
              <p>
                Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for such transfers in compliance with applicable data protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">12. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last updated" date. Your continued use of the Service after changes constitutes acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">13. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at{" "}
                <a href="mailto:privacy@openeye.sh" className="text-primary hover:underline">privacy@openeye.sh</a>.
              </p>
              <div className="mt-4 font-mono text-sm text-muted-foreground">
                AW3 Technology, Inc.<br />
                openeye.sh
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
