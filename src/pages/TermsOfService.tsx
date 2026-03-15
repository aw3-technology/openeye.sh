import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-28 pb-20 px-4">
        <div className="container max-w-3xl mx-auto">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Legal
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold font-display mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground mb-12">
            Last updated: March 15, 2026
          </p>

          <div className="prose-legal space-y-8 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using the OpenEye software, website (openeye.sh), documentation, APIs, or any related services (collectively, the "Service") provided by AW3 Technology, Inc. ("Company," "we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
              <p>
                OpenEye is an open-source perception engine for robots and autonomous agents. The Service includes the OpenEye CLI, model registry, perception pipeline, fleet management tools, hosted APIs, documentation, and the openeye.sh website. The core software is licensed under the Apache 2.0 License.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. Open-Source License</h2>
              <p>
                The OpenEye software is made available under the Apache License, Version 2.0. Your use of the open-source software is governed by that license. These Terms govern your use of the hosted services, website, and any proprietary features or services we may offer. In the event of a conflict between the Apache 2.0 License and these Terms regarding the open-source software, the Apache 2.0 License prevails.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. User Accounts</h2>
              <p>
                Some features of the Service may require you to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate, current, and complete information during registration and to update such information as necessary.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
                <li>Attempt to gain unauthorized access to any part of the Service or its related systems</li>
                <li>Interfere with or disrupt the integrity or performance of the Service</li>
                <li>Use the Service to deploy perception systems in safety-critical applications without proper independent validation and testing</li>
                <li>Misrepresent your affiliation with AW3 Technology, Inc. or the OpenEye project</li>
                <li>Use the Service to infringe upon the intellectual property rights of others</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Safety Disclaimer</h2>
              <p>
                OpenEye provides perception tools intended to assist with robot safety and autonomous systems. However, the Service is provided "as is" and should not be used as the sole safety mechanism in any deployment. You are solely responsible for ensuring that your use of OpenEye meets the safety requirements of your specific application, industry standards, and applicable regulations. Always implement independent safety systems and human oversight.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Intellectual Property</h2>
              <p>
                Except for the open-source components licensed under Apache 2.0, all intellectual property rights in the Service, including trademarks, logos, and proprietary features, are owned by AW3 Technology, Inc. The OpenEye name and logo are trademarks of AW3 Technology, Inc.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Third-Party Models and Services</h2>
              <p>
                The Service integrates with third-party models (e.g., YOLOv8, Depth Anything, Grounding DINO) and services. These third-party components are subject to their own licenses and terms. We are not responsible for the availability, accuracy, or performance of third-party models or services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">9. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, AW3 TECHNOLOGY, INC. SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, WHETHER BASED ON WARRANTY, CONTRACT, TORT, OR ANY OTHER LEGAL THEORY, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">10. Disclaimer of Warranties</h2>
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">11. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless AW3 Technology, Inc. and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses arising out of or in any way connected with your use of the Service or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">12. Modifications to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will provide notice of material changes by updating the "Last updated" date. Your continued use of the Service after such modifications constitutes your acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">13. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">14. Contact</h2>
              <p>
                If you have any questions about these Terms, please contact us at{" "}
                <a href="mailto:legal@openeye.sh" className="text-primary hover:underline">legal@openeye.sh</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
