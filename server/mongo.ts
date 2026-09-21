import { MongoClient, Db, ServerApiVersion } from 'mongodb';
import fs from 'fs';
import path from 'path';
import {
  Product,
  User,
  Sale,
  StockTransaction,
  PaymentRecord,
  AppNotification,
  AdminLog,
  BusinessSettings,
  MongoStatus,
} from '../src/types';

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

const CONFIG_FILE = path.join(process.cwd(), 'data', 'mongo_config.json');

// Memory references
let client: MongoClient | null = null;
let db: Db | null = null;
let isConnected = false;
let lastError: string | null = null;
let activeUri: string = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB_NAME || 'deshi_bite';

// Load saved URI if exists
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.uri && !activeUri) {
      activeUri = parsed.uri;
    }
  }
} catch (e) {
  // ignore
}

// If activeUri is still empty, inspect .env and .env.example files
if (!activeUri) {
  try {
    const envPaths = [path.join(process.cwd(), '.env'), path.join(process.cwd(), '.env.example')];
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/^MONGODB_URI=(.+)$/m);
        if (match && match[1] && !match[1].startsWith('your_') && match[1].trim() !== '') {
          activeUri = match[1].trim();
          break;
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

export function maskMongoUri(uri: string): string {
  if (!uri) return '';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/i, '$1*****$3');
}

export function getActiveUri(): string {
  return activeUri;
}

export function isMongoActive(): boolean {
  return isConnected && db !== null;
}

export async function connectMongo(customUri?: string): Promise<{ success: boolean; message: string }> {
  let uriToUse = customUri?.trim() || activeUri?.trim() || process.env.MONGODB_URI?.trim();

  if (!uriToUse) {
    try {
      const envPaths = [path.join(process.cwd(), '.env'), path.join(process.cwd(), '.env.example')];
      for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf-8');
          const match = content.match(/^MONGODB_URI=(.+)$/m);
          if (match && match[1] && !match[1].startsWith('your_') && match[1].trim() !== '') {
            uriToUse = match[1].trim();
            break;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (!uriToUse) {
    isConnected = false;
    lastError = 'No MongoDB URI configured. Running in local persistence mode.';
    return { success: false, message: lastError };
  }

  try {
    // Close existing client if any
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // ignore
      }
    }

    console.log(`[MongoDB] Attempting to connect to MongoDB Atlas... (${maskMongoUri(uriToUse)})`);
    
    // Connect with optimal timeout so app never blocks
    client = new MongoClient(uriToUse, {
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 3000,
      retryWrites: true,
    });

    await client.connect();
    // Ping database
    await client.db(DB_NAME).command({ ping: 1 });

    db = client.db(DB_NAME);
    isConnected = true;
    lastError = null;
    activeUri = uriToUse;

    // Save configuration for persistence
    try {
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ uri: uriToUse, dbName: DB_NAME, updatedAt: new Date().toISOString() }), 'utf-8');
    } catch (e) {
      console.warn('[MongoDB] Could not persist mongo_config.json:', e);
    }

    console.log(`[MongoDB] Connected successfully to MongoDB Cloud database: "${DB_NAME}"`);
    return { success: true, message: `Connected to MongoDB database "${DB_NAME}" successfully!` };
  } catch (err: any) {
    isConnected = false;
    lastError = err.message || 'Failed to connect to MongoDB';
    console.warn(`[MongoDB] Connection notice: ${lastError}`);
    return { success: false, message: lastError };
  }
}

export async function getMongoStatus(): Promise<MongoStatus> {
  const dt = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' });

  if (!isConnected || !db) {
    return {
      connected: false,
      database: DB_NAME,
      hasUri: Boolean(activeUri),
      maskedUri: maskMongoUri(activeUri),
      error: lastError,
      lastChecked: dt,
      source: 'local',
    };
  }

  try {
    const [productsCount, usersCount, salesCount, stockCount, paymentsCount, logsCount, notifsCount] = await Promise.all([
      db.collection('products').countDocuments(),
      db.collection('users').countDocuments(),
      db.collection('sales').countDocuments(),
      db.collection('stock_transactions').countDocuments(),
      db.collection('payments').countDocuments(),
      db.collection('logs').countDocuments(),
      db.collection('notifications').countDocuments(),
    ]);

    return {
      connected: true,
      database: DB_NAME,
      hasUri: true,
      maskedUri: maskMongoUri(activeUri),
      error: null,
      lastChecked: dt,
      source: 'mongodb',
      counts: {
        products: productsCount,
        users: usersCount,
        sales: salesCount,
        stockTransactions: stockCount,
        payments: paymentsCount,
        logs: logsCount,
        notifications: notifsCount,
      },
    };
  } catch (err: any) {
    return {
      connected: false,
      database: DB_NAME,
      hasUri: Boolean(activeUri),
      maskedUri: maskMongoUri(activeUri),
      error: err.message || 'Error pinging MongoDB collections',
      lastChecked: dt,
      source: 'local',
    };
  }
}

