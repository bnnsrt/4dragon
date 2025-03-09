"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Wallet, Loader2, Upload, Copy, Check, CreditCard, QrCode } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useUser } from "@/lib/auth";
import Image from "next/image";
import { useTheme } from "@/lib/theme-provider";
import { useRouter } from "next/navigation";

interface BankAccount {
  bank: string;
  accountNumber: string;
  accountName: string;
}

interface VerifiedSlip {
  id: number;
  amount: string;
  verifiedAt: string;
  status: "completed" | "pending";
}

interface DepositLimit {
  id: number;
  name: string;
  dailyLimit: string;
}

interface QrData {
  amount: number;
  qrImage: string;
  promptpayNumber: string;
  createdAt: string;
}

const BANK_NAMES: { [key: string]: string } = {
  ktb: "ธนาคารกรุงไทย",
  kbank: "ธนาคารกสิกรไทย",
  scb: "ธนาคารไทยพาณิชย์",
  gsb: "ธนาคารออมสิน",
  kkp: "ธนาคารเกียรตินาคินภัทร",
};

export default function DepositPage() {
  const { user } = useUser();
  const { theme } = useTheme();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentDeposits, setRecentDeposits] = useState<VerifiedSlip[]>([]);
  const [balance, setBalance] = useState(0);
  const [depositLimit, setDepositLimit] = useState<DepositLimit | null>(null);
  const [showLimitDialog, setShowLimitDialog] = useState(true);
  const [todayDeposits, setTodayDeposits] = useState(0);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [txnId, setTxnId] = useState<string>("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const paymentMethods = [
    {
      id: "qr-promptpay",
      name: "QR PromptPay",
      description: "Scan QR code to pay",
    },
  ];

  useEffect(() => {
    async function fetchData() {
      try {
        // Get today's date at midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [depositsResponse, balanceResponse, limitResponse] =
          await Promise.all([
            fetch("/api/transactions/deposit"),
            fetch("/api/user/balance"),
            fetch("/api/user/deposit-limit"),
          ]);

        if (depositsResponse.ok && balanceResponse.ok && limitResponse.ok) {
          const [depositsData, balanceData, limitData] = await Promise.all([
            depositsResponse.json(),
            balanceResponse.json(),
            limitResponse.json(),
          ]);

          // Calculate today's deposits
          const todayTotal = depositsData
            .filter(
              (deposit: VerifiedSlip) => new Date(deposit.verifiedAt) >= today
            )
            .reduce(
              (sum: number, deposit: VerifiedSlip) =>
                sum + Number(deposit.amount),
              0
            );

          setRecentDeposits(depositsData);
          setBalance(Number(balanceData.balance));
          setDepositLimit(limitData);
          setTodayDeposits(todayTotal);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }

    if (user) {
      fetchData();
    }
  }, [user]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("กรุณากรอกจำนวนเงินที่ถูกต้อง");
      return;
    }

    if (depositLimit) {
      const dailyLimit = Number(depositLimit.dailyLimit);
      const remainingDailyLimit = dailyLimit - todayDeposits;

      if (amountNum > remainingDailyLimit) {
        toast.error("ไม่สามารถเพิ่มเงินได้ เนื่องจากเกินวงเงินที่กำหนด");
        return;
      }
    }

    setIsProcessing(true);

    try {
      if (selectedMethod === "qr-promptpay") {
        // Handle QR PromptPay
        const response = await fetch("/api/qr-promptpay/create", {
          method: "POST",
          body: JSON.stringify({ amount }),
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          toast.error(data.error || "Failed to generate QR code");
          return;
        }

        setQrData({
          amount: data.data.amount,
          qrImage: data.data.qrImage,
          promptpayNumber: data.data.promptpayNumber,
          createdAt: data.data.createdAt,
        });
        setTxnId(data.data.txnId);
        setShowQrModal(true);
      }
    } catch (error) {
      console.error("Error processing deposit:", error);
      toast.error("ไม่สามารถดำเนินการได้");
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  // Calculate remaining deposit limit
  const remainingDailyLimit = depositLimit
    ? Number(depositLimit.dailyLimit) - todayDeposits
    : 0;
  const canDeposit = Boolean(
    depositLimit &&
      (!amount || (Number(amount) > 0 && Number(amount) <= remainingDailyLimit))
  );
  const showLimitError = Boolean(amount && Number(amount) > 0 && !canDeposit);

  // Function to format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Effect for countdown timer
  useEffect(() => {
    if (!qrData || !showQrModal) return;

    const createdTime = new Date(qrData.createdAt).getTime();
    const timeLimit = 15 * 60 * 1000; // 15 minutes in milliseconds
    const endTime = createdTime + timeLimit;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));

      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        setShowQrModal(false);
        toast.error("QR Code หมดอายุ กรุณาทำรายการใหม่");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [qrData, showQrModal]);

  // Function to handle redirect after successful payment
  const handlePaymentSuccess = useCallback(() => {
    router.push("/thanks-you");
  }, [router]);

  // Effect for checking payment status
  useEffect(() => {
    if (!txnId || !showQrModal) return;

    const checkPayment = async () => {
      try {
        const response = await fetch(`/api/qr-promptpay/check/${txnId}`);
        const result = await response.json();

        if (result.data.status === "SUCCESS") {
          toast.success("ชำระเงินสำเร็จ");
          setShowQrModal(false);
          handlePaymentSuccess();
        } else if (result.data.status === "FAIL") {
          toast.error("การชำระเงินไม่สำเร็จ");
          setShowQrModal(false);
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
      }
    };

    // Initial check
    checkPayment();

    // Poll every 3 seconds
    const statusInterval = setInterval(checkPayment, 3000);
    return () => clearInterval(statusInterval);
  }, [txnId, showQrModal, handlePaymentSuccess]);

  // Check for pending transactions on mount
  useEffect(() => {
    const checkPendingTransaction = async () => {
      try {
        const response = await fetch("/api/qr-promptpay/pending");
        const result = await response.json();
        console.log("Pending transaction check:", result);

        if (result.status && result.data) {
          setQrData(result.data);
          setTxnId(result.data.txnId);
          setShowQrModal(true);
        }
      } catch (error) {
        console.error("Error checking pending transaction:", error);
      }
    };

    checkPendingTransaction();
  }, []);

  // Function to handle cancel button click
  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  // Function to handle cancel confirmation
  const handleCancelConfirm = async () => {
    if (!txnId) return;

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/qr-promptpay/cancel/${txnId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("ยกเลิกรายการสำเร็จ");
        setShowQrModal(false);
      } else {
        toast.error("ไม่สามารถยกเลิกรายการได้");
      }
    } catch (error) {
      console.error("Error cancelling payment:", error);
      toast.error("เกิดข้อผิดพลาดในการยกเลิกรายการ");
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  // Function to handle QR payment creation
  const handleQrPayment = async (amount: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/qr-promptpay/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }),
      });

      const result = await response.json();
      if (response.ok) {
        setQrData(result.data);
        setTxnId(result.data.txnId);
        setShowQrModal(true);
      } else {
        toast.error(result.error || "ไม่สามารถสร้าง QR Code ได้");
      }
    } catch (error) {
      console.error("Error creating QR payment:", error);
      toast.error("เกิดข้อผิดพลาดในการสร้าง QR Code");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format status
  const getStatusBadge = (status: string) => {
    const statusMap = {
      PE: {
        label: "รอการชำระเงิน",
        className:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
      },
      CP: {
        label: "ชำระเงินสำเร็จ",
        className:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      },
      CANCELLED: {
        label: "ยกเลิกรายการ",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
      },
      FAIL: {
        label: "ชำระเงินไม่สำเร็จ",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
      },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || {
      label: status,
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
    };

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.className}`}
      >
        {statusInfo.label}
      </span>
    );
  };

  const getMethodLabel = (method: string) => {
    const methodMap = {
      QR: "QR PromptPay",
      BANK: "โอนผ่านธนาคาร",
    };
    return methodMap[method as keyof typeof methodMap] || method;
  };

  if (!depositLimit) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2">Loading deposit limits...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent
          className={theme === "dark" ? "bg-[#151515] border-[#2A2A2A]" : ""}
        >
          <DialogHeader>
            <DialogTitle className={theme === "dark" ? "text-white" : ""}>
              วงเงินการฝาก
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg ${
                theme === "dark" ? "bg-[#1a1a1a]" : "bg-gray-50"
              }`}
            >
              <p
                className={`font-medium mb-2 ${
                  theme === "dark" ? "text-white" : ""
                }`}
              >
                ระดับวงเงิน: {depositLimit?.name || "Level 1"}
              </p>
              <div
                className={`space-y-2 ${
                  theme === "dark" ? "text-gray-300" : "text-gray-600"
                }`}
              >
                <p>
                  วงเงินลิมิต: ฿
                  {Number(depositLimit?.dailyLimit || 50000).toLocaleString()}
                </p>
                <p>ยอดฝากวันนี้: ฿{todayDeposits.toLocaleString()}</p>
                <p>
                  วงเงินคงเหลือที่ฝากได้: ฿
                  {remainingDailyLimit.toLocaleString()}
                </p>
                <p className="text-sm text-blue-500">
                  <a
                    href="https://lin.ee/EO0xuyG"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ติดต่อพนักงานเพื่อปลดลิมิต
                  </a>
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => setShowLimitDialog(false)}
            >
              ตกลง
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <h1
        className={`text-lg lg:text-2xl font-medium mb-6 ${
          theme === "dark" ? "text-white" : "text-gray-900"
        }`}
      >
        Deposit Funds
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card
          className={theme === "dark" ? "bg-[#151515] border-[#2A2A2A]" : ""}
        >
          <CardHeader>
            <CardTitle
              className={`flex items-center space-x-2 ${
                theme === "dark" ? "text-white" : ""
              }`}
            >
              <Wallet className="h-6 w-6 text-orange-500" />
              <span>Make a Deposit</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleDeposit}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label
                  htmlFor="amount"
                  className={theme === "dark" ? "text-white" : ""}
                >
                  Amount (THB)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  required
                  min="0"
                  step="0.01"
                  className={`text-lg ${
                    theme === "dark"
                      ? "bg-[#1a1a1a] border-[#2A2A2A] text-white"
                      : ""
                  }`}
                />
                {depositLimit && (
                  <div
                    className={`text-sm ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    <p>ยอดฝากวันนี้: ฿{todayDeposits.toLocaleString()}</p>
                    <p>
                      วงเงินคงเหลือที่ฝากได้: ฿
                      {remainingDailyLimit.toLocaleString()}
                    </p>
                  </div>
                )}
                {showLimitError && (
                  <p className="text-sm text-red-500">
                    ไม่สามารถเพิ่มเงินได้ เนื่องจากเกินวงเงินที่กำหนด
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className={theme === "dark" ? "text-white" : ""}>
                  Select Payment Method
                </Label>
                <div className="grid gap-4">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`w-full p-4 rounded-md border cursor-pointer ${
                        selectedMethod === method.id
                          ? "bg-orange-500 text-white border-orange-600"
                          : theme === "dark"
                          ? "bg-[#1a1a1a] border-[#2A2A2A] text-white hover:bg-[#202020]"
                          : "bg-white border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() =>
                        !showLimitError && setSelectedMethod(method.id)
                      }
                    >
                      <div className="flex items-center space-x-4 w-full">
                        <div
                          className={`p-4 ${
                            theme === "dark" ? "bg-[#202020]" : "bg-gray-100"
                          } rounded-md`}
                        >
                          <QrCode className="h-8 w-8 text-orange-500" />
                        </div>
                        <div className="flex flex-col items-start flex-grow">
                          <span className="font-medium">{method.name}</span>
                          <p className="text-sm opacity-75">
                            {method.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !selectedMethod || !amount || Boolean(showLimitError)}
                className={`w-full ${
                  isProcessing
                    ? "bg-gray-500"
                    : "bg-orange-500 hover:bg-orange-600"
                } text-white`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังสร้างรายการ...
                  </>
                ) : (
                  "ชำระเงิน"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card
          className={theme === "dark" ? "bg-[#151515] border-[#2A2A2A]" : ""}
        >
          <CardHeader>
            <CardTitle className={theme === "dark" ? "text-white" : ""}>
              Recent Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDeposits.length > 0 ? (
                recentDeposits.map((deposit: any) => (
                  <div
                    key={deposit.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {getMethodLabel(deposit.method)}
                        </span>
                        {getStatusBadge(deposit.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {deposit.txnId}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(deposit.createdAt || deposit.verifiedAt)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 mt-2 sm:mt-0">
                      <div className="font-medium">
                        {parseFloat(deposit.amount).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        บาท
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p
                  className={`text-center ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  ไม่พบรายการเติมเงิน
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={showQrModal}
        onOpenChange={(open) => {
          if (!open) handleCancelClick();
          setShowQrModal(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>สแกน QR Code เพื่อชำระเงิน</DialogTitle>
            <DialogDescription>
              กรุณาชำระเงินภายใน {formatTime(countdown)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {qrData && (
              <>
                <div className="rounded-lg bg-white p-4">
                  <img
                    src={`data:image/png;base64,${qrData.qrImage}`}
                    alt="QR Code"
                    className="h-64 w-64"
                  />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">
                    จำนวนเงิน: ฿
                    {Number(qrData.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    พร้อมเพย์: {qrData.promptpayNumber}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  กรุณารอสักครู่ ระบบกำลังตรวจสอบการชำระเงิน...
                </p>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleCancelClick}
                >
                  ยกเลิกรายการ
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>ยืนยันการยกเลิกรายการ</DialogTitle>
            <DialogDescription>
              คุณต้องการยกเลิกรายการชำระเงินนี้ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-4 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowCancelConfirm(false)}
              disabled={isCancelling}
            >
              ไม่ใช่
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังยกเลิกรายการ...
                </>
              ) : (
                "ใช่, ยกเลิกรายการ"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
