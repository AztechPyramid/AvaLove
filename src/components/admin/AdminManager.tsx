import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Shield, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

interface Admin {
  id: string;
  user_id: string;
  wallet_address: string;
  username?: string;
  avatar_url?: string;
  created_at: string;
  created_by: string;
}

export default function AdminManager() {
  const { executeAdminAction } = useAdminAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [newAdminWallet, setNewAdminWallet] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, created_at, created_by')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      if (!rolesData) {
        setAdmins([]);
        return;
      }

      const adminsWithWallets = await Promise.all(
        rolesData.map(async (role) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('wallet_address, username, avatar_url')
            .eq('id', role.user_id)
            .single();

          return {
            ...role,
            wallet_address: profile?.wallet_address || 'Unknown',
            username: profile?.username,
            avatar_url: profile?.avatar_url
          };
        })
      );

      setAdmins(adminsWithWallets);
    } catch (error) {
      console.error('Error fetching admins:', error);
      toast.error('Failed to load admins');
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminWallet.trim()) {
      toast.error('Please enter a wallet address');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(newAdminWallet.trim())) {
      toast.error('Invalid wallet address format');
      return;
    }

    setLoading(true);
    try {
      const result = await executeAdminAction('add_admin', {
        walletAddress: newAdminWallet.trim()
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to add admin');
      }

      toast.success('Admin added successfully');
      setNewAdminWallet('');
      fetchAdmins();
    } catch (error: any) {
      console.error('Error adding admin:', error);
      toast.error(error.message || 'Failed to add admin');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (walletAddress: string) => {
    setLoading(true);
    try {
      const result = await executeAdminAction('remove_admin', { walletAddress });

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove admin');
      }

      toast.success('Admin removed successfully');
      fetchAdmins();
    } catch (error: any) {
      console.error('Error removing admin:', error);
      toast.error(error.message || 'Failed to remove admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <UserPlus className="h-5 w-5 text-purple-400" />
            Add New Admin
          </CardTitle>
          <CardDescription>Add a new wallet address as admin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wallet">Wallet Address</Label>
            <Input
              id="wallet"
              placeholder="0x..."
              value={newAdminWallet}
              onChange={(e) => setNewAdminWallet(e.target.value)}
              className="bg-black border-zinc-700 text-white"
            />
          </div>
          <Button
            onClick={handleAddAdmin}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Adding...' : 'Add Admin'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Shield className="h-5 w-5 text-purple-400" />
            Current Admins
          </CardTitle>
          <CardDescription>Manage admin access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {admins.length === 0 ? (
              <p className="text-zinc-400 text-center py-4">No admins found</p>
            ) : (
              admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 bg-black rounded-lg border border-zinc-800"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="h-10 w-10 border-2 border-zinc-700">
                      <AvatarImage src={admin.avatar_url || ''} alt={admin.username || 'Admin'} />
                      <AvatarFallback className="bg-purple-600 text-white text-sm">
                        {admin.username?.slice(0, 2).toUpperCase() || 'AD'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      {admin.username && (
                        <p className="text-white font-medium text-sm">@{admin.username}</p>
                      )}
                      <p className="text-zinc-400 font-mono text-xs">
                        {admin.wallet_address.slice(0, 10)}...{admin.wallet_address.slice(-8)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAdmin(admin.wallet_address)}
                    disabled={loading}
                    className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
