'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, ToggleLeft, Save, Clock, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { toast } from 'sonner';
import { useTheme } from '@/lib/theme-provider';
import { Switch } from '@/components/ui/switch';

interface TradingSettings {
  isEnabled: boolean;
  startTime: string;
  endTime: string;
  weekdaysOnly: boolean;
}

export default function TradingStatusPage() {
  const { user } = useUser();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [settings, setSettings] = useState<TradingSettings>({
    isEnabled: true,
    startTime: '09:30',
    endTime: '17:00',
    weekdaysOnly: true
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/trading-status');
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Error fetching trading settings:', error);
      }
    }

    fetchSettings();
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
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>Access Denied</h2>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-center max-w-md`}>
              Only administrators have access to trading status settings. Please contact an administrator for assistance.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/trading-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to update trading settings');
      }

      setMessage({ type: 'success', text: 'Trading settings saved successfully!' });
      toast.success('Trading settings saved successfully!');
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className={`text-lg lg:text-2xl font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-6`}>
        เปิดปิดสถานะการซื้อขาย
      </h1>
      <Card className={isDark ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ToggleLeft className="h-6 w-6 text-orange-500" />
            <span className={isDark ? 'text-white' : ''}>Trading Status Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className={`text-base ${isDark ? 'text-white' : ''}`}>Trading Status</Label>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Enable or disable trading on the platform
                  </p>
                </div>
                <Switch
                  checked={settings.isEnabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, isEnabled: checked }))}
                />
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : ''}`}>Trading Hours</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime" className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className={isDark ? 'text-white' : ''}>Start Time</span>
                    </Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={settings.startTime}
                      onChange={(e) => setSettings(prev => ({ ...prev, startTime: e.target.value }))}
                      className={`mt-1 ${isDark ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}`}
                    />
                  </div>

                  <div>
                    <Label htmlFor="endTime" className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className={isDark ? 'text-white' : ''}>End Time</span>
                    </Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={settings.endTime}
                      onChange={(e) => setSettings(prev => ({ ...prev, endTime: e.target.value }))}
                      className={`mt-1 ${isDark ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <Label className={`text-base flex items-center gap-2 ${isDark ? 'text-white' : ''}`}>
                    <Calendar className="h-4 w-4 text-orange-500" />
                    <span>Weekdays Only</span>
                  </Label>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Restrict trading to weekdays (Monday to Friday)
                  </p>
                </div>
                <Switch
                  checked={settings.weekdaysOnly}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, weekdaysOnly: checked }))}
                />
              </div>
            </div>

            {message.text && (
              <p className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {message.text}
              </p>
            )}

            <Button 
              type="submit" 
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Save className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className={`mt-6 ${isDark ? 'bg-[#151515] border-[#2A2A2A]' : ''}`}>
        <CardHeader>
          <CardTitle className={isDark ? 'text-white' : ''}>Current Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`p-4 rounded-lg ${
            settings.isEnabled 
              ? 'bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-900' 
              : 'bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-900'
          }`}>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                settings.isEnabled ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <p className={`font-medium ${
                settings.isEnabled 
                  ? 'text-green-800 dark:text-green-400' 
                  : 'text-red-800 dark:text-red-400'
              }`}>
                {settings.isEnabled ? 'Trading is currently ENABLED' : 'Trading is currently DISABLED'}
              </p>
            </div>
            <p className={`mt-2 text-sm ${
              settings.isEnabled 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-red-700 dark:text-red-300'
            }`}>
              {settings.isEnabled 
                ? `Trading hours: ${settings.startTime} - ${settings.endTime}${settings.weekdaysOnly ? ', Weekdays only' : ''}`
                : 'All trading operations are currently suspended'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}