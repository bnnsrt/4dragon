import TelegramBot from 'node-telegram-bot-api';

// Initialize bot with token from environment variable
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { 
  polling: false
});

// Convert chat ID to number since Telegram API requires numeric chat IDs
const getChatId = () => {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return null;
  
  // Handle both numeric and string formats
  return chatId.startsWith('-') ? 
    Number(chatId) : // Group chat IDs are negative numbers
    Number(chatId.replace('@', '')); // Handle channel usernames
};

const BAHT_TO_GRAM = 15.2; // 1 baht = 15.2 grams for 96.5% gold

const calculateGrams = (bathAmount: number) => {
  return (bathAmount * BAHT_TO_GRAM).toFixed(2);
};

interface DepositNotificationData {
  userName: string;
  amount: number;
  transRef: string;
}

interface GoldPurchaseNotificationData {
  userName: string;
  goldType: string;
  amount: number;
  totalPrice: number;
  pricePerUnit: number;
  remainingAmount?: number;
  totalUserBalance: number;
}

interface GoldSaleNotificationData {
  userName: string;
  goldType: string;
  amount: number;
  totalPrice: number;
  pricePerUnit: number;
  profitLoss: number;
  remainingAmount?: number;
  totalUserBalance: number;
}

interface WithdrawalRequestData {
  userName: string;
  amount: number;
  bank: string;
  accountNumber: string;
  accountName: string;
}

interface GoldWithdrawalNotificationData {
  userName: string;
  goldType: string;
  amount: number;
  name: string;
  tel: string;
  address: string;
}

export const sendDepositNotification = async (data: DepositNotificationData) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('Missing TELEGRAM_BOT_TOKEN');
      return;
    }

    const chatId = getChatId();
    if (!chatId) {
      console.error('Invalid TELEGRAM_CHAT_ID');
      return;
    }

    try {
      await bot.getChat(chatId);
    } catch (error) {
      console.error('Bot does not have access to the chat. Please add the bot to the group/channel first.');
      return;
    }

    const message = `💰 *New Deposit!*\n\n` +
      `👤 User: ${data.userName}\n` +
      `💵 Amount: ฿${data.amount.toLocaleString()}\n` +
      `🔖 Transaction Ref: ${data.transRef}`;

    const result = await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

    if (result) {
      console.log('Telegram deposit notification sent successfully');
    }
  } catch (error: any) {
    if (error.code === 'ETELEGRAM') {
      console.error('Telegram API Error:', {
        code: error.response?.body?.error_code,
        description: error.response?.body?.description
      });
    } else {
      console.error('Telegram Bot Error:', error);
    }
  }
};

export const sendGoldPurchaseNotification = async (data: GoldPurchaseNotificationData) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('Missing TELEGRAM_BOT_TOKEN');
      return;
    }

    const chatId = getChatId();
    if (!chatId) {
      console.error('Invalid TELEGRAM_CHAT_ID');
      return;
    }

    try {
      await bot.getChat(chatId);
    } catch (error) {
      console.error('Bot does not have access to the chat. Please add the bot to the group/channel first.');
      return;
    }
    
    let message = `🏆 *Update Stock!*\n\n` +
      `👤 User: ${data.userName}\n` +
      `📦 Gold Type: ${data.goldType}\n` +
      `💰 Amount: ${Math.abs(data.amount).toFixed(4)} บาท (${calculateGrams(Math.abs(data.amount))} กรัม)\n` +
      `💵 Price/Unit: ฿${data.pricePerUnit.toLocaleString()}\n` +
      `💎 Total Price: ฿${Math.abs(data.totalPrice).toLocaleString()}\n\n` +
      `💎 เงินสดในระบบลูกค้าทั้งหมด: ฿${data.totalUserBalance < 0 ? '-' : ''}${Math.abs(data.totalUserBalance).toLocaleString()}`;

    // Add remaining amount if provided
    if (typeof data.remainingAmount === 'number') {
      message += `\n\n📊 คงเหลือ: ${data.remainingAmount.toFixed(4)} บาท (${calculateGrams(data.remainingAmount)} กรัม)`;
    }

    const result = await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

    if (result) {
      console.log('Telegram purchase notification sent successfully');
    }
  } catch (error: any) {
    if (error.code === 'ETELEGRAM') {
      console.error('Telegram API Error:', {
        code: error.response?.body?.error_code,
        description: error.response?.body?.description
      });
    } else {
      console.error('Telegram Bot Error:', error);
    }
  }
};

