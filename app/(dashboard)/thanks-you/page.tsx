"use client";

import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ThankYouPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full max-w-md p-8 text-center shadow-lg">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-600"
          >
            <CheckCircle className="h-12 w-12" />
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h1 className="mb-3 text-3xl font-bold text-foreground">
              ขอบคุณสำหรับการชำระเงิน
            </h1>
            <p className="mb-6 text-muted-foreground">
              การทำรายการของคุณสำเร็จแล้ว
              เราได้ส่งรายละเอียดการชำระเงินไปยังอีเมลของคุณ
            </p>

            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/dashboard/gold">กลับไปยังแดชบอร์ด</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/deposit">ดูประวัติการชำระเงิน</Link>
              </Button>
            </div>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}