// Push all local data into MongoDB (useful on initial connection or manual sync)
export async function pushAllToMongo(schema: DatabaseSchema): Promise<boolean> {
  if (!isConnected || !db) return false;

  try {
    // Products
    if (schema.products?.length > 0) {
      const ops = schema.products.map((p) => ({
        replaceOne: {
          filter: { id: p.id },
          replacement: { ...p, _id: p.id as any },
          upsert: true,
        },
      }));
      await db.collection('products').bulkWrite(ops);
    }

    // Users
    if (schema.users?.length > 0) {
      const ops = schema.users.map((u) => ({
        replaceOne: {
          filter: { id: u.id },
          replacement: { ...u, _id: u.id as any },
          upsert: true,
        },
      }));
      await db.collection('users').bulkWrite(ops);
    }

    // Sales
    if (schema.sales?.length > 0) {
      const ops = schema.sales.map((s) => ({
        replaceOne: {
          filter: { id: s.id },
          replacement: { ...s, _id: s.id as any },
          upsert: true,
        },
      }));
      await db.collection('sales').bulkWrite(ops);
    }

    // Stock Transactions
    if (schema.stockTransactions?.length > 0) {
      const ops = schema.stockTransactions.map((st) => ({
        replaceOne: {
          filter: { id: st.id },
          replacement: { ...st, _id: st.id as any },
          upsert: true,
        },
      }));
      await db.collection('stock_transactions').bulkWrite(ops);
    }

    // Payments
    if (schema.payments?.length > 0) {
      const ops = schema.payments.map((pm) => ({
        replaceOne: {
          filter: { id: pm.id },
          replacement: { ...pm, _id: pm.id as any },
          upsert: true,
        },
      }));
      await db.collection('payments').bulkWrite(ops);
    }

    // Notifications
    if (schema.notifications?.length > 0) {
      const ops = schema.notifications.map((n) => ({
        replaceOne: {
          filter: { id: n.id },
          replacement: { ...n, _id: n.id as any },
          upsert: true,
        },
      }));
      await db.collection('notifications').bulkWrite(ops);
    }

    // Logs
    if (schema.logs?.length > 0) {
      const ops = schema.logs.map((l) => ({
        replaceOne: {
          filter: { id: l.id },
          replacement: { ...l, _id: l.id as any },
          upsert: true,
        },
      }));
      await db.collection('logs').bulkWrite(ops);
    }

    // Settings
    if (schema.settings) {
      await db.collection('settings').replaceOne(
        { _id: 'global_settings' as any },
        { ...schema.settings, _id: 'global_settings' as any },
        { upsert: true }
      );
    }

    console.log('[MongoDB] All collections synced to MongoDB Cloud successfully.');
    return true;
  } catch (err) {
    console.error('[MongoDB] Error pushing state to MongoDB:', err);
    return false;
  }
}

// Pull latest state from MongoDB
export async function pullAllFromMongo(): Promise<DatabaseSchema | null> {
  if (!isConnected || !db) return null;

  try {
    const [products, users, sales, stockTransactions, payments, notifications, logs, settingsDoc] = await Promise.all([
      db.collection('products').find().toArray(),
      db.collection('users').find().toArray(),
      db.collection('sales').find().sort({ timestamp: -1 }).toArray(),
      db.collection('stock_transactions').find().sort({ timestamp: -1 }).toArray(),
      db.collection('payments').find().sort({ timestamp: -1 }).toArray(),
      db.collection('notifications').find().sort({ timestamp: -1 }).toArray(),
      db.collection('logs').find().sort({ timestamp: -1 }).toArray(),
      db.collection('settings').findOne({ _id: 'global_settings' as any }),
    ]);

    // If collections are completely empty, return null so caller can seed
    if (products.length === 0 && users.length === 0) {
      return null;
    }

    return {
      products: products.map((p: any) => {
        const { _id, ...rest } = p;
        return rest as Product;
      }),
      users: users.map((u: any) => {
        const { _id, ...rest } = u;
        return rest as User;
      }),
      sales: sales.map((s: any) => {
        const { _id, ...rest } = s;
        return rest as Sale;
      }),
      stockTransactions: stockTransactions.map((st: any) => {
        const { _id, ...rest } = st;
        return rest as StockTransaction;
      }),
      payments: payments.map((pm: any) => {
        const { _id, ...rest } = pm;
        return rest as PaymentRecord;
      }),
      notifications: notifications.map((n: any) => {
        const { _id, ...rest } = n;
        return rest as AppNotification;
      }),
      logs: logs.map((l: any) => {
        const { _id, ...rest } = l;
        return rest as AdminLog;
      }),
      settings: settingsDoc
        ? (({ _id, ...s }: any) => s as BusinessSettings)(settingsDoc)
        : ({} as BusinessSettings),
    };
  } catch (err) {
    console.error('[MongoDB] Error pulling data from MongoDB:', err);
    return null;
  }
}

// Real-time write operations to MongoDB
export async function mongoUpsert(collectionName: string, id: string, doc: any): Promise<void> {
  if (!isConnected || !db) return;
  try {
    await db.collection(collectionName).replaceOne(
      { id },
      { ...doc, _id: id as any },
      { upsert: true }
    );
  } catch (err) {
    console.warn(`[MongoDB] Failed to upsert document in ${collectionName}:`, err);
  }
}

export async function mongoInsert(collectionName: string, doc: any): Promise<void> {
  if (!isConnected || !db) return;
  try {
    const id = doc.id || `doc_${Date.now()}`;
    await db.collection(collectionName).replaceOne(
      { id },
      { ...doc, _id: id as any },
      { upsert: true }
    );
  } catch (err) {
    console.warn(`[MongoDB] Failed to insert in ${collectionName}:`, err);
  }
}