export const sendGoldSaleNotification = async (data: GoldSaleNotificationData) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('Missing TELEGRAM_BOT_TOKEN');
      return;
    }

    const chatId = getChatId();
    if (!chatId) {
      console.error('Invalid TELEGRAM_CHAT_ID');
      return;
    }

    try {
      await bot.getChat(chatId);
    } catch (error) {
      console.error('Bot does not have access to the chat. Please add the bot to the group/channel first.');
      return;
    }

    const profitLossEmoji = data.profitLoss >= 0 ? '📈' : '📉';
    const profitLossText = data.profitLoss >= 0 ? 'Profit' : 'Loss';

    // Calculate the correct value for "เงินสดในระบบลูกค้าทั้งหมด" using the formula:
    // (เงินสดในระบบลูกค้าทั้งหมด in dashboard/gold-stock) - (Total Value in dashboard/gold-stock)
    // where data.totalUserBalance is the total cash in system and data.totalPrice is the total value
    const adjustedTotalUserBalance = data.totalUserBalance - data.totalPrice;
    
    let message = `💫 *New Gold Sale!*\n\n` +
      `👤 User: ${data.userName}\n` +
      `📦 Gold Type: ${data.goldType}\n` +
      `💰 Amount: ${data.amount.toFixed(4)} บาท (${calculateGrams(data.amount)} กรัม)\n` +
      `💵 Price/Unit: ฿${data.pricePerUnit.toLocaleString()}\n` +
      `💎 Total Price: ฿${data.totalPrice.toLocaleString()}\n` +
      `${profitLossEmoji} ${profitLossText}: ฿${Math.abs(data.profitLoss).toLocaleString()}\n\n` +
      `💎 เงินสดในระบบลูกค้าทั้งหมด: ฿${adjustedTotalUserBalance.toLocaleString()}`;

    // Add remaining amount if provided
    if (typeof data.remainingAmount === 'number') {
      message += `\n\n📊 คงเหลือ: ${data.remainingAmount.toFixed(4)} บาท (${calculateGrams(data.remainingAmount)} กรัม)`;
    }

    const result = await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

    if (result) {
      console.log('Telegram sale notification sent successfully');
    }
  } catch (error: any) {
    if (error.code === 'ETELEGRAM') {
      console.error('Telegram API Error:', {
        code: error.response?.body?.error_code,
        description: error.response?.body?.description
      });
    } else {
      console.error('Telegram Bot Error:', error);
    }
  }
};

export const sendWithdrawalRequestNotification = async (data: WithdrawalRequestData) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('Missing TELEGRAM_BOT_TOKEN');
      return;
    }

    const chatId = getChatId();
    if (!chatId) {
      console.error('Invalid TELEGRAM_CHAT_ID');
      return;
    }

    try {
      await bot.getChat(chatId);
    } catch (error) {
      console.error('Bot does not have access to the chat. Please add the bot to the group/channel first.');
      return;
    }

    const BANK_NAMES: { [key: string]: string } = {
      'ktb': 'ธนาคารกรุงไทย',
      'kbank': 'ธนาคารกสิกรไทย',
      'scb': 'ธนาคารไทยพาณิชย์',
      'gsb': 'ธนาคารออมสิน',
      'kkp': 'ธนาคารเกียรตินาคินภัทร'
    };

    const bankName = BANK_NAMES[data.bank] || data.bank;

    const message = `💸 *New Withdrawal Request!*\n\n` +
      `👤 User: ${data.userName}\n` +
      `💰 Amount: ฿${data.amount.toLocaleString()}\n` +
      `🏦 Bank: ${bankName}\n` +
      `📝 Account Name: ${data.accountName}\n` +
      `🔢 Account Number: ${data.accountNumber}`;

    const result = await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

    if (result) {
      console.log('Telegram withdrawal notification sent successfully');
    }
  } catch (error: any) {
    if (error.code === 'ETELEGRAM') {
      console.error('Telegram API Error:', {
        code: error.response?.body?.error_code,
        description: error.response?.body?.description
      });
    } else {
      console.error('Telegram Bot Error:', error);
    }
  }
};

export const sendGoldWithdrawalNotification = async (data: GoldWithdrawalNotificationData) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('Missing TELEGRAM_BOT_TOKEN');
      return;
    }

    const chatId = getChatId();
    if (!chatId) {
      console.error('Invalid TELEGRAM_CHAT_ID');
      return;
    }

    try {
      await bot.getChat(chatId);
    } catch (error) {
      console.error('Bot does not have access to the chat. Please add the bot to the group/channel first.');
      return;
    }

    const message = `🏆 *New Gold Withdrawal Request!*\n\n` +
      `👤 User: ${data.userName}\n` +
      `📦 Gold Type: ${data.goldType}\n` +
      `💰 Amount: ${data.amount.toFixed(4)} บาท (${calculateGrams(data.amount)} กรัม)\n\n` +
      `📝 Delivery Details:\n` +
      `- Name: ${data.name}\n` +
      `- Tel: ${data.tel}\n` +
      `- Address: ${data.address}`;

    const result = await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

    if (result) {
      console.log('Telegram gold withdrawal notification sent successfully');
    }
  } catch (error: any) {
    if (error.code === 'ETELEGRAM') {
      console.error('Telegram API Error:', {
        code: error.response?.body?.error_code,
        description: error.response?.body?.description
      });
    } else {
      console.error('Telegram Bot Error:', error);
    }
  }
};