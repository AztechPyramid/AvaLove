import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import avloLogo from '@/assets/avlo-logo.jpg';
import arenaLogo from '@/assets/arena-logo.png';
import { Heart, Flame, Coins, Trophy, Video, Zap, Gift, TrendingUp } from "lucide-react";

export default function FAQ() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black mb-4 text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text">
            Frequently Asked Questions
          </h1>
          <p className="text-zinc-400 text-lg">
            Everything you need to know about AvaLove
          </p>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-6">
          {/* Platform Basics */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Heart className="w-6 h-6 text-pink-500" />
              Platform Basics
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-white">What is AvaLove?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  AvaLove is a revolutionary Web3 dating platform built on the Avalanche blockchain. It combines traditional dating app features with crypto tokenomics, allowing users to match, chat, and interact while earning and burning tokens. The platform uses $AVLO and $ARENA tokens to create a unique gamified dating experience.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger className="text-white">How do I get started?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  To get started: 1) Connect your Web3 wallet (MetaMask, Rainbow, etc.), 2) Complete your profile setup with photos and bio, 3) Start swiping to find matches! Make sure you have some $AVLO tokens in your wallet to unlock premium features like posting and burning.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger className="text-white">Is AvaLove free to use?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Basic features like browsing profiles, matching, and chatting are free. However, premium features like creating posts require burning $AVLO tokens. Token burning creates scarcity and gives you special status in the community. You can earn tokens through staking, airdrops, and community activities.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Token System */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Coins className="w-6 h-6 text-orange-500" />
              Token System
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-4">
                <AccordionTrigger className="text-white">
                  <div className="flex items-center gap-2">
                    <img src={avloLogo} alt="AVLO" className="w-5 h-5 rounded-full" />
                    What is $AVLO token?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  $AVLO is the primary utility token of AvaLove. It's used for creating posts, unlocking premium features, and accessing exclusive content. You can earn $AVLO through staking, participating in quests, and community events. Burning $AVLO tokens gives you special status and unlocks elite features like video profiles.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger className="text-white">
                  <div className="flex items-center gap-2">
                    <img src={arenaLogo} alt="ARENA" className="w-5 h-5 rounded-full" />
                    What is $ARENA token?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  $ARENA is a secondary token in the ecosystem. The platform's main reward token is $AVLO - you earn $AVLO by being active: creating posts, getting likes, matching with people, and maintaining streaks. Both tokens can be staked to earn rewards.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger className="text-white">Where can I buy tokens?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Click the "Buy" button in the header to purchase $AVLO tokens directly from the Arena.social marketplace. Make sure your wallet is connected and has some AVAX for gas fees.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Burning & Staking */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Flame className="w-6 h-6 text-orange-500" />
              Burning & Staking
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-7">
                <AccordionTrigger className="text-white">What is token burning?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Token burning is the process of permanently removing tokens from circulation. On AvaLove, you burn $AVLO tokens to create posts and unlock exclusive features. Each post costs tokens to create, and these tokens are sent to a burn address and destroyed forever. This creates scarcity and increases the value of remaining tokens.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8">
                <AccordionTrigger className="text-white">What is the BurnerKing badge?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  The BurnerKing badge is an elite status awarded to users who have burned 1,000,000+ $AVLO tokens. BurnerKings get exclusive features like video profile pictures (up to 3 seconds), special profile animations, and priority visibility in the discovery feed. It's the ultimate status symbol on AvaLove!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9">
                <AccordionTrigger className="text-white">How does staking work?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Staking allows you to lock your tokens for a period of time to earn rewards. Visit the Staking page to stake your $AVLO or $ARENA tokens. You'll earn passive rewards based on your stake amount and duration. Longer stakes generally yield higher APY rates. You can unstake anytime, but there may be early withdrawal penalties.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-10">
                <AccordionTrigger className="text-white">What's the difference between burning and staking?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Burning permanently destroys tokens to unlock features and increase scarcity. Staking temporarily locks tokens to earn rewards - you get your tokens back plus interest when you unstake. Burn for status and exclusivity, stake for passive income!
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Gift Swipes on Discover */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Gift className="w-6 h-6 text-pink-500" />
              Gift Swipes on Discover
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-gift-1">
                <AccordionTrigger className="text-white">How does the gift swipe system work?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  When you swipe right (like) on someone in Discover, instead of burning tokens, the tokens are sent directly to that person's wallet as a gift! This creates a unique "gift economy" where your interest in someone is backed by real value. The recipient receives a notification with your username, the token type, amount, and USD value.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-gift-2">
                <AccordionTrigger className="text-white">Why send tokens instead of burning?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Gift swipes make your like more meaningful! Instead of tokens disappearing into a burn address, they go directly to the person you're interested in. This shows genuine appreciation and creates an incentive for quality profiles. Users with attractive profiles naturally receive more tokens from admirers.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-gift-3">
                <AccordionTrigger className="text-white">What tokens can I use for gift swipes?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  You can use AVLO (the default) or any of the community-approved tokens from the token selector. Each token has its own swipe price. The token selector shows you the USD value of each option so you can choose what fits your budget. All tokens go directly to the person you liked!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-gift-4">
                <AccordionTrigger className="text-white">Does gift swiping affect my airdrop score?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Yes! Gift swipes still count toward your airdrop score just like regular swipes. You earn points for each right swipe regardless of whether tokens are burned or gifted. The scoring system tracks your activity, not the token destination.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-gift-5">
                <AccordionTrigger className="text-white">What notification does the recipient get?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  The recipient receives a special gift notification showing: your username/display name, the token type and logo, the amount sent, and the USD equivalent value. This makes your like stand out and increases the chance they'll check your profile and potentially match with you!
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Burning & Staking */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Flame className="w-6 h-6 text-orange-500" />
              Burning & Staking
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-7">
                <AccordionTrigger className="text-white">What is token burning?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Token burning is the process of permanently removing tokens from circulation. On AvaLove, you burn $AVLO tokens to create posts and unlock exclusive features. Each post costs tokens to create, and these tokens are sent to a burn address and destroyed forever. This creates scarcity and increases the value of remaining tokens. Note: Discover swipes use gift transfers instead of burning!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8">
                <AccordionTrigger className="text-white">What is the BurnerKing badge?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  The BurnerKing badge is an elite status awarded to users who have burned 1,000,000+ $AVLO tokens. BurnerKings get exclusive features like video profile pictures (up to 3 seconds), special profile animations, and priority visibility in the discovery feed. It's the ultimate status symbol on AvaLove!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9">
                <AccordionTrigger className="text-white">How does staking work?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Staking allows you to lock your tokens for a period of time to earn rewards. Visit the Staking page to stake your $AVLO or $ARENA tokens. You'll earn passive rewards based on your stake amount and duration. Longer stakes generally yield higher APY rates. You can unstake anytime, but there may be early withdrawal penalties.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-10">
                <AccordionTrigger className="text-white">What's the difference between burning and staking?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Burning permanently destroys tokens to unlock features and increase scarcity. Staking temporarily locks tokens to earn rewards - you get your tokens back plus interest when you unstake. Burn for status and exclusivity, stake for passive income!
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Referral Program */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Gift className="w-6 h-6 text-orange-500" />
              Referral Program & Airdrop
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="referral-1">
                <AccordionTrigger className="text-white">How does the Referral Program work?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Share your unique referral link (found on your Profile page) with friends. When they sign up using your link and burn 10,000+ AVLO tokens, the referral becomes "qualified". You'll earn 1 re-view right in Discover (to review profiles again) and points in the Airdrop leaderboard per qualified referral!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="referral-2">
                <AccordionTrigger className="text-white">What are re-view rights?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Re-view rights let you reset the Discover page to see profiles again that you've already swiped through. Each qualified referral gives you 1 re-view right. This is a valuable feature to get a second chance with profiles you may have passed on!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="airdrop-scoring">
                <AccordionTrigger className="text-white">How is the Airdrop Leaderboard scored?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  <p className="mb-2">Your airdrop score is calculated from platform activity:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Right Swipe: 3 points</li>
                    <li>Match: 5 points</li>
                    <li>Message: 2 points</li>
                    <li>Stake: 10 points</li>
                    <li>Post: 1 point</li>
                    <li>Comment: 0.5 points</li>
                    <li className="font-bold text-orange-500">Qualified Referral: 50 points (Most valuable!)</li>
                  </ul>
                  <p className="mt-2 text-sm text-zinc-400">Note: Tips, likes, and burns do not contribute to your airdrop score.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Social Features */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Heart className="w-6 h-6 text-pink-500" />
              Social Features
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-11">
                <AccordionTrigger className="text-white">How does matching work?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Browse profiles on the Discover page and swipe right to like or left to pass. When someone you liked also likes you back, it's a match! You'll be notified and can start chatting immediately. Matches appear in your Matches page where you can see all your conversations.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-12">
                <AccordionTrigger className="text-white">What are Posts?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Posts are public content you share with the community. Creating a post costs $AVLO tokens (burn amount varies). Posts can include text, images, GIFs, and videos. Other users can like and comment on your posts. High-performing posts earn you $ARENA rewards and increase your visibility. The more engagement your posts get, the higher they rank!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-13">
                <AccordionTrigger className="text-white">Can I send voice messages?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Yes! In chat conversations, you can record and send voice messages to your matches. Just hold the microphone button to record. Voice messages add a personal touch to your conversations and help you stand out.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-14">
                <AccordionTrigger className="text-white">What is tipping?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  You can tip other users with tokens to show appreciation for great posts or profiles. Tips are sent directly to the recipient's wallet and help support content creators in the community. It's a great way to reward quality content!
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Gamification */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Gamification & Rewards
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-15">
                <AccordionTrigger className="text-white">What are Daily Quests?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Daily Quests are challenges that reset every day. Complete quests like "Send 5 messages", "Match with 3 people", or "Create a post" to earn XP and level up. Each quest gives you experience points that contribute to your overall level. Check the quest panel daily for new challenges!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-16">
                <AccordionTrigger className="text-white">How does the level system work?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Your level increases as you earn XP from daily quests and activities. Higher levels unlock badges, special profile frames, and exclusive features. Your level is displayed on your profile and shows your commitment to the platform. Level up by staying active and completing quests!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-17">
                <AccordionTrigger className="text-white">What are streaks?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Streaks track consecutive days you've logged into AvaLove. The longer your streak, the more bonus rewards you earn! Streaks are displayed in the header with a fire emoji. Don't break your streak - log in daily to maximize your rewards and XP multipliers.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-18">
                <AccordionTrigger className="text-white">What are badges?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Badges are achievements you earn for reaching milestones: first match, 100 swipes, 10 posts created, etc. They're displayed on your profile and show your accomplishments. Rare badges make your profile stand out and demonstrate your activity level. Collect them all!
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Premium Features */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Video className="w-6 h-6 text-purple-500" />
              Premium Features
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-19">
                <AccordionTrigger className="text-white">How do I get video profile pictures?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Video profiles are exclusive to BurnerKings - users who have burned 1,000,000+ $AVLO tokens. Once you reach this milestone, you can upload videos up to 3 seconds long as your profile picture. This makes your profile incredibly eye-catching and unique. Videos must be in MP4 or WebM format and under 5MB.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-20">
                <AccordionTrigger className="text-white">What is Arena verification?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Arena verification is a badge showing you're a verified member of the Arena.social community. Connect your Arena username in your profile settings to get verified. Verified profiles get higher visibility and are more trusted in the community.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-21">
                <AccordionTrigger className="text-white">Can I edit my profile anytime?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Yes! Visit your Profile page to update your photos, bio, interests, location, and preferences anytime. Keep your profile fresh and up-to-date to get more matches. You can add up to 6 photos or videos (if you're a BurnerKing).
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Airdrop & Rewards */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Gift className="w-6 h-6 text-green-500" />
              Airdrop & Rewards
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-22">
                <AccordionTrigger className="text-white">What is the Airdrop program?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  The Airdrop program is where administrators periodically distribute rewards to top performers and active community members. These are special distributions given at specific times - there is no claim process, rewards are distributed directly by the team to eligible users based on activity and achievements.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-23">
                <AccordionTrigger className="text-white">How can I earn more $AVLO tokens?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Earn $AVLO tokens by: 1) Completing daily quests, 2) Creating popular posts that get likes and comments, 3) Staking your existing tokens to earn rewards, 4) Maintaining login streaks, 5) Receiving administrator airdrops for top performance, 6) Being an active community member. The more engaged you are, the more you earn!
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Stats & History */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <TrendingUp className="w-6 h-6 text-blue-500" />
              Stats & History
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-24">
                <AccordionTrigger className="text-white">Where can I see my stats?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Visit the Statistics page to see detailed analytics: total matches, swipes, messages sent, tokens burned, post performance, and more. Track your progress over time and see how you compare to the community average.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-25">
                <AccordionTrigger className="text-white">What is in the History page?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  The History page shows all your past swipes, matches, and interactions. You can review profiles you've swiped on and see timestamps for all activities. It's useful for tracking who you've interacted with and when.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Privacy & Security */}
          <Card className="p-6 bg-zinc-900/50 border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
              <Zap className="w-6 h-6 text-cyan-500" />
              Privacy & Security
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-26">
                <AccordionTrigger className="text-white">Is my wallet address public?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Your wallet address is visible on the blockchain (that's how Web3 works), but your personal profile information like name, photos, and bio are only visible to other platform users. We use blockchain technology for security and transparency while protecting your privacy.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-27">
                <AccordionTrigger className="text-white">Can I delete my account?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Yes, you can delete your profile by disconnecting your wallet. Note that only token burns are permanent and cannot be reversed. If you return to the platform later, you can still withdraw your staked tokens. Your profile data will be removed from the platform.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-28">
                <AccordionTrigger className="text-white">Is my data safe?</AccordionTrigger>
                <AccordionContent className="text-zinc-300">
                  Yes! We use industry-standard encryption and security practices. Your profile data is stored securely, and all token transactions are handled by smart contracts on the Avalanche blockchain. We never have access to your wallet's private keys.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-zinc-400">
          <p>Still have questions? Join our community or reach out to support!</p>
        </div>
      </div>
    </div>
  );
}
