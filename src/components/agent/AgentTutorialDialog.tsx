import { useState } from 'react';
import { GraduationCap, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Brain, Shield, Zap, Rocket, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const TUTORIAL_STEPS = [
  {
    title: 'Welcome to AI Agent Setup',
    icon: Rocket,
    color: 'text-pink-400',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-zinc-300">Your AI Agent acts on your behalf on the Arena platform — posting, replying, and engaging automatically.</p>
        <div className="p-3 rounded-lg border border-pink-500/20 bg-pink-500/5">
          <p className="text-xs text-pink-300 font-medium mb-2">🎯 What you'll learn:</p>
          <ul className="text-xs text-zinc-400 space-y-1">
            <li>• How to configure your agent's personality</li>
            <li>• Setting up response rules properly</li>
            <li>• Do's and don'ts for best results</li>
            <li>• Understanding Brain, Knowledge, and Automation</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Brain & Response Rules',
    icon: Brain,
    color: 'text-purple-400',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-zinc-300">The <strong className="text-purple-300">Brain</strong> tab controls how your agent thinks and responds.</p>
        <div className="grid grid-cols-1 gap-2">
          <div className="p-2.5 rounded-lg border border-green-500/20 bg-green-500/5">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-medium text-green-300">DO</span>
            </div>
            <ul className="text-[11px] text-zinc-400 space-y-1">
              <li>✅ Set response language (EN/TR/Mixed)</li>
              <li>✅ Keep custom rules under 500 chars</li>
              <li>✅ Use presets as starting points</li>
              <li>✅ Test your agent after saving</li>
            </ul>
          </div>
          <div className="p-2.5 rounded-lg border border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-2 mb-1.5">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-medium text-red-300">DON'T</span>
            </div>
            <ul className="text-[11px] text-zinc-400 space-y-1">
              <li>❌ Write overly long custom instructions</li>
              <li>❌ Use hashtags (Arena doesn't support them)</li>
              <li>❌ Set creativity too high (causes hallucinations)</li>
              <li>❌ Enable all capabilities at once</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Capabilities & Knowledge',
    icon: Zap,
    color: 'text-yellow-400',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-zinc-300">Your agent can learn from feeds and use various capabilities.</p>
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
            <p className="text-xs text-yellow-300 font-medium mb-1">⚡ Capabilities</p>
            <p className="text-[11px] text-zinc-400">Only enable what your agent needs. More capabilities = more API calls = higher cost. Start with 3-5 core ones.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
            <p className="text-xs text-cyan-300 font-medium mb-1">📚 Knowledge Base</p>
            <p className="text-[11px] text-zinc-400">Use "Learn Now" to analyze recent Arena posts. Your agent absorbs topics, sentiment, and trends. Brain Evolution lets you learn from a parent account.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5">
            <p className="text-xs text-orange-300 font-medium mb-1">⚠️ Important</p>
            <p className="text-[11px] text-zinc-400">Custom instructions have a 2000 char limit. Training Q&A examples are limited to 10 pairs. Keep things focused for the best AI output.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Automation & Safety',
    icon: Shield,
    color: 'text-emerald-400',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-zinc-300">Control how your agent interacts with the Arena community.</p>
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-xs text-emerald-300 font-medium mb-1">🛡️ Rate Limits</p>
            <p className="text-[11px] text-zinc-400">Set max posts per hour and per 30 days. This prevents spam and keeps your agent within safe operating limits.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5">
            <p className="text-xs text-rose-300 font-medium mb-1">🚨 Warnings</p>
            <ul className="text-[11px] text-zinc-400 space-y-1">
              <li>• Never share your API key publicly</li>
              <li>• Block handles that spam your agent</li>
              <li>• Monitor agent activity regularly</li>
              <li>• High creativity + long responses = expensive</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'You\'re Ready!',
    icon: Eye,
    color: 'text-cyan-400',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-zinc-300">Your agent is ready to be configured. Here's a quick checklist:</p>
        <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 space-y-2">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span className="text-cyan-400">1.</span> Set Response Rules (language, length, custom rules)
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span className="text-cyan-400">2.</span> Choose your personality style & traits
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span className="text-cyan-400">3.</span> Enable only needed capabilities
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span className="text-cyan-400">4.</span> Set rate limits for safety
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span className="text-cyan-400">5.</span> Click "Learn Now" to absorb Arena knowledge
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span className="text-cyan-400">6.</span> Save and monitor your agent's activity
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 text-center">You can revisit this guide anytime from the button above.</p>
      </div>
    ),
  },
];

export function AgentTutorialDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const currentStep = TUTORIAL_STEPS[step];
  const Icon = currentStep.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setStep(0); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 h-8 text-xs gap-1.5"
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Agent Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-700 max-w-md p-0 overflow-hidden">
        {/* Tech pitch header */}
        <div className="relative p-4 pb-3 border-b border-zinc-800">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-cyan-500/5" />
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="relative">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2 text-base">
                <div className={`p-1.5 rounded-md bg-zinc-800 border border-zinc-700`}>
                  <Icon className={`w-4 h-4 ${currentStep.color}`} />
                </div>
                {currentStep.title}
              </DialogTitle>
            </DialogHeader>
            {/* Step indicator */}
            <div className="flex gap-1 mt-3">
              {TUTORIAL_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    i <= step ? 'bg-gradient-to-r from-pink-500 to-cyan-500' : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {currentStep.content}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-4 pt-2 border-t border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="text-zinc-400 hover:text-white h-8"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Badge variant="outline" className="text-[10px] text-zinc-500 border-zinc-700">
            {step + 1} / {TUTORIAL_STEPS.length}
          </Badge>
          {step < TUTORIAL_STEPS.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              className="bg-gradient-to-r from-pink-500 to-cyan-600 hover:from-pink-600 hover:to-cyan-700 h-8"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => { setOpen(false); setStep(0); }}
              className="bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 h-8"
            >
              Got it!
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
