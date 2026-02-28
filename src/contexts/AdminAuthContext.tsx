import { createContext, useContext, ReactNode, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';

interface AdminAuthContextType {
  isAdmin: boolean;
  isTotpVerified: boolean;
  setTotpVerified: (verified: boolean) => void;
  executeAdminAction: (action: string, data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [isTotpVerified, setTotpVerified] = useState(false);
  const { walletAddress } = useWalletAuth();

  // Execute admin action directly via Supabase (for TOTP-authenticated admins)
  const executeAdminAction = async (action: string, data: any) => {
    if (!isTotpVerified) {
      return { success: false, error: 'TOTP verification required' };
    }

    try {
      console.log('[Admin Action] Executing:', action, data);
      
      let result;
      
      switch (action) {
        case 'update_score_config': {
          if (!walletAddress) {
            return { success: false, error: 'Wallet not connected' };
          }

          const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-action', {
            body: {
              action: 'update_score_config',
              data: { points: data.points },
              walletAddress,
            },
          });

          if (fnError) {
            console.error('[Admin Action] admin-action invoke error:', fnError);
            return { success: false, error: fnError.message };
          }

          if (!fnData?.success) {
            return { success: false, error: fnData?.error || 'Failed to update score config' };
          }

          result = { data: fnData.data, error: null };
          break;
        }

        case 'create_staking_pool':
          result = await supabase
            .from('staking_pools')
            .insert({
              ...data,
              created_by: 'admin'
            });
          break;

        case 'update_staking_pool':
          result = await supabase
            .from('staking_pools')
            .update(data.updates)
            .eq('id', data.poolId);
          break;

        case 'delete_staking_pool':
          result = await supabase
            .from('staking_pools')
            .delete()
            .eq('id', data.poolId);
          break;

        case 'reorder_staking_pools':
          const { error: err1 } = await supabase
            .from('staking_pools')
            .update({ display_order: data.pool1Order })
            .eq('id', data.pool1Id);
          
          const { error: err2 } = await supabase
            .from('staking_pools')
            .update({ display_order: data.pool2Order })
            .eq('id', data.pool2Id);
          
          result = { error: err1 || err2 };
          break;

        case 'update_chat_cost': {
          if (!walletAddress) {
            return { success: false, error: 'Wallet not connected' };
          }

          const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-action', {
            body: {
              action: 'update_chat_cost',
              data: { avloCost: data.avloCost },
              walletAddress,
            },
          });

          if (fnError) {
            console.error('[Admin Action] admin-action invoke error:', fnError);
            return { success: false, error: fnError.message };
          }

          if (!fnData?.success) {
            return { success: false, error: fnData?.error || 'Failed to update chat cost' };
          }

          result = { data: fnData.data, error: null };
          break;
        }


        case 'update_reward_pool':
          result = await supabase
            .from('game_config')
            .update({
              config_value: { value: data.newPoolValue },
              updated_at: new Date().toISOString()
            })
            .eq('config_key', 'total_reward_pool');
          break;

        case 'update_reward_per_second':
          result = await supabase
            .from('game_config')
            .update({
              config_value: { value: data.rewardPerSecond },
              updated_at: new Date().toISOString()
            })
            .eq('config_key', 'reward_per_second');
          break;

        case 'update_limit_period':
          result = await supabase
            .from('game_config')
            .update({
              config_value: {
                value: data.limitPeriod,
                options: ["daily", "weekly", "monthly", "yearly"],
              },
              updated_at: new Date().toISOString()
            })
            .eq('config_key', 'limit_period');
          break;

        case 'update_bet_cost':
          // First try to update, if no rows affected, insert
          const { data: existingBetCost } = await supabase
            .from('game_config')
            .select('id')
            .eq('config_key', 'bet_cost')
            .single();

          if (existingBetCost) {
            result = await supabase
              .from('game_config')
              .update({
                config_value: data.bet_cost,
                updated_at: new Date().toISOString()
              })
              .eq('config_key', 'bet_cost');
          } else {
            result = await supabase
              .from('game_config')
              .insert({
                config_key: 'bet_cost',
                config_value: data.bet_cost,
                updated_at: new Date().toISOString()
              });
          }
          break;

        case 'update_post_costs': {
          if (!walletAddress) {
            return { success: false, error: 'Wallet not connected' };
          }

          const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-action', {
            body: {
              action: 'update_post_costs',
              data: {
                textCost: data.textCost,
                imageCost: data.imageCost,
                videoCost: data.videoCost,
                gifCost: data.gifCost,
              },
              walletAddress,
            },
          });

          if (fnError) {
            console.error('[Admin Action] admin-action invoke error:', fnError);
            return { success: false, error: fnError.message };
          }

          if (!fnData?.success) {
            return { success: false, error: fnData?.error || 'Failed to update post costs' };
          }

          result = { data: fnData.data, error: null };
          break;
        }

        default:
          return { success: false, error: 'Unknown action' };
      }

      if (result.error) {
        console.error('[Admin Action] Error:', result.error);
        return { success: false, error: result.error.message };
      }

      console.log('[Admin Action] Success:', action);
      return { success: true, data: result.data };

    } catch (error: any) {
      console.error('[Admin Action] Failed:', error);
      return { success: false, error: error.message || 'Action failed' };
    }
  };

  return (
    <AdminAuthContext.Provider value={{ 
      isAdmin: isTotpVerified, 
      isTotpVerified, 
      setTotpVerified, 
      executeAdminAction 
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};
