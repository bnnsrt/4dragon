'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldAlert, Package, Loader2, Plus, Tangent as Exchange, Pencil, Trash2, DollarSign } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { toast } from 'sonner';
import { useTheme } from '@/lib/theme-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface GoldAsset {
  id: number;
  goldType: string;
  amount: string;
  purchasePrice: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  name: string | null;
  email: string;
  totalGold?: string; // Total gold amount for the user
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
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExchangeDialogOpen, setIsExchangeDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<GoldAsset | null>(null);
  const [addFormData, setAddFormData] = useState({
    goldType: 'ทองสมาคม 96.5%',
    grams: '',
    purchasePrice: '',
  });
  const [editFormData, setEditFormData] = useState({
    goldType: 'ทองสมาคม 96.5%',
    grams: '',
    purchasePrice: '',
  });
  const [exchangeFormData, setExchangeFormData] = useState({
    customerId: '',
    goldType: 'ทองสมาคม 96.5%',
    grams: '',
  });
  const [totalUserBalance, setTotalUserBalance] = useState(0);

  useEffect(() => {
    fetchGoldAssets();
    fetchTotalUserBalance();
    if (user?.role === 'admin') {
      fetchCustomers();
    }
  }, [user]);

  if (!user) {
    redirect('/sign-in');
  }

  if (user.role !== 'admin') {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="h-12 w-12 text-orange-500 mb-4" />
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-2`}>Access Denied</h2>
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

  async function fetchTotalUserBalance() {
    try {
      const response = await fetch('/api/transactions/history');
      if (response.ok) {
        const data = await response.json();
        
        // Calculate total value of all transactions
        const total = data.reduce((sum: number, transaction: any) => {
          if (transaction.type === 'buy') {
            return sum + Number(transaction.totalPrice);
          }
          return sum;
        }, 0);
        
        setTotalUserBalance(total);
      }
    } catch (error) {
      console.error('Error fetching total user balance:', error);
    }
  }

  async function fetchCustomers() {
    try {
      // Fetch all users who have gold assets
      const response = await fetch('/api/admin/savings-summary');
      if (response.ok) {
        const data = await response.json();
        // Extract unique users from userSummaries
        const userSummaries = data.userSummaries || [];
        
        // Create a map to deduplicate users
        const userMap = new Map();
        
        userSummaries.forEach((summary: any) => {
          // Only include users who have gold (amount > 0)
          if (Number(summary.totalAmount) > 0) {
            userMap.set(summary.userId, {
              id: summary.userId,
              name: summary.userName,
              email: summary.userEmail,
              totalGold: summary.totalAmount
            });
          }
        });
        
        // Convert map to array
        const customersList = Array.from(userMap.values());
        setCustomers(customersList);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to fetch customer data');
    }
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Convert grams to baht before sending to API
      const bathAmount = calculateBaht(Number(addFormData.grams));

      const response = await fetch('/api/management/gold-stock/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goldType: addFormData.goldType,
          amount: bathAmount,
          purchasePrice: addFormData.purchasePrice,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add gold stock');
      }

      toast.success('Gold stock added successfully');
      setIsAddDialogOpen(false);
      setAddFormData({
        goldType: 'ทองสมาคม 96.5%',
        grams: '',
        purchasePrice: '',
      });
      fetchGoldAssets();
      fetchTotalUserBalance();
    } catch (error) {
      console.error('Error adding gold stock:', error);
      toast.error('Failed to add gold stock');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    
    setIsProcessing(true);

    try {
      // Convert grams to baht before sending to API
      const bathAmount = calculateBaht(Number(editFormData.grams));

      const response = await fetch(`/api/gold-assets/${selectedAsset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goldType: editFormData.goldType,
          amount: bathAmount,
          purchasePrice: editFormData.purchasePrice,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update gold stock');
      }

      toast.success('Gold stock updated successfully');
      setIsEditDialogOpen(false);
      setSelectedAsset(null);
      fetchGoldAssets();
      fetchTotalUserBalance();
    } catch (error) {
      console.error('Error updating gold stock:', error);
      toast.error('Failed to update gold stock');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDeleteAsset(assetId: number) {
    if (!confirm('Are you sure you want to delete this gold asset?')) {
      return;
    }

    try {
      const response = await fetch(`/api/gold-assets/${assetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete gold asset');
      }

      toast.success('Gold asset deleted successfully');
      fetchGoldAssets();
      fetchTotalUserBalance();
    } catch (error) {
      console.error('Error deleting gold asset:', error);
      toast.error('Failed to delete gold asset');
    }
  }

  async function handleExchangeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Convert grams to baht before sending to API
      const bathAmount = calculateBaht(Number(exchangeFormData.grams));

      const response = await fetch('/api/management/gold-stock/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: exchangeFormData.customerId,
          goldType: exchangeFormData.goldType,
          amount: bathAmount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to exchange gold');
      }

      toast.success('Gold exchanged successfully');
      setIsExchangeDialogOpen(false);
      setExchangeFormData({
        customerId: '',
        goldType: 'ทองสมาคม 96.5%',
        grams: '',
      });
      fetchGoldAssets();
      fetchCustomers();
      fetchTotalUserBalance();
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
            onClick={() => setIsExchangeDialogOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Exchange className="mr-2 h-4 w-4" />
            ตัด Stock แลกทองลูกค้า
          </Button>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            เพิ่ม Stock
          </Button>
        </div>
      </div>

      {/* Total User Balance Card */}
      <Card className={`mb-6 ${theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}`}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-orange-100'}`}>
              <DollarSign className={`h-6 w-6 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-500'}`} />
            </div>
            <div>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                เงินสดในระบบลูกค้าทั้งหมด
              </p>
              <p className="text-2xl font-bold text-orange-500">
                ฿{totalUserBalance.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  {goldAssets.map((asset) => (
                    <div
                      key={asset.id}
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
                          <div className="flex space-x-2 mt-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedAsset(asset);
                                setEditFormData({
                                  goldType: asset.goldType,
                                  grams: calculateGrams(Number(asset.amount)),
                                  purchasePrice: asset.purchasePrice,
                                });
                                setIsEditDialogOpen(true);
                              }}
                              className={theme === 'dark' ? 'border-[#2A2A2A] hover:bg-[#202020]' : ''}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteAsset(asset.id)}
                              className={`text-red-500 ${
                                theme === 'dark' 
                                  ? 'border-[#2A2A2A] hover:bg-[#202020]' 
                                  : 'hover:bg-red-50'
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Add Stock Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : ''}>
              เพิ่ม Stock ทอง
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <Label htmlFor="goldType" className={theme === 'dark' ? 'text-white' : ''}>ประเภททอง</Label>
              <Input
                id="goldType"
                value={addFormData.goldType}
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
                value={addFormData.grams}
                onChange={(e) => setAddFormData(prev => ({ ...prev, grams: e.target.value }))}
                placeholder="ระบุจำนวนกรัม"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
              />
              {addFormData.grams && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {calculateBaht(Number(addFormData.grams))} บาท
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="purchasePrice" className={theme === 'dark' ? 'text-white' : ''}>ราคาต่อหน่วย (บาท)</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                value={addFormData.purchasePrice}
                onChange={(e) => setAddFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
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

      {/* Edit Stock Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : ''}>
              แก้ไข Stock ทอง
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="editGoldType" className={theme === 'dark' ? 'text-white' : ''}>ประเภททอง</Label>
              <Input
                id="editGoldType"
                value={editFormData.goldType}
                disabled
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
              />
            </div>

            <div>
              <Label htmlFor="editGrams" className={theme === 'dark' ? 'text-white' : ''}>จำนวน (กรัม)</Label>
              <Input
                id="editGrams"
                type="number"
                step="0.01"
                value={editFormData.grams}
                onChange={(e) => setEditFormData(prev => ({ ...prev, grams: e.target.value }))}
                placeholder="ระบุจำนวนกรัม"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
              />
              {editFormData.grams && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {calculateBaht(Number(editFormData.grams))} บาท
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="editPurchasePrice" className={theme === 'dark' ? 'text-white' : ''}>ราคาต่อหน่วย (บาท)</Label>
              <Input
                id="editPurchasePrice"
                type="number"
                step="0.01"
                value={editFormData.purchasePrice}
                onChange={(e) => setEditFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
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
                'บันทึกการแก้ไข'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Exchange Gold Dialog */}
      <Dialog open={isExchangeDialogOpen} onOpenChange={setIsExchangeDialogOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : ''}>
              ตัด Stock แลกทองลูกค้า
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleExchangeSubmit} className="space-y-4">
            <div>
              <Label htmlFor="customerId" className={theme === 'dark' ? 'text-white' : ''}>เลือกลูกค้า</Label>
              <Select
                value={exchangeFormData.customerId}
                onValueChange={(value) => setExchangeFormData(prev => ({ ...prev, customerId: value }))}
              >
                <SelectTrigger className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}>
                  <SelectValue placeholder="เลือกลูกค้า" />
                </SelectTrigger>
                <SelectContent className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}>
                  {customers.map((customer) => (
                    <SelectItem 
                      key={customer.id} 
                      value={customer.id.toString()}
                      className={theme === 'dark' ? 'text-white focus:bg-[#252525]' : ''}
                    >
                      {customer.name || customer.email} - {Number(customer.totalGold).toFixed(4)} บาท ({calculateGrams(Number(customer.totalGold))} กรัม)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="goldType" className={theme === 'dark' ? 'text-white' : ''}>ประเภททอง</Label>
              <Input
                id="goldType"
                value={exchangeFormData.goldType}
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
                value={exchangeFormData.grams}
                onChange={(e) => setExchangeFormData(prev => ({ ...prev, grams: e.target.value }))}
                placeholder="ระบุจำนวนกรัม"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
              />
              {exchangeFormData.grams && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {calculateBaht(Number(exchangeFormData.grams))} บาท
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
              disabled={isProcessing || !exchangeFormData.customerId || !exchangeFormData.grams}
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
        </DialogContent>
      </Dialog>
    </section>
  );
}