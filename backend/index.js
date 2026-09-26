import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as jose from 'jose-cjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'deshi-bite-secret-key-2026-very-secure');
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_FILE = path.join(__dirname, 'db_data.json');

app.use(cors({ origin: '*' }));
app.use(express.json());

// In-Memory & File Fallback Seed Data
const INITIAL_PRODUCTS = [
  { id: 'PROD-1001', name: 'Chicken Samosa', retailPriceKg: 600, retailPricePcs: null, wholesalePriceKg: 580, wholesalePricePcs: null, stockKg: 28.5, stockPcs: 0, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 10, active: true },
  { id: 'PROD-1002', name: 'Chicken Nugget', retailPriceKg: 700, retailPricePcs: null, wholesalePriceKg: 670, wholesalePricePcs: null, stockKg: 35, stockPcs: 0, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 10, active: true },
  { id: 'PROD-1003', name: 'Fish Finger', retailPriceKg: 800, retailPricePcs: null, wholesalePriceKg: 760, wholesalePricePcs: null, stockKg: 18, stockPcs: 0, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 10, active: true },
  { id: 'PROD-1004', name: 'Half Moon', retailPriceKg: 550, retailPricePcs: null, wholesalePriceKg: null, wholesalePricePcs: null, stockKg: 12, stockPcs: 0, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 10, active: true },
  { id: 'PROD-1005', name: 'Chicken Cutlet', retailPriceKg: 800, retailPricePcs: null, wholesalePriceKg: null, wholesalePricePcs: null, stockKg: 15, stockPcs: 0, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 10, active: true },
  { id: 'PROD-1006', name: 'Vegetable Spring Roll', retailPriceKg: null, retailPricePcs: 20, wholesalePriceKg: null, wholesalePricePcs: 17, stockKg: 0, stockPcs: 140, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 20, active: true },
  { id: 'PROD-1007', name: 'Frozen Paratha', retailPriceKg: null, retailPricePcs: 15, wholesalePriceKg: null, wholesalePricePcs: 12, stockKg: 0, stockPcs: 220, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 20, active: true },
  { id: 'PROD-1008', name: 'Dal Puri', retailPriceKg: null, retailPricePcs: 10, wholesalePriceKg: 200, wholesalePricePcs: 8, stockKg: 0, stockPcs: 65, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 15, active: true },
  { id: 'PROD-1009', name: 'Frozen Roti', retailPriceKg: null, retailPricePcs: 10, wholesalePriceKg: null, wholesalePricePcs: 8, stockKg: 0, stockPcs: 190, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 20, active: true },
  { id: 'PROD-1010', name: 'Kolija Singara', retailPriceKg: null, retailPricePcs: null, wholesalePriceKg: 370, wholesalePricePcs: null, stockKg: 4, stockPcs: 0, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 10, active: true },
  { id: 'PROD-1011', name: 'Borfi', retailPriceKg: 600, retailPricePcs: null, wholesalePriceKg: 580, wholesalePricePcs: null, stockKg: 1, stockPcs: 0, lowStockThresholdKg: 0.5, lowStockThresholdPcs: 10, active: true }
];

const INITIAL_USERS = [
  { id: 'ADMIN-0001', name: 'Admin Manager', phone: '01613522678', passwordHash: '02369', role: 'ADMIN', status: 'ACTIVE', totalSales: 0, totalPaid: 0, currentDue: 0, joinedDate: '10 September 2026', address: 'Dhaka', email: 'admin@deshibite.com' },
  { id: 'AGENT-0003', name: 'Toha Jamil', phone: '01763213388', passwordHash: '123456', role: 'AGENT', status: 'ACTIVE', totalSales: 0, totalPaid: 0, currentDue: 0, address: 'Dhaka', joinedDate: '17 September 2026' }
];

let localDb = {
  products: INITIAL_PRODUCTS,
  users: INITIAL_USERS,
  sales: [],
  stockTransactions: [],
  payments: [],
  notifications: [],
  logs: [],
  settings: {
    businessName: 'DESHI BITE',
    contactPhone: '+880 1613-522678',
    currencySymbol: '৳',
    lowStockAlerts: true,
    googleAppsScriptUrl: ''
  }
};

function loadLocalDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      localDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } else {
      const parentDb = path.resolve(__dirname, '../data/deshi_bite_db.json');
      if (fs.existsSync(parentDb)) {
        localDb = JSON.parse(fs.readFileSync(parentDb, 'utf-8'));
      }
    }
  } catch (err) {
    console.error('Error loading fallback db:', err);
  }
}
loadLocalDb();

function saveLocalDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(localDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing fallback db:', err);
  }
}

// Bangladesh Time Helper
function getDhakaTime() {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const timeStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
  return { date: dateStr, time: timeStr, timestamp: now.getTime() };
}

// Mongoose Connection
let isMongoConnected = false;
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
      isMongoConnected = true;
      console.log('MongoDB (Mongoose) Connected successfully to Atlas!');
    })
    .catch((err) => {
      console.warn('Mongoose connect notice (running in local persistence mode):', err.message);
    });
}

// Token Helper with jose-cjs
async function generateToken(payload) {
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

// Router
const api = express.Router();

// Health
api.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DESHI BITE Backend API Server',
    time: getDhakaTime(),
    mongodb: isMongoConnected,
    mode: isMongoConnected ? 'mongodb-mongoose' : 'local-json'
  });
});

// Full state
api.get('/state', (req, res) => {
  res.json({
    products: localDb.products,
    users: localDb.users.map(({ passwordHash, ...u }) => u),
    sales: localDb.sales,
    stockTransactions: localDb.stockTransactions,
    payments: localDb.payments,
    notifications: localDb.notifications,
    logs: localDb.logs,
    settings: localDb.settings
  });
});

function normalizePhone(p) {
  if (!p) return '';
  let cleaned = String(p).replace(/[\s\-\(\)\+]/g, '').trim();
  if (cleaned.startsWith('880')) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
}

// Login
api.post('/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  const cleanPhone = normalizePhone(phone);
  const cleanPass = String(password).trim();

  // 1. Guaranteed Master Admin
  if (cleanPhone === '01613522678' && cleanPass === '02369') {
    let admin = localDb.users.find((u) => normalizePhone(u.phone) === '01613522678' && u.role === 'ADMIN');
    if (!admin) {
      admin = {
        id: 'ADMIN-0001',
        name: 'Admin Manager',
        phone: '01613522678',
        role: 'ADMIN',
        status: 'ACTIVE',
        totalSales: 0,
        totalPaid: 0,
        currentDue: 0,
        joinedDate: '10 September 2026',
        address: 'Factory 1, Dhaka',
        email: 'admin@deshibite.com',
      };
      localDb.users.unshift(admin);
      saveLocalDb();
    }
    const { passwordHash, ...safeAdmin } = admin;
    const token = await generateToken({ id: admin.id, role: admin.role, phone: admin.phone });
    return res.json({ success: true, user: safeAdmin, token });
  }

  // 2. Guaranteed Master Agent
  if (cleanPhone === '01763213388' && cleanPass === '123456') {
    let agent = localDb.users.find((u) => normalizePhone(u.phone) === '01763213388' && u.role === 'AGENT');
    if (!agent) {
      agent = {
        id: 'AGENT-0003',
        name: 'Toha Jamil',
        phone: '01763213388',
        role: 'AGENT',
        status: 'ACTIVE',
        totalSales: 0,
        totalPaid: 0,
        currentDue: 0,
        address: 'Dhaka',
        joinedDate: '17 September 2026',
      };
      localDb.users.push(agent);
      saveLocalDb();
    }
    const { passwordHash, ...safeAgent } = agent;
    const token = await generateToken({ id: agent.id, role: agent.role, phone: agent.phone });
    return res.json({ success: true, user: safeAgent, token });
  }

  const user = localDb.users.find((u) => normalizePhone(u.phone) === cleanPhone);
  if (!user || String(user.passwordHash || '').trim() !== cleanPass) {
    return res.status(401).json({ error: 'Invalid phone number or password' });
  }

  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ error: `Account is currently ${user.status}. Please contact Management.` });
  }

  const { passwordHash, ...safeUser } = user;
  const token = await generateToken({ id: user.id, role: user.role, phone: user.phone });

  res.json({
    success: true,
    user: safeUser,
    token
  });
});

