'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, DollarSign, Save, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { toast } from 'sonner';
import { useTheme } from '@/lib/theme-provider';

export default function MinimumPurchasePage() {
  const { user } = useUser();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [minimumAmount, setMinimumAmount] = useState('0');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMinimumPurchase();
  }, []);

  if (!user) {
    redirect('/sign-in');
  }

  if (user.role !== 'admin') {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className={isDark ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="h-12 w-12 text-orange-500 mb-4" />
            <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Access Denied</h2>
            <p className={`text-center max-w-md ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Only administrators have access to minimum purchase settings.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  async function fetchMinimumPurchase() {
    try {
      const response = await fetch('/api/minimum-purchase');
      if (response.ok) {
        const data = await response.json();
        setMinimumAmount(data.minimumAmount);
      }
    } catch (error) {
      console.error('Error fetching minimum purchase setting:', error);
      toast.error('Failed to fetch minimum purchase setting');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/minimum-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          minimumAmount: Number(minimumAmount)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update minimum purchase setting');
      }

      toast.success('Minimum purchase amount updated successfully');
    } catch (error) {
      console.error('Error updating minimum purchase setting:', error);
      toast.error('Failed to update minimum purchase setting');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className={`text-lg lg:text-2xl font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        กำหนดยอดขั้นต่ำ
      </h1>

      <Card className={isDark ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-6 w-6 text-orange-500" />
            <span className={isDark ? 'text-white' : ''}>Minimum Purchase Amount</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="minimumAmount" className={isDark ? 'text-white' : ''}>
                  Minimum Purchase Amount (THB)
                </Label>
                <Input
                  id="minimumAmount"
                  type="number"
                  min="0"
                  step="1"
                  value={minimumAmount}
                  onChange={(e) => setMinimumAmount(e.target.value)}
                  className={`mt-1 ${isDark ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}`}
                />
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Set the minimum amount users must purchase. Set to 0 for no minimum.
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Setting
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}