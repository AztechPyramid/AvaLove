import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Shield, Zap, History, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AgentPaymentsTabProps {
  agentId: string;
  walletAddress?: string;
}

interface X402Config {
  id?: string;
  enabled: boolean;
  max_payment_per_request: number;
  daily_limit: number;
  daily_spent: number;
  auto_approve_below: number;
  allowed_chains: string[];
  allowed_tokens: string[];
}

interface X402Payment {
  id: string;
  tx_hash: string;
  amount: number;
  token: string;
  chain: string;
  recipient_address: string;
  endpoint_url: string | null;
  status: string;
  created_at: string;
}

const DEFAULT_CONFIG: X402Config = {
  enabled: false,
  max_payment_per_request: 0.10,
  daily_limit: 5.00,
  daily_spent: 0,
  auto_approve_below: 0.05,
  allowed_chains: ['avalanche'],
  allowed_tokens: ['USDC'],
};

export const AgentPaymentsTab = ({ agentId, walletAddress }: AgentPaymentsTabProps) => {
  const [config, setConfig] = useState<X402Config>(DEFAULT_CONFIG);
  const [payments, setPayments] = useState<X402Payment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfig();
    loadPayments();
  }, [agentId]);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from('agent_x402_config')
        .select('*')
        .eq('agent_id', agentId)
        .single();
      
      if (data) {
        setConfig({
          id: data.id,
          enabled: data.enabled,
          max_payment_per_request: Number(data.max_payment_per_request),
          daily_limit: Number(data.daily_limit),
          daily_spent: Number(data.daily_spent),
          auto_approve_below: Number(data.auto_approve_below),
          allowed_chains: data.allowed_chains,
          allowed_tokens: data.allowed_tokens,
        });
      }
    } catch {
      // No config yet, use defaults
    } finally {
      setIsLoading(false);
    }
  };

  const loadPayments = async () => {
    const { data } = await supabase
      .from('agent_x402_payments')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (data) setPayments(data as X402Payment[]);
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const payload = {
        agent_id: agentId,
        enabled: config.enabled,
        max_payment_per_request: config.max_payment_per_request,
        daily_limit: config.daily_limit,
        auto_approve_below: config.auto_approve_below,
        allowed_chains: config.allowed_chains,
        allowed_tokens: config.allowed_tokens,
        updated_at: new Date().toISOString(),
      };

      if (config.id) {
        await supabase
          .from('agent_x402_config')
          .update(payload)
          .eq('id', config.id);
      } else {
        const { data } = await supabase
          .from('agent_x402_config')
          .insert(payload)
          .select()
          .single();
        if (data) setConfig(prev => ({ ...prev, id: data.id }));
      }

      toast.success('x402 payment config saved!');
    } catch (err) {
      toast.error('Failed to save config');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const dailyRemaining = Math.max(0, config.daily_limit - config.daily_spent);

  return (
    <div className="space-y-6">
      {/* x402 Overview Card */}
      <Card className="bg-black border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            x402 Autonomous Payments
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Enable your agent to automatically pay for API calls using the x402 (HTTP 402) protocol.
            When an API returns 402, the agent pays with USDC and retries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-700">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-white font-medium">Enable x402 Payments</p>
                <p className="text-xs text-zinc-500">Agent will auto-pay for 402 responses within limits</p>
              </div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
            />
          </div>

          {/* Limits */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white flex items-center justify-between">
                <span>Max Per Request</span>
                <span className="text-green-400 font-mono">${config.max_payment_per_request.toFixed(2)}</span>
              </Label>
              <Slider
                value={[config.max_payment_per_request]}
                onValueChange={([v]) => setConfig(prev => ({ ...prev, max_payment_per_request: v }))}
                min={0.01}
                max={5}
                step={0.01}
                className="w-full"
              />
              <p className="text-xs text-zinc-500">Maximum USDC per single API call</p>
            </div>

            <div className="space-y-2">
              <Label className="text-white flex items-center justify-between">
                <span>Daily Limit</span>
                <span className="text-green-400 font-mono">${config.daily_limit.toFixed(2)}</span>
              </Label>
              <Slider
                value={[config.daily_limit]}
                onValueChange={([v]) => setConfig(prev => ({ ...prev, daily_limit: v }))}
                min={0.50}
                max={100}
                step={0.50}
                className="w-full"
              />
              <p className="text-xs text-zinc-500">Total USDC limit per 24 hours</p>
            </div>

            <div className="space-y-2">
              <Label className="text-white flex items-center justify-between">
                <span>Auto-Approve Below</span>
                <span className="text-yellow-400 font-mono">${config.auto_approve_below.toFixed(2)}</span>
              </Label>
              <Slider
                value={[config.auto_approve_below]}
                onValueChange={([v]) => setConfig(prev => ({ ...prev, auto_approve_below: v }))}
                min={0.001}
                max={1}
                step={0.001}
                className="w-full"
              />
              <p className="text-xs text-zinc-500">Payments below this amount are auto-approved without notification</p>
            </div>
          </div>

          {/* Daily Status */}
          <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Daily Spent</span>
              <span className="text-white font-mono">${config.daily_spent.toFixed(2)} / ${config.daily_limit.toFixed(2)}</span>
            </div>
            <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-yellow-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (config.daily_spent / config.daily_limit) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">${dailyRemaining.toFixed(2)} remaining today</p>
          </div>

          {/* Supported Chains & Tokens */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-zinc-400 text-xs mb-2 block">Chains</Label>
              <div className="flex gap-2 flex-wrap">
                {['avalanche', 'base'].map(chain => (
                  <Badge
                    key={chain}
                    variant={config.allowed_chains.includes(chain) ? 'default' : 'outline'}
                    className={`cursor-pointer ${config.allowed_chains.includes(chain) ? 'bg-green-600' : 'border-zinc-600 text-zinc-400'}`}
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        allowed_chains: prev.allowed_chains.includes(chain)
                          ? prev.allowed_chains.filter(c => c !== chain)
                          : [...prev.allowed_chains, chain],
                      }));
                    }}
                  >
                    {chain}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-zinc-400 text-xs mb-2 block">Tokens</Label>
              <div className="flex gap-2 flex-wrap">
                {['USDC', 'USDT', 'AVAX'].map(token => (
                  <Badge
                    key={token}
                    variant={config.allowed_tokens.includes(token) ? 'default' : 'outline'}
                    className={`cursor-pointer ${config.allowed_tokens.includes(token) ? 'bg-blue-600' : 'border-zinc-600 text-zinc-400'}`}
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        allowed_tokens: prev.allowed_tokens.includes(token)
                          ? prev.allowed_tokens.filter(t => t !== token)
                          : [...prev.allowed_tokens, token],
                      }));
                    }}
                  >
                    {token}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={saveConfig}
            disabled={isSaving}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
            Save Payment Config
          </Button>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className="bg-black border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <History className="w-5 h-5 text-zinc-400" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">No payments yet</p>
          ) : (
            <div className="space-y-2">
              {payments.map(payment => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-white font-mono text-sm">${Number(payment.amount).toFixed(4)}</span>
                      <Badge variant="outline" className="text-xs border-zinc-600">{payment.token}</Badge>
                      <Badge variant={payment.status === 'confirmed' ? 'default' : 'outline'} 
                             className={`text-xs ${payment.status === 'confirmed' ? 'bg-green-600' : payment.status === 'failed' ? 'bg-red-600' : 'border-yellow-500 text-yellow-400'}`}>
                        {payment.status}
                      </Badge>
                    </div>
                    {payment.endpoint_url && (
                      <p className="text-xs text-zinc-500 mt-1 truncate">{payment.endpoint_url}</p>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 shrink-0 ml-2">
                    {new Date(payment.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
