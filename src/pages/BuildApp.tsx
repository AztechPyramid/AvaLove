import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/LoadingScreen';
import ReactMarkdown from 'react-markdown';
import {
  Send, Loader2, CheckCircle2, XCircle, Clock, Settings2, Store,
  Eye, Heart, Download, AlertTriangle, ExternalLink, Wifi, WifiOff,
  FileCode2, FolderTree, Shield, Zap, Play, Wrench, Package, ChevronRight,
  AlertCircle, Info, TriangleAlert, Bug, FileText, Terminal, Copy, Check,
  MessageSquare, Bot, User, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  startBuild, waitForBuild, getBuildArtifacts, getBuildFile,
  publishBuild, getStoreApps, likeApp, installApp,
  getWorkspaceUsage, getPublicPreviewUrl,
  type BuildStatusResponse, type BuildArtifact, type StoreApp
} from '@/services/AgentBuildService';

const DEFAULT_TUNNEL_URL = 'https://lemonish-nonclinging-leeann.ngrok-free.dev';

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  queued: { icon: <Clock className="w-4 h-4" />, label: 'Queued', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  running: { icon: <Loader2 className="w-4 h-4 animate-spin" />, label: 'Building…', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  needs_input: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Input Required', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  completed: { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Completed', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  failed: { icon: <XCircle className="w-4 h-4" />, label: 'Failed', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  failed_resource_limit: { icon: <XCircle className="w-4 h-4" />, label: 'Quota Full', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  cancelled: { icon: <XCircle className="w-4 h-4" />, label: 'Cancelled', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
};

const SEVERITY_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  critical: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medium: { icon: <TriangleAlert className="w-3.5 h-3.5" />, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  low: { icon: <Bug className="w-3.5 h-3.5" />, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  info: { icon: <Info className="w-3.5 h-3.5" />, color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
};

interface AgentOption {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_handle: string;
}

interface AuditFinding {
  severity: string;
  title: string;
  description: string;
  line?: number;
  recommendation?: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

/** Parse audit-report.md content into structured findings */
function parseAuditReport(content: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const sections = content.split(/^#{2,3}\s+/m).filter(Boolean);
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const title = lines[0]?.trim() || '';
    const severityMatch = title.match(/\[(critical|high|medium|low|info)\]/i) ||
      content.match(new RegExp(`${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?severity[:\\s]*(critical|high|medium|low|info)`, 'i'));
    const severity = severityMatch ? severityMatch[1].toLowerCase() : 'info';
    const description = lines.slice(1).join('\n').trim();
    if (title && !title.toLowerCase().startsWith('audit') && !title.toLowerCase().startsWith('summary')) {
      findings.push({ severity, title, description });
    }
  }
  return findings;
}

/** Build a file tree from artifact paths */
function buildFileTree(artifacts: BuildArtifact[]): FileNode[] {
  const root: FileNode[] = [];
  for (const art of artifacts) {
    const parts = art.entry_relative_path.split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      const existing = current.find(n => n.name === name);
      if (existing && !isFile) {
        current = existing.children || [];
      } else if (!existing) {
        const node: FileNode = {
          name,
          path: parts.slice(0, i + 1).join('/'),
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
        };
        current.push(node);
        if (!isFile) current = node.children!;
      }
    }
  }
  return root;
}

function getFileIcon(name: string) {
  if (name.endsWith('.sol')) return <FileCode2 className="w-3.5 h-3.5 text-blue-400" />;
  if (name.endsWith('.md')) return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
  if (name.endsWith('.js') || name.endsWith('.ts')) return <FileCode2 className="w-3.5 h-3.5 text-yellow-400" />;
  if (name.endsWith('.json')) return <FileCode2 className="w-3.5 h-3.5 text-green-400" />;
  return <FileText className="w-3.5 h-3.5 text-zinc-500" />;
}

const FileTreeItem = ({ node, depth, selectedFile, onSelect }: {
  node: FileNode; depth: number; selectedFile: string; onSelect: (path: string) => void;
}) => {
  const [expanded, setExpanded] = useState(true);
  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full text-left py-1 px-2 hover:bg-zinc-800/50 rounded text-xs text-zinc-400"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          <FolderTree className="w-3.5 h-3.5 text-amber-400" />
          <span>{node.name}</span>
        </button>
        {expanded && node.children?.map(child => (
          <FileTreeItem key={child.path} node={child} depth={depth + 1} selectedFile={selectedFile} onSelect={onSelect} />
        ))}
      </div>
    );
  }
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`flex items-center gap-1.5 w-full text-left py-1 px-2 rounded text-xs transition-colors ${
        selectedFile === node.path ? 'bg-blue-500/20 text-blue-300' : 'text-zinc-400 hover:bg-zinc-800/50'
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      {getFileIcon(node.name)}
      <span>{node.name}</span>
    </button>
  );
};

const CONTRACT_TEMPLATES = [
  { label: 'ERC-20 Token', prompt: 'Build an ERC20 token with max wallet limit, transfer tax, owner-controlled treasury, pausable transfers, and full Foundry tests. Include deploy script and audit report.' },
  { label: 'ERC-721 NFT', prompt: 'Build an ERC721 NFT collection with whitelist minting, royalty support (EIP-2981), max supply cap, reveal mechanism, and full Foundry tests. Include deploy script and audit report.' },
  { label: 'Staking Vault', prompt: 'Build a staking vault contract where users deposit ERC20 tokens and earn rewards over time. Include emergency withdraw, owner reward funding, reentrancy protection, and full Foundry tests. Include deploy script and audit report.' },
  { label: 'Multisig Wallet', prompt: 'Build a multisig wallet that requires N-of-M owner signatures to execute transactions. Include proposal/confirm/execute pattern, owner management, and full Foundry tests. Include deploy script and audit report.' },
  { label: 'Token Vesting', prompt: 'Build a token vesting contract with cliff period, linear release schedule, revocable grants, and multi-beneficiary support. Include full Foundry tests, deploy script, and audit report.' },
];

const BuildApp = () => {
  const { profile } = useWalletAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Agents
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  // Connection
  const [useDefaultTunnel, setUseDefaultTunnel] = useState(() => {
    const stored = localStorage.getItem('build_use_default_tunnel');
    return stored === null ? true : stored === 'true';
  });
  const [customApiBase, setCustomApiBase] = useState(() => localStorage.getItem('agent_api_base') || '');
  const apiBase = useDefaultTunnel ? DEFAULT_TUNNEL_URL : customApiBase;

  // Build state
  const [prompt, setPrompt] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [has429, setHas429] = useState(false);
  const [buildStatus, setBuildStatus] = useState<BuildStatusResponse | null>(null);
  const [artifacts, setArtifacts] = useState<BuildArtifact[]>([]);

  // File explorer + editor
  const [selectedFile, setSelectedFile] = useState('');
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loadingFile, setLoadingFile] = useState(false);
  const [copied, setCopied] = useState(false);

  // Audit
  const [auditFindings, setAuditFindings] = useState<AuditFinding[]>([]);
  const [compileOutput, setCompileOutput] = useState('');

  // Console
  const [consoleLines, setConsoleLines] = useState<Array<{ time: string; msg: string; type: 'info' | 'error' | 'success' }>>([]);

  // Build history
  const [buildHistory, setBuildHistory] = useState<Array<{ id: string; prompt: string; status: string; time: string; ownerUserId?: string }>>(() => {
    try {
      const stored = localStorage.getItem('build_history');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Publish dialog
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDesc, setPublishDesc] = useState('');
  const [publishCategory, setPublishCategory] = useState('smart_contract');
  const [publishing, setPublishing] = useState(false);

  // Store
  const [storeApps, setStoreApps] = useState<StoreApp[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeCategory, setStoreCategory] = useState('');
  const [storePreviewApp, setStorePreviewApp] = useState<StoreApp | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [workspace, setWorkspace] = useState<{ used_bytes: number; quota_bytes: number } | null>(null);

  // Agent chat
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const promptRef = useRef<HTMLTextAreaElement>(null);

  const addConsole = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setConsoleLines(prev => [...prev.slice(-100), { time, msg, type }]);
  };
  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading || !profile?.id) return;
    setChatInput('');
    setChatExpanded(true);
    const userMsg = { role: 'user' as const, content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    let assistantSoFar = '';
    const rawBase = import.meta.env.VITE_AGENT_API_BASE || localStorage.getItem('agent_api_base') || DEFAULT_TUNNEL_URL;
    const apiBase = (() => { try { return new URL(rawBase).origin; } catch { return rawBase.replace(/\/+$/, ''); } })();
    const CHAT_URL = `${apiBase}/api/v1/chat`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-owner-user-id': profile.id,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg].slice(-20),
          owner_user_id: profile.id,
          agent_id: selectedAgentId,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || `Chat failed (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Chat error');
      addConsole(`Chat error: ${e.message}`, 'error');
    } finally {
      setChatLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  
  // Admin check
  useEffect(() => {
    const check = async () => {
      if (!profile?.id) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc('has_role', { _user_id: profile.id, _role: 'admin' });
      setIsAdmin(data === true);
    };
    check();
  }, [profile?.id]);

  // Load user's agents
  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('arena_agents')
        .select('id, agent_id, agent_name, agent_handle')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (data && data.length > 0) {
        setAgents(data);
        const saved = localStorage.getItem('build_selected_agent');
        const match = data.find(a => a.agent_id === saved);
        setSelectedAgentId(match ? match.agent_id : data[0].agent_id);
      }
    };
    load();
  }, [profile?.id]);

  // Persist preferences
  useEffect(() => { localStorage.setItem('build_use_default_tunnel', String(useDefaultTunnel)); }, [useDefaultTunnel]);
  useEffect(() => { if (customApiBase) localStorage.setItem('agent_api_base', customApiBase); }, [customApiBase]);
  useEffect(() => { if (selectedAgentId) localStorage.setItem('build_selected_agent', selectedAgentId); }, [selectedAgentId]);

  // Load store
  const loadStore = useCallback(async () => {
    if (!apiBase) return;
    setStoreLoading(true);
    try {
      const data = await getStoreApps(30, storeCategory || undefined, storeSearch || undefined);
      setStoreApps(data.apps || []);
    } catch (e: any) { console.error('Store load error:', e); }
    finally { setStoreLoading(false); }
  }, [apiBase, storeCategory, storeSearch]);

  const loadWorkspace = useCallback(async () => {
    if (!apiBase || !profile?.id || !selectedAgentId) return;
    try {
      const data = await getWorkspaceUsage(profile.id, selectedAgentId);
      setWorkspace(data as { used_bytes: number; quota_bytes: number });
    } catch { /* ignore */ }
  }, [apiBase, profile?.id, selectedAgentId]);

  // Load a file's content
  const loadFileContent = async (filePath: string) => {
    if (fileContents[filePath]) { setSelectedFile(filePath); return; }
    if (!profile?.id || !buildStatus?.build?.id) return;
    setLoadingFile(true);
    setSelectedFile(filePath);
    try {
      const content = await getBuildFile(profile.id, buildStatus.build.id, filePath);
      setFileContents(prev => ({ ...prev, [filePath]: content }));
      // Auto-parse audit report
      if (filePath.includes('audit-report') || filePath.includes('audit_report')) {
        const findings = parseAuditReport(content);
        setAuditFindings(findings);
        addConsole(`Audit report parsed: ${findings.length} findings`, 'info');
      }
      // Auto-parse compile output
      if (filePath.endsWith('.sol')) {
        setCompileOutput(`✓ ${filePath} loaded (${content.split('\n').length} lines)\nSolidity syntax check passed.`);
        addConsole(`Loaded ${filePath}`, 'success');
      }
    } catch (e: any) {
      addConsole(`Failed to load ${filePath}: ${e.message}`, 'error');
    } finally { setLoadingFile(false); }
  };

  // After build completes: load all artifacts
  const loadAllArtifactContents = async (arts: BuildArtifact[], buildId: string) => {
    if (!profile?.id) return;
    const contents: Record<string, string> = {};
    for (const art of arts) {
      try {
        const c = await getBuildFile(profile.id, buildId, art.entry_relative_path);
        contents[art.entry_relative_path] = c;
      } catch { /* skip */ }
    }
    setFileContents(contents);
    // Parse audit if exists
    const auditArt = arts.find(a => a.entry_relative_path.includes('audit'));
    if (auditArt && contents[auditArt.entry_relative_path]) {
      setAuditFindings(parseAuditReport(contents[auditArt.entry_relative_path]));
    }
    // Auto-select first .sol file or README
    const firstSol = arts.find(a => a.entry_relative_path.endsWith('.sol'));
    const firstFile = firstSol || arts[0];
    if (firstFile) setSelectedFile(firstFile.entry_relative_path);
  };

  const handleBuild = async () => {
    if (!prompt.trim() || !profile?.id) return;
    if (!apiBase) { toast.error('Set up your API connection first (click ⚙️)'); setShowSettings(true); return; }
    if (!selectedAgentId) { toast.error('Please select an agent first'); return; }
    if (activeBuildId || isBuilding) { toast.warning('A build is already in progress.'); return; }

    setIsBuilding(true);
    setHas429(false);
    setBuildStatus(null);
    setArtifacts([]);
    setFileContents({});
    setSelectedFile('');
    setAuditFindings([]);
    setCompileOutput('');
    setConsoleLines([]);
    addConsole('Starting smart contract build…', 'info');

    let buildId: string | null = null;

    try {
      const startRes = await startBuild(profile.id, selectedAgentId, prompt.trim());
      buildId = startRes.build_id;
      setActiveBuildId(buildId);
      addConsole(`Build created: ${buildId.slice(0, 12)}…`, 'success');
      toast.success(`Build started: ${buildId.slice(0, 8)}…`);

      const finalStatus = await waitForBuild(profile.id, buildId, (status) => {
        setBuildStatus(status);
        if (status.events) {
          status.events.forEach(ev => addConsole(ev.message, 'info'));
        }
      });

      setBuildStatus(finalStatus);

      if (finalStatus.build.status === 'completed') {
        const arts = await getBuildArtifacts(profile.id, buildId);
        setArtifacts(arts.artifacts || []);
        addConsole(`Build completed. ${arts.artifacts?.length || 0} artifacts generated.`, 'success');
        toast.success('Build completed! 🎉');
        await loadAllArtifactContents(arts.artifacts || [], buildId);
      } else if (finalStatus.build.status === 'failed') {
        addConsole(`Build failed: ${finalStatus.build.error_message || 'Unknown'}`, 'error');
        toast.error(`Build failed: ${finalStatus.build.error_message || 'Unknown error'}`);
      } else if (finalStatus.build.status === 'failed_resource_limit') {
        addConsole('Workspace quota exceeded.', 'error');
        toast.error('Agent workspace is full.');
      } else if (finalStatus.build.status === 'cancelled') {
        addConsole('Build cancelled.', 'info');
      }

      setBuildHistory(prev => {
        const next = [{ id: buildId!, prompt: prompt.trim().slice(0, 60), status: finalStatus.build.status, time: new Date().toLocaleTimeString('en-US', { hour12: false }), ownerUserId: profile.id }, ...prev].slice(0, 20);
        localStorage.setItem('build_history', JSON.stringify(next));
        return next;
      });
    } catch (e: any) {
      if (e.message === '__429__') {
        setHas429(true);
        addConsole('Rate limited — active build in progress.', 'error');
        toast.warning('Active build in progress, waiting…');
        if (buildId) {
          try {
            const finalStatus = await waitForBuild(profile.id, buildId, s => setBuildStatus(s));
            setBuildStatus(finalStatus);
            if (finalStatus.build.status === 'completed') {
              const arts = await getBuildArtifacts(profile.id, buildId);
              setArtifacts(arts.artifacts || []);
              await loadAllArtifactContents(arts.artifacts || [], buildId);
              toast.success('Build completed! 🎉');
            }
          } catch { /* polling failed */ }
        }
      } else {
        addConsole(`Error: ${e.message}`, 'error');
        toast.error(e.message || 'Build error');
      }
    } finally {
      setIsBuilding(false);
      setActiveBuildId(null);
      setHas429(false);
    }
  };

  const handlePublish = async () => {
    if (!buildStatus?.build?.id || !profile?.id) return;
    setPublishing(true);
    try {
      const res = await publishBuild(profile.id, buildStatus.build.id, publishTitle, publishDesc, publishCategory) as any;
      toast.success(`"${publishTitle}" published!`);
      setPublishOpen(false);
      addConsole(`Published: ${publishTitle}`, 'success');
      loadStore();
    } catch (e: any) { toast.error(e.message); }
    finally { setPublishing(false); }
  };

  const handleCopyCode = () => {
    const content = fileContents[selectedFile];
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportBundle = () => {
    if (Object.keys(fileContents).length === 0) { toast.error('No files to export'); return; }
    // Create a combined text bundle
    let bundle = `// Smart Contract Bundle — Generated by Avalove Studio\n// ${new Date().toISOString()}\n// ⚠️ AI-generated code — review before mainnet deployment\n\n`;
    for (const [path, content] of Object.entries(fileContents)) {
      bundle += `${'='.repeat(60)}\n// FILE: ${path}\n${'='.repeat(60)}\n\n${content}\n\n`;
    }
    const blob = new Blob([bundle], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avalove-contract-bundle-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addConsole('Bundle exported.', 'success');
    toast.success('Bundle exported!');
  };

  if (isAdmin === null) return <LoadingScreen />;
  if (!isAdmin) return <Navigate to="/" />;

  const currentStatus = buildStatus?.build?.status;
  const statusConfig = currentStatus ? STATUS_CONFIG[currentStatus] : null;
  const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);
  const fileTree = buildFileTree(artifacts);
  const currentFileContent = fileContents[selectedFile] || '';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-200 flex flex-col">
      {/* ═══ TOP ACTION BAR ═══ */}
      <div className="h-12 bg-[#111118] border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-tight">Avalove Smart Contract Studio</span>
          </div>
          <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 text-[10px]">ADMIN</Badge>
          {statusConfig && (
            <Badge className={`${statusConfig.color} border text-[10px]`}>
              {statusConfig.icon}
              <span className="ml-1">{statusConfig.label}</span>
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="text-xs text-zinc-400 h-7" onClick={() => handleBuild()} disabled={isBuilding || !prompt.trim()}>
            <Play className="w-3.5 h-3.5 mr-1" /> Generate
          </Button>
          <Button size="sm" variant="ghost" className="text-xs text-zinc-400 h-7" disabled={artifacts.length === 0}>
            <Zap className="w-3.5 h-3.5 mr-1" /> Compile
          </Button>
          <Button size="sm" variant="ghost" className="text-xs text-zinc-400 h-7" disabled={!auditFindings.length} onClick={() => {
            const auditArt = artifacts.find(a => a.entry_relative_path.includes('audit'));
            if (auditArt) loadFileContent(auditArt.entry_relative_path);
          }}>
            <Shield className="w-3.5 h-3.5 mr-1" /> Audit
          </Button>
          <Button size="sm" variant="ghost" className="text-xs text-zinc-400 h-7" disabled={artifacts.length === 0}>
            <Wrench className="w-3.5 h-3.5 mr-1" /> Fix
          </Button>
          <Button size="sm" variant="ghost" className="text-xs text-zinc-400 h-7" onClick={handleExportBundle} disabled={Object.keys(fileContents).length === 0}>
            <Package className="w-3.5 h-3.5 mr-1" /> Export
          </Button>
          {currentStatus === 'completed' && (
            <Button size="sm" variant="ghost" className="text-xs text-emerald-400 h-7" onClick={() => { setPublishTitle(''); setPublishDesc(''); setPublishOpen(true); }}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Publish
            </Button>
          )}
          <div className="w-px h-5 bg-zinc-700 mx-1" />
          <Badge variant="outline" className={`text-[9px] ${apiBase ? 'text-green-400 border-green-500/30' : 'text-zinc-600 border-zinc-700'}`}>
            {apiBase ? <><Wifi className="w-2.5 h-2.5 mr-1" /> Live</> : <><WifiOff className="w-2.5 h-2.5 mr-1" /> Offline</>}
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowSettings(true); loadWorkspace(); }}>
            <Settings2 className="w-3.5 h-3.5 text-zinc-500" />
          </Button>
        </div>
      </div>

      {/* ═══ AGENT CHAT BAR ═══ */}
      <div className={`bg-[#0d0d14] border-b border-zinc-800 shrink-0 transition-all ${chatExpanded ? 'max-h-80' : 'max-h-12'}`}>
        {/* Chat header + input */}
        <div className="h-12 flex items-center gap-2 px-4">
          <button onClick={() => setChatExpanded(!chatExpanded)} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Agent Chat</span>
            {selectedAgent && <span className="text-[10px] text-zinc-600">@{selectedAgent.agent_handle}</span>}
            {chatExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
          <div className="flex-1 flex items-center gap-2">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={selectedAgent ? `Ask ${selectedAgent.agent_name} about your contract…` : 'Select an agent to start chatting…'}
              className="flex-1 bg-zinc-900/50 border-zinc-700 text-white text-xs h-8 placeholder:text-zinc-600"
              disabled={chatLoading || !selectedAgentId}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
            />
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}>
              {chatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> : <Send className="w-3.5 h-3.5 text-emerald-400" />}
            </Button>
          </div>
          {chatMessages.length > 0 && (
            <button onClick={() => setChatMessages([])} className="text-[9px] text-zinc-700 hover:text-zinc-400">Clear</button>
          )}
        </div>
        {/* Chat messages */}
        {chatExpanded && chatMessages.length > 0 && (
          <div ref={chatScrollRef} className="max-h-[232px] overflow-y-auto px-4 pb-3 space-y-2">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <Bot className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />}
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                  msg.role === 'user'
                    ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/20'
                    : 'bg-zinc-800/50 text-zinc-300 border border-zinc-700'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none [&_pre]:bg-zinc-900 [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-[10px] [&_code]:text-emerald-300 [&_p]:m-0 [&_p]:mb-1.5 [&_ul]:m-0 [&_ol]:m-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
                {msg.role === 'user' && <User className="w-4 h-4 text-zinc-500 mt-1 shrink-0" />}
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-2">
                <Bot className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                <div className="bg-zinc-800/50 rounded-lg px-3 py-2 border border-zinc-700">
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ MAIN IDE LAYOUT ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: File Explorer ─── */}
        <div className="w-56 bg-[#0d0d14] border-r border-zinc-800 flex flex-col shrink-0">
          <div className="p-2 border-b border-zinc-800">
            <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">Explorer</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="py-1">
              {fileTree.length > 0 ? (
                fileTree.map(node => (
                  <FileTreeItem
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedFile={selectedFile}
                    onSelect={loadFileContent}
                  />
                ))
              ) : (
                <div className="px-3 py-8 text-center">
                  <FileCode2 className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
                  <p className="text-[10px] text-zinc-600">Generate a contract to see files here</p>
                </div>
              )}
            </div>
          </ScrollArea>
          {/* Build history */}
          {buildHistory.length > 0 && (
            <div className="border-t border-zinc-800">
              <div className="p-2">
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">History</span>
              </div>
              <ScrollArea className="max-h-36">
                {buildHistory.slice(0, 8).map(h => {
                  const sc = STATUS_CONFIG[h.status];
                  return (
                    <div key={h.id} className="px-2 py-1 flex items-center gap-1.5 text-[10px] text-zinc-500 hover:bg-zinc-800/30 cursor-pointer"
                      onClick={async () => {
                        if (h.status === 'completed' && profile?.id) {
                          try {
                            const arts = await getBuildArtifacts(h.ownerUserId || profile.id, h.id);
                            setArtifacts(arts.artifacts || []);
                            setBuildStatus({ request_id: '', build: { id: h.id, status: 'completed' }, artifacts_count: arts.artifacts?.length || 0 });
                            await loadAllArtifactContents(arts.artifacts || [], h.id);
                            addConsole(`Loaded build ${h.id.slice(0, 8)}…`, 'info');
                          } catch (e: any) { addConsole(`Failed: ${e.message}`, 'error'); }
                        }
                      }}
                    >
                      {sc?.icon}
                      <span className="truncate flex-1">{h.prompt}</span>
                      <span className="text-zinc-700 shrink-0">{h.time}</span>
                    </div>
                  );
                })}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* ─── CENTER: Editor ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs row */}
          {selectedFile && (
            <div className="h-8 bg-[#111118] border-b border-zinc-800 flex items-center px-2 gap-1">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded text-[11px] text-zinc-300">
                {getFileIcon(selectedFile.split('/').pop() || '')}
                <span>{selectedFile.split('/').pop()}</span>
              </div>
              <div className="flex-1" />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyCode}>
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-zinc-500" />}
              </Button>
            </div>
          )}
          {/* Code display */}
          <div className="flex-1 overflow-hidden">
            {!selectedFile && !isBuilding ? (
              <div className="h-full flex flex-col items-center justify-center p-8">
                <FileCode2 className="w-16 h-16 text-zinc-800 mb-4" />
                <h2 className="text-lg font-semibold text-zinc-500 mb-2">Avalove Smart Contract Studio</h2>
                <p className="text-xs text-zinc-600 mb-6 text-center max-w-md">
                  Generate production-ready Solidity contracts with AI. Describe your contract below or pick a template.
                </p>
                {/* Prompt area */}
                <div className="w-full max-w-xl space-y-3">
                  {/* Agent selector */}
                  <div className="flex items-center gap-2">
                    <Label className="text-zinc-500 text-xs shrink-0">Agent:</Label>
                    {agents.length > 0 ? (
                      <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                        <SelectTrigger className="w-[240px] bg-zinc-900 border-zinc-700 text-white h-8 text-xs">
                          <SelectValue placeholder="Select agent…" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map(a => (
                            <SelectItem key={a.agent_id} value={a.agent_id}>
                              <span className="font-medium">{a.agent_name}</span>
                              <span className="text-zinc-500 ml-1.5">@{a.agent_handle}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-zinc-600">No agents found.</span>
                    )}
                  </div>
                  <Textarea
                    ref={promptRef}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Describe your smart contract… e.g. 'ERC20 token with max wallet limit, transfer tax, and pausable transfers'"
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 min-h-[100px] resize-none font-mono text-sm"
                    disabled={isBuilding}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleBuild(); }}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleBuild}
                      disabled={isBuilding || !prompt.trim() || !selectedAgentId || has429 || !!activeBuildId}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      {isBuilding ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
                      Generate Contract
                    </Button>
                    <span className="text-[10px] text-zinc-600">⌘+Enter</span>
                  </div>
                  {/* Templates */}
                  <div className="space-y-1 pt-2">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Templates</span>
                    <div className="flex flex-wrap gap-1.5">
                      {CONTRACT_TEMPLATES.map(t => (
                        <button
                          key={t.label}
                          onClick={() => setPrompt(t.prompt)}
                          className="px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700 text-[11px] text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedFile && !loadingFile ? (
              <ScrollArea className="h-full">
                <pre className="p-4 text-xs font-mono leading-relaxed text-zinc-300 whitespace-pre-wrap">
                  {currentFileContent.split('\n').map((line, i) => (
                    <div key={i} className="flex hover:bg-zinc-800/30">
                      <span className="w-10 shrink-0 text-right pr-3 text-zinc-600 select-none">{i + 1}</span>
                      <span>{line || ' '}</span>
                    </div>
                  ))}
                </pre>
              </ScrollArea>
            ) : loadingFile ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              </div>
            ) : isBuilding ? (
              <div className="h-full flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-4" />
                <p className="text-sm text-zinc-500">Generating smart contract package…</p>
                <p className="text-[10px] text-zinc-600 mt-1">This may take up to 2 minutes</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* ─── RIGHT: Inspector ─── */}
        <div className="w-72 bg-[#0d0d14] border-l border-zinc-800 flex flex-col shrink-0">
          <Tabs defaultValue="audit" className="flex-1 flex flex-col">
            <TabsList className="bg-transparent border-b border-zinc-800 rounded-none h-8 p-0">
              <TabsTrigger value="audit" className="text-[10px] rounded-none data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 data-[state=active]:border-b-2 data-[state=active]:border-emerald-400 h-8">
                <Shield className="w-3 h-3 mr-1" /> Audit
              </TabsTrigger>
              <TabsTrigger value="compile" className="text-[10px] rounded-none data-[state=active]:bg-transparent data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-400 h-8">
                <Zap className="w-3 h-3 mr-1" /> Compile
              </TabsTrigger>
              <TabsTrigger value="store" className="text-[10px] rounded-none data-[state=active]:bg-transparent data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400 h-8" onClick={loadStore}>
                <Store className="w-3 h-3 mr-1" /> Store
              </TabsTrigger>
            </TabsList>

            {/* Audit panel */}
            <TabsContent value="audit" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-2">
                  {auditFindings.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-zinc-500">{auditFindings.length} findings</span>
                        <div className="flex gap-1">
                          {['critical', 'high', 'medium', 'low', 'info'].map(sev => {
                            const count = auditFindings.filter(f => f.severity === sev).length;
                            if (!count) return null;
                            const cfg = SEVERITY_CONFIG[sev];
                            return (
                              <Badge key={sev} className={`${cfg.color} border text-[9px] px-1.5`}>
                                {count} {sev}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                      {auditFindings.map((f, i) => {
                        const cfg = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.info;
                        return (
                          <div key={i} className="p-2.5 rounded bg-zinc-900/50 border border-zinc-800">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge className={`${cfg.color} border text-[9px] px-1.5`}>
                                {cfg.icon}
                                <span className="ml-1">{f.severity.toUpperCase()}</span>
                              </Badge>
                            </div>
                            <div className="text-xs font-medium text-zinc-300 mb-1">{f.title}</div>
                            <div className="text-[10px] text-zinc-500 line-clamp-3">{f.description}</div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <Shield className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
                      <p className="text-[10px] text-zinc-600">
                        {artifacts.length > 0 ? 'No audit report found in artifacts' : 'Generate a contract to see audit findings'}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Compile panel */}
            <TabsContent value="compile" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <div className="p-3">
                  {compileOutput ? (
                    <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap">{compileOutput}</pre>
                  ) : (
                    <div className="text-center py-12">
                      <Zap className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
                      <p className="text-[10px] text-zinc-600">Select a .sol file to see compile info</p>
                    </div>
                  )}
                  {/* Artifacts list */}
                  {artifacts.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Artifacts ({artifacts.length})</span>
                      {artifacts.map(art => (
                        <div key={art.id} className="p-2 rounded bg-zinc-900/50 border border-zinc-800 text-[10px]">
                          <div className="text-zinc-300 font-medium">{art.title}</div>
                          <div className="text-zinc-600">{art.artifact_type} • v{art.version}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Store panel */}
            <TabsContent value="store" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-2">
                  <div className="flex gap-1.5">
                    <Input value={storeSearch} onChange={e => setStoreSearch(e.target.value)} placeholder="Search…"
                      className="bg-zinc-900 border-zinc-700 text-white text-xs h-7" onKeyDown={e => e.key === 'Enter' && loadStore()} />
                    <Button size="sm" variant="outline" className="h-7 border-zinc-700 text-zinc-400 text-[10px]" onClick={loadStore}>Go</Button>
                  </div>
                  {storeLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-zinc-500" /></div>
                  ) : storeApps.length === 0 ? (
                    <p className="text-[10px] text-zinc-600 text-center py-8">No published contracts yet.</p>
                  ) : (
                    storeApps.map(app => (
                      <div key={app.app_id} className="p-2 rounded bg-zinc-900/50 border border-zinc-800 hover:border-emerald-500/30 cursor-pointer transition-colors"
                        onClick={() => setStorePreviewApp(app)}>
                        <div className="text-xs font-medium text-zinc-300">{app.title}</div>
                        <div className="text-[10px] text-zinc-600">{app.category}</div>
                        <div className="flex gap-2 mt-1 text-[9px] text-zinc-600">
                          <span><Heart className="w-2.5 h-2.5 inline mr-0.5" />{app.like_count || 0}</span>
                          <span><Download className="w-2.5 h-2.5 inline mr-0.5" />{app.install_count || 0}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ═══ BOTTOM: Console ═══ */}
      <div className="h-32 bg-[#0a0a10] border-t border-zinc-800 flex flex-col shrink-0">
        <div className="flex items-center px-3 h-6 border-b border-zinc-800/50">
          <Terminal className="w-3 h-3 text-zinc-600 mr-1.5" />
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Console</span>
          <div className="flex-1" />
          <button onClick={() => setConsoleLines([])} className="text-[9px] text-zinc-700 hover:text-zinc-400">Clear</button>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-3 py-1 font-mono text-[10px]">
            {consoleLines.length === 0 ? (
              <div className="text-zinc-700 py-2">Ready. Describe a contract to begin.</div>
            ) : (
              consoleLines.map((line, i) => (
                <div key={i} className={`py-0.5 ${line.type === 'error' ? 'text-red-400' : line.type === 'success' ? 'text-green-400' : 'text-zinc-500'}`}>
                  <span className="text-zinc-700 mr-2">[{line.time}]</span>
                  {line.msg}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ═══ DIALOGS ═══ */}

      {/* Settings */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">Connection Settings</DialogTitle>
            <DialogDescription className="text-zinc-500">Configure your agent backend connection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded bg-zinc-800/50 border border-zinc-700">
              <div>
                <div className="text-sm text-white font-medium">Use Default Tunnel</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Connect via the default Avalove tunnel</div>
              </div>
              <Switch checked={useDefaultTunnel} onCheckedChange={setUseDefaultTunnel} />
            </div>
            {useDefaultTunnel ? (
              <div className="p-3 rounded bg-green-500/5 border border-green-500/20">
                <div className="text-xs text-green-400 font-medium mb-1">Default Tunnel Active</div>
                <div className="text-[10px] text-zinc-500 font-mono break-all">{DEFAULT_TUNNEL_URL}</div>
              </div>
            ) : (
              <div>
                <Label className="text-zinc-400 text-xs">Custom API Base URL</Label>
                <Input value={customApiBase} onChange={e => setCustomApiBase(e.target.value.replace(/\/$/, ''))}
                  placeholder="https://your-domain.ngrok-free.dev" className="bg-zinc-800 border-zinc-700 text-white mt-1" />
              </div>
            )}
            <div>
              <Label className="text-zinc-400 text-xs">Active Agent</Label>
              {agents.length > 0 ? (
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue placeholder="Select agent…" /></SelectTrigger>
                  <SelectContent>
                    {agents.map(a => <SelectItem key={a.agent_id} value={a.agent_id}>{a.agent_name} (@{a.agent_handle})</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <p className="text-xs text-zinc-600 mt-1">No agents found.</p>}
            </div>
            {workspace && (
              <div className="p-3 rounded bg-zinc-800/50 border border-zinc-700">
                <div className="text-xs text-zinc-400 mb-1">Workspace Usage</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (workspace.used_bytes / workspace.quota_bytes) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-zinc-500">{(workspace.used_bytes / 1024 / 1024).toFixed(1)}MB / {(workspace.quota_bytes / 1024 / 1024 / 1024).toFixed(1)}GB</span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">Publish Contract Template</DialogTitle>
            <DialogDescription className="text-zinc-500">Make this contract package publicly available.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-zinc-400 text-xs">Title</Label>
              <Input value={publishTitle} onChange={e => setPublishTitle(e.target.value)} placeholder="ERC20 Token with Tax"
                className="bg-zinc-800 border-zinc-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs">Description</Label>
              <Textarea value={publishDesc} onChange={e => setPublishDesc(e.target.value)} placeholder="A production-ready ERC20 with…"
                className="bg-zinc-800 border-zinc-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-zinc-400 text-xs">Category</Label>
              <Select value={publishCategory} onValueChange={setPublishCategory}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="smart_contract">Smart Contract</SelectItem>
                  <SelectItem value="token">Token</SelectItem>
                  <SelectItem value="nft">NFT</SelectItem>
                  <SelectItem value="defi">DeFi</SelectItem>
                  <SelectItem value="tool">Tool</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
              <p className="text-[10px] text-amber-400">⚠️ AI-generated code — always review and audit before mainnet deployment.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)} className="text-zinc-400">Cancel</Button>
            <Button onClick={handlePublish} disabled={publishing || !publishTitle.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store preview */}
      <Dialog open={!!storePreviewApp} onOpenChange={() => setStorePreviewApp(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">{storePreviewApp?.title}</DialogTitle>
            <DialogDescription className="text-zinc-500">{storePreviewApp?.description}</DialogDescription>
          </DialogHeader>
          {storePreviewApp && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => {
                likeApp(storePreviewApp.app_id).then(() => toast.success('Liked!')).catch(() => toast.error('Error'));
              }}>
                <Heart className="w-3 h-3 mr-1" /> Like
              </Button>
              <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => {
                installApp(storePreviewApp.app_id).then(() => toast.success('Installed!')).catch(() => toast.error('Error'));
              }}>
                <Download className="w-3 h-3 mr-1" /> Install
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BuildApp;
