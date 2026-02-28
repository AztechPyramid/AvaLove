import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Privacy = () => {
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
          Privacy Policy
        </h1>

        <div className="space-y-6 text-foreground/80">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Information We Collect</h2>
            <p className="mb-4">
              AvaLove collects and processes the following information:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Wallet addresses for authentication and transactions</li>
              <li>Profile information you choose to provide (username, bio, photos)</li>
              <li>Usage data including games played, videos watched, and interactions</li>
              <li>Transaction history on the blockchain</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. How We Use Your Information</h2>
            <p className="mb-4">
              We use your information to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide and improve our platform services</li>
              <li>Process token transactions and rewards</li>
              <li>Enable social features like matching and messaging</li>
              <li>Maintain security and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Data Sharing</h2>
            <p className="mb-4">
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Other users based on your privacy settings</li>
              <li>Service providers who help operate our platform</li>
              <li>Law enforcement when legally required</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Blockchain Transparency</h2>
            <p>
              Please note that all blockchain transactions are publicly visible on the Avalanche network. 
              This includes token transfers, staking activities, and game rewards. Wallet addresses and 
              transaction amounts are permanently recorded on the blockchain.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data. However, no system 
              is completely secure. You are responsible for keeping your wallet credentials safe and secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Your Rights</h2>
            <p className="mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access your personal data</li>
              <li>Request data deletion (subject to legal and blockchain constraints)</li>
              <li>Update your profile information</li>
              <li>Opt out of non-essential communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Children's Privacy</h2>
            <p>
              AvaLove is not intended for users under 18 years of age. We do not knowingly collect 
              information from minors. If you believe a minor has provided us with personal information, 
              please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Changes to Privacy Policy</h2>
            <p>
              We may update this privacy policy from time to time. Continued use of AvaLove after changes 
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Contact</h2>
            <p>
              For privacy-related questions or concerns, please contact us through our official channels 
              on Arena Social or Discord.
            </p>
          </section>

          <p className="text-sm text-foreground/60 mt-8">
            Last Updated: December 2024
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
