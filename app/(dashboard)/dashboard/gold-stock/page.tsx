'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldAlert, Package, Loader2, Plus, Tangent as Exchange, Pencil, Trash2, DollarSign, ArrowUpRight, ArrowDownRight, Gem, XCircle } from 'lucide-react';
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

interface Transaction {
  id: number;
  type: string;
  amount: string;
  goldType: string;
  pricePerUnit: string;
  totalPrice: string;
  createdAt: string;
  user?: {
    id: number;
    name: string | null;
    email: string;
  };
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
  const [isJewelryExchangeDialogOpen, setIsJewelryExchangeDialogOpen] = useState(false);
  const [isEditJewelryDialogOpen, setIsEditJewelryDialogOpen] = useState(false);
  const [isAddToUserDialogOpen, setIsAddToUserDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<GoldAsset | null>(null);
  const [selectedJewelryTransaction, setSelectedJewelryTransaction] = useState<Transaction | null>(null);
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
  const [jewelryExchangeFormData, setJewelryExchangeFormData] = useState({
    customerId: '',
    goldType: 'ทองสมาคม 96.5%',
    grams: '',
    jewelryName: '',
  });
  
  const [editJewelryFormData, setEditJewelryFormData] = useState({
    customerId: '',
    goldType: 'ทองสมาคม 96.5%',
    grams: '',
    jewelryName: '',
  });
  
  const [addToUserFormData, setAddToUserFormData] = useState({
    customerId: '',
    goldType: 'ทองสมาคม 96.5%',
    purchaseAmount: '',
    goldPrice: '',
  });
  const [totalUserBalance, setTotalUserBalance] = useState(0);
  const [minPurchaseAmount, setMinPurchaseAmount] = useState(0);
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);

  useEffect(() => {
    fetchGoldAssets();
    fetchTotalUserBalance();
    fetchMinPurchaseAmount();
    fetchTransactionHistory();
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
            <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-center max-w-md`}>
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

  async function fetchMinPurchaseAmount() {
    try {
      const response = await fetch('/api/trading-status');
      if (response.ok) {
        const data = await response.json();
        if (data.minPurchaseAmount) {
          setMinPurchaseAmount(Number(data.minPurchaseAmount));
        }
      }
    } catch (error) {
      console.error('Error fetching min purchase amount:', error);
    }
  }

  async function fetchTransactionHistory() {
    try {
      const response = await fetch('/api/transactions/history?includeAll=true');
      if (response.ok) {
        const data = await response.json();
        setTransactionHistory(data);
      }
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      toast.error('Failed to fetch transaction history');
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
      fetchTransactionHistory();
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
      fetchTransactionHistory();
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
      fetchTransactionHistory();
    } catch (error) {
      console.error('Error deleting gold asset:', error);
      toast.error('Failed to delete gold asset');
    }
  }
  
  async function handleCancelAsset(assetId: number) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการยกเลิกรายการนี้?')) {
      return;
    }

    try {
      const response = await fetch(`/api/gold-assets/${assetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel gold asset');
      }

      toast.success('รายการถูกยกเลิกเรียบร้อยแล้ว');
      fetchGoldAssets();
      fetchTotalUserBalance();
      fetchTransactionHistory();
    } catch (error) {
      console.error('Error canceling gold asset:', error);
      toast.error('ไม่สามารถยกเลิกรายการได้');
    }
  }
  
