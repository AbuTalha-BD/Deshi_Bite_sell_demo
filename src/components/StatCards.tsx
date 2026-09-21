import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Sale, isProductLowStock } from '../types';
import {
  getBangladeshWeekDays,
  getDhakaYMD,
  getBangladeshMonthInfo,
  isSaleInDhakaMonth,
} from '../utils/salesDateUtils';
import {
  TrendingUp,
  Calendar,
  CalendarDays,
  ShoppingBag,
  AlertTriangle,
  Users,
  Package,
  Clock,
  DollarSign,
} from 'lucide-react';

export const StatCards: React.FC = () => {
  const { currentUser, sales, products, users } = useApp();
  const isAdmin = currentUser?.role === 'ADMIN';

  // Live timer state: automatically refreshes at midnight, at weekly reset (Saturday),
  // and at monthly reset (1st of the month) in Asia/Dhaka time without requiring manual reload.
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000); // Ticks every 30 seconds
    return () => clearInterval(timer);
  }, []);

  // Filter sales for this agent if Agent
  const relevantSales = isAdmin ? sales : sales.filter((s) => s.agentId === currentUser?.id);

  // Accurate Today, Week, and Month calculations in Asia/Dhaka timezone
  const todayYmd = getDhakaYMD(currentTime);
  const todayDhaka = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(currentTime));

  const isSaleToday = (s: Sale) => {
    if (s.createdAtDate === todayDhaka) return true;
    if (s.timestamp && !isNaN(s.timestamp)) {
      return getDhakaYMD(s.timestamp) === todayYmd;
    }
    return false;
  };

  const todaySales = relevantSales
    .filter(isSaleToday)
    .reduce((acc, s) => acc + s.grandTotal, 0);

  // Current Week Sales (Bangladesh business calendar: Saturday to Friday)
  const { startDateYmd, endDateYmd, formattedRange } = getBangladeshWeekDays(0, currentTime);
  const isSaleThisWeek = (s: Sale) => {
    const saleYmd = s.timestamp ? getDhakaYMD(s.timestamp) : getDhakaYMD(s.createdAtDate);
    if (!saleYmd) return isSaleToday(s);
    return saleYmd >= startDateYmd && saleYmd <= endDateYmd;
  };

  const weekSales = relevantSales
    .filter(isSaleThisWeek)
    .reduce((acc, s) => acc + s.grandTotal, 0);

  // Month Sales (current calendar month in Asia/Dhaka)
  const { yearMonthYm, fullMonthName } = getBangladeshMonthInfo(currentTime);
  const isSaleThisMonth = (s: Sale) => isSaleInDhakaMonth(s, yearMonthYm, fullMonthName);

  const monthSales = relevantSales
    .filter(isSaleThisMonth)
    .reduce((acc, s) => acc + s.grandTotal, 0);

  // Total Lifetime Sales
  const totalSales = relevantSales.reduce((acc, s) => acc + s.grandTotal, 0);

  // Due calculation
  const totalDueAcrossAgents = users
    .filter((u) => u.role === 'AGENT')
    .reduce((acc, u) => acc + u.currentDue, 0);

  const agentPersonalDue = currentUser?.currentDue || 0;

  // Products stock status
  const lowStockCount = products.filter(isProductLowStock).length;

  const totalAgents = users.filter((u) => u.role === 'AGENT').length;
  const pendingAgentsCount = users.filter((u) => u.role === 'AGENT' && u.status === 'PENDING').length;

  if (isAdmin) {
    return (
      <div className="space-y-4">
        {/* Row 1: Sales Revenue Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Today's Sales */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100/70 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Today's Sales</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              ৳{todaySales.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 font-medium">Daily gross total</p>
          </div>

          {/* This Week */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100/70 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">This Week</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              ৳{weekSales.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 font-medium">Sat – Fri ({formattedRange})</p>
          </div>

          {/* This Month */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100/70 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">This Month</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              ৳{monthSales.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 font-medium">{fullMonthName}</p>
          </div>

          {/* Total Sales */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100/70 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Total Sales</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              ৳{totalSales.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 font-medium">Lifetime system orders</p>
          </div>
        </div>

        {/* Row 2: Operational Status Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Due */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-rose-100 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Total Due</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-600 tracking-tight">
              ৳{totalDueAcrossAgents.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 font-medium">Executive outstanding payable</p>
          </div>

          {/* Total Agents */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100/70 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Total Executives</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {totalAgents}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 font-medium">
              {pendingAgentsCount > 0 ? (
                <span className="text-amber-600 font-bold">{pendingAgentsCount} pending approval</span>
              ) : (
                'All active and verified'
              )}
            </p>
          </div>

          {/* Total Products */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100/70 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Total Products</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {products.length}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 font-medium">Frozen items catalog</p>
          </div>

          {/* Low Stock Items */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100/70 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Low Stock Items</span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  lowStockCount > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
                lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {lowStockCount}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 font-medium">
              {lowStockCount > 0 ? 'Requires stock replenishing' : 'Optimal inventory levels'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // AGENT STATS VIEW (Exact match to screenshot photo_2026-09-16_17-57-10.jpg)
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Today's Sale */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100/70 shadow-xs hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Today's Sale</span>
          <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          ৳{todaySales.toLocaleString()}
        </div>
        <p className="text-[11px] text-slate-600 mt-1 font-medium">Confirmed orders today</p>
      </div>

      {/* This Week */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100/70 shadow-xs hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">This Week</span>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          ৳{weekSales.toLocaleString()}
        </div>
        <p className="text-[11px] text-slate-600 mt-1 font-medium">Sat – Fri ({formattedRange})</p>
      </div>

      {/* This Month */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100/70 shadow-xs hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">This Month</span>
          <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <CalendarDays className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          ৳{monthSales.toLocaleString()}
        </div>
        <p className="text-[11px] text-slate-600 mt-1 font-medium">{fullMonthName}</p>
      </div>

      {/* Current Due */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-rose-100 shadow-xs hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Current Due</span>
          <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-rose-600 tracking-tight">
          ৳{agentPersonalDue.toLocaleString()}
        </div>
        <p className="text-[11px] text-slate-600 mt-1 font-medium">Payable to Admin</p>
      </div>
    </div>
  );
};
