'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ArrowUpCircle, ArrowDownCircle, ShieldAlert, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { useTheme } from '@/lib/theme-provider';

interface Transaction {
  id: number;
  goldType: string;
  amount: string;
  pricePerUnit: string;
  totalPrice: string;
  type: 'buy' | 'sell' | 'exchange';
  createdAt: string;
  user?: {
    id: number;
    name: string | null;
    email: string;
  };
}

interface GroupedTransactions {
  [userId: string]: {
    user: {
      name: string | null;
      email: string;
    };
    transactions: Transaction[];
  };
}

export default function TransactionsHistoryPage() {
  const { user } = useUser();
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const response = await fetch('/api/transactions/history');
        if (response.ok) {
          const data = await response.json();
          setTransactions(data);
          
          // Calculate total value of all transactions
          const total = data.reduce((sum: number, transaction: Transaction) => {
            if (transaction.type === 'buy') {
              return sum + Number(transaction.totalPrice);
            }
            return sum;
          }, 0);
          
          setTotalValue(total);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchTransactions();
    }
  }, [user]);

  if (!user || user.role !== 'admin') {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <Card className={theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="h-12 w-12 text-orange-500 mb-4" />
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-2`}>Access Denied</h2>
            <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-center max-w-md`}>
              Only administrators have access to the transaction history.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  // Group transactions by user
  const groupedTransactions = transactions.reduce<GroupedTransactions>((acc, transaction) => {
    if (!transaction.user) return acc;
    
    const userId = transaction.user.id.toString();
    if (!acc[userId]) {
      acc[userId] = {
        user: {
          name: transaction.user.name,
          email: transaction.user.email
        },
        transactions: []
      };
    }
    acc[userId].transactions.push(transaction);
    return acc;
  }, {});

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className={`text-lg lg:text-2xl font-medium mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        รายการซื้อขายทองทั้งหมด
      </h1>

      {/* Total Value Card */}
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
                ฿{totalValue.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading transactions...
        </div>
      ) : Object.keys(groupedTransactions).length > 0 ? (
        Object.entries(groupedTransactions).map(([userId, { user, transactions }]) => (
          <Card key={userId} className={`mb-6 ${theme === 'dark' ? 'bg-[#151515] border-[#2A2A2A]' : ''}`}>
            <CardHeader>
              <CardTitle className={`flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                <FileText className="h-6 w-6 text-orange-500" />
                <span>{user.name || user.email}'s Transactions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      theme === 'dark' 
                        ? 'bg-[#1a1a1a] border-[#2A2A2A] hover:bg-[#202020]' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${
                        transaction.type === 'buy' 
                          ? 'bg-green-100 text-green-600' 
                          : transaction.type === 'sell'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {transaction.type === 'buy' ? (
                          <ArrowDownCircle className="h-6 w-6" />
                        ) : transaction.type === 'sell' ? (
                          <ArrowUpCircle className="h-6 w-6" />
                        ) : (
                          <FileText className="h-6 w-6" />
                        )}
                      </div>
                      <div>
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : ''}`}>
                          {transaction.type === 'buy' ? 'ซื้อ' : 
                           transaction.type === 'sell' ? 'ขาย' : 'แลกเปลี่ยน'} {transaction.goldType}
                        </p>
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          {new Date(transaction.createdAt).toLocaleString('th-TH')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${
                        transaction.type === 'buy' ? 'text-red-600' : 
                        transaction.type === 'sell' ? 'text-green-600' : 'text-blue-600'
                      }`}>
                        {transaction.type === 'buy' ? '-' : 
                         transaction.type === 'sell' ? '+' : ''}฿{Number(transaction.totalPrice).toLocaleString()}
                      </p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        {Number(transaction.amount).toFixed(4)} บาท @ ฿{Number(transaction.pricePerUnit).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          No transactions found
        </div>
      )}
    </section>
  );
}