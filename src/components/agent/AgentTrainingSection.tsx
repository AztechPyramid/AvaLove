import { useState, useEffect } from 'react';
import { Brain, BookOpen, Plus, Trash2, Loader2, Save, Sparkles, Globe, Youtube, BarChart3, Link2, MessageSquare, Smile, Zap, Search, TrendingUp, Palette, Shield, Eye, Newspaper, Coins, Languages, Lightbulb, AlertTriangle } from 'lucide-react';
import { ResponseRulePresets } from './ResponseRulePresets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

interface AgentTrainingSectionProps {
  agentId: string;
}

interface TrainingExample {
  question: string;
  answer: string;
}

interface AgentCapabilities {
  web_research: boolean;
  youtube_enrichment: boolean;
  news_analysis: boolean;
  onchain_analysis: boolean;
  meme_generation: boolean;
  multilingual: boolean;
  thread_awareness: boolean;
  sentiment_analysis: boolean;
  custom_knowledge_priority: boolean;
  proactive_engagement: boolean;
}

interface ResponseStyle {
  emoji_density: 'none' | 'low' | 'medium' | 'high';
  formality: 'formal' | 'casual' | 'street';
  humor_level: 'none' | 'low' | 'medium' | 'high';
  technical_depth: 'simple' | 'medium' | 'deep';
  reply_speed: 'instant' | 'normal' | 'thoughtful';
  response_rules?: {
    language: string;
    length: string;
    formatting: string;
    custom_rules: string;
  };
}

