'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldAlert, Package, Loader2, Plus, Tangent as Exchange, Pencil, Trash2, AlertCircle } from 'lucide-react';
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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

  useEffect(() => {
    fetchGoldAssets();
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
        const data = await response.json() as GoldAsset[];
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
              email: summary.userEmail
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

      // Since there's no direct API for updating gold assets, we'll need to:
      // 1. Delete the existing asset (or set amount to 0)
      // 2. Create a new asset with the updated values

      // First, set the existing asset amount to 0
      const deleteResponse = await fetch(`/api/gold-assets/${selectedAsset.id}`, {
        method: 'DELETE',
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to update gold stock');
      }

      // Then create a new asset with the updated values
      const addResponse = await fetch('/api/management/gold-stock/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goldType: editFormData.goldType,
          amount: bathAmount,
          purchasePrice: editFormData.purchasePrice,
        }),
      });

      if (!addResponse.ok) {
        throw new Error('Failed to update gold stock');
      }

      toast.success('Gold stock updated successfully');
      setIsEditDialogOpen(false);
      setSelectedAsset(null);
      fetchGoldAssets();
    } catch (error) {
      console.error('Error updating gold stock:', error);
      toast.error('Failed to update gold stock');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDeleteAsset() {
    if (!selectedAsset) return;
    
    setIsProcessing(true);

    try {
      const response = await fetch(`/api/gold-assets/${selectedAsset.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete gold stock');
      }

      toast.success('Gold stock deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedAsset(null);
      fetchGoldAssets();
    } catch (error) {
      console.error('Error deleting gold stock:', error);
      toast.error('Failed to delete gold stock');
    } finally {
      setIsProcessing(false);
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
                            <p>วันที่: {new Date(asset.createdAt).toLocaleDateString('th-TH')}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
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
                              className={theme === 'dark' ? 'border-[#2A2A2A] hover:bg-[#252525]' : ''}
                              onClick={() => {
                                setSelectedAsset(asset);
                                setEditFormData({
                                  goldType: asset.goldType,
                                  grams: calculateGrams(Number(asset.amount)),
                                  purchasePrice: asset.purchasePrice,
                                });
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              แก้ไข
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className={`text-red-500 ${theme === 'dark' ? 'border-[#2A2A2A] hover:bg-[#252525]' : ''}`}
                              onClick={() => {
                                setSelectedAsset(asset);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              ลบ
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : ''}>
              ยืนยันการลบ Stock ทอง
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-red-50'} flex items-start`}>
              <AlertCircle className={`h-5 w-5 mr-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-500'} mt-0.5`} />
              <div>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  คุณแน่ใจหรือไม่ที่จะลบรายการนี้?
                </p>
                {selectedAsset && (
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {selectedAsset.goldType} - {Number(selectedAsset.amount).toFixed(4)} บาท ({calculateGrams(Number(selectedAsset.amount))} กรัม)
                  </p>
                )}
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                  การดำเนินการนี้ไม่สามารถย้อนกลับได้
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                className={theme === 'dark' ? 'border-[#2A2A2A] hover:bg-[#252525] text-white' : ''}
              >
                ยกเลิก
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAsset}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  'ยืนยันการลบ'
                )}
              </Button>
            </div>
          </div>
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
                      {customer.name || customer.email}
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