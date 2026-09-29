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
    agentId?: string;
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

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      // Strictly require authentication: shared links or fresh sessions default to null (Login page)
      const sessionUser = sessionStorage.getItem('deshi_bite_user');
      if (sessionUser) return JSON.parse(sessionUser);
      return null;
    } catch {
      return null;
    }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('deshi_bite_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_PRODUCTS;
  });

  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('deshi_bite_users');
      if (saved) {
        const parsed = JSON.parse(saved);
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
      const saved = localStorage.getItem('deshi_bite_sales');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_SALES;
  });

  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('deshi_bite_stock_tx');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_STOCK_TRANSACTIONS;
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('deshi_bite_payments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_PAYMENTS;
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('deshi_bite_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_NOTIFICATIONS;
  });

  const [logs, setLogs] = useState<AdminLog[]>(INITIAL_LOGS);
  const [settings, setSettings] = useState<BusinessSettings>(() => {
    try {
      const saved = localStorage.getItem('deshi_bite_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
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
      const res = await fetch('/api/mongodb/status');
      if (res.ok) {
        const data = await res.json();
        setMongoStatus(data);
        return data;
      }
    } catch (e) {
      console.warn('Failed to check MongoDB status:', e);
    }
    return null;
  };

  const connectMongo = async (uri: string): Promise<{ success: boolean; message: string }> => {
    setLoading(true);
    try {
      const res = await fetch('/api/mongodb/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri }),
      });
      const data = await res.json();
      if (data.status) {
        setMongoStatus(data.status);
      }
      if (data.success) {
        showToast(data.message || 'Connected to MongoDB Atlas Cloud!', 'success');
        await refreshData();
      } else {
        showToast(data.message || 'Failed to connect to MongoDB', 'error');
      }
      setLoading(false);
      return { success: data.success, message: data.message };
    } catch (err: any) {
      setLoading(false);
      const msg = err.message || 'Network error connecting to MongoDB';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const syncMongo = async (direction: 'push' | 'pull' = 'push'): Promise<{ success: boolean; message: string }> => {
    setLoading(true);
    try {
      const res = await fetch('/api/mongodb/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'MongoDB Cloud sync completed!', 'success');
        await refreshData();
        await checkMongoStatus();
      } else {
        showToast(data.error || 'MongoDB Cloud sync failed', 'error');
      }
      setLoading(false);
      return { success: data.success, message: data.message || data.error };
    } catch (err: any) {
      setLoading(false);
      const msg = err.message || 'Sync failed';
      showToast(msg, 'error');
      return { success: false, message: msg };
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

  // Sync client state to serverless backend
  const syncClientStateToServer = async (overrideData?: any) => {
    try {
      const payload = overrideData || {
        products,
        sales,
        users,
        stockTransactions,
        payments,
        settings,
      };
      await fetch('/api/sync/client-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // ignore
    }
  };

  // Fetch full state from server on mount with intelligent non-destructive merging
  const refreshData = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();

        // 1. Products merge: Never overwrite user-added products
        setProducts((prev) => {
          const map = new Map<string, Product>();
          (data.products || []).forEach((p: Product) => map.set(p.id, p));
          prev.forEach((p) => {
            if (!map.has(p.id)) map.set(p.id, p);
          });
          const merged = Array.from(map.values());
          try {
            localStorage.setItem('deshi_bite_products', JSON.stringify(merged));
          } catch {}
          return merged;
        });

        // 2. Sales merge
        setSales((prev) => {
          const map = new Map<string, Sale>();
          (data.sales || []).forEach((s: Sale) => map.set(s.id, s));
          prev.forEach((s) => {
            if (!map.has(s.id)) map.set(s.id, s);
          });
          const merged = Array.from(map.values());
          try {
            localStorage.setItem('deshi_bite_sales', JSON.stringify(merged));
          } catch {}
          return merged;
        });

        // 3. Users merge
        setUsers((prev) => {
          const map = new Map<string, User>();
          (data.users || []).forEach((u: User) => map.set(u.id, u));
          prev.forEach((u) => {
            if (!map.has(u.id)) map.set(u.id, u);
          });
          const merged = Array.from(map.values());
          try {
            localStorage.setItem('deshi_bite_users', JSON.stringify(merged));
          } catch {}
          return merged;
        });

        // 4. Stock Transactions merge
        if (Array.isArray(data.stockTransactions)) {
          setStockTransactions((prev) => {
            const map = new Map<string, StockTransaction>();
            data.stockTransactions.forEach((tx: StockTransaction) => map.set(tx.id, tx));
            prev.forEach((tx) => {
              if (!map.has(tx.id)) map.set(tx.id, tx);
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('deshi_bite_stock_tx', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        // 5. Payments merge
        if (Array.isArray(data.payments)) {
          setPayments((prev) => {
            const map = new Map<string, PaymentRecord>();
            data.payments.forEach((p: PaymentRecord) => map.set(p.id, p));
            prev.forEach((p) => {
              if (!map.has(p.id)) map.set(p.id, p);
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('deshi_bite_payments', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        if (data.settings) {
          setSettings(data.settings);
          try {
            localStorage.setItem('deshi_bite_settings', JSON.stringify(data.settings));
          } catch {}
        }

        // Update currentUser if logged in
        if (currentUser) {
          const freshUser = (data.users || []).find((u: User) => u.id === currentUser.id);
          if (freshUser) {
            setCurrentUser(freshUser);
            sessionStorage.setItem('deshi_bite_user', JSON.stringify(freshUser));
            localStorage.setItem('deshi_bite_user', JSON.stringify(freshUser));
          }
        }
      }
    } catch (e) {
      console.warn('Backend state fetch notice:', e);
    }
  };

  useEffect(() => {
    refreshData();
    checkMongoStatus();
  }, []);

  const login = async (phone: string, pass: string): Promise<boolean> => {
    setLoading(true);
    const cleanPhone = phone.trim();
    const cleanPass = pass.trim();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, password: cleanPass }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok && data?.user) {
        setCurrentUser(data.user);
        sessionStorage.setItem('deshi_bite_user', JSON.stringify(data.user));
        localStorage.setItem('deshi_bite_user', JSON.stringify(data.user));
        showToast(`Welcome back, ${data.user.name}!`, 'success');
        setActiveTab('dashboard');
        setLoading(false);
        return true;
      }

      // If credentials specifically rejected with 401/403
      if (res.status === 401 || res.status === 403) {
        const errorMsg = data?.error || 'Invalid phone number or password';
        showToast(errorMsg, 'error');
        setLoading(false);
        return false;
      }

      throw new Error(data?.error || `Status: ${res.status}`);
    } catch (err: any) {
      console.warn('Backend login unavailable, verifying against local credential store:', err);

      // Resilient Fallback: Verify against known seeds & registered users
      const match = INITIAL_USERS.find(
        (u) => u.phone === cleanPhone && u.passwordHash === cleanPass
      );

      if (match) {
        const { passwordHash, ...safeUser } = match;
        setCurrentUser(safeUser);
        sessionStorage.setItem('deshi_bite_user', JSON.stringify(safeUser));
        localStorage.setItem('deshi_bite_user', JSON.stringify(safeUser));
        showToast(`Welcome back, ${safeUser.name}!`, 'success');
        setActiveTab('dashboard');
        setLoading(false);
        return true;
      }

      showToast(err?.message || 'Invalid phone number or password', 'error');
      setLoading(false);
      return false;
    }
  };

  const registerAgent = async (data: { name: string; phone: string; password: string; address?: string }): Promise<boolean> => {
    setLoading(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const newAgent: User = {
        id: `AGENT-${Date.now()}`,
        name: data.name.trim(),
        phone: data.phone.trim(),
        role: 'AGENT',
        status: 'PENDING',
        totalSales: 0,
        totalPaid: 0,
        currentDue: 0,
        address: data.address?.trim() || '',
        joinedDate: dateStr,
      };

      setUsers((prev) => {
        const updated = [...prev.filter((u) => u.phone !== newAgent.phone), newAgent];
        try {
          localStorage.setItem('deshi_bite_users', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      showToast('Registration submitted! Please await Admin approval.', 'success');

      try {
        await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch {}

      setLoading(false);
      return true;
    } catch (err: any) {
      showToast('Registration notice', 'error');
      setLoading(false);
      return false;
    }
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
    agentId?: string;
  }): Promise<Sale | null> => {
    if (!currentUser) {
      showToast('Please sign in to record a sale', 'error');
      return null;
    }

    setLoading(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const timestamp = now.getTime();

      const targetAgentId = saleData.agentId || currentUser.id;
      const targetAgent = users.find((u) => u.id === targetAgentId) || currentUser;

      const invoiceCounter = sales.length + 1;
      const invoiceNo = `DB-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(invoiceCounter).padStart(5, '0')}`;
      const saleId = `SALE-${Date.now()}-${invoiceCounter}`;

      let subtotal = 0;
      const frozenItems: SaleItem[] = saleData.items.map((it) => {
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

      const discountAmount = Number(saleData.discount) || 0;
      const grandTotal = Math.max(0, subtotal - discountAmount);

      const newSale: Sale = {
        id: saleId,
        invoiceNo,
        agentId: targetAgent.id,
        agentName: targetAgent.name,
        customerName: saleData.customerName || 'Direct Customer',
        customerPhone: saleData.customerPhone || '',
        customerAddress: saleData.customerAddress || '',
        saleType: saleData.saleType,
        items: frozenItems,
        subtotal,
        discount: discountAmount,
        grandTotal,
        paymentStatus: 'UNPAID',
        createdAtDate: dateStr,
        createdAtTime: timeStr,
        timestamp,
      };

      // 1. Deduct Stock in LocalState
      setProducts((prev) => {
        const updated = prev.map((p) => {
          const matchingItem = frozenItems.find((it) => it.productId === p.id);
          if (!matchingItem) return p;
          if (matchingItem.unit === 'KG') {
            return { ...p, stockKg: Number(Math.max(0, (p.stockKg || 0) - matchingItem.quantity).toFixed(3)) };
          } else {
            return { ...p, stockPcs: Math.max(0, (p.stockPcs || 0) - matchingItem.quantity) };
          }
        });
        try {
          localStorage.setItem('deshi_bite_products', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // 2. Add Stock Transactions
      const newStockTxs: StockTransaction[] = frozenItems.map((it) => ({
        id: `STX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: it.productId,
        productName: it.productName,
        type: 'SALE_OUT',
        quantity: it.quantity,
        unit: it.unit,
        referenceNote: `Deducted via Sale ${invoiceNo}`,
        recordedBy: currentUser.name,
        date: dateStr,
        time: timeStr,
        createdAtDate: dateStr,
        createdAtTime: timeStr,
        timestamp,
      }));

      setStockTransactions((prev) => {
        const updated = [...newStockTxs, ...prev];
        try {
          localStorage.setItem('deshi_bite_stock_tx', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // 3. Add to Sales
      setSales((prev) => {
        const updated = [newSale, ...prev];
        try {
          localStorage.setItem('deshi_bite_sales', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // 4. Update Agent Due if target is an Agent
      if (targetAgent.role === 'AGENT') {
        setUsers((prev) => {
          const updated = prev.map((u) => {
            if (u.id === targetAgent.id) {
              const newTotalSales = Number(((u.totalSales || 0) + grandTotal).toFixed(2));
              const newCurrentDue = Number(((u.currentDue || 0) + grandTotal).toFixed(2));
              const updatedUser = { ...u, totalSales: newTotalSales, currentDue: newCurrentDue };
              if (currentUser.id === u.id) {
                setCurrentUser(updatedUser);
                sessionStorage.setItem('deshi_bite_user', JSON.stringify(updatedUser));
                localStorage.setItem('deshi_bite_user', JSON.stringify(updatedUser));
              }
              return updatedUser;
            }
            return u;
          });
          try {
            localStorage.setItem('deshi_bite_users', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }

      showToast(`Sale confirmed! Invoice ${newSale.invoiceNo} generated`, 'success');

      // 5. Asynchronously notify backend
      try {
        await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: targetAgent.id,
            saleType: saleData.saleType,
            items: frozenItems,
            customerName: saleData.customerName,
            customerPhone: saleData.customerPhone,
            customerAddress: saleData.customerAddress,
            discount: discountAmount,
          }),
        });
      } catch (err) {
        console.warn('Backend sync notice for sale:', err);
      }

      setLoading(false);
      return newSale;
    } catch (err: any) {
      showToast(err?.message || 'Error recording sale', 'error');
      setLoading(false);
      return null;
    }
  };

  const recordPayment = async (data: {
    agentId: string;
    amount: number;
    paymentMethod: string;
    referenceNote?: string;
  }): Promise<boolean> => {
    setLoading(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const timestamp = now.getTime();

      const agent = users.find((u) => u.id === data.agentId);
      if (!agent) {
        showToast('Executive not found', 'error');
        setLoading(false);
        return false;
      }

      const currentDue = agent.currentDue || 0;
      const payAmount = Number(data.amount) || 0;
      const remainingDue = Math.max(0, currentDue - payAmount);

      const newPay: PaymentRecord = {
        id: `PAY-${Date.now()}`,
        agentId: agent.id,
        agentName: agent.name,
        amount: payAmount,
        previousDue: currentDue,
        remainingDue,
        paymentMethod: data.paymentMethod || 'CASH',
        referenceNote: data.referenceNote || 'Payment collected',
        recordedBy: currentUser?.name || 'Admin Manager',
        date: dateStr,
        time: timeStr,
        createdAtDate: dateStr,
        createdAtTime: timeStr,
        timestamp,
      };

      setPayments((prev) => {
        const updated = [newPay, ...prev];
        try {
          localStorage.setItem('deshi_bite_payments', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setUsers((prev) => {
        const updated = prev.map((u) => {
          if (u.id === agent.id) {
            const newTotalPaid = Number(((u.totalPaid || 0) + newPay.amount).toFixed(2));
            const newCurrentDue = Number(Math.max(0, (u.currentDue || 0) - newPay.amount).toFixed(2));
            const updatedAgent = { ...u, totalPaid: newTotalPaid, currentDue: newCurrentDue };
            if (currentUser?.id === u.id) {
              setCurrentUser(updatedAgent);
              sessionStorage.setItem('deshi_bite_user', JSON.stringify(updatedAgent));
              localStorage.setItem('deshi_bite_user', JSON.stringify(updatedAgent));
            }
            return updatedAgent;
          }
          return u;
        });
        try {
          localStorage.setItem('deshi_bite_users', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      showToast(`Payment of ৳${data.amount.toLocaleString()} successfully recorded!`, 'success');

      try {
        await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            recordedBy: currentUser?.name || 'Admin Manager',
          }),
        });
      } catch (err) {
        console.warn('Backend sync notice for payment:', err);
      }

      setLoading(false);
      return true;
    } catch (e: any) {
      showToast('Failed to record payment', 'error');
      setLoading(false);
      return false;
    }
  };

  const saveProduct = async (prodData: Partial<Product>): Promise<boolean> => {
    setLoading(true);
    try {
      const isEdit = Boolean(prodData.id);
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const targetId = prodData.id || `PROD-${Date.now()}`;
      const fullProd: Product = {
        id: targetId,
        name: prodData.name || 'Unnamed Product',
        unit: prodData.unit || 'KG',
        retailPriceKg: prodData.retailPriceKg !== undefined ? prodData.retailPriceKg : null,
        retailPricePcs: prodData.retailPricePcs !== undefined ? prodData.retailPricePcs : null,
        wholesalePriceKg: prodData.wholesalePriceKg !== undefined ? prodData.wholesalePriceKg : null,
        wholesalePricePcs: prodData.wholesalePricePcs !== undefined ? prodData.wholesalePricePcs : null,
        stockKg: Number(prodData.stockKg) || 0,
        stockPcs: Number(prodData.stockPcs) || 0,
        lowStockThresholdKg: prodData.lowStockThresholdKg !== undefined ? prodData.lowStockThresholdKg : 0.5,
        lowStockThresholdPcs: prodData.lowStockThresholdPcs !== undefined ? prodData.lowStockThresholdPcs : 20,
        active: prodData.active !== undefined ? prodData.active : true,
        updatedAt: dateStr,
      };

      // 1. Immediately update React state and LocalStorage (Instant UI feedback!)
      setProducts((prev) => {
        let updated: Product[];
        if (isEdit) {
          updated = prev.map((p) => (p.id === targetId ? fullProd : p));
        } else {
          updated = [fullProd, ...prev.filter((p) => p.id !== targetId)];
        }
        try {
          localStorage.setItem('deshi_bite_products', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      showToast(`Product "${fullProd.name}" saved successfully!`, 'success');

      // 2. Persist to Backend in background
      const url = isEdit ? `/api/products/${targetId}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      try {
        await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullProd),
        });
      } catch (err) {
        console.warn('Backend sync notice for saveProduct:', err);
      }

      setLoading(false);
      return true;
    } catch (e: any) {
      showToast(e?.message || 'Error saving product', 'error');
      setLoading(false);
      return false;
    }
  };

  const deleteProduct = async (productId: string): Promise<boolean> => {
    setLoading(true);
    try {
      setProducts((prev) => {
        const updated = prev.filter((p) => p.id !== productId);
        try {
          localStorage.setItem('deshi_bite_products', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      showToast('Product deleted successfully!', 'success');

      try {
        await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Backend sync notice for deleteProduct:', err);
      }

      setLoading(false);
      return true;
    } catch (e) {
      showToast('Error deleting product', 'error');
      setLoading(false);
      return false;
    }
  };

  const deleteAgent = async (agentId: string): Promise<boolean> => {
    setLoading(true);
    try {
      setUsers((prev) => {
        const updated = prev.filter((u) => u.id !== agentId);
        try {
          localStorage.setItem('deshi_bite_users', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      showToast('Executive removed successfully!', 'success');

      try {
        await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
      } catch {}

      setLoading(false);
      return true;
    } catch (e) {
      showToast('Error removing executive', 'error');
      setLoading(false);
      return false;
    }
  };

  const recordStockChange = async (data: {
    productId: string;
    type: StockTransactionType;
    quantity: number;
    unit: UnitType;
    referenceNote?: string;
  }): Promise<boolean> => {
    setLoading(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const timestamp = now.getTime();

      const prod = products.find((p) => p.id === data.productId);
      const prodName = prod?.name || 'Product';

      // 1. Update Product Stock in LocalStorage
      setProducts((prev) => {
        const updated = prev.map((p) => {
          if (p.id !== data.productId) return p;
          const currentKg = p.stockKg || 0;
          const currentPcs = p.stockPcs || 0;
          let newKg = currentKg;
          let newPcs = currentPcs;

          const delta = data.type === 'INITIAL' || data.type === 'STOCK_IN' ? data.quantity : -data.quantity;

          if (data.unit === 'KG') {
            newKg = Number(Math.max(0, currentKg + delta).toFixed(3));
          } else {
            newPcs = Math.max(0, currentPcs + delta);
          }
          return { ...p, stockKg: newKg, stockPcs: newPcs };
        });
        try {
          localStorage.setItem('deshi_bite_products', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // 2. Add Stock Transaction
      const newTx: StockTransaction = {
        id: `STX-${Date.now()}`,
        productId: data.productId,
        productName: prodName,
        type: data.type,
        quantity: data.quantity,
        unit: data.unit,
        referenceNote: data.referenceNote || 'Stock adjusted',
        recordedBy: currentUser?.name || 'Admin Manager',
        date: dateStr,
        time: timeStr,
        createdAtDate: dateStr,
        createdAtTime: timeStr,
        timestamp,
      };

      setStockTransactions((prev) => {
        const updated = [newTx, ...prev];
        try {
          localStorage.setItem('deshi_bite_stock_tx', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      showToast(`Stock updated: ${data.type} of ${data.quantity} ${data.unit}`, 'success');

      try {
        await fetch('/api/stock/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            recordedBy: currentUser?.name || 'Admin Manager',
          }),
        });
      } catch {}

      setLoading(false);
      return true;
    } catch (e) {
      showToast('Stock change error', 'error');
      setLoading(false);
      return false;
    }
  };

  const deleteStockTransaction = async (id: string): Promise<boolean> => {
    setLoading(true);
    try {
      setStockTransactions((prev) => {
        const updated = prev.filter((tx) => tx.id !== id);
        try {
          localStorage.setItem('deshi_bite_stock_tx', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      showToast('Stock transaction removed', 'success');

      try {
        await fetch(`/api/stock/${id}`, { method: 'DELETE' });
      } catch {}

      setLoading(false);
      return true;
    } catch (e) {
      showToast('Failed to delete transaction', 'error');
      setLoading(false);
      return false;
    }
  };

  const updateAgentStatus = async (agentId: string, status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED'): Promise<boolean> => {
    setLoading(true);
    try {
      setUsers((prev) => {
        let updated: User[];
        if (status === 'REJECTED') {
          updated = prev.filter((u) => u.id !== agentId);
        } else {
          updated = prev.map((u) => (u.id === agentId ? { ...u, status } : u));
        }
        try {
          localStorage.setItem('deshi_bite_users', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      if (status === 'REJECTED') {
        showToast('Executive registration rejected and removed from system', 'info');
      } else {
        showToast(`Executive status updated to ${status}`, 'success');
      }

      try {
        await fetch(`/api/agents/${agentId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, adminName: currentUser?.name || 'Admin' }),
        });
      } catch {}

      setLoading(false);
      return true;
    } catch (e) {
      showToast('Error updating executive', 'error');
      setLoading(false);
      return false;
    }
  };

  const markNotificationsAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PUT' });
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
      const res = await fetch('/api/sync/sheets', {
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
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        showToast('Settings saved successfully', 'success');
        return true;
      }
      return false;
    } catch (e) {
      setSettings((prev) => ({ ...prev, ...newSettings }));
      showToast('Settings saved', 'success');
      return true;
    }
  };

  const updateProfile = async (data: { email?: string; address?: string }): Promise<boolean> => {
    if (!currentUser) return false;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        showToast(resData.error || 'Failed to update profile', 'error');
        setLoading(false);
        return false;
      }
      showToast(resData.message || 'Profile updated successfully!', 'success');
      if (resData.user) {
        setCurrentUser(resData.user);
        sessionStorage.setItem('deshi_bite_user', JSON.stringify(resData.user));
      }
      await refreshData();
      setLoading(false);
      return true;
    } catch (e) {
      showToast('Error connecting to server', 'error');
      setLoading(false);
      return false;
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    if (!currentUser) return false;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          oldPassword,
          newPassword,
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        showToast(resData.error || 'Failed to change password', 'error');
        setLoading(false);
        return false;
      }
      showToast(resData.message || 'Password changed successfully!', 'success');
      setLoading(false);
      return true;
    } catch (e) {
      showToast('Error connecting to server', 'error');
      setLoading(false);
      return false;
    }
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
