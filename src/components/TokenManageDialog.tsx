import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

interface TokenManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TokenManageDialog = ({ open, onOpenChange }: TokenManageDialogProps) => {
  const { profile } = useWalletAuth();
  const [autoTipEnabled, setAutoTipEnabled] = useState(false);
  const [autoTipAmount, setAutoTipAmount] = useState(1000);
  const [totalBurned, setTotalBurned] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEligible = totalBurned >= 100000;

  useEffect(() => {
    if (open && profile) {
      fetchData();
    }
  }, [open, profile]);

  const fetchData = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Fetch total burned tokens
      const { data: burns } = await supabase
        .from('token_burns')
        .select('amount')
        .eq('user_id', profile.id);

      const total = burns?.reduce((sum, burn) => sum + burn.amount, 0) || 0;
      setTotalBurned(total);

      // Fetch current settings
      setAutoTipEnabled((profile as any).auto_tip_enabled || false);
      setAutoTipAmount((profile as any).auto_tip_amount || 1000);
    } catch (error) {
      console.error('Error fetching token manage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          auto_tip_enabled: autoTipEnabled,
          auto_tip_amount: autoTipAmount,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Token management settings saved!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Token Management</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure how your tokens are used when you like someone
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-zinc-400">Loading...</div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="text-sm text-zinc-400 mb-1">Total AVLO Burned</div>
              <div className="text-2xl font-bold text-primary">
                {totalBurned.toLocaleString()} AVLO
              </div>
              {!isEligible && (
                <div className="mt-2 text-xs text-amber-500">
                  🔒 Burn {(100000 - totalBurned).toLocaleString()} more AVLO to unlock auto-tipping
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/30 border border-zinc-700">
                <div className="flex-1">
                  <Label htmlFor="auto-tip" className="text-base font-semibold">
                    Auto-Tip on Like
                  </Label>
                  <p className="text-sm text-zinc-400 mt-1">
                    Automatically send AVLO tokens to people you like instead of burning
                  </p>
                </div>
                <Switch
                  id="auto-tip"
                  checked={autoTipEnabled}
                  onCheckedChange={setAutoTipEnabled}
                  disabled={!isEligible}
                />
              </div>

              {autoTipEnabled && isEligible && (
                <div className="space-y-2">
                  <Label htmlFor="tip-amount" className="text-sm font-medium">
                    Tip Amount per Like
                  </Label>
                  <Input
                    id="tip-amount"
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={autoTipAmount}
                    onChange={(e) => setAutoTipAmount(parseInt(e.target.value) || 1000)}
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500">
                    Minimum: 100 AVLO • Maximum: 10,000 AVLO
                  </p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-800/50">
                <p className="text-xs text-blue-200">
                  💡 <strong>How it works:</strong> When auto-tip is enabled, swiping right will send the specified amount of AVLO tokens directly to the person you liked, and they'll receive a notification. When disabled, tokens are burned as usual.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !isEligible}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
