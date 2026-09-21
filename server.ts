import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_PRODUCTS,
  INITIAL_USERS,
  INITIAL_SALES,
  INITIAL_STOCK_TRANSACTIONS,
  INITIAL_PAYMENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_LOGS,
  INITIAL_SETTINGS,
} from './src/data/seedData';
import { Product, User, Sale, StockTransaction, PaymentRecord, AppNotification, AdminLog, BusinessSettings } from './src/types';
import {
  connectMongo,
  getMongoStatus,
  pushAllToMongo,
  pullAllFromMongo,
  mongoUpsert,
  mongoInsert,
  isMongoActive,
} from './server/mongo';

const PORT = 3000;
const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'deshi_bite_db.json');

// Helper to asynchronously sync mutations to MongoDB Cloud
function syncToMongo(task: () => Promise<void>) {
  if (isMongoActive()) {
    task().catch((err) => console.warn('[MongoDB Sync Notice]:', err?.message || err));
  }
}

interface DatabaseSchema {
  products: Product[];
  users: User[];
  sales: Sale[];
  stockTransactions: StockTransaction[];
  payments: PaymentRecord[];
  notifications: AppNotification[];
  logs: AdminLog[];
  settings: BusinessSettings;
}

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Load or initialize DB
function loadDatabase(): DatabaseSchema {
  let loaded: DatabaseSchema | null = null;
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      loaded = JSON.parse(content);
    } catch (e) {
      console.error('Error reading db file, restoring defaults:', e);
    }
  }

  if (!loaded) {
    const initialDb: DatabaseSchema = {
      products: INITIAL_PRODUCTS,
      users: INITIAL_USERS,
      sales: INITIAL_SALES,
      stockTransactions: INITIAL_STOCK_TRANSACTIONS,
      payments: INITIAL_PAYMENTS,
      notifications: INITIAL_NOTIFICATIONS,
      logs: INITIAL_LOGS,
      settings: INITIAL_SETTINGS,
    };

    saveDatabase(initialDb);
    return initialDb;
  }

  // Purge any rejected agents so admin panel never shows them
  if (loaded.users) {
    loaded.users = loaded.users.filter((u) => u.status !== 'REJECTED');
  }

  // Ensure default low stock alert for KG is 0.5 instead of 5
  if (loaded.products) {
    loaded.products.forEach((p) => {
      if (p.lowStockThresholdKg === 5) {
        p.lowStockThresholdKg = 0.5;
      }
    });
  }

  if (loaded.settings && (loaded.settings.lowStockDefaultKg === 5 || !loaded.settings.lowStockDefaultKg)) {
    loaded.settings.lowStockDefaultKg = 0.5;
  }

  // Ensure payment dates are populated
  if (loaded.payments) {
    loaded.payments.forEach((p) => {
      if (!p.createdAtDate && p.date) p.createdAtDate = p.date;
      if (!p.createdAtTime && p.time) p.createdAtTime = p.time;
      if (!p.date && p.createdAtDate) p.date = p.createdAtDate;
      if (!p.time && p.createdAtTime) p.time = p.createdAtTime;
    });
  }

  // Ensure stock transaction dates are populated
  if (loaded.stockTransactions) {
    loaded.stockTransactions.forEach((tx) => {
      if (!tx.createdAtDate && tx.date) tx.createdAtDate = tx.date;
      if (!tx.createdAtTime && tx.time) tx.createdAtTime = tx.time;
      if (!tx.date && tx.createdAtDate) tx.date = tx.createdAtDate;
      if (!tx.time && tx.createdAtTime) tx.time = tx.createdAtTime;
    });
  }

  saveDatabase(loaded);
  return loaded;
}

function saveDatabase(newDb: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(newDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write db file:', err);
  }

  // Asynchronously synchronize all records to MongoDB Cloud Atlas
  syncToMongo(async () => {
    await pushAllToMongo(newDb);
  });
}

let db = loadDatabase();

