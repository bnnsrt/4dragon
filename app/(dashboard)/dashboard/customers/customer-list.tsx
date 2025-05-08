'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound } from 'lucide-react';

interface User {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  createdAt: Date;
  depositLimitId?: number | null;
}

interface DepositLimit {
  id: number;
  name: string;
  dailyLimit: string;
  monthlyLimit: string;
}

interface CustomerListProps {
  users: User[];
  depositLimits: DepositLimit[];
}

function formatDate(date: Date) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear() + 543; // Convert to Buddhist Era
  return `${day}/${month}/${year}`;
}

export function CustomerList({ users, depositLimits }: CustomerListProps) {
  const [userLimits, setUserLimits] = useState<{[key: number]: number}>({});
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Initialize userLimits with current values
  useEffect(() => {
    const initialLimits = users.reduce((acc, user) => {
      if (user.depositLimitId) {
        acc[user.id] = user.depositLimitId;
      }
      return acc;
    }, {} as {[key: number]: number});
    setUserLimits(initialLimits);
  }, [users]);

  const handleLimitChange = async (userId: number, limitId: string) => {
    try {
      const response = await fetch('/api/user/deposit-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          limitId: parseInt(limitId)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update deposit limit');
      }

      setUserLimits(prev => ({
        ...prev,
        [userId]: parseInt(limitId)
      }));

      toast.success('Deposit limit updated successfully');
    } catch (error) {
      console.error('Error updating deposit limit:', error);
      toast.error('Failed to update deposit limit');
    }
  };

  const handleResetPassword = (userId: number, userEmail: string) => {
    setSelectedUserId(userId);
    setSelectedUserEmail(userEmail);
    setNewPassword('');
    setIsResetPasswordOpen(true);
  };

  const handleResetPasswordSubmit = async () => {
    if (!selectedUserId || !newPassword) return;

    setIsResetting(true);
    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUserId,
          newPassword
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset password');
      }

      toast.success('Password reset successfully');
      setIsResetPasswordOpen(false);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {users.length > 0 ? (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {users.filter(user => user.role !== 'admin').map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between py-4"
            >
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage src={`/placeholder.svg?height=32&width=32`} />
                  <AvatarFallback>
                    {user.name
                      ? user.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                      : user.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.name || 'Unnamed User'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                  {user.phone && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      เบอร์ติดต่อ: {user.phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Select
                  value={userLimits[user.id]?.toString() || '1'}
                  onValueChange={(value) => handleLimitChange(user.id, value)}
                >
                  <SelectTrigger className="w-[180px] dark:bg-[#1a1a1a] dark:border-[#2A2A2A] dark:text-white">
                    <SelectValue placeholder="Select deposit limit" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#1a1a1a] dark:border-[#2A2A2A]">
                    {depositLimits.map((limit) => (
                      <SelectItem 
                        key={limit.id} 
                        value={limit.id.toString()}
                        className="dark:text-white dark:focus:bg-[#252525]"
                      >
                        {limit.name} - ฿{Number(limit.dailyLimit).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResetPassword(user.id, user.email)}
                  className="flex items-center gap-1"
                >
                  <KeyRound className="h-4 w-4" />
                  Reset Password
                </Button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Joined: {formatDate(user.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No users found</p>
        </div>
      )}

      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="dark:bg-[#151515] dark:border-[#2A2A2A]">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="dark:text-white">User</Label>
              <p className="text-sm dark:text-gray-400">{selectedUserEmail}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="dark:text-white">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="dark:bg-[#1a1a1a] dark:border-[#2A2A2A] dark:text-white"
                required
                minLength={8}
              />
            </div>
            <Button
              onClick={handleResetPasswordSubmit}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!newPassword || isResetting}
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}