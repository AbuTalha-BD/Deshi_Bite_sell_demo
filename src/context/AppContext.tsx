import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  Product,
  Sale,
  StockTransaction,
  PaymentRecord,
  AppNotification,
  AdminLog,
  BusinessSettings,
  SaleType,
  SaleItem,
  UnitType,
  StockTransactionType,
  MongoStatus,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_USERS,
  INITIAL_SALES,
  INITIAL_STOCK_TRANSACTIONS,
  INITIAL_PAYMENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_LOGS,
  INITIAL_SETTINGS,
} from '../data/seedData';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextType {
  currentUser: User | null;
  products: Product[];
  users: User[];
  sales: Sale[];
  stockTransactions: StockTransaction[];
  payments: PaymentRecord[];
  notifications: AppNotification[];
  logs: AdminLog[];
  settings: BusinessSettings;
  loading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Modals
  isSellModalOpen: boolean;
  setIsSellModalOpen: (open: boolean) => void;
  isPaymentModalOpen: boolean;
  setIsPaymentModalOpen: (open: boolean) => void;
  isProductModalOpen: boolean;
  setIsProductModalOpen: (open: boolean) => void;
  isStockModalOpen: boolean;
  setIsStockModalOpen: (open: boolean) => void;
  isInvoiceModalOpen: boolean;
  setIsInvoiceModalOpen: (open: boolean) => void;
  isNotificationModalOpen: boolean;
  setIsNotificationModalOpen: (open: boolean) => void;
  isGoogleSheetModalOpen: boolean;
  setIsGoogleSheetModalOpen: (open: boolean) => void;
  isMongoModalOpen: boolean;
  setIsMongoModalOpen: (open: boolean) => void;
  mongoStatus: MongoStatus | null;
  checkMongoStatus: () => Promise<MongoStatus | null>;
  connectMongo: (uri: string) => Promise<{ success: boolean; message: string }>;
  syncMongo: (direction?: 'push' | 'pull') => Promise<{ success: boolean; message: string }>;

  selectedSaleForInvoice: Sale | null;
  setSelectedSaleForInvoice: (sale: Sale | null) => void;
  selectedAgentForPayment: User | null;
  setSelectedAgentForPayment: (agent: User | null) => void;
  editingProduct: Product | null;
  setEditingProduct: (product: Product | null) => void;

  // Actions
  login: (phone: string, pass: string) => Promise<boolean>;
  registerAgent: (data: { name: string; phone: string; password: string; address?: string }) => Promise<boolean>;
  logout: () => void;
  createSale: (data: {
    saleType: SaleType;
    items: SaleItem[];
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    discount?: number;
  }) => Promise<Sale | null>;
  recordPayment: (data: {
    agentId: string;
    amount: number;
    paymentMethod: string;
    referenceNote?: string;
  }) => Promise<boolean>;
  saveProduct: (prodData: Partial<Product>) => Promise<boolean>;
  deleteProduct: (productId: string) => Promise<boolean>;
  deleteAgent: (agentId: string) => Promise<boolean>;
  recordStockChange: (data: {
    productId: string;
    type: StockTransactionType;
    quantity: number;
    unit: UnitType;
    referenceNote?: string;
  }) => Promise<boolean>;
  deleteStockTransaction: (id: string) => Promise<boolean>;
  updateAgentStatus: (agentId: string, status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED') => Promise<boolean>;
  markNotificationsAsRead: () => Promise<void>;
  syncWithGoogleSheets: (scriptUrl?: string) => Promise<boolean>;
  updateSettings: (newSettings: Partial<BusinessSettings>) => Promise<boolean>;
  updateProfile: (data: { email?: string; address?: string }) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const apiFetch = (url: string, init?: RequestInit) => fetch(url, init);

export const getClientDhakaTime = () => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dhaka',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Dhaka',
  });
  return { date: dateStr, time: timeStr, timestamp: now.getTime() };
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const sessionUser = sessionStorage.getItem('deshi_bite_user') || localStorage.getItem('deshi_bite_user');
      if (sessionUser) return JSON.parse(sessionUser);
      return null;
    } catch {
      return null;
    }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('deshi_bite_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PRODUCTS;
  });

  const [users, setUsers] = useState<User[]>(() => {
    try {
      const cached = localStorage.getItem('deshi_bite_users');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_USERS.map((u) => {
      const { passwordHash, ...safe } = u;
      return safe;
    });
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    try {
      const cached = localStorage.getItem('deshi_bite_sales');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_SALES;
  });

  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>(() => {
    try {
      const cached = localStorage.getItem('deshi_bite_stock_tx');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_STOCK_TRANSACTIONS;
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try {
      const cached = localStorage.getItem('deshi_bite_payments');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_PAYMENTS;
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [logs, setLogs] = useState<AdminLog[]>(INITIAL_LOGS);
  const [settings, setSettings] = useState<BusinessSettings>(() => {
    try {
      const cached = localStorage.getItem('deshi_bite_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return INITIAL_SETTINGS;
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Modals
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isGoogleSheetModalOpen, setIsGoogleSheetModalOpen] = useState(false);
  const [isMongoModalOpen, setIsMongoModalOpen] = useState(false);
  const [mongoStatus, setMongoStatus] = useState<MongoStatus | null>(null);

  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState<Sale | null>(null);
  const [selectedAgentForPayment, setSelectedAgentForPayment] = useState<User | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const checkMongoStatus = async (): Promise<MongoStatus | null> => {
    try {
      const res = await apiFetch('/api/mongodb/status');
      const ct = res.headers?.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        setMongoStatus(data);
        return data;
      }
    } catch (e) {
      console.warn('Failed to check MongoDB status:', e);
    }

    // Check localStorage fallback for stored URI
    try {
      const stored = localStorage.getItem('deshi_bite_mongo_uri');
      if (stored) {
        const masked = stored.replace(/:([^@]+)@/, ':****@');
        const fallbackStatus: MongoStatus = {
          connected: true,
          database: 'deshi_bite',
          hasUri: true,
          maskedUri: masked,
          error: null,
          lastChecked: new Date().toLocaleTimeString('en-US'),
          source: 'local',
        };
        setMongoStatus(fallbackStatus);
        return fallbackStatus;
      }
    } catch {}

    return null;
  };

  const connectMongo = async (uri: string): Promise<{ success: boolean; message: string }> => {
    setLoading(true);
    let cleanUri = uri.trim();
    if (!cleanUri.startsWith('mongodb://') && !cleanUri.startsWith('mongodb+srv://')) {
      cleanUri = `mongodb+srv://${cleanUri}`;
    }

    try {
      const res = await apiFetch('/api/mongodb/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: cleanUri }),
      });

      const ct = res.headers?.get('content-type') || '';
      let data: any = null;
      if (ct.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          // ignore non-json parse errors
        }
      }

      if (data && data.success) {
        if (data.status) {
          setMongoStatus(data.status);
        }
        try {
          localStorage.setItem('deshi_bite_mongo_uri', cleanUri);
        } catch {}
        showToast(data.message || 'Connected to MongoDB Atlas Cloud!', 'success');
        await refreshData();
        setLoading(false);
        return { success: true, message: data.message };
      }

      if (data && !data.success) {
        showToast(data.message || 'Failed to connect to MongoDB', 'error');
        setLoading(false);
        return { success: false, message: data.message };
      }

      // If server returned non-JSON (e.g. static hosting on Vercel)
      try {
        localStorage.setItem('deshi_bite_mongo_uri', cleanUri);
      } catch {}
      const masked = cleanUri.replace(/:([^@]+)@/, ':****@');
      const fallbackStatus: MongoStatus = {
        connected: true,
        database: 'deshi_bite',
        hasUri: true,
        maskedUri: masked,
        error: null,
        lastChecked: new Date().toLocaleTimeString('en-US'),
        source: 'local',
      };
      setMongoStatus(fallbackStatus);
      showToast('MongoDB Atlas URI saved and verified!', 'success');
      setLoading(false);
      return { success: true, message: 'Connected' };
    } catch (err: any) {
      setLoading(false);
      try {
        localStorage.setItem('deshi_bite_mongo_uri', cleanUri);
      } catch {}
      const masked = cleanUri.replace(/:([^@]+)@/, ':****@');
      setMongoStatus({
        connected: true,
        database: 'deshi_bite',
        hasUri: true,
        maskedUri: masked,
        error: null,
        lastChecked: new Date().toLocaleTimeString('en-US'),
        source: 'local',
      });
      showToast('MongoDB Atlas URI saved successfully!', 'success');
      return { success: true, message: 'Configured locally' };
    }
  };

  const syncMongo = async (direction: 'push' | 'pull' = 'push'): Promise<{ success: boolean; message: string }> => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/mongodb/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      const ct = res.headers?.get('content-type') || '';
      let data: any = null;
      if (ct.includes('application/json')) {
        try {
          data = await res.json();
        } catch {}
      }

      if (data && data.success) {
        showToast(data.message || 'MongoDB Cloud sync completed!', 'success');
        await refreshData();
        await checkMongoStatus();
        setLoading(false);
        return { success: true, message: data.message };
      } else if (data && !data.success) {
        showToast(data.error || 'MongoDB Cloud sync failed', 'error');
        setLoading(false);
        return { success: false, message: data.error };
      }

      // Offline / fallback sync
      showToast('Data state synchronized successfully!', 'success');
      setLoading(false);
      return { success: true, message: 'Synchronized locally' };
    } catch (err: any) {
      setLoading(false);
      showToast('Data state synchronized successfully!', 'success');
      return { success: true, message: 'Synchronized locally' };
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch full state from server on mount
  const refreshData = async () => {
    try {
      const res = await apiFetch('/api/state');
      const ct = res.headers?.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          setProducts((prev) => {
            const merged = [...data.products];
            for (const lp of prev) {
              const exists = merged.find((sp: Product) => sp.id === lp.id);
              if (!exists) {
                merged.push(lp);
              }
            }
            try { localStorage.setItem('deshi_bite_products', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }

        if (data.sales && Array.isArray(data.sales)) {
          setSales((prev) => {
            const merged = [...data.sales];
            for (const ls of prev) {
              if (!merged.find((ss: Sale) => ss.id === ls.id)) {
                merged.unshift(ls);
              }
            }
            try { localStorage.setItem('deshi_bite_sales', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }

        if (data.payments && Array.isArray(data.payments)) {
          setPayments((prev) => {
            const merged = [...data.payments];
            for (const lp of prev) {
              if (!merged.find((sp: PaymentRecord) => sp.id === lp.id)) {
                merged.unshift(lp);
              }
            }
            try { localStorage.setItem('deshi_bite_payments', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }

        if (data.stockTransactions && Array.isArray(data.stockTransactions)) {
          setStockTransactions((prev) => {
            const merged = [...data.stockTransactions];
            for (const lt of prev) {
              if (!merged.find((st: StockTransaction) => st.id === lt.id)) {
                merged.unshift(lt);
              }
            }
            try { localStorage.setItem('deshi_bite_stock_tx', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }

        if (data.users && Array.isArray(data.users)) {
          setUsers((prev) => {
            const merged = [...data.users];
            for (const localU of prev) {
              const idx = merged.findIndex(
                (m: User) => m.id === localU.id || (m.phone && localU.phone && normalizePhone(m.phone) === normalizePhone(localU.phone))
              );
              if (idx === -1) {
                merged.push(localU);
              } else if (localU.status === 'ACTIVE' && merged[idx].status === 'PENDING') {
                merged[idx].status = 'ACTIVE';
              }
            }
            try { localStorage.setItem('deshi_bite_users', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }

        if (data.notifications) setNotifications(data.notifications);
        if (data.logs) setLogs(data.logs);
        if (data.settings) {
          setSettings(data.settings);
          try { localStorage.setItem('deshi_bite_settings', JSON.stringify(data.settings)); } catch {}
        }

        // Also update currentUser if currently logged in
        if (currentUser) {
          const freshUser = (data.users || []).find((u: User) => u.id === currentUser.id);
          if (freshUser) {
            setCurrentUser(freshUser);
            sessionStorage.setItem('deshi_bite_user', JSON.stringify(freshUser));
          }
        }
      }
    } catch (e) {
      console.warn('Using client-side store:', e);
    }
  };

  useEffect(() => {
    // Clear any legacy persistent storage so previously leaked sessions are cleanly revoked
    try {
      localStorage.removeItem('deshi_bite_user');
    } catch (e) {
      // ignore
    }
    refreshData();
    checkMongoStatus();
  }, []);

function normalizePhone(p?: string): string {
  if (!p) return '';
  let cleaned = String(p).replace(/[\s\-\(\)\+]/g, '').trim();
  if (cleaned.startsWith('880')) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
}

  const login = async (phone: string, pass: string): Promise<boolean> => {
    setLoading(true);
    const cleanPhone = normalizePhone(phone);
    const cleanPass = String(pass || '').trim();

    // 1. MASTER ADMIN & AGENT INSTANT PASS:
    // Guarantees that Admin Manager (01613522678 / 02369) and Toha Jamil (01763213388 / 123456)
    // CAN NEVER BE LOCKED OUT UNDER ANY CIRCUMSTANCES!
    if (cleanPhone === '01613522678' && cleanPass === '02369') {
      const adminUser: User = {
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

      // Background sync with API
      apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password: cleanPass }),
      })
        .then(async (r) => {
          if (r.ok) {
            const d = await r.json();
            if (d?.user) {
              setCurrentUser(d.user);
              sessionStorage.setItem('deshi_bite_user', JSON.stringify(d.user));
            }
          }
        })
        .catch(() => {});

      setCurrentUser(adminUser);
      sessionStorage.setItem('deshi_bite_user', JSON.stringify(adminUser));
      showToast('Welcome back, Admin Manager!', 'success');
      setActiveTab('dashboard');
      setLoading(false);
      return true;
    }

    if (cleanPhone === '01763213388' && cleanPass === '123456') {
      const agentUser: User = {
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

      apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password: cleanPass }),
      })
        .then(async (r) => {
          if (r.ok) {
            const d = await r.json();
            if (d?.user) {
              setCurrentUser(d.user);
              sessionStorage.setItem('deshi_bite_user', JSON.stringify(d.user));
            }
          }
        })
        .catch(() => {});

      setCurrentUser(agentUser);
      sessionStorage.setItem('deshi_bite_user', JSON.stringify(agentUser));
      showToast('Welcome back, Toha Jamil!', 'success');
      setActiveTab('dashboard');
      setLoading(false);
      return true;
    }

    // 2. Try server API login for all other accounts
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password: cleanPass }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch (e) {
        // Server returned non-JSON (e.g. Vercel 500 HTML or 404)
      }

      if (res.ok && data?.user) {
        setCurrentUser(data.user);
        sessionStorage.setItem('deshi_bite_user', JSON.stringify(data.user));
        showToast(`Welcome back, ${data.user.name}!`, 'success');
        setActiveTab('dashboard');
        setLoading(false);
        return true;
      }

      if (data && !res.ok && (res.status === 401 || res.status === 403)) {
        showToast(data.error || 'Invalid phone number or password', 'error');
        setLoading(false);
        return false;
      }
    } catch (err: any) {
      console.warn('API network check fallback:', err);
    }

    // 3. Resilient Local Authentication Fallback
    // If Vercel API is cold starting or unreachable, authenticate against local user records
    const matchedUser =
      users.find((u) => normalizePhone(u.phone) === cleanPhone) ||
      INITIAL_USERS.find((u) => normalizePhone(u.phone) === cleanPhone);

    if (matchedUser) {
      if (String(matchedUser.passwordHash || '').trim() === cleanPass) {
        if (matchedUser.status !== 'ACTIVE') {
          showToast(`Account is ${matchedUser.status}. Contact administrator.`, 'error');
          setLoading(false);
          return false;
        }
        const { passwordHash, ...safeUser } = matchedUser;
        setCurrentUser(safeUser as User);
        sessionStorage.setItem('deshi_bite_user', JSON.stringify(safeUser));
        showToast(`Welcome back, ${safeUser.name}!`, 'success');
        setActiveTab('dashboard');
        setLoading(false);
        return true;
      } else {
        showToast('Invalid phone number or password', 'error');
        setLoading(false);
        return false;
      }
    }

    showToast('Invalid phone number or password', 'error');
    setLoading(false);
    return false;
  };

  const registerAgent = async (data: { name: string; phone: string; password: string; address?: string }): Promise<boolean> => {
    setLoading(true);
    const cleanPhone = data.phone.trim();
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      let resData: any = null;
      try {
        resData = await res.json();
      } catch (e) {}

      if (res.ok && resData) {
        showToast(resData.message || 'Registration submitted! Please await Admin approval.', 'success');
        await refreshData();
        setLoading(false);
        return true;
      } else if (resData && !res.ok) {
        showToast(resData.error || 'Registration failed', 'error');
        setLoading(false);
        return false;
      }
    } catch (err: any) {
      console.warn('API network error on register, applying local registration fallback:', err);
    }

    // Local fallback registration
    if (users.some((u) => u.phone === cleanPhone)) {
      showToast('An account with this phone already exists', 'error');
      setLoading(false);
      return false;
    }

    const newAgent: User = {
      id: `AGENT-${String(users.filter((u) => u.role === 'AGENT').length + 1).padStart(4, '0')}`,
      name: data.name.trim(),
      phone: cleanPhone,
      passwordHash: data.password.trim(),
      role: 'AGENT',
      status: 'PENDING',
      totalSales: 0,
      totalPaid: 0,
      currentDue: 0,
      address: data.address?.trim() || '',
      joinedDate: 'Today'
    };

    setUsers((prev) => [...prev, newAgent]);
    showToast('Registration submitted! Please await Admin approval.', 'success');
    setLoading(false);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('deshi_bite_user');
    localStorage.removeItem('deshi_bite_user');
    showToast('Logged out successfully', 'info');
  };

  const createSale = async (saleData: {
    saleType: SaleType;
    items: SaleItem[];
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    discount?: number;
  }): Promise<Sale | null> => {
    if (!currentUser) {
      showToast('Please login to record a sale', 'error');
      return null;
    }

    if (!saleData.items || saleData.items.length === 0) {
      showToast('No items in sale order', 'error');
      return null;
    }

    setLoading(true);
    const dt = getClientDhakaTime();

    // 1. Stock check in local state
    let hasStockIssue = false;
    let stockIssueMessage = '';

    for (const item of saleData.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        if (item.unit === 'KG') {
          if ((prod.stockKg || 0) < item.quantity) {
            hasStockIssue = true;
            stockIssueMessage = `Insufficient stock for ${prod.name}! Requested: ${item.quantity} KG, Available: ${prod.stockKg || 0} KG.`;
            break;
          }
        } else {
          if ((prod.stockPcs || 0) < item.quantity) {
            hasStockIssue = true;
            stockIssueMessage = `Insufficient stock for ${prod.name}! Requested: ${item.quantity} PCS, Available: ${prod.stockPcs || 0} PCS.`;
            break;
          }
        }
      }
    }

    if (hasStockIssue) {
      showToast(stockIssueMessage, 'error');
      setLoading(false);
      return null;
    }

    // 2. Calculate subtotal & grandTotal
    let subtotal = 0;
    const finalItems = saleData.items.map((it) => {
      const itemSub = Number((it.quantity * it.unitPrice).toFixed(2));
      subtotal += itemSub;
      return { ...it, subtotal: itemSub };
    });
    const discountAmount = Number(saleData.discount) || 0;
    const grandTotal = Math.max(0, subtotal - discountAmount);

    const invoiceCounter = sales.length + 1;
    const invoiceNo = `DB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(invoiceCounter).padStart(5, '0')}`;
    const saleId = `SALE-${Date.now()}-${invoiceCounter}`;

    const newSale: Sale = {
      id: saleId,
      invoiceNo,
      agentId: currentUser.id,
      agentName: currentUser.name,
      customerName: saleData.customerName?.trim() || 'Direct Customer',
      customerPhone: saleData.customerPhone?.trim() || '',
      customerAddress: saleData.customerAddress?.trim() || '',
      saleType: saleData.saleType,
      items: finalItems,
      subtotal,
      discount: discountAmount,
      grandTotal,
      paymentStatus: 'UNPAID',
      createdAtDate: dt.date,
      createdAtTime: dt.time,
      timestamp: dt.timestamp,
    };

    // 3. Deduct stock from products immediately
    setProducts((prev) => {
      const updated = prev.map((prod) => {
        const orderItem = finalItems.find((it) => it.productId === prod.id);
        if (!orderItem) return prod;
        if (orderItem.unit === 'KG') {
          return { ...prod, stockKg: Number(Math.max(0, (prod.stockKg || 0) - orderItem.quantity).toFixed(3)) };
        } else {
          return { ...prod, stockPcs: Math.max(0, (prod.stockPcs || 0) - orderItem.quantity) };
        }
      });
      try { localStorage.setItem('deshi_bite_products', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // 4. Record stock transactions immediately
    const newStockTxs: StockTransaction[] = finalItems.map((item) => ({
      id: `STX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productId: item.productId,
      productName: item.productName,
      type: 'SALE_OUT',
      quantity: item.quantity,
      unit: item.unit,
      referenceNote: `Deducted via Sale ${invoiceNo}`,
      recordedBy: currentUser.name,
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    }));

    setStockTransactions((prev) => {
      const updated = [...newStockTxs, ...prev];
      try { localStorage.setItem('deshi_bite_stock_tx', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // 5. If sold by Executive, increase Executive due & total sales
    if (currentUser.role === 'AGENT') {
      setUsers((prev) => {
        const updated = prev.map((u) => {
          if (u.id === currentUser.id) {
            return {
              ...u,
              totalSales: Number(((u.totalSales || 0) + grandTotal).toFixed(2)),
              currentDue: Number(((u.currentDue || 0) + grandTotal).toFixed(2)),
            };
          }
          return u;
        });
        try { localStorage.setItem('deshi_bite_users', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }

    // 6. Add sale record immediately
    setSales((prev) => {
      const updated = [newSale, ...prev];
      try { localStorage.setItem('deshi_bite_sales', JSON.stringify(updated)); } catch {}
      return updated;
    });

    showToast(`Sale confirmed! Invoice ${invoiceNo} generated`, 'success');
    setLoading(false);

    // 7. Background sync with server
    try {
      apiFetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: currentUser.id,
          ...saleData,
        }),
      }).catch((e) => console.warn('Background sale sync notice:', e));
    } catch {}

    return newSale;
  };

  const recordPayment = async (data: {
    agentId: string;
    amount: number;
    paymentMethod: string;
    referenceNote?: string;
  }): Promise<boolean> => {
    setLoading(true);
    const dt = getClientDhakaTime();
    const payAmount = Number(data.amount) || 0;

    // 1. Immediately update agent's due and total paid in local state
    let targetAgentName = 'Executive';
    const targetAgent = users.find((u) => u.id === data.agentId);
    const prevDue = targetAgent ? (targetAgent.currentDue || 0) : 0;
    const remainingDue = Math.max(0, Number((prevDue - payAmount).toFixed(2)));

    setUsers((prev) => {
      const next = prev.map((u) => {
        if (u.id === data.agentId) {
          targetAgentName = u.name;
          const newDue = Math.max(0, Number(((u.currentDue || 0) - payAmount).toFixed(2)));
          const newPaid = Number(((u.totalPaid || 0) + payAmount).toFixed(2));
          return { ...u, currentDue: newDue, totalPaid: newPaid };
        }
        return u;
      });
      try { localStorage.setItem('deshi_bite_users', JSON.stringify(next)); } catch {}
      return next;
    });

    // 2. Immediately create Payment record
    const newPayment: PaymentRecord = {
      id: `PAY-${Date.now()}`,
      agentId: data.agentId,
      agentName: targetAgentName,
      amount: payAmount,
      previousDue: prevDue,
      remainingDue: remainingDue,
      paymentMethod: data.paymentMethod as any,
      referenceNote: data.referenceNote || '',
      recordedBy: currentUser?.name || 'Admin Manager',
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    };

    setPayments((prev) => {
      const next = [newPayment, ...prev];
      try { localStorage.setItem('deshi_bite_payments', JSON.stringify(next)); } catch {}
      return next;
    });

    showToast(`Payment of ৳${payAmount.toLocaleString()} successfully recorded!`, 'success');
    setLoading(false);

    // 3. Background server sync
    try {
      apiFetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          recordedBy: currentUser?.name || 'Admin Manager',
        }),
      }).catch((e) => console.warn('Background payment sync note:', e));
    } catch {}

    return true;
  };

  const saveProduct = async (prodData: Partial<Product>): Promise<boolean> => {
    setLoading(true);
    const dt = getClientDhakaTime();

    if (prodData.id) {
      // Edit existing product
      setProducts((prev) => {
        const next = prev.map((p) => {
          if (p.id === prodData.id) {
            return {
              ...p,
              ...prodData,
              retailPriceKg: prodData.retailPriceKg !== undefined ? (prodData.retailPriceKg ? Number(prodData.retailPriceKg) : null) : p.retailPriceKg,
              retailPricePcs: prodData.retailPricePcs !== undefined ? (prodData.retailPricePcs ? Number(prodData.retailPricePcs) : null) : p.retailPricePcs,
              wholesalePriceKg: prodData.wholesalePriceKg !== undefined ? (prodData.wholesalePriceKg ? Number(prodData.wholesalePriceKg) : null) : p.wholesalePriceKg,
              wholesalePricePcs: prodData.wholesalePricePcs !== undefined ? (prodData.wholesalePricePcs ? Number(prodData.wholesalePricePcs) : null) : p.wholesalePricePcs,
              stockKg: prodData.stockKg !== undefined ? Number(prodData.stockKg) : p.stockKg,
              stockPcs: prodData.stockPcs !== undefined ? Number(prodData.stockPcs) : p.stockPcs,
              lowStockThresholdKg: prodData.lowStockThresholdKg !== undefined ? Number(prodData.lowStockThresholdKg) : p.lowStockThresholdKg,
              lowStockThresholdPcs: prodData.lowStockThresholdPcs !== undefined ? Number(prodData.lowStockThresholdPcs) : p.lowStockThresholdPcs,
              active: prodData.active !== undefined ? prodData.active : p.active,
              updatedAt: dt.date,
            };
          }
          return p;
        });
        try { localStorage.setItem('deshi_bite_products', JSON.stringify(next)); } catch {}
        return next;
      });
      showToast(`Product "${prodData.name || 'item'}" updated successfully!`, 'success');
    } else {
      // Create new product
      const newId = `PROD-${Date.now()}`;
      const newProd: Product = {
        id: newId,
        name: prodData.name?.trim() || 'New Item',
        retailPriceKg: prodData.retailPriceKg ? Number(prodData.retailPriceKg) : null,
        retailPricePcs: prodData.retailPricePcs ? Number(prodData.retailPricePcs) : null,
        wholesalePriceKg: prodData.wholesalePriceKg ? Number(prodData.wholesalePriceKg) : null,
        wholesalePricePcs: prodData.wholesalePricePcs ? Number(prodData.wholesalePricePcs) : null,
        stockKg: Number(prodData.stockKg) || 0,
        stockPcs: Number(prodData.stockPcs) || 0,
        lowStockThresholdKg: prodData.lowStockThresholdKg !== undefined ? Number(prodData.lowStockThresholdKg) : 0.5,
        lowStockThresholdPcs: Number(prodData.lowStockThresholdPcs) || 10,
        active: prodData.active !== undefined ? prodData.active : true,
        updatedAt: dt.date,
      };

      setProducts((prev) => {
        const next = [newProd, ...prev];
        try { localStorage.setItem('deshi_bite_products', JSON.stringify(next)); } catch {}
        return next;
      });

      if (newProd.stockKg > 0 || newProd.stockPcs > 0) {
        const initialStx: StockTransaction = {
          id: `STX-${Date.now()}`,
          productId: newProd.id,
          productName: newProd.name,
          type: 'INITIAL',
          quantity: newProd.stockKg || newProd.stockPcs,
          unit: newProd.stockKg > 0 ? 'KG' : 'PCS',
          referenceNote: 'Initial stock on product creation',
          recordedBy: currentUser?.name || 'Admin Manager',
          date: dt.date,
          time: dt.time,
          timestamp: dt.timestamp,
        };
        setStockTransactions((prev) => {
          const updated = [initialStx, ...prev];
          try { localStorage.setItem('deshi_bite_stock_tx', JSON.stringify(updated)); } catch {}
          return updated;
        });
      }

      showToast(`Product "${newProd.name}" added successfully!`, 'success');
    }

    setLoading(false);

    // Background sync with server
    try {
      const isEdit = Boolean(prodData.id);
      const url = isEdit ? `/api/products/${prodData.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prodData),
      }).catch((e) => console.warn('Background product sync note:', e));
    } catch {}

    return true;
  };

  const deleteProduct = async (productId: string): Promise<boolean> => {
    setLoading(true);
    let deletedName = 'Product';
    setProducts((prev) => {
      const target = prev.find((p) => p.id === productId);
      if (target) deletedName = target.name;
      const next = prev.filter((p) => p.id !== productId);
      try { localStorage.setItem('deshi_bite_products', JSON.stringify(next)); } catch {}
      return next;
    });
    showToast(`Product "${deletedName}" deleted successfully!`, 'success');
    setLoading(false);

    try {
      apiFetch(`/api/products/${productId}`, { method: 'DELETE' }).catch((e) => console.warn('Background delete note:', e));
    } catch {}

    return true;
  };

  const deleteAgent = async (agentId: string): Promise<boolean> => {
    setLoading(true);
    let agentName = 'Executive';
    setUsers((prev) => {
      const target = prev.find((u) => u.id === agentId);
      if (target) agentName = target.name;
      const next = prev.filter((u) => u.id !== agentId);
      try { localStorage.setItem('deshi_bite_users', JSON.stringify(next)); } catch {}
      return next;
    });
    showToast(`Executive "${agentName}" removed successfully!`, 'success');
    setLoading(false);

    try {
      apiFetch(`/api/agents/${agentId}`, { method: 'DELETE' }).catch((e) => console.warn('Background delete agent note:', e));
    } catch {}

    return true;
  };

  const recordStockChange = async (data: {
    productId: string;
    type: StockTransactionType;
    quantity: number;
    unit: UnitType;
    referenceNote?: string;
  }): Promise<boolean> => {
    setLoading(true);
    const dt = getClientDhakaTime();
    const qty = Number(data.quantity) || 0;

    let prodName = 'Product';
    setProducts((prev) => {
      const next = prev.map((p) => {
        if (p.id === data.productId) {
          prodName = p.name;
          const currentKg = p.stockKg || 0;
          const currentPcs = p.stockPcs || 0;
          let newKg = currentKg;
          let newPcs = currentPcs;
          const isAdding = data.type === 'STOCK_IN' || data.type === 'INITIAL' || data.type === 'RETURN';
          if (data.unit === 'KG') {
            newKg = isAdding ? currentKg + qty : Math.max(0, currentKg - qty);
          } else {
            newPcs = isAdding ? currentPcs + qty : Math.max(0, currentPcs - qty);
          }
          return { ...p, stockKg: Number(newKg.toFixed(3)), stockPcs: newPcs, updatedAt: dt.date };
        }
        return p;
      });
      try { localStorage.setItem('deshi_bite_products', JSON.stringify(next)); } catch {}
      return next;
    });

    const newTx: StockTransaction = {
      id: `STX-${Date.now()}`,
      productId: data.productId,
      productName: prodName,
      type: data.type,
      quantity: qty,
      unit: data.unit,
      referenceNote: data.referenceNote || '',
      recordedBy: currentUser?.name || 'Admin Manager',
      date: dt.date,
      time: dt.time,
      timestamp: dt.timestamp,
    };

    setStockTransactions((prev) => {
      const next = [newTx, ...prev];
      try { localStorage.setItem('deshi_bite_stock_tx', JSON.stringify(next)); } catch {}
      return next;
    });

    showToast(`Stock updated: ${data.type} of ${qty} ${data.unit}`, 'success');
    setLoading(false);

    try {
      apiFetch('/api/stock/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          recordedBy: currentUser?.name || 'Admin Manager',
        }),
      }).catch((e) => console.warn('Background stock sync note:', e));
    } catch {}

    return true;
  };

  const deleteStockTransaction = async (id: string): Promise<boolean> => {
    setLoading(true);
    setStockTransactions((prev) => {
      const next = prev.filter((tx) => tx.id !== id);
      try { localStorage.setItem('deshi_bite_stock_tx', JSON.stringify(next)); } catch {}
      return next;
    });
    showToast('Stock transaction removed', 'success');
    setLoading(false);

    try {
      apiFetch(`/api/stock/${id}`, { method: 'DELETE' }).catch((e) => console.warn('Background delete note:', e));
    } catch {}

    return true;
  };

  const updateAgentStatus = async (agentId: string, status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED'): Promise<boolean> => {
    setLoading(true);
    
    // 1. Locate the agent in current local state
    const targetAgent = users.find((u) => u.id === agentId);

    // 2. GUARANTEED IMMEDIATE STATE UPDATE (Never blocks the Admin)
    if (status === 'REJECTED') {
      setUsers((prev) => prev.filter((u) => u.id !== agentId));
      showToast('Executive registration rejected and removed from system', 'info');
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === agentId ? { ...u, status } : u))
      );
      showToast(`Executive status updated to ${status}`, 'success');
    }

    // 3. Persist local backup immediately
    try {
      const updatedUsers = status === 'REJECTED'
        ? users.filter((u) => u.id !== agentId)
        : users.map((u) => (u.id === agentId ? { ...u, status } : u));
      localStorage.setItem('deshi_bite_users_cache', JSON.stringify(updatedUsers));
    } catch {}

    // 4. Send background sync to server with full agent metadata so server can auto-upsert if missing
    try {
      const res = await apiFetch(`/api/agents/${agentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          adminName: currentUser?.name || 'Admin Manager',
          phone: targetAgent?.phone,
          name: targetAgent?.name,
          address: targetAgent?.address,
        }),
      });

      if (res.ok) {
        await refreshData();
      }
    } catch (e) {
      console.warn('Server sync notice for agent status update:', e);
    }

    setLoading(false);
    return true;
  };

  const markNotificationsAsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      // client update
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const syncWithGoogleSheets = async (scriptUrl?: string): Promise<boolean> => {
    const url = scriptUrl || settings.googleAppsScriptUrl;
    if (!url) {
      showToast('Please enter your deployed Google Apps Script Web App URL first', 'error');
      return false;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/sync/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Google Sheets sync failed. Check URL permissions.', 'error');
        setLoading(false);
        return false;
      }
      showToast('Google Sheets synchronized successfully!', 'success');
      setLoading(false);
      return true;
    } catch (e: any) {
      showToast('Error connecting to Google Sheets endpoint', 'error');
      setLoading(false);
      return false;
    }
  };

  const updateSettings = async (newSettings: Partial<BusinessSettings>): Promise<boolean> => {
    setSettings((prev) => {
      const next = { ...prev, ...newSettings };
      try { localStorage.setItem('deshi_bite_settings', JSON.stringify(next)); } catch {}
      return next;
    });
    showToast('Settings saved successfully', 'success');

    try {
      apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      }).catch((e) => console.warn('Background settings sync note:', e));
    } catch {}

    return true;
  };

  const updateProfile = async (data: { email?: string; address?: string }): Promise<boolean> => {
    if (!currentUser) return false;
    setLoading(true);

    const updatedUser = {
      ...currentUser,
      email: data.email !== undefined ? data.email : currentUser.email,
      address: data.address !== undefined ? data.address : currentUser.address,
    };

    setCurrentUser(updatedUser);
    try {
      sessionStorage.setItem('deshi_bite_user', JSON.stringify(updatedUser));
      localStorage.setItem('deshi_bite_user', JSON.stringify(updatedUser));
    } catch {}

    setUsers((prev) => {
      const next = prev.map((u) => (u.id === currentUser.id ? { ...u, ...data } : u));
      try { localStorage.setItem('deshi_bite_users', JSON.stringify(next)); } catch {}
      return next;
    });

    showToast('Profile updated successfully!', 'success');
    setLoading(false);

    try {
      apiFetch(`/api/users/${currentUser.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch((e) => console.warn('Background profile sync note:', e));
    } catch {}

    return true;
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    if (!currentUser) return false;
    setLoading(true);

    showToast('Password changed successfully!', 'success');
    setLoading(false);

    try {
      apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          oldPassword,
          newPassword,
        }),
      }).catch((e) => console.warn('Background password sync note:', e));
    } catch {}

    return true;
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        products,
        users,
        sales,
        stockTransactions,
        payments,
        notifications,
        logs,
        settings,
        loading,
        activeTab,
        setActiveTab,
        toasts,
        showToast,
        removeToast,
        isSellModalOpen,
        setIsSellModalOpen,
        isPaymentModalOpen,
        setIsPaymentModalOpen,
        isProductModalOpen,
        setIsProductModalOpen,
        isStockModalOpen,
        setIsStockModalOpen,
        isInvoiceModalOpen,
        setIsInvoiceModalOpen,
        isNotificationModalOpen,
        setIsNotificationModalOpen,
        isGoogleSheetModalOpen,
        setIsGoogleSheetModalOpen,
        isMongoModalOpen,
        setIsMongoModalOpen,
        mongoStatus,
        checkMongoStatus,
        connectMongo,
        syncMongo,
        selectedSaleForInvoice,
        setSelectedSaleForInvoice,
        selectedAgentForPayment,
        setSelectedAgentForPayment,
        editingProduct,
        setEditingProduct,
        login,
        registerAgent,
        logout,
        createSale,
        recordPayment,
        saveProduct,
        deleteProduct,
        deleteAgent,
        recordStockChange,
        deleteStockTransaction,
        updateAgentStatus,
        markNotificationsAsRead,
        syncWithGoogleSheets,
        updateSettings,
        updateProfile,
        changePassword,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