  async function handleDeleteJewelryTransaction(transactionId: number) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการแลกทองรูปพรรณนี้?')) {
      return;
    }

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete jewelry exchange transaction');
      }

      toast.success('รายการแลกทองรูปพรรณถูกลบเรียบร้อยแล้ว');
      fetchGoldAssets();
      fetchTotalUserBalance();
      fetchTransactionHistory();
    } catch (error) {
      console.error('Error deleting jewelry transaction:', error);
      toast.error('ไม่สามารถลบรายการแลกทองรูปพรรณได้');
    }
  }
  
  async function handleCancelJewelryTransaction(transactionId: number) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการยกเลิกรายการแลกทองรูปพรรณนี้?')) {
      return;
    }

    try {
      // First try to use the dedicated cancel endpoint
      try {
        const response = await fetch(`/api/transactions/${transactionId}/cancel`, {
          method: 'POST',
        });

        if (response.ok) {
          toast.success('รายการแลกทองรูปพรรณถูกยกเลิกเรียบร้อยแล้ว');
          fetchGoldAssets();
          fetchTotalUserBalance();
          fetchTransactionHistory();
          return;
        }

        // If the endpoint doesn't exist or returns an error, continue to fallback
        const errorData = await response.json().catch(() => ({}));
        console.warn('Cancel endpoint failed:', errorData.error || response.statusText);
      } catch (cancelError) {
        console.warn('Cancel endpoint not available, using fallback method');
      }

      // Fallback: Update the transaction directly using the PUT endpoint
      const transaction = transactionHistory.find(tx => tx.id === transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const updateResponse = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: transaction.user?.id.toString() || '',
          goldType: transaction.goldType,
          amount: transaction.amount,
          type: 'CANCEL_EX', // Using shorter type name (max 10 chars)
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to cancel jewelry exchange transaction');
      }

      toast.success('รายการแลกทองรูปพรรณถูกยกเลิกเรียบร้อยแล้ว');
      fetchGoldAssets();
      fetchTotalUserBalance();
      fetchTransactionHistory();
    } catch (error) {
      console.error('Error canceling jewelry transaction:', error);
      toast.error('ไม่สามารถยกเลิกรายการแลกทองรูปพรรณได้');
    }
  }
  
  async function handleEditJewelrySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJewelryTransaction) return;
    
    setIsProcessing(true);

    try {
      // Convert grams to baht before sending to API
      const bathAmount = calculateBaht(Number(editJewelryFormData.grams));

      const response = await fetch(`/api/transactions/${selectedJewelryTransaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: editJewelryFormData.customerId,
          goldType: editJewelryFormData.jewelryName, // Store jewelry name in goldType for EX_JEWELRY
          amount: bathAmount,
          type: 'EX_JEWELRY',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update jewelry exchange transaction');
      }

      toast.success('รายการแลกทองรูปพรรณถูกแก้ไขเรียบร้อยแล้ว');
      setIsEditJewelryDialogOpen(false);
      setSelectedJewelryTransaction(null);
      fetchGoldAssets();
      fetchTotalUserBalance();
      fetchTransactionHistory();
    } catch (error) {
      console.error('Error updating jewelry transaction:', error);
      toast.error('ไม่สามารถแก้ไขรายการแลกทองรูปพรรณได้');
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
      fetchCustomers();
      fetchTotalUserBalance();
      fetchTransactionHistory();
    } catch (error) {
      console.error('Error exchanging gold:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to exchange gold');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleJewelryExchangeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Convert grams to baht before sending to API
      const bathAmount = calculateBaht(Number(jewelryExchangeFormData.grams));

      const response = await fetch('/api/management/gold-stock/exchange-jewelry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: jewelryExchangeFormData.customerId,
          goldType: jewelryExchangeFormData.goldType,
          amount: bathAmount,
          jewelryName: jewelryExchangeFormData.jewelryName,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to exchange gold jewelry');
      }

      toast.success('Gold jewelry exchanged successfully');
      setIsJewelryExchangeDialogOpen(false);
      setJewelryExchangeFormData({
        customerId: '',
        goldType: 'ทองสมาคม 96.5%',
        grams: '',
        jewelryName: '',
      });
      
      // Refresh all data to ensure the Stock History list is updated
      fetchGoldAssets();
      fetchCustomers();
      fetchTotalUserBalance();
      fetchTransactionHistory();
    } catch (error) {
      console.error('Error exchanging gold jewelry:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to exchange gold jewelry');
    } finally {
      setIsProcessing(false);
    }
  }
  
  async function handleAddToUserSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Calculate gold amount in baht
      const goldAmount = Number(addToUserFormData.purchaseAmount) / Number(addToUserFormData.goldPrice);
      
      const response = await fetch('/api/management/gold-stock/add-to-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: addToUserFormData.customerId,
          goldType: addToUserFormData.goldType,
          amount: goldAmount.toString(),
          goldPrice: addToUserFormData.goldPrice,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add gold to user');
      }

      toast.success('Gold added to user successfully');
      setIsAddToUserDialogOpen(false);
      setAddToUserFormData({
        customerId: '',
        goldType: 'ทองสมาคม 96.5%',
        purchaseAmount: '',
        goldPrice: '',
      });
      
      // Refresh all data
      fetchGoldAssets();
      fetchCustomers();
      fetchTotalUserBalance();
      fetchTransactionHistory();
    } catch (error) {
      console.error('Error adding gold to user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add gold to user');
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

  // Function to determine if an asset is related to a jewelry exchange transaction
  const getAssetTypeInfo = (asset: GoldAsset) => {
    // Check if there's a jewelry exchange transaction around the same time as this asset
    const jewelryExchange = transactionHistory.find(transaction => 
      (transaction.type === 'EX_JEWELRY' || transaction.type === 'CANCEL_EX') && 
      Math.abs(new Date(transaction.createdAt).getTime() - new Date(asset.createdAt).getTime()) < 60000 // Within 1 minute
    );

    if (jewelryExchange) {
      return {
        type: 'jewelry_exchange',
        jewelryName: jewelryExchange.goldType, // The jewelry name is stored in the goldType field for EX_JEWELRY transactions
        userName: jewelryExchange.user?.name || jewelryExchange.user?.email || 'Unknown User',
        transactionId: jewelryExchange.id,
        isCanceled: jewelryExchange.type === 'CANCEL_EX'
      };
    }
    
    // Regular exchange check - look for EXCHANGE transaction type first
    const exchangeTransaction = transactionHistory.find(transaction => 
      (transaction.type === 'EXCHANGE' || transaction.type === 'sell') && 
      Math.abs(new Date(transaction.createdAt).getTime() - new Date(asset.createdAt).getTime()) < 60000 // Within 1 minute
    );
    
    if (exchangeTransaction || Number(asset.purchasePrice) % 100 !== 0) {
      return {
        type: 'exchange',
        userName: exchangeTransaction?.user?.name || exchangeTransaction?.user?.email || 'Unknown User',
        transactionId: exchangeTransaction?.id
      };
    }
    
    // Default to direct addition
    return { type: 'addition' };
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className={`text-lg lg:text-2xl font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          จัดการ Stock ทอง
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => setIsJewelryExchangeDialogOpen(true)}
            className="bg-purple-500 hover:bg-purple-600 text-white text-xs sm:text-sm"
            size="sm"
          >
            <Gem className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="whitespace-nowrap">ตัด Stock ลูกค้าเเลกทองรูปพรรณ</span>
          </Button>
          <Button 
            onClick={() => setIsExchangeDialogOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm"
            size="sm"
          >
            <Exchange className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="whitespace-nowrap">ตัด Stock ลูกค้าขายทอง</span>
          </Button>
          <Button 
            onClick={() => setIsAddToUserDialogOpen(true)}
            className="bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm"
            size="sm"
          >
            <Plus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="whitespace-nowrap">เพิ่มทองลูกค้าซื้อ</span>
          </Button>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm"
            size="sm"
          >
            <Plus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="whitespace-nowrap">เพิ่ม Stock ร้านใหญ่</span>
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

      {/* Gold Jewelry Exchange Transactions Section */}
   

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
              <div className={`p-4 sm:p-6 border rounded-lg ${
                theme === 'dark' 
                  ? 'bg-[#1a1a1a] border-[#2A2A2A]' 
                  : 'bg-white border-gray-200'
              }`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Total Gold Stock
                    </h3>
                    <p className={`text-xl sm:text-2xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : ''}`}>
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
                    <p className={`text-xl sm:text-2xl font-bold mt-2 text-orange-500`}>
                      ฿{totalGoldValue.toLocaleString()}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Average Price
                    </h3>
                    <p className={`text-xl sm:text-2xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                      ฿{averagePrice.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock History */}
              <div className="mt-6">
                <h3 className={`text-lg font-medium mb-4 ${theme === 'dark' ? 'text-white' : ''}`}>Stock History</h3>
                <div className="space-y-4">
                  {goldAssets.map((asset) => {
                    const assetInfo = getAssetTypeInfo(asset);
                    const isJewelryExchange = assetInfo.type === 'jewelry_exchange';
                    const isRegularExchange = assetInfo.type === 'exchange';
                    const isAddition = assetInfo.type === 'addition';
                    
                    return (
                      <div
                        key={asset.id}
                        className={`p-4 border rounded-lg ${
                          theme === 'dark' 
                            ? 'bg-[#1a1a1a] border-[#2A2A2A]' 
                            : 'bg-white border-gray-200'
                        } ${
                          isJewelryExchange
                            ? theme === 'dark' ? 'border-l-4 border-l-purple-600' : 'border-l-4 border-l-purple-500'
                            : isRegularExchange
                              ? theme === 'dark' ? 'border-l-4 border-l-blue-600' : 'border-l-4 border-l-blue-500'
                              : theme === 'dark' ? 'border-l-4 border-l-green-600' : 'border-l-4 border-l-green-500'
                        }`}
                        data-transaction-type={isJewelryExchange ? 'jewelry_exchange' : isRegularExchange ? 'exchange' : 'addition'}
                        data-transaction-id={assetInfo.transactionId || ''}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start">
                          <div>
                            <div className="flex items-center">
                              {isJewelryExchange ? (
                                <Gem className={`h-4 w-4 mr-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-500'}`} />
                              ) : isRegularExchange ? (
                                <ArrowUpRight className={`h-4 w-4 mr-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
                              ) : (
                                <ArrowDownRight className={`h-4 w-4 mr-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-500'}`} />
                              )}
                              <p className={`font-medium ${theme === 'dark' ? 'text-white' : ''}`}>
                                {asset.goldType} {
                                  isJewelryExchange ? (
                                    <span className="text-purple-500 font-medium">(ตัด Stock ลูกค้าเเลกทองรูปพรรณ)</span>
                                  ) : isRegularExchange ? (
                                    <span className="text-blue-500">(ตัด Stock ลูกค้าขายทอง)</span>
                                  ) : (
                                    <span>(เพิ่ม Stock)</span>
                                  )
                                }
                              </p>
                            </div>
                            <div className={`mt-1 space-y-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                              <p>จำนวน: {Number(asset.amount).toFixed(4)} บาท</p>
                              <p>({calculateGrams(Number(asset.amount))} กรัม)</p>
                              <p>ราคาซื้อ: ฿{Number(asset.purchasePrice).toLocaleString()}/บาท</p>
                              {isJewelryExchange && (
                                <p className="font-medium text-purple-500 mt-2 border-l-2 border-purple-500 pl-2">
                                  ทองรูปพรรณ: <span className="font-bold">{assetInfo.jewelryName || 'ไม่ระบุ'}</span>
                                </p>
                              )}
                              {(isJewelryExchange || isRegularExchange) && (
                                <p>ลูกค้า: {assetInfo.userName || 'ไม่ระบุ'}</p>
                              )}
                              <p>วันที่: {new Date(asset.createdAt).toLocaleString('th-TH')}</p>
                            </div>
                          </div>
                          <div className="text-right mt-3 sm:mt-0">
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
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleCancelAsset(asset.id)}
                                className={`text-orange-500 ${
                                  theme === 'dark' 
                                    ? 'border-[#2A2A2A] hover:bg-[#202020]' 
                                    : 'hover:bg-orange-50'
                                }`}
                                title="ยกเลิกรายการ"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Card className={`mb-6 ${theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}`}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gem className="h-6 w-6 text-purple-500" />
            <span className={theme === 'dark' ? 'text-white' : ''}>Gold Jewelry Exchange Transactions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {transactionHistory.filter(tx => tx.type === 'EX_JEWELRY' || tx.type === 'CANCEL_EX').length > 0 ? (
                transactionHistory
                  .filter(tx => tx.type === 'EX_JEWELRY' || tx.type === 'CANCEL_EX')
                  .map((transaction) => (
                    <div
                      key={transaction.id}
                      className={`p-4 border rounded-lg ${theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A]' : 'bg-white border-gray-200'} border-l-4 ${theme === 'dark' ? 'border-l-purple-600' : 'border-l-purple-500'}`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start">
                        <div>
                          <div className="flex items-center">
                            <Gem className={`h-4 w-4 mr-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-500'}`} />
                            <p className={`font-medium ${theme === 'dark' ? 'text-white' : ''}`}>
                              {transaction.goldType} 
                              <span className="text-purple-500 font-medium">(ทองรูปพรรณ)</span>
                              {transaction.type === 'CANCEL_EX' && (
                                <span className="ml-2 text-orange-500 font-medium">(ยกเลิกแล้ว)</span>
                              )}
                            </p>
                          </div>
                          <div className={`mt-1 space-y-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            <p>จำนวน: {Number(transaction.amount).toFixed(4)} บาท</p>
                            <p>({calculateGrams(Number(transaction.amount))} กรัม)</p>
                            <p>ลูกค้า: {transaction.user?.name || transaction.user?.email || 'ไม่ระบุ'}</p>
                            <p>วันที่: {new Date(transaction.createdAt).toLocaleString('th-TH')}</p>
                          </div>
                        </div>
                        <div className="text-right mt-3 sm:mt-0">
                          <div className="flex space-x-2 mt-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedJewelryTransaction(transaction);
                                setEditJewelryFormData({
                                  customerId: transaction.user?.id.toString() || '',
                                  goldType: 'ทองสมาคม 96.5%',
                                  grams: calculateGrams(Number(transaction.amount)),
                                  jewelryName: transaction.goldType,
                                });
                                setIsEditJewelryDialogOpen(true);
                              }}
                              className={theme === 'dark' ? 'border-[#2A2A2A] hover:bg-[#202020]' : ''}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteJewelryTransaction(transaction.id)}
                              className={`text-red-500 ${
                                theme === 'dark' 
                                  ? 'border-[#2A2A2A] hover:bg-[#202020]' 
                                  : 'hover:bg-red-50'
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleCancelJewelryTransaction(transaction.id)}
                              className={`text-orange-500 ${
                                theme === 'dark' 
                                  ? 'border-[#2A2A2A] hover:bg-[#202020]' 
                                  : 'hover:bg-orange-50'
                              }`}
                              title="ยกเลิกรายการ"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  No gold jewelry exchange transactions available
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
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
              ตัด Stock ลูกค้าขายทอง
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
                      {customer.name || customer.email} - {Number(customer.totalGold || 0).toFixed(4)} บาท ({calculateGrams(Number(customer.totalGold || 0))} กรัม)
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

      {/* Jewelry Exchange Dialog */}
      <Dialog open={isJewelryExchangeDialogOpen} onOpenChange={setIsJewelryExchangeDialogOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : ''}>
              ตัด Stock ลูกค้าเเลกทองรูปพรรณ
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJewelryExchangeSubmit} className="space-y-4">
            <div>
              <Label htmlFor="jewelryCustomerId" className={theme === 'dark' ? 'text-white' : ''}>เลือกลูกค้า</Label>
              <Select
                value={jewelryExchangeFormData.customerId}
                onValueChange={(value) => setJewelryExchangeFormData(prev => ({ ...prev, customerId: value }))}
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
                      {customer.name || customer.email} - {Number(customer.totalGold || 0).toFixed(4)} บาท ({calculateGrams(Number(customer.totalGold || 0))} กรัม)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="jewelryName" className={theme === 'dark' ? 'text-white' : ''}>ชื่อทองรูปพรรณ</Label>
              <Input
                id="jewelryName"
                value={jewelryExchangeFormData.jewelryName}
                onChange={(e) => setJewelryExchangeFormData(prev => ({ ...prev, jewelryName: e.target.value }))}
                placeholder="เช่น สร้อยคอทอง, แหวนทอง"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
                maxLength={50}
              />
            </div>

            <div>
              <Label htmlFor="goldType" className={theme === 'dark' ? 'text-white' : ''}>ประเภททองที่จะได้รับ</Label>
              <Input
                id="goldType"
                value={jewelryExchangeFormData.goldType}
                disabled
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
              />
            </div>

            <div>
              <Label htmlFor="jewelryGrams" className={theme === 'dark' ? 'text-white' : ''}>จำนวนทองที่จะเเลก (กรัม)</Label>
              <Input
                id="jewelryGrams"
                type="number"
                step="0.01"
                value={jewelryExchangeFormData.grams}
                onChange={(e) => setJewelryExchangeFormData(prev => ({ ...prev, grams: e.target.value }))}
                placeholder="ระบุจำนวนกรัม"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
              />
              {jewelryExchangeFormData.grams && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {calculateBaht(Number(jewelryExchangeFormData.grams))} บาท
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-purple-500 hover:bg-purple-600 text-white"
              disabled={isProcessing || !jewelryExchangeFormData.customerId || !jewelryExchangeFormData.grams || !jewelryExchangeFormData.jewelryName}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                'ยืนยันการเเลกทองรูปพรรณ'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Jewelry Exchange Dialog */}
      <Dialog open={isEditJewelryDialogOpen} onOpenChange={setIsEditJewelryDialogOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : ''}>
              แก้ไขรายการแลกทองรูปพรรณ
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditJewelrySubmit} className="space-y-4">
            <div>
              <Label htmlFor="editJewelryCustomer" className={theme === 'dark' ? 'text-white' : ''}>ลูกค้า</Label>
              <Select
                value={editJewelryFormData.customerId}
                onValueChange={(value) => setEditJewelryFormData(prev => ({ ...prev, customerId: value }))}
                disabled={isProcessing}
              >
                <SelectTrigger className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}>
                  <SelectValue placeholder="เลือกลูกค้า" />
                </SelectTrigger>
                <SelectContent className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name || customer.email} {customer.totalGold && `(${customer.totalGold} บาท)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="editJewelryType" className={theme === 'dark' ? 'text-white' : ''}>ประเภททอง</Label>
              <Input
                id="editJewelryType"
                value={editJewelryFormData.goldType}
                disabled
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
              />
            </div>

            <div>
              <Label htmlFor="editJewelryGrams" className={theme === 'dark' ? 'text-white' : ''}>จำนวน (กรัม)</Label>
              <Input
                id="editJewelryGrams"
                type="number"
                step="0.01"
                value={editJewelryFormData.grams}
                onChange={(e) => setEditJewelryFormData(prev => ({ ...prev, grams: e.target.value }))}
                placeholder="ระบุจำนวนกรัม"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
              />
              {editJewelryFormData.grams && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {calculateBaht(Number(editJewelryFormData.grams))} บาท
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="editJewelryName" className={theme === 'dark' ? 'text-white' : ''}>ชื่อทองรูปพรรณ</Label>
              <Input
                id="editJewelryName"
                value={editJewelryFormData.jewelryName}
                onChange={(e) => setEditJewelryFormData(prev => ({ ...prev, jewelryName: e.target.value }))}
                placeholder="ระบุชื่อทองรูปพรรณ"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-purple-500 hover:bg-purple-600 text-white"
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

      {/* Add Gold to User Dialog */}
      <Dialog open={isAddToUserDialogOpen} onOpenChange={setIsAddToUserDialogOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : ''}>
              เพิ่มทองให้ลูกค้า
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddToUserSubmit} className="space-y-4">
            <div>
              <Label htmlFor="addToUserCustomerId" className={theme === 'dark' ? 'text-white' : ''}>เลือกลูกค้า</Label>
              <Select
                value={addToUserFormData.customerId}
                onValueChange={(value) => setAddToUserFormData(prev => ({ ...prev, customerId: value }))}
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
                      {customer.name || customer.email} - {Number(customer.totalGold || 0).toFixed(4)} บาท ({calculateGrams(Number(customer.totalGold || 0))} กรัม)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="goldType" className={theme === 'dark' ? 'text-white' : ''}>ประเภททอง</Label>
              <Input
                id="goldType"
                value={addToUserFormData.goldType}
                disabled
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
              />
            </div>

            <div>
              <Label htmlFor="purchaseAmount" className={theme === 'dark' ? 'text-white' : ''}>จำนวนเงินที่ต้องการซื้อ (บาท)</Label>
              <Input
                id="purchaseAmount"
                type="number"
                step="0.01"
                value={addToUserFormData.purchaseAmount}
                onChange={(e) => setAddToUserFormData(prev => ({ ...prev, purchaseAmount: e.target.value }))}
                placeholder="ระบุจำนวนเงิน"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
              />
            </div>

            <div>
              <Label htmlFor="goldPrice" className={theme === 'dark' ? 'text-white' : ''}>ราคาทอง (บาท/บาท)</Label>
              <Input
                id="goldPrice"
                type="number"
                step="0.01"
                value={addToUserFormData.goldPrice}
                onChange={(e) => setAddToUserFormData(prev => ({ ...prev, goldPrice: e.target.value }))}
                placeholder="ระบุราคาทอง"
                className={theme === 'dark' ? 'bg-[#1a1a1a] border-[#2A2A2A] text-white' : ''}
                required
              />
            </div>

            {/* Summary section */}
            {addToUserFormData.purchaseAmount && addToUserFormData.goldPrice && Number(addToUserFormData.purchaseAmount) > 0 && Number(addToUserFormData.goldPrice) > 0 && (
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-[#1a1a1a] border border-[#2A2A2A]' : 'bg-gray-50 border border-gray-200'}`}>
                <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : ''}`}>สรุปรายการ</h3>
                <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  <p>จำนวนเงินที่ต้องการซื้อ: ฿{Number(addToUserFormData.purchaseAmount).toLocaleString()}</p>
                  <p>ราคาทอง: ฿{Number(addToUserFormData.goldPrice).toLocaleString()}/บาท</p>
                  <p className="mt-2 font-medium text-green-500">
                    ทองที่ได้รับ: {(Number(addToUserFormData.purchaseAmount) / Number(addToUserFormData.goldPrice)).toFixed(4)} บาท
                  </p>
                  <p className="text-green-500">
                    ({calculateGrams(Number(addToUserFormData.purchaseAmount) / Number(addToUserFormData.goldPrice))} กรัม)
                  </p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-green-500 hover:bg-green-600 text-white"
              disabled={isProcessing || !addToUserFormData.customerId || !addToUserFormData.purchaseAmount || !addToUserFormData.goldPrice}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                'ยืนยันการเพิ่มทอง'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}