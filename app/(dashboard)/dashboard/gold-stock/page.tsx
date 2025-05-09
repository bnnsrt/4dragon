'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldAlert, Package, Loader2, Plus, Scissors, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { toast } from 'sonner';
import { useTheme } from '@/lib/theme-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface GoldAsset {
  goldType: string;
  amount: string;
  purchasePrice: string;
}

interface UserWithGold {
  id: number;
  name: string | null;
  email: string;
  goldAmount: string;
}

const BAHT_TO_GRAM = 15.2; // 1 baht = 15.2 grams for 96.5% gold

const calculateGrams = (bathAmount: number) => {
  return (bathAmount * BAHT_TO_GRAM).toFixed(2);
};

const calculateBaht = (gramAmount: number) => {
  return (gramAmount / BAHT_TO_GRAM).toFixed(4);
};

export default function GoldStockPage() {
  const { user } = useUser();
  const { theme } = useTheme();
  const [goldAssets, setGoldAssets] = useState<GoldAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExchangeDialogOpen, setIsExchangeDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    goldType: 'ทองสมาคม 96.5%',
    grams: '',
    purchasePrice: '',
  });
  const [usersWithGold, setUsersWithGold] = useState<UserWithGold[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [exchangeAmount, setExchangeAmount] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchGoldAssets();
  }, []);

  if (!user) {
    redirect('/sign-in');
  }

  if (user.role !== 'admin') {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="h-12 w-12 text-orange-500 mb-4" />
            <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Access Denied</h2>
            <p className={`text-center max-w-md ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Only administrators have access to gold stock management.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  async function fetchGoldAssets() {
    try {
      const response = await fetch('/api/gold-assets');
      if (response.ok) {
        const data = await response.json();
        // Filter for admin's 96.5% gold assets only
        const adminGoldAssets = data.filter((asset: GoldAsset) => 
          asset.goldType === 'ทองสมาคม 96.5%'
        );
        setGoldAssets(adminGoldAssets);
      }
    } catch (error) {
      console.error('Error fetching gold assets:', error);
      toast.error('Failed to fetch gold stock data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsersWithGold() {
    setLoadingUsers(true);
    try {
      const response = await fetch('/api/admin/savings-summary');
      if (response.ok) {
        const data = await response.json();
        // Map user summaries to the format we need
        const users = data.userSummaries.map((summary: any) => ({
          id: summary.userId,
          name: summary.userName || summary.userEmail,
          email: summary.userEmail,
          goldAmount: summary.totalAmount
        }));
        setUsersWithGold(users);
      }
    } catch (error) {
      console.error('Error fetching users with gold:', error);
      toast.error('Failed to fetch users with gold');
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Convert grams to baht before sending to API
      const bathAmount = calculateBaht(Number(formData.grams));

      const response = await fetch('/api/management/gold-stock/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goldType: formData.goldType,
          amount: bathAmount,
          purchasePrice: formData.purchasePrice,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add gold stock');
      }

      toast.success('Gold stock added successfully');
      setIsDialogOpen(false);
      setFormData({
        goldType: 'ทองสมาคม 96.5%',
        grams: '',
        purchasePrice: '',
      });
      fetchGoldAssets();
    } catch (error) {
      console.error('Error adding gold stock:', error);
      toast.error('Failed to add gold stock');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleExchangeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Convert grams to baht before sending to API
      const bathAmount = calculateBaht(Number(exchangeAmount));
      
      const response = await fetch('/api/management/gold-exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUserId,
          amount: bathAmount,
          goldType: 'ทองสมาคม 96.5%'
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to exchange gold');
      }

      toast.success('Gold exchanged successfully');
      setIsExchangeDialogOpen(false);
      setSelectedUserId('');
      setExchangeAmount('');
      fetchGoldAssets();
    } catch (error) {
      console.error('Error exchanging gold:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to exchange gold');
    } finally {
      setIsProcessing(false);
    }
  }

  // Calculate totals from admin's assets only
  const totalGoldStock = goldAssets.reduce((total, asset) => total + Number(asset.amount), 0);
  const totalGoldValue = goldAssets.reduce((total, asset) => 
    total + (Number(asset.amount) * Number(asset.purchasePrice)), 0
  );
  const averagePrice = totalGoldStock > 0 ? totalGoldValue / totalGoldStock : 0;

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-lg lg:text-2xl font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          จัดการ Stock ทอง
        </h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              fetchUsersWithGold();
              setIsExchangeDialogOpen(true);
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Scissors className="mr-2 h-4 w-4" />
            ตัด Stock เเลกทองลูกค้า
          </Button>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            เพิ่ม Stock
          </Button>
        </div>
      </div>

      <Card className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-6 w-6 text-orange-500" />
            <span className={theme === 'dark' ? 'text-white' : ''}>Gold Stock Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : goldAssets.length > 0 ? (
            <div className="space-y-4">
              <div className={`p-6 border rounded-lg ${
                theme === 'dark' 
                  ? 'bg-[#1a1a1a] border-[#2A2A2A]' 
                  : 'bg-white border-gray-200'
              }`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Total Gold Stock
                    </h3>
                    <p className={`text-2xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                      {totalGoldStock.toFixed(4)} บาท
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      ({calculateGrams(totalGoldStock)} กรัม)
                    </p>
                  </div>
                  
                  <div>
                    <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Total Value
                    </h3>
                    <p className={`text-2xl font-bold mt-2 text-orange-500`}>
                      ฿{totalGoldValue.toLocaleString()}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Average Price
                    </h3>
                    <p className={`text-2xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                      ฿{averagePrice.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock History */}
              <div className="mt-6">
                <h3 className={`text-lg font-medium mb-4 ${theme === 'dark' ? 'text-white' : ''}`}>Stock History</h3>
                <div className="space-y-4">
                  {goldAssets.map((asset, index) => (
                    <div
                      key={index}
                      className={`p-4 border rounded-lg ${
                        theme === 'dark' 
                          ? 'bg-[#1a1a1a] border-[#2A2A2A]' 
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : ''}`}>
                            {asset.goldType}
                          </p>
                          <div className={`mt-1 space-y-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            <p>จำนวน: {Number(asset.amount).toFixed(4)} บาท</p>
                            <p>({calculateGrams(Number(asset.amount))} กรัม)</p>
                            <p>ราคาซื้อ: ฿{Number(asset.purchasePrice).toLocaleString()}/บาท</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : ''}`}>
                            มูลค่ารวม
                          </p>
                          <p className="text-orange-500 font-bold">
                            ฿{(Number(asset.amount) * Number(asset.purchasePrice)).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              No gold stock data available
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : ''}>
              เพิ่ม Stock ทอง
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="goldType" className={theme === 'dark' ? 'text-white' : ''}>ประเภททอง</Label>
              <Input
                id="goldType"
                value={formData.goldType}
                disabled
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
              />
            </div>

            <div>
              <Label htmlFor="grams" className={theme === 'dark' ? 'text-white' : ''}>จำนวน (กรัม)</Label>
              <Input
                id="grams"
                type="number"
                step="0.01"
                value={formData.grams}
                onChange={(e) => setFormData(prev => ({ ...prev, grams: e.target.value }))}
                placeholder="ระบุจำนวนกรัม"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
              />
              {formData.grams && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {calculateBaht(Number(formData.grams))} บาท
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="purchasePrice" className={theme === 'dark' ? 'text-white' : ''}>ราคาต่อหน่วย (บาท)</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                value={formData.purchasePrice}
                onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                placeholder="ระบุราคาต่อหน่วย"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                'บันทึก Stock'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isExchangeDialogOpen} onOpenChange={setIsExchangeDialogOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : ''}>
              ตัด Stock เเลกทองลูกค้า
            </DialogTitle>
          </DialogHeader>
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <form onSubmit={handleExchangeSubmit} className="space-y-4">
              <div>
                <Label htmlFor="userId" className={theme === 'dark' ? 'text-white' : ''}>เลือกลูกค้า</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}>
                    <SelectValue placeholder="เลือกลูกค้า" />
                  </SelectTrigger>
                  <SelectContent className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A]' : ''}>
                    {usersWithGold.length > 0 ? (
                      usersWithGold.map((user) => (
                        <SelectItem 
                          key={user.id} 
                          value={user.id.toString()}
                          className={theme === 'dark' ? 'text-white focus:bg-[#252525]' : ''}
                        >
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-2" />
                            <span>{user.name} - {Number(user.goldAmount).toFixed(4)} บาท</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>ไม่มีลูกค้าที่มีทอง</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedUserId && (
                <div>
                  <Label htmlFor="exchangeAmount" className={theme === 'dark' ? 'text-white' : ''}>จำนวนทอง (กรัม)</Label>
                  <Input
                    id="exchangeAmount"
                    type="number"
                    step="0.01"
                    value={exchangeAmount}
                    onChange={(e) => setExchangeAmount(e.target.value)}
                    placeholder="ระบุจำนวนกรัม"
                    className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                    required
                  />
                  {exchangeAmount && (
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {calculateBaht(Number(exchangeAmount))} บาท
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                disabled={!selectedUserId || !exchangeAmount || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังดำเนินการ...
                  </>
                ) : (
                  'ยืนยันการแลกทอง'
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}