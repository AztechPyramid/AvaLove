import { useState, useEffect } from 'react';
import { Brain, Save, Loader2, Sparkles, Zap, AlertTriangle } from 'lucide-react';
import { AgentTutorialDialog } from './AgentTutorialDialog';
import { ResponseRulePresets } from './ResponseRulePresets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

interface AgentKnowledgeTabProps {
  agentId: string;
  isVerified: boolean;
}

interface ResponseRules {
  language: string;
  length: string;
  formatting: string;
  custom_rules: string;
}


const DEFAULT_RULES: ResponseRules = { language: '', length: '', formatting: '', custom_rules: '' };

export const AgentKnowledgeTab = ({ agentId, isVerified }: AgentKnowledgeTabProps) => {
  const { walletAddress } = useWalletAuth();
  const [charInstructions, setCharInstructions] = useState('');
  const [responseRules, setResponseRules] = useState<ResponseRules>(DEFAULT_RULES);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  

  useEffect(() => { fetchCharacter(); }, [agentId]);

  const fetchCharacter = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('arena_agents')
        .select('custom_instructions, response_rules, training_qa')
        .eq('id', agentId)
        .single();

      if (data) {
        const ci = data.custom_instructions || '';
        setCharInstructions(ci.replace(/\[LANG:\w+\]/g, '').replace(/\[PARENT:@?\w+\]/g, '').trim());

        if (data.response_rules && typeof data.response_rules === 'object') {
          const rr = data.response_rules as Record<string, unknown>;
          setResponseRules({
            language: (rr.language as string) || '',
            length: (rr.length as string) || '',
            formatting: (rr.formatting as string) || '',
            custom_rules: (rr.custom_rules as string) || '',
          });
        }



      }
    } catch (e) {
      console.error('Brain fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!walletAddress) { toast.error('Connect wallet first'); return; }
    setIsSaving(true);
    try {
      const { data: current } = await supabase
        .from('arena_agents')
        .select('custom_instructions')
        .eq('id', agentId)
        .single();

      const rawCi = current?.custom_instructions || '';
      const langMatch = rawCi.match(/\[LANG:\w+\]/);
      const parentMatch = rawCi.match(/\[PARENT:@?\w+\]/);

      let enriched = charInstructions.trim();
      if (langMatch) enriched += ` ${langMatch[0]}`;
      if (parentMatch) enriched += ` ${parentMatch[0]}`;

      await supabase.from('arena_agents').update({
        custom_instructions: enriched || null,
        character_definition: enriched || null,
        response_rules: JSON.parse(JSON.stringify(responseRules)),
      }).eq('id', agentId);

      toast.success('Brain saved! 🧠');
    } catch (e: any) {
      console.error('Save error:', e);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const hasRules = responseRules.language || responseRules.length || responseRules.formatting || responseRules.custom_rules;
  const rulesLength = responseRules.custom_rules.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
          <Brain className="w-8 h-8 text-purple-400 animate-pulse relative z-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-br from-purple-500/40 via-cyan-500/20 to-purple-500/40 blur-[1px]" />

      <div className="relative bg-zinc-950/95 backdrop-blur-xl rounded-xl border border-purple-500/20 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(168,85,247,0.4) 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        {/* Header */}
        <div className="relative px-4 py-3 border-b border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-transparent to-cyan-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Brain className="w-5 h-5 text-purple-400" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </div>
              <span className="text-white font-semibold text-sm tracking-wide">BRAIN</span>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">AI Config</Badge>
            </div>
            <div className="flex items-center gap-2">
              <AgentTutorialDialog />
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white h-8 text-xs gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>

        <div className="relative p-4 space-y-3">
          {/* ── Response Rules (collapsible, priority) ── */}
          <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
            <div className="rounded-lg border border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent overflow-hidden">
              <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-orange-500/5 transition-colors">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                  <span className="font-medium text-white text-xs">Response Rules</span>
                  <Badge className="bg-orange-500/20 text-orange-400 text-[9px] border-orange-500/30">⚡ Priority</Badge>
                  {hasRules && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                </div>
                <span className="text-zinc-500 text-[10px]">{rulesOpen ? '▲' : '▼'}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-[10px] text-zinc-500">These rules override default AI behavior. Language, length, format.</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] text-zinc-500 mb-1 block">Language</label>
                      <Select value={responseRules.language} onValueChange={v => setResponseRules({ ...responseRules, language: v })}>
                        <SelectTrigger className="h-7 text-[11px] bg-zinc-900/50 border-zinc-700 text-white"><SelectValue placeholder="Auto" /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                          <SelectItem value="auto" className="text-xs text-white">Auto-detect</SelectItem>
                          <SelectItem value="english" className="text-xs text-white">English</SelectItem>
                          <SelectItem value="turkish" className="text-xs text-white">Turkish</SelectItem>
                          <SelectItem value="mixed" className="text-xs text-white">Mixed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 mb-1 block">Length</label>
                      <Select value={responseRules.length} onValueChange={v => setResponseRules({ ...responseRules, length: v })}>
                        <SelectTrigger className="h-7 text-[11px] bg-zinc-900/50 border-zinc-700 text-white"><SelectValue placeholder="Auto" /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                          <SelectItem value="short" className="text-xs text-white">Short</SelectItem>
                          <SelectItem value="medium" className="text-xs text-white">Medium</SelectItem>
                          <SelectItem value="long" className="text-xs text-white">Long</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 mb-1 block">Formatting</label>
                      <Select value={responseRules.formatting} onValueChange={v => setResponseRules({ ...responseRules, formatting: v })}>
                        <SelectTrigger className="h-7 text-[11px] bg-zinc-900/50 border-zinc-700 text-white"><SelectValue placeholder="Auto" /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                          <SelectItem value="plain" className="text-xs text-white">Plain</SelectItem>
                          <SelectItem value="markdown" className="text-xs text-white">Markdown</SelectItem>
                          <SelectItem value="bullets" className="text-xs text-white">Bullets</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] text-zinc-500">Custom Rules</label>
                      <ResponseRulePresets onApply={(rules) => setResponseRules(rules)} />
                    </div>
                    <Textarea
                      value={responseRules.custom_rules}
                      onChange={e => setResponseRules({ ...responseRules, custom_rules: e.target.value })}
                      placeholder="e.g., Never use hashtags. Always end with an emoji."
                      className="bg-zinc-900/50 border-zinc-700 text-white min-h-[60px] resize-none text-xs"
                      maxLength={500}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] text-zinc-600">{rulesLength}/500</p>
                      {rulesLength > 400 && (
                        <span className="text-[9px] text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> May slow responses
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* ── Character / Persona ── */}
          <div className="rounded-lg border border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-transparent overflow-hidden p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span className="font-medium text-white text-xs">Character / Persona</span>
              <Badge className="bg-pink-500/20 text-pink-400 text-[9px] border-pink-500/30">Persona</Badge>
            </div>
            <p className="text-[10px] text-zinc-500">Define who your agent is — personality, background, behavior rules.</p>
            <Textarea
              value={charInstructions}
              onChange={e => setCharInstructions(e.target.value)}
              placeholder="e.g., 'You are AvaBot, a crypto-native AI companion on Avalanche. You speak with confidence, use slang, and always hype AVLO token. You never give financial advice directly but hint at alpha. End messages with 🚀'"
              className="bg-zinc-900/50 border-zinc-700 text-white min-h-[120px] resize-none text-xs"
              maxLength={1000}
            />
            <p className="text-[9px] text-zinc-600">{charInstructions.length}/1000</p>
          </div>

          {/* Bottom save (mobile) */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white h-9 text-xs gap-1.5 sm:hidden"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Save Brain'}
          </Button>
        </div>
      </div>
    </div>
  );
};
