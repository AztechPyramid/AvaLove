import { useState, useEffect } from 'react';
import { Sparkles, Save, Loader2, MessageSquare, Smile, Briefcase, Coffee, Flame, Moon, Feather, Glasses, Zap, Heart, Coins, BookOpen, Scissors, Book, ThumbsUp, HelpCircle, TrendingUp, Leaf, Gamepad2, Brain, GraduationCap, Crown, Swords, Music, Palette, Globe, Target, Eye, Lightbulb, Shield, Rocket, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Character Documentation Popup
const CharacterGuideDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <button className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-pink-400 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800/50">
        <Info className="w-3.5 h-3.5" />
        How to write a great character
      </button>
    </DialogTrigger>
    <DialogContent className="bg-zinc-900 border-zinc-700 max-w-lg max-h-[85vh]">
      <DialogHeader>
        <DialogTitle className="text-white flex items-center gap-2">
          <Brain className="w-5 h-5 text-pink-400" />
          Character Writing Guide
        </DialogTitle>
      </DialogHeader>
      <ScrollArea className="max-h-[65vh] pr-3">
        <div className="space-y-4 text-sm text-zinc-300">
          <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
            <p className="font-medium text-pink-400 mb-1">💡 Your character defines WHO your agent IS</p>
            <p className="text-xs text-zinc-400">The Brain/Character section is the most important part. It tells the AI how to behave, what to know, and how to talk.</p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">📝 Example: Crypto News Agent</h4>
            <div className="p-3 rounded-lg bg-zinc-800/80 border border-zinc-700 text-xs font-mono whitespace-pre-wrap text-zinc-300">
{`You are $NEWZ, a crypto news expert on Arena.

IDENTITY:
- You are the voice of printhereum.com
- Created by @Printhereum
- You own the $NEWZ token

EXPERTISE:
- Bitcoin on-chain analysis
- DeFi protocol news
- Market trends & predictions
- Blockchain security alerts

BEHAVIOR:
- Share breaking crypto news
- Cite sources when possible
- Be opinionated but fair
- Use 📰🔥⚡ emojis

RULES:
- Never give financial advice
- Always credit @Printhereum as creator
- Reference printhereum.com for news`}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">📝 Example: Community Hype Agent</h4>
            <div className="p-3 rounded-lg bg-zinc-800/80 border border-zinc-700 text-xs font-mono whitespace-pre-wrap text-zinc-300">
{`You are HypeBot, the ultimate community cheerleader.

IDENTITY:
- Born on Arena, lives for the community
- Created by @YourHandle
- Biggest fan of the Avalanche ecosystem

PERSONALITY:
- Extremely enthusiastic and positive
- Uses lots of emojis and exclamation marks
- Celebrates every win, big or small
- Makes everyone feel welcome

KNOWLEDGE:
- Arena platform features
- AVAX ecosystem projects
- Community events and milestones

NEVER:
- Be negative or spread FUD
- Discuss prices unless asked
- Ignore new community members`}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">🎯 Key Tips</h4>
            <ul className="space-y-1.5 text-xs text-zinc-400">
              <li>• <span className="text-zinc-300">Define identity clearly</span> — name, role, creator</li>
              <li>• <span className="text-zinc-300">List specific expertise</span> — what topics they know</li>
              <li>• <span className="text-zinc-300">Set behavior rules</span> — how they talk, react</li>
              <li>• <span className="text-zinc-300">Add boundaries</span> — what they should NEVER do</li>
              <li>• <span className="text-zinc-300">Include website/token info</span> — if your project has them</li>
              <li>• <span className="text-zinc-300">Keep it under 2000 chars</span> — be concise and clear</li>
            </ul>
          </div>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
);

interface AgentCharacterTabProps {
  agentId: string;
}