// Bangladesh Time helper
function getBangladeshDateTime() {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(now);

  return { date: dateStr, time: timeStr, timestamp: now.getTime() };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Connect to MongoDB Atlas Cloud if configured
  try {
    const mongoRes = await connectMongo();
    if (mongoRes.success) {
      const remoteData = await pullAllFromMongo();
      if (remoteData && remoteData.products.length > 0) {
        db = remoteData;
        saveDatabase(db);
        console.log(`[MongoDB] Synced state from Cloud MongoDB (${db.products.length} products, ${db.sales.length} sales)`);
      } else {
        await pushAllToMongo(db);
        console.log('[MongoDB] Pushed initial dataset to MongoDB Atlas Cloud');
      }
    } else {
      console.log(`[MongoDB] Startup status: ${mongoRes.message}`);
    }
  } catch (err: any) {
    console.warn('[MongoDB] Initial connection notice:', err?.message || err);
  }

  // API ROUTES FIRST
  // Health
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'DESHI BITE Enterprise Server',
      timezone: 'Asia/Dhaka',
      time: getBangladeshDateTime(),
      mongodbConnected: isMongoActive(),
    });
  });

  // MongoDB Atlas: Status endpoint
  app.get('/api/mongodb/status', async (req, res) => {
    const status = await getMongoStatus();
    res.json(status);
  });

  // MongoDB Atlas: Connect or update URI
  app.post('/api/mongodb/connect', async (req, res) => {
    const { uri } = req.body;
    if (!uri?.trim()) {
      return res.status(400).json({ success: false, message: 'MongoDB connection string (URI) is required' });
    }
    const result = await connectMongo(uri.trim());
    if (result.success) {
      const remoteData = await pullAllFromMongo();
      if (remoteData && remoteData.products.length > 0) {
        db = remoteData;
        saveDatabase(db);
      } else {
        await pushAllToMongo(db);
      }
    }
    const status = await getMongoStatus();
    res.json({ ...result, status });
  });

  // MongoDB Atlas: Sync data
  app.post('/api/mongodb/sync', async (req, res) => {
    const { direction } = req.body; // 'push' or 'pull'
    if (!isMongoActive()) {
      return res.status(400).json({
        success: false,
        error: 'MongoDB Atlas is not connected yet. Please configure your MongoDB URI first.',
      });
    }

    if (direction === 'pull') {
      const remoteData = await pullAllFromMongo();
      if (remoteData) {
        db = remoteData;
        saveDatabase(db);
        return res.json({ success: true, message: 'Live data successfully pulled from MongoDB Atlas Cloud!' });
      } else {
        return res.status(404).json({ success: false, error: 'No data documents found in MongoDB Cloud database.' });
      }
    }

    const pushed = await pushAllToMongo(db);
    if (pushed) {
      res.json({ success: true, message: 'All local products, sales, dues & records uploaded to MongoDB Cloud!' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to upload state to MongoDB Cloud' });
    }
  });

  // Get full state (for fast client hydration)
  app.get('/api/state', (req, res) => {
    res.json({
      products: db.products,
      users: db.users.map((u) => {
        const { passwordHash, ...safeUser } = u;
        return safeUser;
      }),
      sales: db.sales,
      stockTransactions: db.stockTransactions,
      payments: db.payments,
      notifications: db.notifications,
      logs: db.logs,
      settings: db.settings,
    });
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { phone, password } = req.body;
    const user = db.users.find((u) => u.phone === phone?.trim());

    if (!user) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    if (user.passwordHash !== password?.trim()) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    if (user.status === 'PENDING') {
      return res.status(403).json({
        error: 'Your account registration is currently PENDING approval by an Administrator.',
      });
    }

    if (user.status === 'REJECTED') {
      return res.status(403).json({
        error: 'Your account registration has been rejected. Please contact DESHI BITE management.',
      });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Your account is suspended. Please contact management.',
      });
    }

    const { passwordHash, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  });

  // Auth: Register Agent
  app.post('/api/auth/register', (req, res) => {
    const { name, phone, password, address } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, phone, and password are required' });
    }

    const cleanPhone = phone.trim();
    if (db.users.some((u) => u.phone === cleanPhone)) {
      return res.status(400).json({ error: 'An account with this phone number already exists' });
    }

    const dt = getBangladeshDateTime();
    const newAgent: User = {
      id: `AGENT-${String(db.users.filter((u) => u.role === 'AGENT').length + 1).padStart(4, '0')}`,
      name: name.trim(),
      phone: cleanPhone,
      passwordHash: password.trim(),
      role: 'AGENT',
      status: 'PENDING',
      totalSales: 0,
      totalPaid: 0,
      currentDue: 0,
      address: address?.trim() || '',
      joinedDate: dt.date,
    };

    db.users.push(newAgent);

    // Add Admin Notification
    const notif: AppNotification = {
      id: `NOTIF-${Date.now()}`,
      title: 'New Agent Registration Pending',
      message: `${newAgent.name} (${newAgent.phone}) has applied for an agent account.`,
      type: 'INFO',
      isRead: false,
      date: dt.date,
      time: dt.time,
      targetRole: 'ADMIN',
      timestamp: dt.timestamp,
    };
    db.notifications.unshift(notif);

    // Audit log
    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: newAgent.name,
      role: 'AGENT',
      action: 'Agent Registered (Pending)',
      referenceId: newAgent.id,
      details: `New registration with phone ${newAgent.phone}`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });

    saveDatabase(db);
    res.json({
      success: true,
      message: 'Agent registration submitted successfully! Please wait for Admin approval.',
      agentId: newAgent.id,
    });
  });

  // Auth: Change password
  app.post('/api/auth/change-password', (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.passwordHash !== oldPassword) {
      return res.status(400).json({ error: 'Current password does not match' });
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long' });
    }

    user.passwordHash = newPassword.trim();
    saveDatabase(db);
    syncToMongo(async () => {
      await mongoUpsert('users', user.id, user);
    });

    const dt = getBangladeshDateTime();
    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: user.name,
      role: user.role,
      action: 'Password Changed',
      referenceId: user.id,
      details: `${user.role} (${user.name}) updated account password securely`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });
    saveDatabase(db);

    res.json({ success: true, message: 'Password updated successfully!' });
  });

  // Users: Update Profile (Address & Email - Name and Phone are strictly immutable)
  app.put('/api/users/:id/profile', (req, res) => {
    const { id } = req.params;
    const { address, email } = req.body;
    const user = db.users.find((u) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Name and phone are strictly IMMUTABLE as requested
    if (address !== undefined) {
      user.address = String(address).trim();
    }
    if (email !== undefined) {
      user.email = String(email).trim();
    }

    saveDatabase(db);
    syncToMongo(async () => {
      await mongoUpsert('users', user.id, user);
    });

    const dt = getBangladeshDateTime();
    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: user.name,
      role: user.role,
      action: 'Profile Updated',
      referenceId: user.id,
      details: `${user.name} updated profile details (address / email)`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });
    saveDatabase(db);

    const { passwordHash, ...safeUser } = user;
    res.json({
      success: true,
      message: 'Profile details updated successfully!',
      user: safeUser,
    });
  });

  // Agents: Update status (Approve, Reject, Suspend, Activate)
  app.put('/api/agents/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, adminName } = req.body;
    const agentIndex = db.users.findIndex((u) => u.id === id);

    if (agentIndex === -1) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = db.users[agentIndex];
    const dt = getBangladeshDateTime();

    if (status === 'REJECTED') {
      // User directive: Rejecting an agent must completely remove them from the admin panel
      db.users.splice(agentIndex, 1);
      db.logs.unshift({
        id: `LOG-${Date.now()}`,
        user: adminName || 'Admin Manager',
        role: 'ADMIN',
        action: 'Agent Application Rejected',
        referenceId: id,
        details: `${agent.name} (${agent.phone}) registration was rejected and removed from system`,
        date: dt.date,
        time: dt.time,
        timestamp: dt.timestamp,
      });
      saveDatabase(db);
      return res.json({ success: true, message: 'Agent registration rejected and removed from admin portal', removedId: id });
    }

    agent.status = status;

    // Log
    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: adminName || 'Admin Manager',
      role: 'ADMIN',
      action: `Agent Status Updated to ${status}`,
      referenceId: agent.id,
      details: `${agent.name} status updated to ${status}`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });

    saveDatabase(db);
    res.json({ success: true, agent });
  });

  // Agents: Delete / Remove
  app.delete('/api/agents/:id', (req, res) => {
    const { id } = req.params;
    const index = db.users.findIndex((u) => u.id === id);
    if (index === -1) return res.status(404).json({ error: 'Agent not found' });

    const agent = db.users[index];
    db.users.splice(index, 1);

    const dt = getBangladeshDateTime();
    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: 'Admin Manager',
      role: 'ADMIN',
      action: 'Agent Removed',
      referenceId: id,
      details: `Removed agent "${agent.name}" (${id})`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });

    saveDatabase(db);
    res.json({ success: true, message: `Agent "${agent.name}" removed successfully`, removedId: id });
  });

  // Products: Add
  app.post('/api/products', (req, res) => {
    const {
      name,
      retailPriceKg,
      retailPricePcs,
      wholesalePriceKg,
      wholesalePricePcs,
      stockKg,
      stockPcs,
      lowStockThresholdKg,
      lowStockThresholdPcs,
      active,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const dt = getBangladeshDateTime();
    const newProd: Product = {
      id: `PROD-${1000 + db.products.length + 1}`,
      name: name.trim(),
      retailPriceKg: retailPriceKg ? Number(retailPriceKg) : null,
      retailPricePcs: retailPricePcs ? Number(retailPricePcs) : null,
      wholesalePriceKg: wholesalePriceKg ? Number(wholesalePriceKg) : null,
      wholesalePricePcs: wholesalePricePcs ? Number(wholesalePricePcs) : null,
      stockKg: Number(stockKg) || 0,
      stockPcs: Number(stockPcs) || 0,
      lowStockThresholdKg: lowStockThresholdKg !== undefined && lowStockThresholdKg !== '' ? Number(lowStockThresholdKg) : 0.5,
      lowStockThresholdPcs: Number(lowStockThresholdPcs) || 20,
      active: active !== undefined ? active : true,
      updatedAt: dt.date,
    };

    db.products.push(newProd);

    // Initial stock transaction if stock > 0
    if (newProd.stockKg > 0 || newProd.stockPcs > 0) {
      db.stockTransactions.unshift({
        id: `STX-${Date.now()}`,
        productId: newProd.id,
        productName: newProd.name,
        type: 'INITIAL',
        quantity: newProd.stockKg || newProd.stockPcs,
        unit: newProd.stockKg ? 'KG' : 'PCS',
        referenceNote: 'Initial stock on product creation',
        recordedBy: 'Admin Manager',
        date: dt.date,
        time: dt.time,
        timestamp: dt.timestamp,
      });
    }

    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: 'Admin Manager',
      role: 'ADMIN',
      action: 'Product Added',
      referenceId: newProd.id,
      details: `Created product "${newProd.name}"`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });

    saveDatabase(db);
    res.json({ success: true, product: newProd });
  });

  // Products: Edit
  app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const prod = db.products.find((p) => p.id === id);
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    const dt = getBangladeshDateTime();
    Object.assign(prod, {
      name: req.body.name?.trim() || prod.name,
      retailPriceKg: req.body.retailPriceKg !== undefined ? (req.body.retailPriceKg ? Number(req.body.retailPriceKg) : null) : prod.retailPriceKg,
      retailPricePcs: req.body.retailPricePcs !== undefined ? (req.body.retailPricePcs ? Number(req.body.retailPricePcs) : null) : prod.retailPricePcs,
      wholesalePriceKg: req.body.wholesalePriceKg !== undefined ? (req.body.wholesalePriceKg ? Number(req.body.wholesalePriceKg) : null) : prod.wholesalePriceKg,
      wholesalePricePcs: req.body.wholesalePricePcs !== undefined ? (req.body.wholesalePricePcs ? Number(req.body.wholesalePricePcs) : null) : prod.wholesalePricePcs,
      stockKg: req.body.stockKg !== undefined ? Number(req.body.stockKg) : prod.stockKg,
      stockPcs: req.body.stockPcs !== undefined ? Number(req.body.stockPcs) : prod.stockPcs,
      lowStockThresholdKg: req.body.lowStockThresholdKg !== undefined && req.body.lowStockThresholdKg !== '' ? Number(req.body.lowStockThresholdKg) : prod.lowStockThresholdKg,
      lowStockThresholdPcs: req.body.lowStockThresholdPcs !== undefined ? Number(req.body.lowStockThresholdPcs) : prod.lowStockThresholdPcs,
      active: req.body.active !== undefined ? Boolean(req.body.active) : prod.active,
      updatedAt: dt.date,
    });

    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: 'Admin Manager',
      role: 'ADMIN',
      action: 'Product Updated',
      referenceId: prod.id,
      details: `Updated details/pricing for "${prod.name}"`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });

    saveDatabase(db);
    res.json({ success: true, product: prod });
  });

  // Products: Delete
  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const index = db.products.findIndex((p) => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'Product not found' });

    const prod = db.products[index];
    db.products.splice(index, 1);

    const dt = getBangladeshDateTime();
    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: 'Admin Manager',
      role: 'ADMIN',
      action: 'Product Deleted',
      referenceId: id,
      details: `Deleted product "${prod.name}" (${id})`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });

    saveDatabase(db);
    res.json({ success: true, message: `Product "${prod.name}" deleted successfully`, deletedId: id });
  });

  // Sales: Create Sale (Atomic Transaction)
  app.post('/api/sales', (req, res) => {
    const { agentId, saleType, items, customerName, customerPhone, customerAddress, discount } = req.body;
    const agent = db.users.find((u) => u.id === agentId && u.role === 'AGENT');
    if (!agent) {
      return res.status(403).json({ error: 'Authorized Agent account required to create sale' });
    }

    if (!items || !items.length) {
      return res.status(400).json({ error: 'At least one product item is required' });
    }

    // Pre-validate stock
    for (const item of items) {
      const prod = db.products.find((p) => p.id === item.productId);
      if (!prod) {
        return res.status(400).json({ error: `Product ${item.productName} not found` });
      }

      if (item.unit === 'KG') {
        if (prod.stockKg < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${prod.name}! Requested: ${item.quantity} KG, Available: ${prod.stockKg} KG.`,
          });
        }
      } else {
        if (prod.stockPcs < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${prod.name}! Requested: ${item.quantity} PCS, Available: ${prod.stockPcs} PCS.`,
          });
        }
      }
    }

    const dt = getBangladeshDateTime();
    const invoiceCounter = db.sales.length + 1;
    const invoiceNumber = `DB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(invoiceCounter).padStart(5, '0')}`;
    const saleId = `SALE-${Date.now()}-${invoiceCounter}`;

    let subtotal = 0;
    const frozenItems = items.map((it: any) => {
      const itemSubtotal = Number((it.quantity * it.unitPrice).toFixed(2));
      subtotal += itemSubtotal;
      return {
        productId: it.productId,
        productName: it.productName,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: itemSubtotal,
      };
    });

    const discountAmount = Number(discount) || 0;
    const grandTotal = Math.max(0, subtotal - discountAmount);

    // 1. Deduct Stock & Record Stock Transactions
    for (const item of frozenItems) {
      const prod = db.products.find((p) => p.id === item.productId)!;
      const stockBefore = item.unit === 'KG' ? prod.stockKg : prod.stockPcs;
      if (item.unit === 'KG') {
        prod.stockKg = Number((prod.stockKg - item.quantity).toFixed(3));
      } else {
        prod.stockPcs = Math.max(0, prod.stockPcs - item.quantity);
      }
      const stockAfter = item.unit === 'KG' ? prod.stockKg : prod.stockPcs;

      db.stockTransactions.unshift({
        id: `STX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: prod.id,
        productName: prod.name,
        type: 'SALE_OUT',
        quantity: item.quantity,
        unit: item.unit,
        referenceNote: `Deducted via Sale ${invoiceNumber}`,
        recordedBy: agent.name,
        date: dt.date,
        time: dt.time,
        createdAtDate: dt.date,
        createdAtTime: dt.time,
        timestamp: dt.timestamp,
        stockBefore,
        stockAfter,
      });

      // Check Low Stock Threshold
      const isLowKg = prod.retailPriceKg || prod.wholesalePriceKg ? prod.stockKg <= prod.lowStockThresholdKg : false;
      const isLowPcs = prod.retailPricePcs || prod.wholesalePricePcs ? prod.stockPcs <= prod.lowStockThresholdPcs : false;

      if (isLowKg || isLowPcs) {
        db.notifications.unshift({
          id: `NOTIF-${Date.now()}-${prod.id}`,
          title: 'Low Stock Alert',
          message: `${prod.name} stock has fallen to ${prod.stockKg ? `${prod.stockKg} KG` : ''} ${prod.stockPcs ? `${prod.stockPcs} PCS` : ''} (below threshold).`,
          type: 'ALERT',
          isRead: false,
          date: dt.date,
          time: dt.time,
          targetRole: 'ADMIN',
          timestamp: dt.timestamp,
        });
      }
    }

    // 2. Increase Agent Due & Total Sales
    agent.totalSales = Number((agent.totalSales + grandTotal).toFixed(2));
    agent.currentDue = Number((agent.currentDue + grandTotal).toFixed(2));

    // 3. Create Sale Record
    const newSale: Sale = {
      id: saleId,
      invoiceNo: invoiceNumber,
      agentId: agent.id,
      agentName: agent.name,
      customerName: customerName?.trim() || 'Direct Customer',
      customerPhone: customerPhone?.trim() || '',
      customerAddress: customerAddress?.trim() || '',
      saleType,
      items: frozenItems,
      subtotal,
      discount: discountAmount,
      grandTotal,
      paymentStatus: 'UNPAID',
      createdAtDate: dt.date,
      createdAtTime: dt.time,
      timestamp: dt.timestamp,
    };

    db.sales.unshift(newSale);

    // 4. Activity Log
    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: agent.name,
      role: 'AGENT',
      action: 'Sale Created',
      referenceId: invoiceNumber,
      details: `Sold ${frozenItems.length} items to ${newSale.customerName} for ৳${grandTotal.toLocaleString()}. Added to Agent Due.`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });

    saveDatabase(db);

    res.json({
      success: true,
      sale: newSale,
      agentUpdatedDue: agent.currentDue,
      invoiceNo: invoiceNumber,
    });
  });

  // Stock: Adjustment / Stock In
  app.post('/api/stock/change', (req, res) => {
    const { productId, type, quantity, unit, referenceNote, recordedBy } = req.body;
    const prod = db.products.find((p) => p.id === productId);
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    const numQty = Number(quantity);
    if (!numQty || numQty <= 0) {
      return res.status(400).json({ error: 'Valid positive quantity required' });
    }

    const stockBefore = unit === 'KG' ? prod.stockKg : prod.stockPcs;
    if (unit === 'KG') {
      if (type === 'STOCK_IN' || type === 'RETURN') {
        prod.stockKg = Number((prod.stockKg + numQty).toFixed(3));
      } else if (type === 'SALE_OUT' || type === 'ADJUSTMENT') {
        prod.stockKg = Number((prod.stockKg - numQty).toFixed(3));
      }
    } else {
      if (type === 'STOCK_IN' || type === 'RETURN') {
        prod.stockPcs += Math.round(numQty);
      } else if (type === 'SALE_OUT' || type === 'ADJUSTMENT') {
        prod.stockPcs = Math.max(0, prod.stockPcs - Math.round(numQty));
      }
    }
    const stockAfter = unit === 'KG' ? prod.stockKg : prod.stockPcs;

    const dt = getBangladeshDateTime();
    const stx: StockTransaction = {
      id: `STX-${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      type,
      quantity: numQty,
      unit,
      referenceNote: referenceNote || `${type} recorded manually`,
      recordedBy: recordedBy || 'Admin Manager',
      date: dt.date,
      time: dt.time,
      createdAtDate: dt.date,
      createdAtTime: dt.time,
      timestamp: dt.timestamp,
      stockBefore,
      stockAfter,
    };

    db.stockTransactions.unshift(stx);

    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: recordedBy || 'Admin Manager',
      role: 'ADMIN',
      action: `Stock ${type}`,
      referenceId: stx.id,
      details: `${type} of ${numQty} ${unit} for "${prod.name}". New Stock: ${prod.stockKg} KG, ${prod.stockPcs} PCS.`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });

    saveDatabase(db);
    res.json({ success: true, transaction: stx, updatedProduct: prod });
  });

  // Due Management: Record Payment / Clear Due
  app.post('/api/payments', (req, res) => {
    const { agentId, amount, paymentMethod, referenceNote, recordedBy } = req.body;
    const agent = db.users.find((u) => u.id === agentId && u.role === 'AGENT');
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    const previousDue = agent.currentDue;
    const remainingDue = Math.max(0, Number((previousDue - numAmount).toFixed(2)));

    agent.totalPaid = Number((agent.totalPaid + numAmount).toFixed(2));
    agent.currentDue = remainingDue;

    const dt = getBangladeshDateTime();
    const paymentRecord: PaymentRecord = {
      id: `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      agentId: agent.id,
      agentName: agent.name,
      amount: numAmount,
      previousDue,
      remainingDue,
      paymentMethod: paymentMethod || 'Cash in Hand',
      referenceNote: referenceNote || 'Due clearance payment',
      recordedBy: recordedBy || 'Admin Manager',
      date: dt.date,
      time: dt.time,
      createdAtDate: dt.date,
      createdAtTime: dt.time,
      timestamp: dt.timestamp,
    };

    db.payments.unshift(paymentRecord);

    // Notify Agent
    db.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      title: 'Payment Received & Due Updated',
      message: `Admin recorded payment of ৳${numAmount.toLocaleString()}. Your remaining due is now ৳${remainingDue.toLocaleString()}.`,
      type: 'SUCCESS',
      isRead: false,
      date: dt.date,
      time: dt.time,
      targetRole: 'AGENT',
      agentId: agent.id,
      timestamp: dt.timestamp,
    });

    // Log
    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      user: recordedBy || 'Admin Manager',
      role: 'ADMIN',
      action: 'Payment Recorded',
      referenceId: paymentRecord.id,
      details: `Received ৳${numAmount.toLocaleString()} from ${agent.name}. Remaining due: ৳${remainingDue.toLocaleString()}`,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    });

    saveDatabase(db);
    res.json({
      success: true,
      payment: paymentRecord,
      agentRemainingDue: remainingDue,
    });
  });

  // Notifications: Mark all read
  app.put('/api/notifications/read-all', (req, res) => {
    db.notifications.forEach((n) => (n.isRead = true));
    saveDatabase(db);
    res.json({ success: true });
  });

  // Settings: Update
  app.post('/api/settings', (req, res) => {
    Object.assign(db.settings, req.body);
    saveDatabase(db);
    res.json({ success: true, settings: db.settings });
  });

  // Google Sheets Sync Bridge
  app.post('/api/sync/sheets', async (req, res) => {
    const { scriptUrl } = req.body;
    const targetUrl = scriptUrl || db.settings.googleAppsScriptUrl;

    if (!targetUrl) {
      return res.status(400).json({
        error: 'Google Apps Script URL is not configured yet. Please paste your deployed Web App URL.',
      });
    }

    try {
      // Forward payload to Google Apps Script Web App
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncFullState',
          payload: {
            salesCount: db.sales.length,
            paymentsCount: db.payments.length,
            productsCount: db.products.length,
            agentsCount: db.users.filter((u) => u.role === 'AGENT').length,
            timestamp: Date.now(),
          },
        }),
      });

      const data = await response.json();
      res.json({ success: true, googleResponse: data });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Could not connect to Google Apps Script URL: ${err.message}. Please ensure the Web App is deployed with 'Anyone' access.`,
      });
    }
  });

  // Graceful database error handling fallback middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (
      err.name === 'MongooseError' ||
      err.name === 'MongoNetworkError' ||
      err.name === 'MongoServerSelectionError' ||
      (err.message && (err.message.includes('buffering timed out') || err.message.includes('ECONNREFUSED') || err.message.includes('timed out')))
    ) {
      console.warn('[AI Studio] Database offline or unreachable — continuing with local state');
      if (req.method === 'GET') {
        return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
      }
      return res.status(503).json({ error: 'Database service temporarily unavailable (running in local mode)' });
    }
    next(err);
  });

  // Vite Middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DESHI BITE Server running on http://localhost:${PORT}`);
  });
}

startServer();
