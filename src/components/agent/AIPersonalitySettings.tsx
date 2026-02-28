import { useState, useEffect } from 'react';
import { Sparkles, Save, Loader2, MessageSquare, Smile, Briefcase, Coffee, Flame, Moon, Feather, Glasses, Zap, Heart, Coins, BookOpen, Scissors, Book, ThumbsUp, HelpCircle, TrendingUp, Leaf, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AIPersonalitySettingsProps {
  agentId: string;
}

// Personality style options
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
] as const;

// Additional personality traits that can be combined - using Lucide icons instead of emojis
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
] as const;

export const AIPersonalitySettings = ({ agentId }: AIPersonalitySettingsProps) => {
  const [selectedStyle, setSelectedStyle] = useState<string>('friendly');
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPersonalitySettings();
  }, [agentId]);

  const fetchPersonalitySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('arena_agents')
        .select('personality_style, personality_traits, custom_instructions')
        .eq('id', agentId)
        .single();

      if (error) throw error;

      if (data) {
        setSelectedStyle(data.personality_style || 'friendly');
        // Handle both string array and JSON array
        const traits = data.personality_traits;
        if (Array.isArray(traits)) {
          setSelectedTraits(traits as string[]);
        } else if (typeof traits === 'string') {
          try {
            setSelectedTraits(JSON.parse(traits));
          } catch {
            setSelectedTraits([]);
          }
        }
        setCustomInstructions(data.custom_instructions || '');
      }
    } catch (error) {
      console.error('Error fetching personality settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTraitToggle = (traitId: string) => {
    setSelectedTraits(prev => {
      if (prev.includes(traitId)) {
        return prev.filter(t => t !== traitId);
      }
      if (prev.length >= 4) {
        toast.error('Maximum 4 traits allowed');
        return prev;
      }
      return [...prev, traitId];
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('arena_agents')
        .update({
          personality_style: selectedStyle,
          personality_traits: selectedTraits,
          custom_instructions: customInstructions || null,
        })
        .eq('id', agentId);

      if (error) throw error;
      toast.success('Personality settings saved!');
    } catch (error) {
      console.error('Error saving personality settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
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
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pink-400" />
          AI Personality
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Customize how your AI agent communicates and behaves
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Style Selection */}
        <div className="space-y-3">
          <Label className="text-white text-sm font-medium">Communication Style</Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PERSONALITY_STYLES.map((style) => {
              const Icon = style.icon;
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1.5 ${
                    isSelected 
                      ? `${style.color} border-current ring-1 ring-current` 
                      : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 text-zinc-400'
                  }`}
                  title={style.description}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{style.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-zinc-500">
            {PERSONALITY_STYLES.find(s => s.id === selectedStyle)?.description}
          </p>
        </div>

        {/* Traits Selection */}
        <div className="space-y-3">
          <Label className="text-white text-sm font-medium">
            Additional Traits <span className="text-zinc-500">(select up to 4)</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {PERSONALITY_TRAITS.map((trait) => {
              const isSelected = selectedTraits.includes(trait.id);
              const Icon = trait.icon;
              return (
                <button
                  key={trait.id}
                  onClick={() => handleTraitToggle(trait.id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all border flex items-center gap-1.5 ${
                    isSelected 
                      ? 'bg-pink-500/20 text-pink-400 border-pink-500/50' 
                      : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                  }`}
                  title={trait.description}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {trait.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Instructions */}
        <div className="space-y-3">
          <Label className="text-white text-sm font-medium">
            Custom Instructions <span className="text-zinc-500">(optional)</span>
          </Label>
          <Textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Add any specific instructions for your AI... e.g., 'Always mention AVLO token when discussing crypto' or 'End messages with 🚀'"
            className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 resize-none min-h-[80px]"
            maxLength={500}
          />
          <p className="text-xs text-zinc-500">{customInstructions.length}/500</p>
        </div>

        {/* Preview */}
        <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
          <p className="text-xs text-zinc-500 mb-2">Personality Preview</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-pink-500/10 text-pink-400 border-pink-500/30">
              {PERSONALITY_STYLES.find(s => s.id === selectedStyle)?.label || 'Friendly'}
            </Badge>
            {selectedTraits.map(traitId => (
              <Badge key={traitId} variant="outline" className="bg-zinc-700/50 text-zinc-300 border-zinc-600">
                {PERSONALITY_TRAITS.find(t => t.id === traitId)?.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Personality Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