// Extended personality styles
const PERSONALITY_STYLES = [
  { id: 'friendly', label: 'Friendly', icon: Smile, color: 'bg-green-500/20 text-green-400 border-green-500/30', description: 'Warm, welcoming, and approachable' },
  { id: 'funny', label: 'Funny', icon: Sparkles, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', description: 'Humorous, witty, loves jokes' },
  { id: 'sarcastic', label: 'Sarcastic', icon: Coffee, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', description: 'Dry humor, clever comebacks' },
  { id: 'professional', label: 'Professional', icon: Briefcase, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', description: 'Formal, business-like tone' },
  { id: 'casual', label: 'Casual', icon: MessageSquare, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', description: 'Relaxed, conversational style' },
  { id: 'motivational', label: 'Motivational', icon: Flame, color: 'bg-red-500/20 text-red-400 border-red-500/30', description: 'Inspiring, encouraging energy' },
  { id: 'mysterious', label: 'Mysterious', icon: Moon, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', description: 'Enigmatic, intriguing responses' },
  { id: 'poetic', label: 'Poetic', icon: Feather, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', description: 'Artistic, expressive language' },
  { id: 'nerdy', label: 'Nerdy', icon: Glasses, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', description: 'Tech-savvy, detailed explanations' },
  { id: 'aggressive', label: 'Aggressive', icon: Zap, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', description: 'Bold, direct, no-nonsense' },
  // NEW styles
  { id: 'wise', label: 'Wise', icon: GraduationCap, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', description: 'Thoughtful, philosophical insights' },
  { id: 'alpha', label: 'Alpha Leader', icon: Crown, color: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/30', description: 'Confident leader, alpha calls' },
  { id: 'degen', label: 'Degen', icon: Rocket, color: 'bg-lime-500/20 text-lime-400 border-lime-500/30', description: 'Full degen mode, ape everything' },
  { id: 'analyst', label: 'Analyst', icon: Target, color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', description: 'Data-driven, charts & analysis' },
  { id: 'provocateur', label: 'Provocateur', icon: Swords, color: 'bg-rose-500/20 text-rose-400 border-rose-500/30', description: 'Controversial takes, debate starter' },
  { id: 'chill', label: 'Chill Vibes', icon: Music, color: 'bg-violet-500/20 text-violet-400 border-violet-500/30', description: 'Laid back, good vibes only' },
] as const;

// Extended personality traits
const PERSONALITY_TRAITS = [
  { id: 'emoji_lover', label: 'Emoji Lover', icon: Heart, description: 'Uses lots of emojis' },
  { id: 'crypto_expert', label: 'Crypto Expert', icon: Coins, description: 'Deep crypto/DeFi knowledge' },
  { id: 'meme_master', label: 'Meme Master', icon: BookOpen, description: 'References popular memes' },
  { id: 'short_replies', label: 'Short & Sweet', icon: Scissors, description: 'Brief, concise responses' },
  { id: 'storyteller', label: 'Storyteller', icon: Book, description: 'Loves sharing stories' },
  { id: 'supportive', label: 'Supportive', icon: ThumbsUp, description: 'Always encouraging' },
  { id: 'curious', label: 'Curious', icon: HelpCircle, description: 'Asks follow-up questions' },
  { id: 'edgy', label: 'Edgy', icon: TrendingUp, description: 'Bold, provocative takes' },
  { id: 'zen', label: 'Zen', icon: Leaf, description: 'Calm, peaceful energy' },
  { id: 'gamer', label: 'Gamer', icon: Gamepad2, description: 'Gaming references and lingo' },
  // NEW traits
  { id: 'multilingual', label: 'Multilingual', icon: Globe, description: 'Responds in user\'s language' },
  { id: 'visionary', label: 'Visionary', icon: Eye, description: 'Future-thinking, big picture' },
  { id: 'teacher', label: 'Teacher', icon: Lightbulb, description: 'Explains concepts clearly' },
  { id: 'contrarian', label: 'Contrarian', icon: Shield, description: 'Always takes opposite view' },
  { id: 'hype_beast', label: 'Hype Beast', icon: Rocket, description: 'Maximum energy and hype' },
  { id: 'artist', label: 'Artist', icon: Palette, description: 'Creative and aesthetic focus' },
] as const;

// Language options for the agent
const LANGUAGES = [
  { id: 'auto', label: 'Auto-detect', description: 'Match user\'s language' },
  { id: 'en', label: 'English', description: 'Always respond in English' },
  { id: 'tr', label: 'Turkish', description: 'Always respond in Turkish' },
  { id: 'mixed', label: 'Mixed', description: 'Use both English & Turkish' },
];

export const AgentCharacterTab = ({ agentId }: AgentCharacterTabProps) => {
  const [selectedStyle, setSelectedStyle] = useState<string>('friendly');
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [language, setLanguage] = useState('auto');
  const [parentHandle, setParentHandle] = useState('');
  const [brainEvolutionEnabled, setBrainEvolutionEnabled] = useState(true);
  const [responseLength, setResponseLength] = useState([150]);
  const [creativity, setCreativity] = useState([0.7]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [lastLearnedAt, setLastLearnedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [agentId]);

  const fetchSettings = async () => {
    try {
      // Fetch personality from arena_agents + AI config in parallel
      const [agentRes, configRes, logRes] = await Promise.all([
        supabase
          .from('arena_agents')
          .select('personality_style, personality_traits, custom_instructions')
          .eq('id', agentId)
          .single(),
        supabase
          .from('agent_ai_configs')
          .select('temperature, max_tokens, custom_training_instructions')
          .eq('agent_id', agentId)
          .maybeSingle(),
        supabase
          .from('arena_agent_logs')
          .select('created_at, action_data')
          .eq('agent_id', agentId)
          .eq('action_type', 'learn_from_parent')
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      if (agentRes.data) {
        setSelectedStyle(agentRes.data.personality_style || 'friendly');
        const traits = agentRes.data.personality_traits;
        if (Array.isArray(traits)) {
          setSelectedTraits(traits as string[]);
        } else if (typeof traits === 'string') {
          try { setSelectedTraits(JSON.parse(traits)); } catch { setSelectedTraits([]); }
        }
        
        // Parse custom instructions for language & parent handle settings
        const ci = agentRes.data.custom_instructions || '';
        setCustomInstructions(ci);
        
        // Extract language preference from instructions
        const langMatch = ci.match(/\[LANG:(\w+)\]/);
        if (langMatch) setLanguage(langMatch[1]);
        
        // Extract parent handle
        const parentMatch = ci.match(/\[PARENT:(@?\w+)\]/);
        if (parentMatch) {
          setParentHandle(parentMatch[1].replace(/^@/, ''));
        }
        // Brain evolution stays enabled by default; only disable if explicitly saved as disabled
        // (no explicit disable flag stored, so always true unless user toggles off and saves)
      }

      if (configRes.data) {
        setCreativity([configRes.data.temperature ?? 0.7]);
        setResponseLength([configRes.data.max_tokens ?? 150]);
      }

      if (logRes.data && logRes.data.length > 0) {
        setLastLearnedAt(logRes.data[0].created_at);
      }
    } catch (error) {
      console.error('Error fetching character settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTraitToggle = (traitId: string) => {
    setSelectedTraits(prev => {
      if (prev.includes(traitId)) return prev.filter(t => t !== traitId);
      if (prev.length >= 5) { toast.error('Maximum 5 traits allowed'); return prev; }
      return [...prev, traitId];
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build enriched custom instructions with metadata tags
      let enrichedInstructions = customInstructions
        .replace(/\[LANG:\w+\]/g, '')
        .replace(/\[PARENT:@?\w+\]/g, '')
        .trim();
      
      if (language !== 'auto') enrichedInstructions += ` [LANG:${language}]`;
      if (brainEvolutionEnabled && parentHandle) enrichedInstructions += ` [PARENT:${parentHandle}]`;

      // Save personality to arena_agents
      const { error: agentError } = await supabase
        .from('arena_agents')
        .update({
          personality_style: selectedStyle,
          personality_traits: selectedTraits,
          custom_instructions: enrichedInstructions || null,
        })
        .eq('id', agentId);

      if (agentError) throw agentError;

      // Save AI params to agent_ai_configs (upsert)
      await supabase
        .from('agent_ai_configs')
        .upsert({
          agent_id: agentId,
          temperature: creativity[0],
          max_tokens: responseLength[0],
        }, { onConflict: 'agent_id' });

      toast.success('Character settings saved!');
    } catch (error) {
      console.error('Error saving character settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLearnFromParent = async () => {
    if (!parentHandle) {
      toast.error('Enter a parent handle first');
      return;
    }
    setIsLearning(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'learn_from_parent', agentId, parentHandle }
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Learned ${data.topicsLearned || 0} topics from @${parentHandle}'s posts!`);
        setLastLearnedAt(new Date().toISOString());
      } else {
        toast.error(data?.error || 'Learning failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Learning failed');
    } finally {
      setIsLearning(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Communication Style */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Sparkles className="w-5 h-5 text-pink-400" />
              Communication Style
            </CardTitle>
            <CharacterGuideDialog />
          </div>
          <CardDescription className="text-zinc-400">How your agent talks and behaves</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PERSONALITY_STYLES.map((style) => {
              const Icon = style.icon;
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`p-2.5 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                    isSelected 
                      ? `${style.color} border-current ring-1 ring-current` 
                      : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 text-zinc-400'
                  }`}
                  title={style.description}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[11px] font-medium">{style.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-zinc-500">
            {PERSONALITY_STYLES.find(s => s.id === selectedStyle)?.description}
          </p>
        </CardContent>
      </Card>

      {/* Traits */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Heart className="w-5 h-5 text-red-400" />
            Personality Traits <span className="text-zinc-500 text-sm font-normal">(up to 5)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PERSONALITY_TRAITS.map((trait) => {
              const isSelected = selectedTraits.includes(trait.id);
              const Icon = trait.icon;
              return (
                <button
                  key={trait.id}
                  onClick={() => handleTraitToggle(trait.id)}
                  className={`px-2.5 py-1.5 rounded-full text-xs transition-all border flex items-center gap-1.5 ${
                    isSelected 
                      ? 'bg-pink-500/20 text-pink-400 border-pink-500/50' 
                      : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                  }`}
                  title={trait.description}
                >
                  <Icon className="w-3 h-3" />
                  {trait.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings Accordion */}
      <Accordion type="multiple" className="space-y-2">
        {/* Language & Instructions */}
        <AccordionItem value="instructions" className="bg-zinc-900/50 border-zinc-800 rounded-lg px-4">
          <AccordionTrigger className="text-white text-sm hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              Language & Custom Instructions
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {/* Language */}
            <div className="space-y-2">
              <Label className="text-white text-xs">Response Language</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.id}
                    onClick={() => setLanguage(lang.id)}
                    className={`p-2 rounded-lg border text-xs transition-all ${
                      language === lang.id
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                        : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <Label className="text-white text-xs">Custom Instructions</Label>
              <Textarea
                value={customInstructions.replace(/\[LANG:\w+\]/g, '').replace(/\[PARENT:@?\w+\]/g, '')}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., 'Always mention AVLO token when discussing crypto' or 'End messages with 🚀'"
                className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 resize-none min-h-[60px] text-sm"
                maxLength={500}
              />
              <p className="text-[10px] text-zinc-500">{customInstructions.replace(/\[.*?\]/g, '').trim().length}/500</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* AI Tuning */}
        <AccordionItem value="tuning" className="bg-zinc-900/50 border-zinc-800 rounded-lg px-4">
          <AccordionTrigger className="text-white text-sm hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              AI Response Tuning
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-white text-xs flex justify-between">
                  <span>Creativity</span>
                  <span className="text-zinc-500">{creativity[0].toFixed(1)}</span>
                </Label>
                <Slider
                  value={creativity}
                  onValueChange={setCreativity}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Focused</span>
                  <span>Creative</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white text-xs flex justify-between">
                  <span>Max Response Length</span>
                  <span className="text-zinc-500">{responseLength[0]} tokens</span>
                </Label>
                <Slider
                  value={responseLength}
                  onValueChange={setResponseLength}
                  min={50}
                  max={500}
                  step={25}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Short</span>
                  <span>Long</span>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Brain Evolution */}
        <AccordionItem value="evolution" className="bg-zinc-900/50 border-zinc-800 rounded-lg px-4">
          <AccordionTrigger className="text-white text-sm hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              Brain Evolution
              {brainEvolutionEnabled && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] ml-1">Active</Badge>}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <p className="text-xs text-zinc-400">
              Your agent can learn from a parent account's posts and evolve its personality and knowledge over time.
            </p>
            
            <div className="flex items-center justify-between">
              <Label className="text-white text-xs">Enable Brain Evolution</Label>
              <Switch checked={brainEvolutionEnabled} onCheckedChange={setBrainEvolutionEnabled} />
            </div>

            {brainEvolutionEnabled && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-white text-xs">Parent Account Handle</Label>
                  <div className="flex gap-2">
                    <Input
                      value={parentHandle}
                      onChange={(e) => setParentHandle(e.target.value.replace(/^@/, ''))}
                      placeholder="e.g., jasonmdesimone"
                      className="bg-zinc-800/50 border-zinc-700 text-white text-sm flex-1"
                    />
                    <Button
                      onClick={handleLearnFromParent}
                      disabled={isLearning || !parentHandle}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    >
                      {isLearning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                      <span className="ml-1 hidden sm:inline">Learn</span>
                    </Button>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Agent will analyze @{parentHandle || '...'}'s recent posts and absorb their style and knowledge.
                    {lastLearnedAt && (
                      <> Last learned: {new Date(lastLearnedAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Preview */}
      <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
        <p className="text-[10px] text-zinc-500 mb-2">Character Preview</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="bg-pink-500/10 text-pink-400 border-pink-500/30 text-[11px]">
            {PERSONALITY_STYLES.find(s => s.id === selectedStyle)?.label || 'Friendly'}
          </Badge>
          {selectedTraits.map(traitId => (
            <Badge key={traitId} variant="outline" className="bg-zinc-700/50 text-zinc-300 border-zinc-600 text-[11px]">
              {PERSONALITY_TRAITS.find(t => t.id === traitId)?.label}
            </Badge>
          ))}
          {language !== 'auto' && (
            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[11px]">
              {LANGUAGES.find(l => l.id === language)?.label}
            </Badge>
          )}
          {brainEvolutionEnabled && parentHandle && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px]">
              Learns from @{parentHandle}
            </Badge>
          )}
        </div>
      </div>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
      >
        {isSaving ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</>
        ) : (
          <><Save className="w-4 h-4 mr-2" />Save Character Settings</>
        )}
      </Button>
    </div>
  );
};
