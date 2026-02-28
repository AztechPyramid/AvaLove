import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useDailyQuests } from '@/hooks/useDailyQuests';
import { Check, Trophy } from 'lucide-react';

const QUEST_INFO = {
  swipe: { icon: '👆', label: 'Swipe profiles', color: 'from-blue-500 to-purple-500' },
  match: { icon: '💕', label: 'Get matches', color: 'from-pink-500 to-rose-500' },
  message: { icon: '💬', label: 'Send messages', color: 'from-green-500 to-emerald-500' },
  tip: { icon: '🎁', label: 'Send tips', color: 'from-yellow-500 to-orange-500' },
  login: { icon: '🔥', label: 'Login daily', color: 'from-red-500 to-orange-500' },
};

export const QuestPanel = () => {
  const { quests, loading } = useDailyQuests();

  if (loading) return null;

  const completedCount = quests.filter((q) => q.completed).length;
  const totalQuests = quests.length;

  return (
    <Card className="p-6 bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm border-white/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground">Daily Quests</h3>
          <p className="text-sm text-muted-foreground">
            {completedCount}/{totalQuests} completed
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {quests.map((quest) => {
          const info = QUEST_INFO[quest.quest_type];
          const progress = (quest.progress / quest.target) * 100;

          return (
            <div
              key={quest.id}
              className={`p-3 rounded-lg ${
                quest.completed
                  ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{info.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      {info.label}
                    </p>
                    {quest.completed ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-xs font-bold bg-gradient-to-r from-love-primary to-love-secondary bg-clip-text text-transparent">
                        +{quest.xp_reward} XP
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {quest.progress}/{quest.target}
                  </p>
                </div>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          );
        })}
      </div>
    </Card>
  );
};
