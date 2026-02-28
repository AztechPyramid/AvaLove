import { useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/LoadingScreen';
import ReactMarkdown from 'react-markdown';
import {
  Send, Loader2, Bot, User, Plus, Search, Pin, Trash2,
  Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Edit3, MessageSquare,
  ChevronDown, Clock, MoreHorizontal, Sparkles, Zap, Brain,
  PanelLeftOpen, PanelLeftClose, GraduationCap, X, ToggleLeft, ToggleRight,
  BookOpen, ShieldAlert, Lightbulb, Pencil, FileText, UserCog, AlertTriangle,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

/* ── Types ─────────────────────────────────────────────────── */

interface AgentOption {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_handle: string;
  profile_picture_url: string | null;
  isPlatformAgent?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status?: 'sending' | 'completed' | 'failed';
}

interface Conversation {
  id: string;
  title: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
  pinned?: boolean;
  archived?: boolean;
  messages: ChatMessage[];
}

interface TrainingRule {
  id: string;
  agent_id: string;
  rule_type: string;
  instruction: string;
  priority: number;
  active: boolean;
  created_at?: string;
}

interface Directive {
  memory_id: string;
  instruction: string;
  source?: string;
  created_at?: string;
}

/* ── Helpers ───────────────────────────────────────────────── */

const PLATFORM_AGENT_HANDLE = 'avaloveapp_agent';
const PLATFORM_AGENT_DAILY_LIMIT = 100;
const DEFAULT_NGROK = 'https://lemonish-nonclinging-leeann.ngrok-free.dev';

const getApiBase = (): string => {
  const raw = import.meta.env.VITE_AGENT_API_BASE || localStorage.getItem('agent_api_base') || DEFAULT_NGROK;
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, '');
  }
};

const apiHeaders = (ownerUserId: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'x-owner-user-id': ownerUserId,
  'ngrok-skip-browser-warning': 'true',
});

const generateId = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);

const safeJson = async (resp: Response): Promise<any> => {
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) return resp.json();
  const text = await resp.text();
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try { return JSON.parse(text); } catch { /* fall through */ }
  }
  const preview = text.substring(0, 200);
  console.error('Expected JSON but got:', ct, preview);
  if (text.includes('<!doctype') || text.includes('<html')) {
    throw new Error('API returned HTML instead of JSON – check that your ngrok tunnel is running and the URL is correct.');
  }
  throw new Error(`Unexpected response format: ${ct || 'unknown'}`);
};

const groupByDate = (convos: Conversation[]) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const week = new Date(today); week.setDate(today.getDate() - 7);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const c of convos) {
    const d = new Date(c.updated_at);
    if (d >= today) groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= week) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter(g => g.items.length > 0);
};

/* ── Storage helpers (localStorage for conversations) ────── */

const STORAGE_KEY = 'your_agents_conversations';

const loadConversations = (): Conversation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

