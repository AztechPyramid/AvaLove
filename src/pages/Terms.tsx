import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 text-foreground hover:bg-foreground/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
          Terms of Service
        </h1>

        <div className="space-y-6 text-foreground/80">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using AvaLove, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Eligibility</h2>
            <p className="mb-4">
              To use AvaLove, you must:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into binding contracts</li>
              <li>Not be prohibited from using the service under applicable laws</li>
              <li>Comply with all local laws regarding online conduct</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Platform Services</h2>
            <p className="mb-4">
              AvaLove provides:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Social matching and dating features</li>
              <li>Play-to-earn gaming opportunities</li>
              <li>Watch-to-earn video content</li>
              <li>Token staking and rewards programs</li>
              <li>Community features and public chat</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. User Responsibilities</h2>
            <p className="mb-4">
              You agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide accurate and truthful information</li>
              <li>Maintain the security of your wallet and account</li>
              <li>Use the platform in compliance with all applicable laws</li>
              <li>Not engage in fraudulent, abusive, or harmful behavior</li>
              <li>Not impersonate others or create fake accounts</li>
              <li>Respect other users' rights and privacy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Prohibited Conduct</h2>
            <p className="mb-4">
              The following activities are strictly prohibited:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Harassment, threats, or bullying of other users</li>
              <li>Posting illegal, offensive, or inappropriate content</li>
              <li>Attempting to manipulate or exploit the reward system</li>
              <li>Using bots, scripts, or automated tools</li>
              <li>Reverse engineering or tampering with the platform</li>
              <li>Money laundering or illegal financial activities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Tokens and Financial Matters</h2>
            <p className="mb-4">
              <strong>IMPORTANT DISCLAIMERS:</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>AVLO tokens have no guaranteed value and may lose value</li>
              <li>Token rewards are subject to change without notice</li>
              <li>Blockchain transactions are irreversible</li>
              <li>You are responsible for all tax obligations</li>
              <li>AvaLove is not a financial institution or investment advisor</li>
              <li>Past performance does not guarantee future results</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Intellectual Property</h2>
            <p>
              All content, trademarks, and intellectual property on AvaLove are owned by AvaLove or 
              its licensors. You may not copy, modify, or distribute platform content without permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Limitation of Liability</h2>
            <p className="mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>AvaLove provides services "AS IS" without warranties</li>
              <li>We are not liable for any losses, damages, or harm</li>
              <li>We are not responsible for user interactions or conduct</li>
              <li>We are not liable for blockchain network issues</li>
              <li>Total liability shall not exceed $100 USD</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms, 
              engage in prohibited conduct, or for any other reason at our sole discretion. 
              Terminated users may lose access to rewards and tokens.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Dispute Resolution</h2>
            <p>
              Any disputes shall be resolved through binding arbitration in accordance with the 
              rules of the American Arbitration Association. You waive the right to participate 
              in class action lawsuits.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Changes to Terms</h2>
            <p>
              We may modify these terms at any time. Continued use after changes constitutes 
              acceptance of the modified terms. Material changes will be announced through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">12. Governing Law</h2>
            <p>
              These terms are governed by the laws of the jurisdiction where AvaLove operates, 
              without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">13. Contact Information</h2>
            <p>
              For questions about these terms, contact us through our official channels on 
              Arena Social or Discord.
            </p>
          </section>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-8">
            <p className="text-red-400 font-semibold mb-2">Risk Warning</p>
            <p className="text-sm">
              Cryptocurrency and blockchain-based platforms involve significant risk. Only use funds 
              you can afford to lose. AvaLove is not responsible for any financial losses incurred 
              through platform use.
            </p>
          </div>

          <p className="text-sm text-foreground/60 mt-8">
            Last Updated: December 2024
          </p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
