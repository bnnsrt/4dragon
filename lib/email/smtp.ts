import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  const config: SMTPTransport.Options = {
    service: 'gmail',
    host: 'smtp.gmail.com', 
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Increase timeouts
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    // TLS settings
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    }
  };

  return nodemailer.createTransport(config);
};

// Create initial transporter
let transporter = createTransporter();

// Verify transporter connection
const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('SMTP connection verified');
    return true;
  } catch (error) {
    console.error('SMTP connection failed:', error);
    return false;
  }
};

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailData): Promise<boolean> {
  try {
    // Verify connection before sending
    const isConnected = await verifyConnection();
    if (!isConnected) {
      console.log('Recreating SMTP transporter due to failed verification');
      transporter = createTransporter();
    }

    // Attempt to send email with retry
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const result = await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to,
          subject,
          html,
        });

        console.log('Email sent successfully:', result.messageId);
        return true;
      } catch (error) {
        attempts++;
        console.error(`Send attempt ${attempts} failed:`, error);

        if (attempts === maxAttempts) {
          throw error;
        }

        // Simple exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Recreate transporter for next attempt
        transporter = createTransporter();
      }
    }

    return false;
  } catch (error) {
    console.error('All email send attempts failed:', error);
    return false;
  }
}

export function formatGoldTransactionEmail(data: {
  type: 'buy' | 'sell';
  userName: string;
  goldType: string;
  amount: number;
  pricePerUnit: number;
  totalPrice: number;
  profitLoss?: number;
}) {
  const BAHT_TO_GRAM = 15.2;
  const grams = (data.amount * BAHT_TO_GRAM).toFixed(2);
  const transactionType = data.type === 'buy' ? 'ซื้อ' : 'ขาย';
  const transactionColor = data.type === 'buy' ? '#4CAF50' : '#ef5350';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Gold Transaction Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px;">
          <h2 style="color: ${transactionColor}; text-align: center; margin-bottom: 20px;">
            การ${transactionType}ทองคำเสร็จสมบูรณ์
          </h2>
          
          <div style="background-color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px;">เรียน ${data.userName},</p>
            <p style="margin: 0 0 20px;">
              รายการ${transactionType}ทองคำของคุณได้ดำเนินการเสร็จสมบูรณ์แล้ว โดยมีรายละเอียดดังนี้:
            </p>
            
            <div style="margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>ประเภททอง:</strong> ${data.goldType}</p>
              <p style="margin: 5px 0;"><strong>จำนวน:</strong> ${data.amount.toFixed(4)} บาท (${grams} กรัม)</p>
              <p style="margin: 5px 0;"><strong>ราคาต่อหน่วย:</strong> ฿${data.pricePerUnit.toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>ยอดรวม:</strong> ฿${data.totalPrice.toLocaleString()}</p>
              ${data.profitLoss !== undefined ? `
                <p style="margin: 5px 0;">
                  <strong>กำไร/ขาดทุน:</strong> 
                  <span style="color: ${data.profitLoss >= 0 ? '#4CAF50' : '#ef5350'}">
                    ฿${Math.abs(data.profitLoss).toLocaleString()}
                  </span>
                </p>
              ` : ''}
            </div>

            <p style="margin: 20px 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
              หากคุณมีข้อสงสัยหรือต้องการความช่วยเหลือ กรุณาติดต่อเราที่ ${process.env.SUPPORT_EMAIL || 'support@example.com'}
            </p>
          </div>
          
          <div style="text-align: center; color: #666; font-size: 12px;">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}