const saveConversations = (convos: Conversation[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
};

const RULE_TYPES = [
  { value: 'reply_style', label: 'Reply Style', icon: Pencil, desc: 'How the agent responds' },
  { value: 'do', label: 'Do', icon: Lightbulb, desc: 'Things the agent should do' },
  { value: 'do_not', label: 'Do Not', icon: ShieldAlert, desc: 'Things the agent must avoid' },
  { value: 'domain_knowledge', label: 'Knowledge', icon: BookOpen, desc: 'Facts the agent should know' },
];

interface ChatTheme {
  name: string;
  emoji: string;
  desc: string;
  userBubble: string;
  assistantBubble: string;
  userText: string;
  assistantText: string;
  chatBg: string;
  fontClass: string;
  bubbleRadius: string;
  codeBlock: string;
  timestampClass: string;
  avatarRing: string;
  inputClass: string;
  accentColor: string;
}

const CHAT_THEMES: Record<string, ChatTheme> = {
  cyber: {
    name: 'Cyber Terminal',
    emoji: '⚡',
    desc: 'Hacker-style monospace terminal',
    userBubble: 'bg-cyan-500/10 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    assistantBubble: 'bg-zinc-950/90 border border-cyan-900/30 shadow-[inset_0_1px_0_rgba(6,182,212,0.1)]',
    userText: 'text-cyan-100',
    assistantText: 'text-green-300',
    chatBg: 'bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.05)_0%,transparent_50%)] bg-black',
    fontClass: 'font-mono tracking-tight',
    bubbleRadius: 'rounded-md',
    codeBlock: '[&_pre]:bg-black [&_pre]:border [&_pre]:border-cyan-800/40 [&_code]:text-cyan-300 [&_pre]:shadow-[0_0_10px_rgba(6,182,212,0.1)]',
    timestampClass: 'text-cyan-700 font-mono text-[10px]',
    avatarRing: 'ring-1 ring-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]',
    inputClass: 'bg-black/80 border-cyan-800/40 text-cyan-100 placeholder:text-cyan-800 focus:border-cyan-500/60 focus:shadow-[0_0_12px_rgba(6,182,212,0.2)]',
    accentColor: 'text-cyan-400',
  },
  hologram: {
    name: 'Hologram',
    emoji: '🔮',
    desc: 'Futuristic glass morphism',
    userBubble: 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-400/30 backdrop-blur-md shadow-[0_4px_30px_rgba(139,92,246,0.15)]',
    assistantBubble: 'bg-white/[0.03] border border-white/10 backdrop-blur-lg shadow-[0_4px_20px_rgba(255,255,255,0.03)]',
    userText: 'text-violet-100',
    assistantText: 'text-zinc-200',
    chatBg: 'bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.08)_0%,transparent_40%),radial-gradient(circle_at_70%_80%,rgba(217,70,239,0.06)_0%,transparent_40%)] bg-zinc-950',
    fontClass: 'font-sans tracking-wide',
    bubbleRadius: 'rounded-2xl',
    codeBlock: '[&_pre]:bg-zinc-950/80 [&_pre]:border [&_pre]:border-violet-500/20 [&_pre]:backdrop-blur [&_code]:text-fuchsia-300',
    timestampClass: 'text-violet-500/60 text-[10px] tracking-widest uppercase',
    avatarRing: 'ring-2 ring-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.4)]',
    inputClass: 'bg-white/[0.03] border-violet-500/20 text-violet-100 placeholder:text-violet-600 backdrop-blur-md focus:border-violet-400/50',
    accentColor: 'text-violet-400',
  },
  aurora: {
    name: 'Aurora',
    emoji: '🌌',
    desc: 'Northern lights gradient flow',
    userBubble: 'bg-gradient-to-r from-emerald-500/30 via-teal-500/25 to-cyan-500/30 border border-emerald-400/25 shadow-[0_2px_20px_rgba(16,185,129,0.12)]',
    assistantBubble: 'bg-gradient-to-br from-zinc-900/90 to-emerald-950/40 border border-emerald-800/20',
    userText: 'text-emerald-50',
    assistantText: 'text-emerald-100',
    chatBg: 'bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.08)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.06)_0%,transparent_50%)] bg-zinc-950',
    fontClass: 'font-sans',
    bubbleRadius: 'rounded-3xl',
    codeBlock: '[&_pre]:bg-emerald-950/60 [&_pre]:border [&_pre]:border-emerald-700/30 [&_code]:text-teal-300',
    timestampClass: 'text-emerald-600/50 text-[10px] italic',
    avatarRing: 'ring-2 ring-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.3)]',
    inputClass: 'bg-emerald-950/20 border-emerald-700/30 text-emerald-100 placeholder:text-emerald-700 focus:border-emerald-500/50',
    accentColor: 'text-emerald-400',
  },
  inferno: {
    name: 'Inferno',
    emoji: '🔥',
    desc: 'Bold fiery gradients',
    userBubble: 'bg-gradient-to-r from-orange-600/70 via-red-500/60 to-amber-500/50 border border-orange-500/30 shadow-[0_4px_25px_rgba(249,115,22,0.2)]',
    assistantBubble: 'bg-zinc-950/90 border-l-2 border-orange-600/50',
    userText: 'text-orange-50 font-semibold',
    assistantText: 'text-amber-100',
    chatBg: 'bg-[radial-gradient(ellipse_at_bottom,rgba(249,115,22,0.06)_0%,transparent_60%)] bg-zinc-950',
    fontClass: 'font-sans',
    bubbleRadius: 'rounded-xl',
    codeBlock: '[&_pre]:bg-zinc-950 [&_pre]:border-l-2 [&_pre]:border-orange-600/40 [&_code]:text-orange-300',
    timestampClass: 'text-orange-700/50 text-[10px] font-bold uppercase tracking-wider',
    avatarRing: 'ring-2 ring-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.4)]',
    inputClass: 'bg-zinc-950/80 border-orange-700/30 text-orange-100 placeholder:text-orange-800 focus:border-orange-500/60 focus:shadow-[0_0_10px_rgba(249,115,22,0.15)]',
    accentColor: 'text-orange-400',
  },
  phantom: {
    name: 'Phantom',
    emoji: '👻',
    desc: 'Dark minimal stealth mode',
    userBubble: 'bg-zinc-800/60 border border-zinc-700/30',
    assistantBubble: 'bg-transparent border-l border-zinc-700/40 pl-4',
    userText: 'text-zinc-200',
    assistantText: 'text-zinc-400',
    chatBg: 'bg-zinc-950',
    fontClass: 'font-sans tracking-tight',
    bubbleRadius: 'rounded-lg',
    codeBlock: '[&_pre]:bg-zinc-900 [&_pre]:border [&_pre]:border-zinc-800/50 [&_code]:text-zinc-300',
    timestampClass: 'text-zinc-700 text-[10px]',
    avatarRing: 'ring-1 ring-zinc-700/40',
    inputClass: 'bg-zinc-900/50 border-zinc-800/50 text-zinc-300 placeholder:text-zinc-700 focus:border-zinc-600',
    accentColor: 'text-zinc-400',
  },
};

/* ── Component ─────────────────────────────────────────────── */

const YourAgents = () => {
  const { profile, loading } = useWalletAuth();
  const isMobile = useIsMobile();

  // Agents
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  // Conversations
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Chat
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  // Chat Theme
  const [chatTheme, setChatTheme] = useState<string>(() => localStorage.getItem('chat_theme') || 'cyber');

  // Training
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [trainingRules, setTrainingRules] = useState<TrainingRule[]>([]);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [newRuleDialog, setNewRuleDialog] = useState(false);
  const [newRuleType, setNewRuleType] = useState('reply_style');
  const [newRuleInstruction, setNewRuleInstruction] = useState('');
  const [newRulePriority, setNewRulePriority] = useState(50);
  const [teachFromMsgDialog, setTeachFromMsgDialog] = useState<{ msgId: string; convoId: string } | null>(null);
  const [teachInstruction, setTeachInstruction] = useState('');
  const [trainingTab, setTrainingTab] = useState('rules');

  // Directives
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [directivesLoading, setDirectivesLoading] = useState(false);
  const [editingDirectiveId, setEditingDirectiveId] = useState<string | null>(null);
  const [editingDirectiveText, setEditingDirectiveText] = useState('');

  // Character
  const [characterText, setCharacterText] = useState('');
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterSaving, setCharacterSaving] = useState(false);

  // Base Character
  const [baseCharacterText, setBaseCharacterText] = useState('');
  const [baseCharacterLoading, setBaseCharacterLoading] = useState(false);
  const [baseCharacterSaving, setBaseCharacterSaving] = useState(false);

  // Platform agent rate limit
  const [platformRateRemaining, setPlatformRateRemaining] = useState<number | null>(null);

  const activeConvo = conversations.find(c => c.id === activeConvoId) || null;
  const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);
  const isPlatformAgent = selectedAgent?.isPlatformAgent === true;

  // Persist conversations
  useEffect(() => { saveConversations(conversations); }, [conversations]);

  // Load agents (with platform agent fallback)
  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return;
      
      // Load user's own agents
      const { data } = await supabase
        .from('arena_agents')
        .select('id, agent_id, agent_name, agent_handle, profile_picture_url')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      const userAgents: AgentOption[] = (data || []).map(a => ({ ...a, isPlatformAgent: false }));
      
      // Always load the platform agent as a fallback option
      const { data: platformData } = await supabase
        .from('arena_agents')
        .select('id, agent_id, agent_name, agent_handle, profile_picture_url')
        .eq('agent_handle', PLATFORM_AGENT_HANDLE)
        .eq('is_active', true)
        .single();
      
      if (platformData && !userAgents.some(a => a.agent_handle === PLATFORM_AGENT_HANDLE)) {
        userAgents.push({ ...platformData, isPlatformAgent: true });
      }
      
      if (userAgents.length > 0) {
        setAgents(userAgents);
        const saved = localStorage.getItem('your_agents_selected');
        const match = userAgents.find(a => a.agent_id === saved);
        setSelectedAgentId(match ? match.agent_id : userAgents[0].agent_id);
      }
    };
    load();
  }, [profile?.id]);

  useEffect(() => {
    if (selectedAgentId) {
      localStorage.setItem('your_agents_selected', selectedAgentId);
      // Reset active conversation when switching agents
      setActiveConvoId(null);
      setChatInput('');
      setChatLoading(false);
      setPlatformRateRemaining(null);
      // Close training panel if switching to platform agent
      const agent = agents.find(a => a.agent_id === selectedAgentId);
      if (agent?.isPlatformAgent) setTrainingOpen(false);
    }
  }, [selectedAgentId]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConvo?.messages]);

  // ── Training rules ────────────────────────────────────────

  const fetchTrainingRules = useCallback(async () => {
    if (!profile?.id || !selectedAgentId) return;
    const apiBase = getApiBase();
    if (!apiBase) { setTrainingRules([]); return; }
    setTrainingLoading(true);
    try {
      const resp = await fetch(
        `${apiBase}/api/v1/assistant/training/rules?agent_id=${selectedAgentId}`,
        { headers: apiHeaders(profile.id) }
      );
      if (resp.ok) {
        const data = await safeJson(resp);
        const rules = Array.isArray(data?.rules) ? data.rules : Array.isArray(data) ? data : [];
        setTrainingRules(rules);
      } else {
        setTrainingRules([]);
      }
    } catch (e) {
      console.error('Failed to fetch training rules', e);
    } finally {
      setTrainingLoading(false);
    }
  }, [profile?.id, selectedAgentId]);

  // ── Directives CRUD ───────────────────────────────────────

  const fetchDirectives = useCallback(async () => {
    if (!profile?.id || !selectedAgentId) return;
    setDirectivesLoading(true);
    try {
      const apiBase = getApiBase();
      const resp = await fetch(
        `${apiBase}/api/v1/assistant/training/directives?agent_id=${selectedAgentId}`,
        { headers: apiHeaders(profile.id) }
      );
      if (resp.ok) {
        const data = await safeJson(resp);
        const list = Array.isArray(data?.directives) ? data.directives : Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setDirectives(list);
      } else {
        setDirectives([]);
      }
    } catch (e) {
      console.error('Failed to fetch directives', e);
    } finally {
      setDirectivesLoading(false);
    }
  }, [profile?.id, selectedAgentId]);

  const updateDirective = async (memoryId: string, instruction: string) => {
    if (!profile?.id) return;
    try {
      const apiBase = getApiBase();
      const resp = await fetch(`${apiBase}/api/v1/assistant/training/directives/${memoryId}`, {
        method: 'PATCH',
        headers: apiHeaders(profile.id),
        body: JSON.stringify({ agent_id: selectedAgentId, instruction }),
      });
      if (!resp.ok) throw new Error('Failed to update directive');
      toast.success('Directive updated');
      setEditingDirectiveId(null);
      setEditingDirectiveText('');
      fetchDirectives();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteDirective = async (memoryId: string) => {
    if (!profile?.id) return;
    try {
      const apiBase = getApiBase();
      const resp = await fetch(
        `${apiBase}/api/v1/assistant/training/directives/${memoryId}?agent_id=${selectedAgentId}`,
        { method: 'DELETE', headers: apiHeaders(profile.id) }
      );
      if (!resp.ok) throw new Error('Failed to delete directive');
      setDirectives(prev => prev.filter(d => d.memory_id !== memoryId));
      toast.success('Directive deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const clearAllDirectives = async () => {
    if (!profile?.id) return;
    if (!confirm('Clear ALL directives for this agent? This cannot be undone.')) return;
    try {
      const apiBase = getApiBase();
      const resp = await fetch(
        `${apiBase}/api/v1/assistant/training/directives?agent_id=${selectedAgentId}`,
        { method: 'DELETE', headers: apiHeaders(profile.id) }
      );
      if (!resp.ok) throw new Error('Failed to clear directives');
      setDirectives([]);
      toast.success('All directives cleared');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ── Character CRUD ────────────────────────────────────────

  const fetchCharacter = useCallback(async () => {
    if (!profile?.id || !selectedAgentId) return;
    setCharacterLoading(true);
    setBaseCharacterLoading(true);
    try {
      const apiBase = getApiBase();
      const resp = await fetch(
        `${apiBase}/api/v1/assistant/character?agent_id=${selectedAgentId}`,
        { headers: apiHeaders(profile.id) }
      );
      if (resp.ok) {
        const data = await safeJson(resp);
        console.log('[Character] GET response:', JSON.stringify(data, null, 2));
        // Owner character: try all possible alias fields
        const ownerChar = data?.character || data?.characterText || data?.character_text
          || data?.instruction || data?.text || data?.content || data?.value || data?.prompt || '';
        setCharacterText(ownerChar);
        // Base character: check items array, then top-level aliases
        const items = Array.isArray(data?.items) ? data.items : [];
        const baseItem = items.find((i: any) => i.source === 'base' || i.type === 'system_prompt' || i.is_base);
        const baseChar = baseItem?.instruction || baseItem?.content || baseItem?.text || baseItem?.value
          || data?.base_character || data?.baseCharacter || data?.system_prompt || data?.systemPrompt || '';
        setBaseCharacterText(baseChar);
      } else {
        console.warn('[Character] GET failed:', resp.status);
        setCharacterText('');
        setBaseCharacterText('');
      }
    } catch (e) {
      console.error('Failed to fetch character', e);
    } finally {
      setCharacterLoading(false);
      setBaseCharacterLoading(false);
    }
  }, [profile?.id, selectedAgentId]);

  const saveBaseCharacter = async () => {
    if (!profile?.id) return;
    setBaseCharacterSaving(true);
    try {
      const apiBase = getApiBase();
      const resp = await fetch(`${apiBase}/api/v1/assistant/character/base`, {
        method: 'PATCH',
        headers: apiHeaders(profile.id),
        body: JSON.stringify({ agent_id: selectedAgentId, base_character: baseCharacterText }),
      });
      if (!resp.ok) throw new Error('Failed to save base character');
      toast.success('Base character saved & reloaded');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBaseCharacterSaving(false);
    }
  };

  const saveCharacter = async () => {
    if (!profile?.id) return;
    setCharacterSaving(true);
    try {
      const apiBase = getApiBase();
      const resp = await fetch(`${apiBase}/api/v1/assistant/character`, {
        method: 'PUT',
        headers: apiHeaders(profile.id),
        body: JSON.stringify({ agent_id: selectedAgentId, character: characterText }),
      });
      if (!resp.ok) throw new Error('Failed to save character');
      toast.success('Character definition saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCharacterSaving(false);
    }
  };

  const deleteCharacter = async () => {
    if (!profile?.id) return;
    if (!confirm('Delete the character definition? This cannot be undone.')) return;
    try {
      const apiBase = getApiBase();
      const resp = await fetch(
        `${apiBase}/api/v1/assistant/character?agent_id=${selectedAgentId}`,
        { method: 'DELETE', headers: apiHeaders(profile.id) }
      );
      if (!resp.ok) throw new Error('Failed to delete character');
      setCharacterText('');
      toast.success('Character definition deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    if (trainingOpen && trainingTab === 'rules') fetchTrainingRules();
    if (trainingOpen && trainingTab === 'directives') fetchDirectives();
    if (trainingOpen && trainingTab === 'character') fetchCharacter();
  }, [trainingOpen, trainingTab, fetchTrainingRules, fetchDirectives, fetchCharacter]);

  const addTrainingRule = async () => {
    if (!profile?.id || !newRuleInstruction.trim()) return;
    try {
      const apiBase = getApiBase();
      const resp = await fetch(`${apiBase}/api/v1/assistant/training/rules`, {
        method: 'POST',
        headers: apiHeaders(profile.id),
        body: JSON.stringify({
          agent_id: selectedAgentId,
          rule_type: newRuleType,
          instruction: newRuleInstruction.trim(),
          priority: newRulePriority,
          active: true,
        }),
      });
      if (!resp.ok) throw new Error('Failed to add rule');
      toast.success('Training rule added');
      setNewRuleDialog(false);
      setNewRuleInstruction('');
      setNewRulePriority(50);
      fetchTrainingRules();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleRule = async (ruleId: string, active: boolean) => {
    if (!profile?.id) return;
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/api/v1/assistant/training/rules/${ruleId}`, {
        method: 'PATCH',
        headers: apiHeaders(profile.id),
        body: JSON.stringify({ active: !active }),
      });
      setTrainingRules(prev => prev.map(r => r.id === ruleId ? { ...r, active: !active } : r));
    } catch (e: any) {
      toast.error('Failed to toggle rule');
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!profile?.id) return;
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/api/v1/assistant/training/rules/${ruleId}`, {
        method: 'DELETE',
        headers: apiHeaders(profile.id),
      });
      setTrainingRules(prev => prev.filter(r => r.id !== ruleId));
      toast.success('Rule deleted');
    } catch (e: any) {
      toast.error('Failed to delete rule');
    }
  };

  const teachFromMessage = async () => {
    if (!profile?.id || !teachFromMsgDialog || !teachInstruction.trim()) return;
    try {
      const apiBase = getApiBase();
      const resp = await fetch(`${apiBase}/api/v1/assistant/training/from-message`, {
        method: 'POST',
        headers: apiHeaders(profile.id),
        body: JSON.stringify({
          agent_id: selectedAgentId,
          conversation_id: teachFromMsgDialog.convoId,
          source_message_id: teachFromMsgDialog.msgId,
          instruction: teachInstruction.trim(),
        }),
      });
      if (!resp.ok) throw new Error('Failed to teach');
      toast.success('Agent trained from message');
      setTeachFromMsgDialog(null);
      setTeachInstruction('');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ── Conversation actions ──────────────────────────────────

  const createNewConversation = () => {
    // Abort any in-flight polling from previous chat
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
      pollAbortRef.current = null;
    }
    setChatLoading(false);

    const id = generateId();
    const newConvo: Conversation = {
      id,
      title: 'New Chat',
      agent_id: selectedAgentId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [],
    };
    setConversations(prev => [newConvo, ...prev]);
    setActiveConvoId(id);
    setChatInput('');
    inputRef.current?.focus();
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) setActiveConvoId(null);
  };

  const togglePin = (id: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));
  };




  // ── Send message ──────────────────────────────────────────

  const sendMessage = async (text: string, convoId?: string) => {
    if (!text.trim() || chatLoading || !profile?.id || !selectedAgentId) return;

    // Platform agent rate limit check
    if (isPlatformAgent) {
      try {
        const { data: rateResult, error: rateError } = await supabase.rpc('check_and_increment_platform_agent_usage', {
          p_user_id: profile.id,
          p_daily_limit: PLATFORM_AGENT_DAILY_LIMIT,
        });
        if (rateError) {
          toast.error('Failed to check rate limit');
          return;
        }
        const rate = rateResult?.[0];
        if (!rate?.allowed) {
          toast.error(`Daily limit reached (${PLATFORM_AGENT_DAILY_LIMIT} messages/day). Try again tomorrow!`);
          setPlatformRateRemaining(0);
          return;
        }
        setPlatformRateRemaining(rate.remaining);
      } catch {
        toast.error('Rate limit check failed');
        return;
      }
    }

    let targetConvoId = convoId || activeConvoId;

    if (!targetConvoId) {
      const id = generateId();
      const newConvo: Conversation = {
        id,
        title: text.slice(0, 40) + (text.length > 40 ? '…' : ''),
        agent_id: selectedAgentId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [],
      };
      setConversations(prev => [newConvo, ...prev]);
      setActiveConvoId(id);
      targetConvoId = id;
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };

    setConversations(prev => prev.map(c =>
      c.id === targetConvoId
        ? { ...c, messages: [...c.messages, userMsg], updated_at: new Date().toISOString() }
        : c
    ));

    setConversations(prev => prev.map(c =>
      c.id === targetConvoId && c.messages.length === 0
        ? { ...c, title: text.slice(0, 50) + (text.length > 50 ? '…' : '') }
        : c
    ));

    setChatInput('');
    setChatLoading(true);

    // Create abort controller for this request cycle
    if (pollAbortRef.current) pollAbortRef.current.abort();
    const abortController = new AbortController();
    pollAbortRef.current = abortController;

    const apiBase = getApiBase();
    const CHAT_URL = `${apiBase}/api/v1/assistant/messages`;

    const currentConvo = conversations.find(c => c.id === targetConvoId);
    const allMessages = [...(currentConvo?.messages || []), userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: apiHeaders(profile.id),
        body: JSON.stringify({
          agent_id: selectedAgentId,
          message: text,
          mode: 'chat',
          conversation_id: targetConvoId,
          context_messages: allMessages.slice(-20).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (resp.status === 429) {
        toast.error('Rate limited. Please wait before sending another message.');
        setChatLoading(false);
        return;
      }

      if (!resp.ok) {
        const errBody = await safeJson(resp).catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${resp.status})`);
      }

      const data = await safeJson(resp);
      const messageId = data.message_id;

      if (!messageId) {
        const text = data.response_text || data.response || data.content || '';
        const assistantMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: text || 'No response text returned.',
          timestamp: new Date().toISOString(),
          status: 'completed',
        };
        setConversations(prev => prev.map(c =>
          c.id === targetConvoId
            ? { ...c, messages: [...c.messages, assistantMsg], updated_at: new Date().toISOString() }
            : c
        ));
        setChatLoading(false);
        return;
      }

      const POLL_URL = `${apiBase}/api/v1/assistant/messages/${messageId}`;
      let attempts = 0;
      const maxAttempts = 60;

      const poll = async () => {
        while (attempts < maxAttempts) {
          if (abortController.signal.aborted) return;
          attempts++;
          await new Promise(r => setTimeout(r, attempts < 10 ? 2000 : 5000));
          if (abortController.signal.aborted) return;
          try {
            const pollResp = await fetch(POLL_URL, { headers: apiHeaders(profile.id), signal: abortController.signal });
            if (!pollResp.ok) continue;
            const pollData = await safeJson(pollResp);

            if (pollData.status === 'completed') {
              const text = pollData.response_text || pollData.response || pollData.content || '';
              const assistantMsg: ChatMessage = {
                id: generateId(),
                role: 'assistant',
                content: text || 'No response text returned.',
                timestamp: new Date().toISOString(),
                status: 'completed',
              };
              setConversations(prev => prev.map(c =>
                c.id === targetConvoId
                  ? { ...c, messages: [...c.messages, assistantMsg], updated_at: new Date().toISOString() }
                  : c
              ));
              return;
            }

            if (pollData.status === 'failed' || pollData.status === 'cancelled') {
              throw new Error(pollData.error_message || 'Response generation failed');
            }
          } catch (e: any) {
            if (e.name === 'AbortError') return;
            if (attempts >= maxAttempts) throw e;
          }
        }
        throw new Error('Response timed out');
      };

      await poll();
    } catch (e: any) {
      if (e.name === 'AbortError' || abortController.signal.aborted) return;
      toast.error(e.message || 'Chat error');
      const errMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `⚠️ Error: ${e.message}`,
        timestamp: new Date().toISOString(),
        status: 'failed',
      };
      setConversations(prev => prev.map(c =>
        c.id === targetConvoId
          ? { ...c, messages: [...c.messages, errMsg] }
          : c
      ));
    } finally {
      if (!abortController.signal.aborted) setChatLoading(false);
    }
  };

  const handleSend = () => sendMessage(chatInput);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const regenerateResponse = async (msgIndex: number) => {
    if (!activeConvo || chatLoading) return;
    const prevUserMsg = activeConvo.messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
    if (!prevUserMsg) return;
    setConversations(prev => prev.map(c =>
      c.id === activeConvoId
        ? { ...c, messages: c.messages.slice(0, msgIndex) }
        : c
    ));
    await sendMessage(prevUserMsg.content, activeConvoId!);
  };

  const editAndResend = async () => {
    if (!editingMsgId || !editText.trim() || !activeConvo) return;
    const msgIndex = activeConvo.messages.findIndex(m => m.id === editingMsgId);
    if (msgIndex === -1) return;
    setConversations(prev => prev.map(c =>
      c.id === activeConvoId
        ? { ...c, messages: c.messages.slice(0, msgIndex) }
        : c
    ));
    setEditingMsgId(null);
    await sendMessage(editText, activeConvoId!);
    setEditText('');
  };

  // ── Filter conversations ─────────────────────────────────

  const MAX_VISIBLE_CONVOS = 50;

  const filteredConvos = conversations
    .filter(c => c.agent_id === selectedAgentId && !c.archived)
    .filter(c => !sidebarSearch || c.title.toLowerCase().includes(sidebarSearch.toLowerCase()))
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })
    .slice(0, MAX_VISIBLE_CONVOS);

  const dateGroups = groupByDate(filteredConvos);

  if (loading) return <LoadingScreen />;
  if (!profile) return <Navigate to="/connect" />;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-black">
      {/* ── Left Sidebar: Conversations ───────────────────── */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} flex-shrink-0 transition-all duration-300 overflow-hidden border-r border-zinc-800/50`}>
        <div className="h-full flex flex-col w-72 bg-zinc-950">
          {/* Agent Selector */}
          <div className="p-3 border-b border-zinc-800/50">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white h-10">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {agents.map(a => (
                  <SelectItem key={a.agent_id} value={a.agent_id} className="text-white">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={a.profile_picture_url || ''} />
                        <AvatarFallback className="bg-zinc-700 text-[10px]">{a.agent_name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{a.agent_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* New Chat Button */}
          <div className="p-3">
            <Button
              onClick={createNewConversation}
              className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white gap-2"
              disabled={!selectedAgentId}
            >
              <Plus className="w-4 h-4" />
              New Chat
            </Button>
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <Input
                placeholder="Search conversations…"
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1 px-2">
            {agents.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Bot className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
                <p className="text-sm text-zinc-500">No agents found.</p>
                <p className="text-xs text-zinc-600 mt-1">Create an agent first to start chatting.</p>
              </div>
            ) : dateGroups.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquare className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
                <p className="text-sm text-zinc-500">No conversations yet.</p>
                <p className="text-xs text-zinc-600 mt-1">Start a new chat with your agent.</p>
              </div>
            ) : (
              dateGroups.map(group => (
                <div key={group.label} className="mb-3">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider px-2 py-1">
                    {group.label}
                  </p>
                  {group.items.map(convo => (
                    <div
                      key={convo.id}
                      className={`group flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm overflow-hidden ${
                        activeConvoId === convo.id
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                      }`}
                      onClick={() => setActiveConvoId(convo.id)}
                    >
                      {convo.pinned && <Pin className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
                      <span className="truncate flex-1 min-w-0">{convo.title}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity flex-shrink-0"
                            onClick={e => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-zinc-900 border-zinc-700 text-white" align="end">
                          <DropdownMenuItem onClick={() => togglePin(convo.id)}>
                            <Pin className="w-3.5 h-3.5 mr-2" />
                            {convo.pinned ? 'Unpin' : 'Pin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteConversation(convo.id)}
                            className="text-red-400 focus:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      </div>

      {/* ── Main Chat Area ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm">
          {/* Panel toggle — always visible */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-zinc-400 hover:text-white"
            title={sidebarOpen ? 'Close panel' : 'Open panel'}
          >
            {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
          </Button>

          {/* Agent switcher in header */}
          {agents.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 flex-1 min-w-0 hover:bg-zinc-800/50 rounded-lg px-2 py-1.5 transition-colors">
                  {selectedAgent && (
                    <>
                      <div className="relative flex-shrink-0">
                        <Avatar className="w-8 h-8 ring-2 ring-cyan-500/30">
                          <AvatarImage src={selectedAgent.profile_picture_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-600 to-purple-600 text-white text-sm font-bold">
                            {selectedAgent.agent_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-950" />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-sm font-semibold text-white truncate">{selectedAgent.agent_name}</h2>
                          {selectedAgent.isPlatformAgent && (
                            <Badge className="bg-purple-500/20 text-purple-400 text-[9px] px-1.5 py-0 h-4">Platform AI</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] text-zinc-500 truncate">@{selectedAgent.agent_handle}</p>
                          {isPlatformAgent && platformRateRemaining !== null && (
                            <span className="text-[10px] text-zinc-600">{platformRateRemaining} msgs left</span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0 ml-1" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-700 text-white w-56" align="start">
                {agents.map(a => (
                  <DropdownMenuItem
                    key={a.agent_id}
                    onClick={() => setSelectedAgentId(a.agent_id)}
                    className={`flex items-center gap-2 ${a.agent_id === selectedAgentId ? 'bg-zinc-800' : ''}`}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={a.profile_picture_url || ''} />
                      <AvatarFallback className="bg-zinc-700 text-[10px]">{a.agent_name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-sm truncate">{a.agent_name}</p>
                        {a.isPlatformAgent && <Badge className="bg-purple-500/20 text-purple-400 text-[8px] px-1 py-0 h-3.5">Platform</Badge>}
                      </div>
                      <p className="text-[10px] text-zinc-500 truncate">@{a.agent_handle}</p>
                    </div>
                    {a.agent_id === selectedAgentId && <Check className="w-3.5 h-3.5 text-cyan-400 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex items-center gap-1">
            {/* Theme Picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white" title="Chat Theme">
                  <span className="text-base">{CHAT_THEMES[chatTheme]?.emoji || '⚡'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-700 text-white w-52" align="end">
                <p className="px-2 py-1.5 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Chat Theme</p>
                {Object.entries(CHAT_THEMES).map(([key, theme]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => { setChatTheme(key); localStorage.setItem('chat_theme', key); }}
                    className={`flex items-center gap-2.5 py-2 ${chatTheme === key ? 'bg-zinc-800' : ''}`}
                  >
                    <span className="text-lg">{theme.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{theme.name}</p>
                      <p className="text-[10px] text-zinc-500">{theme.desc}</p>
                    </div>
                    {chatTheme === key && <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {!isPlatformAgent && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTrainingOpen(!trainingOpen)}
                className={`text-zinc-400 hover:text-white ${trainingOpen ? 'text-cyan-400 bg-cyan-500/10' : ''}`}
                title="Train Agent"
              >
                <GraduationCap className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Messages area */}
          <div className={`flex-1 flex flex-col min-w-0 ${(CHAT_THEMES[chatTheme] || CHAT_THEMES.cyber).fontClass}`}>
            <ScrollArea className={`flex-1 px-4 ${(CHAT_THEMES[chatTheme] || CHAT_THEMES.cyber).chatBg}`}>
              <div className="max-w-3xl mx-auto py-6 space-y-6">
                {!activeConvo || activeConvo.messages.length === 0 ? (
                  /* Welcome Screen */
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    {selectedAgent && (
                      <div className="relative mb-6">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 blur-xl opacity-30 animate-pulse" style={{ margin: '-8px' }} />
                        <Avatar className="w-20 h-20 ring-2 ring-cyan-500/40 relative">
                          <AvatarImage src={selectedAgent.profile_picture_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-600 to-purple-600 text-white text-2xl font-bold">
                            {selectedAgent.agent_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    )}
                    <h1 className="text-2xl font-bold text-white mb-2">
                      {selectedAgent ? `Chat with ${selectedAgent.agent_name}` : 'Select an Agent'}
                    </h1>
                    <p className="text-sm text-zinc-500 max-w-md mb-8">
                      Your assistant with memory, research capabilities, and full context retention.
                      Everything runs through your private infrastructure.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
                      {[
                        { icon: Brain, label: 'Ask anything', desc: 'Get instant answers', prompt: 'Help me understand ' },
                        { icon: Search, label: 'Research', desc: 'Deep analysis', prompt: 'Research and summarize ' },
                        { icon: Sparkles, label: 'Create', desc: 'Generate content', prompt: 'Create a detailed ' },
                      ].map((action) => (
                        <button
                          key={action.label}
                          onClick={() => {
                            setChatInput(action.prompt);
                            setTimeout(() => inputRef.current?.focus(), 50);
                          }}
                          className="group relative p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-800/50 transition-all text-left"
                        >
                          <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          <action.icon className="w-5 h-5 text-cyan-400 mb-2" />
                          <p className="text-sm font-medium text-white">{action.label}</p>
                          <p className="text-xs text-zinc-500">{action.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Message List */
                  activeConvo.messages.map((msg, idx) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && selectedAgent && (
                        <Avatar className={`w-7 h-7 flex-shrink-0 mt-1 ${(CHAT_THEMES[chatTheme] || CHAT_THEMES.cyber).avatarRing}`}>
                          <AvatarImage src={selectedAgent.profile_picture_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-600 to-purple-600 text-white text-[10px]">
                            {selectedAgent.agent_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div className={`group relative max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                        {editingMsgId === msg.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              className="w-full bg-zinc-800 text-white border border-zinc-600 rounded-lg p-3 text-sm resize-none"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => setEditingMsgId(null)} className="text-zinc-400">Cancel</Button>
                              <Button size="sm" onClick={editAndResend} className="bg-cyan-600 hover:bg-cyan-500">Resend</Button>
                            </div>
                          </div>
                        ) : (
                          <div className={`${(CHAT_THEMES[chatTheme] || CHAT_THEMES.cyber).bubbleRadius} px-4 py-3 text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? `${(CHAT_THEMES[chatTheme] || CHAT_THEMES.cyber).userBubble} ${(CHAT_THEMES[chatTheme] || CHAT_THEMES.cyber).userText}`
                              : msg.status === 'failed'
                                ? 'bg-red-950/40 border border-red-800/30 text-red-300'
                                : `${(CHAT_THEMES[chatTheme] || CHAT_THEMES.cyber).assistantBubble} ${(CHAT_THEMES[chatTheme] || CHAT_THEMES.cyber).assistantText}`
                          }`}>
                            {msg.role === 'assistant' ? (
                              <div className={`prose prose-invert prose-sm max-w-none [&_pre]:rounded-lg ${(CHAT_THEMES[chatTheme] || CHAT_THEMES.cyber).codeBlock}`}>
                                {(() => {
                                  // Extract inline SVGs and render them as images
                                  const svgRegex = /(<svg[\s\S]*?<\/svg>)/gi;
                                  const parts = msg.content.split(svgRegex);
                                  const hasSvg = parts.length > 1;
                                  
                                  if (hasSvg) {
                                    return parts.map((part, i) => {
                                      if (part.trim().startsWith('<svg')) {
                                        const encoded = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(part)))}`;
                                        return <img key={i} src={encoded} alt="SVG" className="max-w-full rounded-lg my-2 bg-white/10 p-2" style={{ maxHeight: 400 }} />;
                                      }
                                      if (!part.trim()) return null;
                                      return <ReactMarkdown key={i}>{part}</ReactMarkdown>;
                                    });
                                  }
                                  
                                  return (
                                    <ReactMarkdown
                                      components={{
                                        code({ className, children, ...props }) {
                                          const content = String(children).replace(/\n$/, '');
                                          const isSvg = content.trim().startsWith('<svg') && content.trim().includes('</svg>');
                                          if (isSvg) {
                                            const encoded = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(content)))}`;
                                            return <img src={encoded} alt="SVG" className="max-w-full rounded-lg my-2 bg-white/10 p-2" style={{ maxHeight: 400 }} />;
                                          }
                                          return <code className={className} {...props}>{children}</code>;
                                        },
                                        pre({ children }) {
                                          const child = children as any;
                                          if (child?.type === 'img' || child?.props?.children?.type === 'img') return <>{children}</>;
                                          return <pre>{children}</pre>;
                                        }
                                      }}
                                    >{msg.content}</ReactMarkdown>
                                  );
                                })()}
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                          </div>
                        )}

                        {/* Message Actions */}
                        {editingMsgId !== msg.id && (
                          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => copyMessage(msg.id, msg.content)}
                              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                              title="Copy"
                            >
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>

                            {msg.role === 'user' && (
                              <button
                                onClick={() => { setEditingMsgId(msg.id); setEditText(msg.content); }}
                                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                                title="Edit & Resend"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {msg.role === 'assistant' && msg.status !== 'failed' && (
                              <>
                                <button
                                  onClick={() => regenerateResponse(idx)}
                                  className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                                  title="Regenerate"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors" title="Good response">
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                </button>
                                <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors" title="Bad response">
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (activeConvo) {
                                      setTeachFromMsgDialog({ msgId: msg.id, convoId: activeConvo.id });
                                      setTeachInstruction('');
                                    }
                                  }}
                                  className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-cyan-400 transition-colors"
                                  title="Teach agent from this message"
                                >
                                  <GraduationCap className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {msg.role === 'user' && (
                        <Avatar className="w-7 h-7 flex-shrink-0 mt-1 order-2">
                          <AvatarImage src={profile?.avatar_url || ''} />
                          <AvatarFallback className="bg-zinc-700 text-white text-[10px]">
                            <User className="w-3.5 h-3.5" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))
                )}

                {chatLoading && (
                  <div className="flex gap-3">
                    {selectedAgent && (
                      <Avatar className="w-7 h-7 flex-shrink-0 mt-1 ring-1 ring-cyan-500/20">
                        <AvatarImage src={selectedAgent.profile_picture_url || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-cyan-600 to-purple-600 text-white text-[10px]">
                          {selectedAgent.agent_name[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-zinc-500">Thinking…</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm px-4 py-3">
              <div className="max-w-3xl mx-auto">
                <div className={`relative flex items-end gap-2 rounded-2xl px-4 py-3 border transition-colors ${(CHAT_THEMES[chatTheme] || CHAT_THEMES.cyber).inputClass}`}>
                  <textarea
                    ref={inputRef}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedAgent ? `Message ${selectedAgent.agent_name}…` : 'Select an agent to start…'}
                    rows={1}
                    disabled={!selectedAgentId || agents.length === 0}
                    className="flex-1 bg-transparent text-white text-sm resize-none outline-none placeholder:text-zinc-600 max-h-32 min-h-[20px]"
                    style={{ height: 'auto' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                    }}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!chatInput.trim() || chatLoading || !selectedAgentId}
                    size="icon"
                    className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-30 flex-shrink-0"
                  >
                    {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-zinc-600 text-center mt-2">
                  End-to-end private · Context-aware responses
                </p>
              </div>
            </div>
          </div>

          {/* ── Training Panel (right side) ──────────────────── */}
          {trainingOpen && (
            <div className={`${isMobile ? 'w-80' : 'w-96'} flex-shrink-0 border-l border-zinc-800/50 bg-zinc-950 flex flex-col overflow-hidden`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Train Agent</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setTrainingOpen(false)} className="text-zinc-400 hover:text-white w-7 h-7">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <Tabs value={trainingTab} onValueChange={setTrainingTab} className="flex-1 flex flex-col min-h-0">
                <TabsList className="bg-zinc-900/50 mx-3 mt-3 h-10 w-[calc(100%-1.5rem)]">
                  <TabsTrigger value="rules" className="text-xs flex-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-white py-2">Rules</TabsTrigger>
                  <TabsTrigger value="directives" className="text-xs flex-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-white py-2">Directives</TabsTrigger>
                  <TabsTrigger value="character" className="text-xs flex-1 data-[state=active]:bg-zinc-800 data-[state=active]:text-white py-2">Character</TabsTrigger>
                </TabsList>

                {/* ── Rules Tab ── */}
                <TabsContent value="rules" className="mt-0 data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden flex-1 min-h-0">
                  <div className="p-3">
                    <Button
                      onClick={() => { setNewRuleDialog(true); setNewRuleType('reply_style'); setNewRuleInstruction(''); setNewRulePriority(50); }}
                      className="w-full bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/30 gap-2 text-xs"
                      size="sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Training Rule
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 px-3 pb-3">
                    {trainingLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                      </div>
                    ) : trainingRules.length === 0 ? (
                      <div className="text-center py-8 px-2">
                        <GraduationCap className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
                        <p className="text-xs text-zinc-500">No training rules yet.</p>
                        <p className="text-[10px] text-zinc-600 mt-1">Add rules to customize how your agent responds.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {trainingRules.map(rule => {
                          const ruleType = RULE_TYPES.find(r => r.value === rule.rule_type);
                          const Icon = ruleType?.icon || BookOpen;
                          return (
                            <div key={rule.id} className={`p-3 rounded-lg border transition-colors ${rule.active ? 'bg-zinc-900/60 border-zinc-800/50' : 'bg-zinc-900/20 border-zinc-800/20 opacity-50'}`}>
                              <div className="flex items-start gap-2">
                                <Icon className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Badge className="text-[9px] px-1 py-0 bg-zinc-800 border-zinc-700 text-zinc-400">
                                      {ruleType?.label || rule.rule_type}
                                    </Badge>
                                    <span className="text-[9px] text-zinc-600">P{rule.priority}</span>
                                  </div>
                                  <p className="text-xs text-zinc-300 leading-relaxed">{rule.instruction}</p>
                                </div>
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <button
                                    onClick={() => toggleRule(rule.id, rule.active)}
                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                                    title={rule.active ? 'Disable' : 'Enable'}
                                  >
                                    {rule.active ? <ToggleRight className="w-4 h-4 text-cyan-400" /> : <ToggleLeft className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => deleteRule(rule.id)}
                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* ── Directives Tab ── */}
                <TabsContent value="directives" className="mt-0 data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden flex-1 min-h-0">
                  <ScrollArea className="flex-1 px-3 pt-3 pb-3">
                    {directivesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                      </div>
                    ) : directives.length === 0 ? (
                      <div className="text-center py-8 px-2">
                        <FileText className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
                        <p className="text-xs text-zinc-500">No directives found.</p>
                        <p className="text-[10px] text-zinc-600 mt-1">Directives are persistent memory instructions synced from training rules.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {directives.map(dir => (
                          <div key={dir.memory_id} className="p-3 rounded-lg border bg-zinc-900/60 border-zinc-800/50">
                            {editingDirectiveId === dir.memory_id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editingDirectiveText}
                                  onChange={e => setEditingDirectiveText(e.target.value)}
                                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-xs resize-none"
                                  rows={3}
                                  autoFocus
                                />
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => setEditingDirectiveId(null)} className="text-zinc-400 h-7 text-xs">Cancel</Button>
                                  <Button
                                    size="sm"
                                    onClick={() => updateDirective(dir.memory_id, editingDirectiveText)}
                                    className="bg-cyan-600 hover:bg-cyan-500 h-7 text-xs"
                                    disabled={!editingDirectiveText.trim()}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <FileText className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  {dir.source && (
                                    <Badge className="text-[9px] px-1 py-0 bg-zinc-800 border-zinc-700 text-zinc-500 mb-1">
                                      {dir.source}
                                    </Badge>
                                  )}
                                  <p className="text-xs text-zinc-300 leading-relaxed">{dir.instruction}</p>
                                </div>
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <button
                                    onClick={() => { setEditingDirectiveId(dir.memory_id); setEditingDirectiveText(dir.instruction); }}
                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteDirective(dir.memory_id)}
                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  <div className="p-3 border-t border-zinc-800/50 flex gap-2">
                    <Button
                      onClick={fetchDirectives}
                      variant="ghost"
                      size="sm"
                      className="text-zinc-400 hover:text-white gap-1 text-xs"
                      disabled={directivesLoading}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${directivesLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    {directives.length > 0 && (
                      <Button
                        onClick={clearAllDirectives}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 gap-1 text-xs ml-auto"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Clear All
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* ── Character Tab ── */}
                <TabsContent value="character" className="mt-0 data-[state=inactive]:hidden flex-1 min-h-0 overflow-y-auto">
                  {characterLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                    </div>
                  ) : (
                    <div className="p-3 space-y-3">
                      {/* Owner Character (directive-level) */}
                      <div className="rounded-xl border border-cyan-500/20 bg-zinc-900/40 p-3 flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">Owner Character</span>
                          <Badge className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">Directive</Badge>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Owner-level persona override. Takes priority over base character.
                        </p>
                        <textarea
                          value={characterText}
                          onChange={e => setCharacterText(e.target.value)}
                          placeholder="e.g. You are a crypto expert who always talks about AVAX..."
                          className="w-full mt-2 h-32 bg-zinc-900/70 text-white border border-zinc-800/50 rounded-lg p-3 text-xs resize-none placeholder:text-zinc-600 focus:border-cyan-500/30 outline-none"
                        />
                        <div className="flex gap-2 mt-2">
                          <Button
                            onClick={saveCharacter}
                            disabled={characterSaving}
                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 gap-1.5 text-xs"
                            size="sm"
                          >
                            {characterSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Save
                          </Button>
                          <Button
                            onClick={deleteCharacter}
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 text-xs"
                            size="sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Base Character (system_prompt) */}
                      <div className="rounded-xl border border-orange-500/20 bg-zinc-900/40 p-3 flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Base Character</span>
                          <Badge className="text-[9px] bg-orange-500/10 text-orange-400 border-orange-500/20">System Prompt</Badge>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Fallback system prompt. Used when no owner directive exists.
                        </p>
                        <textarea
                          value={baseCharacterText}
                          onChange={e => setBaseCharacterText(e.target.value)}
                          placeholder="Base system prompt for your agent..."
                          className="w-full mt-2 h-32 bg-zinc-900/70 text-white border border-zinc-800/50 rounded-lg p-3 text-xs resize-none placeholder:text-zinc-600 focus:border-orange-500/30 outline-none"
                        />
                        <Button
                          onClick={saveBaseCharacter}
                          disabled={baseCharacterSaving}
                          className="w-full mt-2 bg-orange-600/80 hover:bg-orange-600 gap-1.5 text-xs"
                          size="sm"
                        >
                          {baseCharacterSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save Base Character
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* ── New Rule Dialog ───────────────────────────────── */}
      <Dialog open={newRuleDialog} onOpenChange={setNewRuleDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add Training Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Rule Type</label>
              <div className="grid grid-cols-2 gap-2">
                {RULE_TYPES.map(rt => (
                  <button
                    key={rt.value}
                    onClick={() => setNewRuleType(rt.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                      newRuleType === rt.value
                        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                        : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <rt.icon className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{rt.label}</p>
                      <p className="text-[10px] opacity-60">{rt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Instruction</label>
              <textarea
                value={newRuleInstruction}
                onChange={e => setNewRuleInstruction(e.target.value)}
                placeholder="e.g. Always respond with concise, technical answers"
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm resize-none placeholder:text-zinc-600"
                rows={3}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Priority (1-100)</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={newRulePriority}
                onChange={e => setNewRulePriority(Number(e.target.value))}
                className="bg-zinc-800 border-zinc-700 text-white h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewRuleDialog(false)} className="text-zinc-400">Cancel</Button>
            <Button onClick={addTrainingRule} disabled={!newRuleInstruction.trim()} className="bg-cyan-600 hover:bg-cyan-500">
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Teach From Message Dialog ────────────────────── */}
      <Dialog open={!!teachFromMsgDialog} onOpenChange={v => !v && setTeachFromMsgDialog(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-cyan-400" />
              Teach Agent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">
              Tell your agent how to handle similar messages in the future.
            </p>
            <textarea
              value={teachInstruction}
              onChange={e => setTeachInstruction(e.target.value)}
              placeholder="e.g. For questions like this, always mention risks before giving recommendations"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm resize-none placeholder:text-zinc-600"
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTeachFromMsgDialog(null)} className="text-zinc-400">Cancel</Button>
            <Button onClick={teachFromMessage} disabled={!teachInstruction.trim()} className="bg-cyan-600 hover:bg-cyan-500">
              Teach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default YourAgents;