const CAPABILITY_ITEMS: { id: keyof AgentCapabilities; label: string; description: string; icon: any; color: string; badge?: string }[] = [
  { id: 'web_research', label: 'Web Research', description: 'Agent can research topics on the web during conversations', icon: Globe, color: 'text-blue-400 bg-blue-500/15 border-blue-500/30', badge: 'NEW' },
  { id: 'youtube_enrichment', label: 'YouTube Enrichment', description: 'Adds relevant YouTube videos to responses', icon: Youtube, color: 'text-red-400 bg-red-500/15 border-red-500/30' },
  { id: 'news_analysis', label: 'News Analysis', description: 'Tracks and references current news', icon: Newspaper, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
  { id: 'onchain_analysis', label: 'On-Chain Analysis', description: 'Analyzes blockchain data (whale activity, supply)', icon: Link2, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  { id: 'sentiment_analysis', label: 'Sentiment Analysis', description: 'Detects message tone and adjusts responses accordingly', icon: Eye, color: 'text-purple-400 bg-purple-500/15 border-purple-500/30' },
  { id: 'meme_generation', label: 'Meme Mode', description: 'Uses meme references and humorous formats in replies', icon: Palette, color: 'text-pink-400 bg-pink-500/15 border-pink-500/30' },
  { id: 'multilingual', label: 'Multilingual', description: 'Automatically responds in the user\'s language', icon: Languages, color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30' },
  { id: 'thread_awareness', label: 'Thread Awareness', description: 'Tracks conversation context across threads', icon: MessageSquare, color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30' },
  { id: 'custom_knowledge_priority', label: 'Knowledge Priority', description: 'Prioritizes learned knowledge over general info', icon: Lightbulb, color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
  { id: 'proactive_engagement', label: 'Proactive Engagement', description: 'Joins trending topics automatically', icon: Zap, color: 'text-lime-400 bg-lime-500/15 border-lime-500/30' },
];

const EMOJI_OPTIONS = [
  { value: 'none', label: '🚫 None' },
  { value: 'low', label: '😊 Low' },
  { value: 'medium', label: '😄✨ Medium' },
  { value: 'high', label: '🚀🔥💯 High' },
];

const FORMALITY_OPTIONS = [
  { value: 'formal', label: '👔 Formal' },
  { value: 'casual', label: '😎 Casual' },
  { value: 'street', label: '🔥 Street' },
];

const HUMOR_OPTIONS = [
  { value: 'none', label: '😐 Serious' },
  { value: 'low', label: '🙂 Light' },
  { value: 'medium', label: '😄 Medium' },
  { value: 'high', label: '🤣 Funny' },
];

const DEPTH_OPTIONS = [
  { value: 'simple', label: '📱 Simple' },
  { value: 'medium', label: '📊 Medium' },
  { value: 'deep', label: '🧬 Deep' },
];

const SPEED_OPTIONS = [
  { value: 'instant', label: '⚡ Instant' },
  { value: 'normal', label: '🕐 Normal' },
  { value: 'thoughtful', label: '🧠 Thoughtful' },
];

const DEFAULT_CAPABILITIES: AgentCapabilities = {
  web_research: true,
  youtube_enrichment: true,
  news_analysis: true,
  onchain_analysis: true,
  meme_generation: true,
  multilingual: true,
  
  thread_awareness: true,
  sentiment_analysis: true,
  custom_knowledge_priority: true,
  proactive_engagement: true,
};

const DEFAULT_STYLE: ResponseStyle = {
  emoji_density: 'medium',
  formality: 'casual',
  humor_level: 'medium',
  technical_depth: 'medium',
  reply_speed: 'normal',
};

export function AgentTrainingSection({ agentId }: AgentTrainingSectionProps) {
  const { walletAddress } = useWalletAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [customInstructions, setCustomInstructions] = useState('');
  const [trainingExamples, setTrainingExamples] = useState<TrainingExample[]>([]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(250);
  const [capabilities, setCapabilities] = useState<AgentCapabilities>(DEFAULT_CAPABILITIES);
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(DEFAULT_STYLE);
  const [responseRules, setResponseRules] = useState({ language: '', length: '', formatting: '', custom_rules: '' });
  
  const [provider, setProvider] = useState('lovable');
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    fetchTrainingConfig();
  }, [agentId, walletAddress]);

  const getSessionId = () => {
    if (!walletAddress) return null;
    return localStorage.getItem(`wallet_session_${walletAddress.toLowerCase()}`);
  };

  const fetchTrainingConfig = async () => {
    try {
      if (!walletAddress) {
        setIsLoading(false);
        return;
      }
      const sessionId = getSessionId();
      const { data, error } = await supabase.functions.invoke('arena-agent', {
        body: { action: 'get_ai_config', agentId, walletAddress, sessionId }
      });
      if (error) throw error;
      const cfg = data?.config;
      if (cfg) {
        setCustomInstructions(cfg.custom_training_instructions || '');
        setTrainingExamples(Array.isArray(cfg.training_examples) ? cfg.training_examples : []);
        setTemperature(cfg.temperature ?? 0.7);
        setMaxTokens(cfg.max_tokens ?? 250);
        setProvider(cfg.provider || 'lovable');
        setModel(cfg.model || null);
        if (cfg.capabilities && typeof cfg.capabilities === 'object') {
          setCapabilities({ ...DEFAULT_CAPABILITIES, ...cfg.capabilities });
        }
        if (cfg.response_style && typeof cfg.response_style === 'object') {
          setResponseStyle({ ...DEFAULT_STYLE, ...cfg.response_style });
          if (cfg.response_style.response_rules) {
            setResponseRules({ language: '', length: '', formatting: '', custom_rules: '', ...cfg.response_style.response_rules });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching training config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }
    setIsSaving(true);
    try {
      const sessionId = getSessionId();
      const { error } = await supabase.functions.invoke('arena-agent', {
        body: {
          action: 'upsert_ai_config',
          agentId,
          walletAddress,
          sessionId: sessionId || undefined,
          provider,
          model,
          isActive: provider !== 'lovable',
          custom_training_instructions: customInstructions || null,
          training_examples: JSON.parse(JSON.stringify(trainingExamples)),
          temperature,
          max_tokens: maxTokens,
          capabilities,
          response_style: { ...responseStyle, response_rules: responseRules },
        }
      });
      if (error) throw error;
      toast.success('Brain settings saved! 🧠');
    } catch (error: any) {
      console.error('Error saving training config:', error);
      toast.error(error.message || 'Failed to save training settings');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCapability = (key: keyof AgentCapabilities) => {
    setCapabilities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeCapCount = Object.values(capabilities).filter(Boolean).length;

  const addTrainingExample = () => {
    setTrainingExamples([...trainingExamples, { question: '', answer: '' }]);
  };

  const removeTrainingExample = (index: number) => {
    setTrainingExamples(trainingExamples.filter((_, i) => i !== index));
  };

  const updateTrainingExample = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...trainingExamples];
    updated[index][field] = value;
    setTrainingExamples(updated);
  };

  if (isLoading) {
    return (
      <div className="bg-zinc-900/50 border border-purple-500/30 rounded-lg p-4 flex justify-center">
        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-zinc-900 border border-purple-500/30 rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-white text-sm font-medium">AI Training & Customization</span>
              <Badge variant="outline" className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/40">
                <Sparkles className="w-3 h-3 mr-1" />Brain
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-zinc-700/50 text-zinc-400 border-zinc-600">
                {activeCapCount} active
              </Badge>
            </div>
            {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            
            {/* ===== CAPABILITIES GRID ===== */}
            <Accordion type="multiple" defaultValue={['response_rules', 'capabilities']} className="space-y-2">
              {/* ===== RESPONSE RULES - TOP PRIORITY WITH GLOW ===== */}
              <AccordionItem value="response_rules" className="relative rounded-lg px-3 bg-gradient-to-br from-orange-500/10 via-zinc-800/30 to-amber-500/10 border border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
                <AccordionTrigger className="text-white text-xs hover:no-underline py-2.5">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                    <span className="font-semibold">Response Rules</span>
                    <Badge className="bg-orange-500/20 text-orange-400 text-[10px] border-orange-500/30 animate-pulse">⚡ Priority</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-zinc-500">
                      These rules override ALL default system rules. Your local bot uses these automatically.
                    </p>
                    <ResponseRulePresets onApply={(rules) => setResponseRules(prev => ({ ...prev, ...rules }))} />
                  </div>

                  {/* Language */}
                  <div className="space-y-1.5">
                    <Label className="text-white text-[11px]">Language</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { value: '', label: '🔄 Default' },
                        { value: 'english', label: '🇬🇧 English' },
                        { value: 'turkish', label: '🇹🇷 Turkish' },
                        { value: 'mixed', label: '🌍 Mixed' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setResponseRules(prev => ({ ...prev, language: opt.value }))}
                          className={`px-2 py-1.5 rounded-md border text-[10px] transition-all ${
                            responseRules.language === opt.value
                              ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                              : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:border-zinc-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Length */}
                  <div className="space-y-1.5">
                    <Label className="text-white text-[11px]">Response Length</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { value: '', label: '🔄 Default' },
                        { value: 'short', label: '📝 Short (1-3)' },
                        { value: 'medium', label: '📄 Medium (4-8)' },
                        { value: 'long', label: '📰 Long (8-15)' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setResponseRules(prev => ({ ...prev, length: opt.value }))}
                          className={`px-2 py-1.5 rounded-md border text-[10px] transition-all ${
                            responseRules.length === opt.value
                              ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                              : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:border-zinc-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Formatting */}
                  <div className="space-y-1.5">
                    <Label className="text-white text-[11px]">Formatting</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { value: '', label: '🔄 Default' },
                        { value: 'plain', label: '📋 Plain Text' },
                        { value: 'light_markdown', label: '✨ Light MD' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setResponseRules(prev => ({ ...prev, formatting: opt.value }))}
                          className={`px-2 py-1.5 rounded-md border text-[10px] transition-all ${
                            responseRules.formatting === opt.value
                              ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                              : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:border-zinc-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Rules Text with warnings */}
                  <div className="space-y-1.5">
                    <Label className="text-white text-[11px]">Custom Rules (free text)</Label>
                    <Textarea
                      value={responseRules.custom_rules}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) {
                          setResponseRules(prev => ({ ...prev, custom_rules: e.target.value }));
                        }
                      }}
                      placeholder="e.g. 'Always end with 🦅', 'Never use hashtags', 'Speak like a pirate on Fridays'"
                      className={`bg-zinc-900/50 border-zinc-700 text-white min-h-[60px] resize-none text-xs ${
                        (responseRules.custom_rules || '').length > 400 ? 'border-amber-500/50' : ''
                      }`}
                      maxLength={500}
                    />
                    <div className="flex items-center justify-between">
                      <p className={`text-[10px] ${
                        (responseRules.custom_rules || '').length > 400 
                          ? 'text-amber-400' 
                          : 'text-zinc-500'
                      }`}>
                        {(responseRules.custom_rules || '').length}/500
                      </p>
                      {(responseRules.custom_rules || '').length > 400 && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          Long rules may slow AI responses
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active Rules Preview */}
                  {(responseRules.language || responseRules.length || responseRules.formatting || responseRules.custom_rules) && (
                    <div className="p-2.5 bg-orange-500/5 rounded-lg border border-orange-500/20">
                      <p className="text-[10px] text-orange-400 font-medium mb-1">Active Overrides:</p>
                      <div className="flex flex-wrap gap-1">
                        {responseRules.language && <Badge variant="outline" className="text-[9px] bg-orange-500/10 text-orange-300 border-orange-500/30">Lang: {responseRules.language}</Badge>}
                        {responseRules.length && <Badge variant="outline" className="text-[9px] bg-orange-500/10 text-orange-300 border-orange-500/30">Length: {responseRules.length}</Badge>}
                        {responseRules.formatting && <Badge variant="outline" className="text-[9px] bg-orange-500/10 text-orange-300 border-orange-500/30">Format: {responseRules.formatting}</Badge>}
                        {responseRules.custom_rules && <Badge variant="outline" className="text-[9px] bg-orange-500/10 text-orange-300 border-orange-500/30">Custom ✓</Badge>}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="capabilities" className="bg-zinc-800/30 border-zinc-700 rounded-lg px-3">
                <AccordionTrigger className="text-white text-xs hover:no-underline py-2.5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    Capabilities & Features
                    <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] border-yellow-500/30">{activeCapCount}/11</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CAPABILITY_ITEMS.map((cap) => {
                      const Icon = cap.icon;
                      const isActive = capabilities[cap.id];
                      return (
                        <button
                          key={cap.id}
                          onClick={() => toggleCapability(cap.id)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all text-left ${
                            isActive
                              ? `${cap.color} ring-1 ring-current/30`
                              : 'bg-zinc-800/40 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                          }`}
                        >
                          <div className={`p-1.5 rounded-md shrink-0 ${isActive ? 'bg-current/10' : 'bg-zinc-700/50'}`}>
                            <Icon className={`w-3.5 h-3.5 ${isActive ? '' : 'text-zinc-500'}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[11px] font-medium ${isActive ? '' : 'text-zinc-400'}`}>{cap.label}</span>
                              {cap.badge && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">{cap.badge}</span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">{cap.description}</p>
                          </div>
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => toggleCapability(cap.id)}
                            className="shrink-0 scale-75"
                          />
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ===== RESPONSE STYLE ===== */}
              <AccordionItem value="style" className="bg-zinc-800/30 border-zinc-700 rounded-lg px-3">
                <AccordionTrigger className="text-white text-xs hover:no-underline py-2.5">
                  <div className="flex items-center gap-2">
                    <Smile className="w-3.5 h-3.5 text-pink-400" />
                    Response Style
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3 space-y-3">
                  {/* Emoji Density */}
                  <StyleSelector
                    label="Emoji Density"
                    options={EMOJI_OPTIONS}
                    value={responseStyle.emoji_density}
                    onChange={(v) => setResponseStyle(prev => ({ ...prev, emoji_density: v as any }))}
                  />
                  {/* Formality */}
                  <StyleSelector
                    label="Formality"
                    options={FORMALITY_OPTIONS}
                    value={responseStyle.formality}
                    onChange={(v) => setResponseStyle(prev => ({ ...prev, formality: v as any }))}
                  />
                  {/* Humor */}
                  <StyleSelector
                    label="Humor Level"
                    options={HUMOR_OPTIONS}
                    value={responseStyle.humor_level}
                    onChange={(v) => setResponseStyle(prev => ({ ...prev, humor_level: v as any }))}
                  />
                  {/* Technical Depth */}
                  <StyleSelector
                    label="Technical Depth"
                    options={DEPTH_OPTIONS}
                    value={responseStyle.technical_depth}
                    onChange={(v) => setResponseStyle(prev => ({ ...prev, technical_depth: v as any }))}
                  />
                  {/* Reply Speed */}
                  <StyleSelector
                    label="Reply Length"
                    options={SPEED_OPTIONS}
                    value={responseStyle.reply_speed}
                    onChange={(v) => setResponseStyle(prev => ({ ...prev, reply_speed: v as any }))}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Response Rules moved to top - see below */}

              <AccordionItem value="instructions" className="bg-zinc-800/30 border-zinc-700 rounded-lg px-3">
                <AccordionTrigger className="text-white text-xs hover:no-underline py-2.5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    Custom Instructions
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3 space-y-2">
                  <Textarea
                    value={customInstructions}
                    onChange={(e) => {
                      if (e.target.value.length <= 2000) {
                        setCustomInstructions(e.target.value);
                      }
                    }}
                    placeholder="e.g. 'Always mention AVLO token', 'Be a crypto expert', 'Keep replies short'"
                    className={`bg-zinc-900/50 border-zinc-700 text-white min-h-[80px] resize-none text-sm ${
                      customInstructions.length > 1500 ? 'border-amber-500/50' : ''
                    }`}
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between">
                    <p className={`text-[10px] ${customInstructions.length > 1500 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {customInstructions.length}/2000
                    </p>
                    {customInstructions.length > 1500 && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        Long instructions increase AI processing time
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ===== AI TUNING ===== */}
              <AccordionItem value="tuning" className="bg-zinc-800/30 border-zinc-700 rounded-lg px-3">
                <AccordionTrigger className="text-white text-xs hover:no-underline py-2.5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                    AI Parameters
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <div className="grid gap-4 grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-white text-xs flex justify-between">
                        <span>Creativity</span>
                        <span className="text-zinc-500">{temperature.toFixed(1)}</span>
                      </Label>
                      <Slider
                        value={[temperature]}
                        onValueChange={([v]) => setTemperature(v)}
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
                        <span>Max Response</span>
                        <span className="text-zinc-500">{maxTokens} token</span>
                      </Label>
                      <Slider
                        value={[maxTokens]}
                        onValueChange={([v]) => setMaxTokens(v)}
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

              {/* ===== TRAINING EXAMPLES ===== */}
              <AccordionItem value="examples" className="bg-zinc-800/30 border-zinc-700 rounded-lg px-3">
                <AccordionTrigger className="text-white text-xs hover:no-underline py-2.5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-green-400" />
                    Examples Q&A (Few-shot)
                    {trainingExamples.length > 0 && (
                      <Badge className="bg-green-500/20 text-green-400 text-[10px] border-green-500/30">{trainingExamples.length}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3 space-y-2">
                  <div className="flex justify-end">
                    <Button
                      onClick={addTrainingExample}
                      size="sm"
                      variant="outline"
                      className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 h-7 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  
                  {trainingExamples.length === 0 ? (
                    <div className="p-3 bg-zinc-800/30 rounded border border-dashed border-zinc-700 text-center">
                      <p className="text-xs text-zinc-500">No examples yet. Add Q&A pairs to train your agent.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {trainingExamples.map((ex, i) => (
                        <div key={i} className="p-2.5 bg-zinc-900/50 rounded-lg border border-zinc-700 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-cyan-400 shrink-0 mt-2">Q:</span>
                            <Input
                              value={ex.question}
                              onChange={(e) => updateTrainingExample(i, 'question', e.target.value)}
                              placeholder="User message..."
                              className="bg-zinc-800/50 border-zinc-600 text-white text-xs h-8"
                            />
                            <Button
                              onClick={() => removeTrainingExample(i)}
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-green-400 shrink-0 mt-2">A:</span>
                            <Textarea
                              value={ex.answer}
                              onChange={(e) => updateTrainingExample(i, 'answer', e.target.value)}
                              placeholder="Expected response..."
                              className="bg-zinc-800/50 border-zinc-600 text-white text-xs min-h-[50px] resize-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* ===== ACTIVE CAPABILITIES PREVIEW ===== */}
            <div className="p-2.5 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
              <p className="text-[10px] text-zinc-500 mb-1.5">Active Capabilities</p>
              <div className="flex flex-wrap gap-1">
                {CAPABILITY_ITEMS.filter(c => capabilities[c.id]).map(cap => {
                  const Icon = cap.icon;
                  return (
                    <Badge key={cap.id} variant="outline" className={`text-[10px] ${cap.color} flex items-center gap-1`}>
                      <Icon className="w-2.5 h-2.5" />
                      {cap.label}
                    </Badge>
                  );
                })}
                {activeCapCount === 0 && <span className="text-[10px] text-zinc-600">No capabilities active</span>}
              </div>
            </div>

            {/* Save */}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
            >
              {isSaving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Saving...</>
              ) : (
                <><Save className="w-3.5 h-3.5 mr-1.5" />Save Brain Settings</>
              )}
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Reusable style selector component
function StyleSelector({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-white text-[11px]">{label}</Label>
      <div className="flex gap-1.5">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-2 py-1.5 rounded-md border text-[10px] transition-all ${
              value === opt.value
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