// Register
api.post('/auth/register', (req, res) => {
  const { name, phone, password, address } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'Name, phone and password are required' });
  }

  const cleanPhone = phone.trim();
  if (localDb.users.some((u) => u.phone === cleanPhone)) {
    return res.status(400).json({ error: 'An account with this phone already exists' });
  }

  const dt = getDhakaTime();
  const newAgent = {
    id: `AGENT-${String(localDb.users.filter((u) => u.role === 'AGENT').length + 1).padStart(4, '0')}`,
    name: name.trim(),
    phone: cleanPhone,
    passwordHash: password.trim(),
    role: 'AGENT',
    status: 'PENDING',
    totalSales: 0,
    totalPaid: 0,
    currentDue: 0,
    address: address?.trim() || '',
    joinedDate: dt.date
  };

  localDb.users.push(newAgent);
  localDb.notifications.unshift({
    id: `NOTIF-${Date.now()}`,
    title: 'New Agent Pending Approval',
    message: `${newAgent.name} (${newAgent.phone}) applied for an agent account.`,
    type: 'INFO',
    isRead: false,
    date: dt.date,
    time: dt.time,
    targetRole: 'ADMIN',
    timestamp: dt.timestamp
  });

  saveLocalDb();
  res.json({ success: true, message: 'Agent registration submitted successfully! Awaiting Admin approval.' });
});

// Create Sale
api.post('/sales', (req, res) => {
  const { agentId, saleType, items, customerName, customerPhone, customerAddress, discount } = req.body;
  const agent = localDb.users.find((u) => u.id === agentId && u.role === 'AGENT');
  if (!agent) {
    return res.status(403).json({ error: 'Authorized agent account required' });
  }

  if (!items || !items.length) {
    return res.status(400).json({ error: 'At least one product item is required' });
  }

  // Stock check & deduction
  for (const item of items) {
    const prod = localDb.products.find((p) => p.id === item.productId);
    if (!prod) return res.status(400).json({ error: `Product not found: ${item.productName}` });

    if (item.unit === 'KG') {
      if (prod.stockKg < item.quantity) return res.status(400).json({ error: `Insufficient stock for ${prod.name}` });
      prod.stockKg = Number((prod.stockKg - item.quantity).toFixed(3));
    } else {
      if (prod.stockPcs < item.quantity) return res.status(400).json({ error: `Insufficient stock for ${prod.name}` });
      prod.stockPcs = Math.max(0, prod.stockPcs - item.quantity);
    }
  }

  const dt = getDhakaTime();
  const invoiceCounter = localDb.sales.length + 1;
  const invoiceNo = `DB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(invoiceCounter).padStart(5, '0')}`;

  let subtotal = 0;
  const calculatedItems = items.map((it) => {
    const itemSub = Number((it.quantity * it.unitPrice).toFixed(2));
    subtotal += itemSub;
    return { ...it, subtotal: itemSub };
  });

  const disc = Number(discount) || 0;
  const grandTotal = Math.max(0, subtotal - disc);

  agent.totalSales += grandTotal;
  agent.currentDue += grandTotal;

  const sale = {
    id: `SALE-${Date.now()}`,
    invoiceNo,
    agentId: agent.id,
    agentName: agent.name,
    customerName: customerName?.trim() || 'Direct Customer',
    customerPhone: customerPhone?.trim() || '',
    customerAddress: customerAddress?.trim() || '',
    saleType,
    items: calculatedItems,
    subtotal,
    discount: disc,
    grandTotal,
    paymentStatus: 'UNPAID',
    createdAtDate: dt.date,
    createdAtTime: dt.time,
    timestamp: dt.timestamp
  };

  localDb.sales.unshift(sale);
  saveLocalDb();

  res.json({ success: true, sale, invoiceNo, agentDue: agent.currentDue });
});

// Payments
api.post('/payments', (req, res) => {
  const { agentId, amount, paymentMethod, referenceNote, recordedBy } = req.body;
  const agent = localDb.users.find((u) => u.id === agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Valid amount required' });

  const previousDue = agent.currentDue;
  const remainingDue = Number((previousDue - numAmount).toFixed(2));
  agent.totalPaid += numAmount;
  agent.currentDue = remainingDue;

  const dt = getDhakaTime();
  const paymentRecord = {
    id: `PAY-${Date.now()}`,
    agentId: agent.id,
    agentName: agent.name,
    amount: numAmount,
    previousDue,
    remainingDue,
    paymentMethod: paymentMethod || 'Cash in Hand',
    referenceNote: referenceNote || 'Payment recorded',
    recordedBy: recordedBy || 'Admin Manager',
    date: dt.date,
    time: dt.time,
    timestamp: dt.timestamp
  };

  localDb.payments.unshift(paymentRecord);
  saveLocalDb();

  res.json({ success: true, payment: paymentRecord, agentRemainingDue: remainingDue });
});

app.use('/api', api);
app.use('/', api);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DESHI BITE Backend running on http://localhost:${PORT}`);
});
