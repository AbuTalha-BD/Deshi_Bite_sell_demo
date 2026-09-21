import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StockTransaction, isProductLowStock } from '../types';
import {
  Boxes,
  Plus,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Undo2,
  Calendar,
  Clock,
  User,
  ArrowRight,
} from 'lucide-react';

export const StockView: React.FC = () => {
  const { stockTransactions, products, setIsStockModalOpen, currentUser } = useApp();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Overview metrics
  const totalStockKg = products.reduce((acc, p) => acc + p.stockKg, 0);
  const totalStockPcs = products.reduce((acc, p) => acc + p.stockPcs, 0);
  const lowStockCount = products.filter(isProductLowStock).length;

  const filteredTransactions = useMemo(() => {
    return stockTransactions.filter((tx) => {
      const matchSearch =
        tx.productName.toLowerCase().includes(search.toLowerCase().trim()) ||
        (tx.referenceNote && tx.referenceNote.toLowerCase().includes(search.toLowerCase().trim()));
      if (!matchSearch) return false;

      if (selectedType !== 'ALL' && tx.type !== selectedType) return false;
      return true;
    });
  }, [stockTransactions, search, selectedType]);

  const getTxDate = (tx: StockTransaction) => {
    if (tx.date) return tx.date;
    if (tx.createdAtDate) return tx.createdAtDate;
    if (tx.timestamp) {
      return new Date(tx.timestamp).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return 'Recent';
  };

  const getTxTime = (tx: StockTransaction) => {
    if (tx.time) return tx.time;
    if (tx.createdAtTime) return tx.createdAtTime;
    if (tx.timestamp) {
      return new Date(tx.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    return '';
  };

  const getActionTypeBadge = (type: string) => {
    switch (type) {
      case 'STOCK_IN':
        return {
          style: 'bg-emerald-100 text-emerald-800 border border-emerald-200/60',
          icon: <ArrowDownRight className="w-3 h-3 shrink-0" />,
          isPositive: true,
        };
      case 'SALE':
      case 'SALE_OUT':
        return {
          style: 'bg-purple-100 text-purple-800 border border-purple-200/60',
          icon: <ArrowUpRight className="w-3 h-3 shrink-0" />,
          isPositive: false,
        };
      case 'STOCK_OUT':
        return {
          style: 'bg-rose-100 text-rose-800 border border-rose-200/60',
          icon: <ArrowUpRight className="w-3 h-3 shrink-0" />,
          isPositive: false,
        };
      case 'RETURN':
        return {
          style: 'bg-indigo-100 text-indigo-800 border border-indigo-200/60',
          icon: <Undo2 className="w-3 h-3 shrink-0" />,
          isPositive: true,
        };
      case 'ADJUSTMENT':
      default:
        return {
          style: 'bg-amber-100 text-amber-800 border border-amber-200/60',
          icon: <RefreshCw className="w-3 h-3 shrink-0" />,
          isPositive: false,
        };
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Stock Management & Ledger</h2>
          <p className="text-xs text-slate-600 font-medium">
            Real-time warehouse inventory audits, factory arrivals, and sales deductions
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsStockModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Stock Change</span>
          </button>
        )}
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-purple-100/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-600 uppercase">Total Warehouse Stock (KG)</span>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-900 mt-1">{totalStockKg.toLocaleString()} KG</div>
          <p className="text-[11px] text-slate-600 mt-0.5">Across {products.length} catalog items</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-600 uppercase">Total Warehouse Stock (PCS)</span>
          <div className="text-xl sm:text-2xl font-extrabold text-indigo-900 mt-1">{totalStockPcs.toLocaleString()} PCS</div>
          <p className="text-[11px] text-slate-600 mt-0.5">Individually packaged pieces</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100/80 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase">Critical Low Stock Items</span>
          <div
            className={`text-xl sm:text-2xl font-extrabold mt-1 ${
              lowStockCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-900'
            }`}
          >
            {lowStockCount} Products
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">Below reorder alert limit</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-purple-100/80 shadow-xs">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product or reference..."
            className="w-full pl-9 pr-3 py-2 sm:py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-purple-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {['ALL', 'STOCK_IN', 'SALE', 'STOCK_OUT', 'ADJUSTMENT', 'RETURN'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                selectedType === t
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {t === 'ALL' ? 'ALL' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Transactions Audit Ledger */}
      <div className="bg-white rounded-3xl border border-purple-100/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Inventory Ledger Audit History</h3>
            <p className="text-xs text-slate-600 font-medium">Real-time audited movement of warehouse goods</p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl whitespace-nowrap">
            {filteredTransactions.length} records
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No stock transactions found.</div>
        ) : (
          <>
            {/* Mobile Responsive Card View (No cramped sideways scroll) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const txDate = getTxDate(tx);
                const txTime = getTxTime(tx);
                const { style: badgeStyle, icon: typeIcon, isPositive } = getActionTypeBadge(tx.type);
                const hasFlow = tx.stockBefore !== undefined && tx.stockAfter !== undefined;

                return (
                  <div key={tx.id} className="p-4 space-y-2.5 hover:bg-purple-50/15 transition-colors">
                    {/* Top Row: Date & Time + Action Type Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="font-bold text-slate-900">{txDate}</span>
                        {txTime && <span className="text-slate-500 font-normal">• {txTime}</span>}
                      </div>

                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${badgeStyle}`}>
                        {typeIcon}
                        <span>{tx.type.replace('_', ' ')}</span>
                      </span>
                    </div>

                    {/* Middle Row: Product Name + Quantity Change */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm leading-snug">{tx.productName}</h4>
                        {hasFlow ? (
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                            <span>Flow:</span>
                            <span>{tx.stockBefore}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <strong className="text-slate-800">{tx.stockAfter} {tx.unit}</strong>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 mt-0.5 block">Unit: {tx.unit}</span>
                        )}
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-base font-extrabold font-mono ${
                            isPositive ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {isPositive ? '+' : '-'}
                          {tx.quantity} {tx.unit}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Recorded By & Reference Note */}
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-50">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>
                          By: <strong className="text-slate-700 font-semibold">{tx.recordedBy}</strong>
                        </span>
                      </div>

                      {tx.referenceNote && (
                        <span className="italic text-slate-500 truncate max-w-[170px]" title={tx.referenceNote}>
                          {tx.referenceNote}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Action Type</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-center">Stock Flow</th>
                    <th className="py-3 px-4">Recorded By</th>
                    <th className="py-3 px-4">Reference Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((tx) => {
                    const txDate = getTxDate(tx);
                    const txTime = getTxTime(tx);
                    const { style: badgeStyle, icon: typeIcon, isPositive } = getActionTypeBadge(tx.type);
                    const hasFlow = tx.stockBefore !== undefined && tx.stockAfter !== undefined;

                    return (
                      <tr key={tx.id} className="hover:bg-purple-50/20 transition-colors">
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>{txDate}</span>
                          </div>
                          {txTime && (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 pl-5">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{txTime}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 font-extrabold text-slate-900">{tx.productName}</td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeStyle}`}
                          >
                            {typeIcon}
                            <span>{tx.type.replace('_', ' ')}</span>
                          </span>
                        </td>

                        <td
                          className={`py-3 px-4 text-right font-extrabold font-mono ${
                            isPositive ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {isPositive ? '+' : '-'}
                          {tx.quantity} {tx.unit}
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-slate-600 whitespace-nowrap">
                          {hasFlow ? (
                            <div className="inline-flex items-center gap-1">
                              <span>{tx.stockBefore}</span>
                              <span className="text-slate-400">&rarr;</span>
                              <span className="font-bold text-slate-900">{tx.stockAfter}</span>
                              <span className="text-[10px] text-slate-500">{tx.unit}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">{tx.recordedBy}</td>

                        <td className="py-3 px-4 text-slate-600 italic max-w-xs truncate">
                          {tx.referenceNote || 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
