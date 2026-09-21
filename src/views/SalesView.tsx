import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SaleType } from '../types';
import { ShoppingCart, Search, FileText, ShoppingBag, Filter, Calendar } from 'lucide-react';

export const SalesView: React.FC = () => {
  const {
    sales,
    currentUser,
    setSelectedSaleForInvoice,
    setIsInvoiceModalOpen,
    setIsSellModalOpen,
  } = useApp();

  const isAdmin = currentUser?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState<'ALL' | SaleType>('ALL');

  // Filter sales
  const relevantSales = isAdmin ? sales : sales.filter((s) => s.agentId === currentUser?.id);

  const filteredSales = useMemo(() => {
    return relevantSales.filter((s) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        s.invoiceNo.toLowerCase().includes(q) ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        (s.agentName && s.agentName.toLowerCase().includes(q));
      if (!matchSearch) return false;

      if (saleTypeFilter !== 'ALL' && s.saleType !== saleTypeFilter) return false;
      return true;
    });
  }, [relevantSales, search, saleTypeFilter]);

  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.grandTotal, 0);
  const retailCount = filteredSales.filter((s) => s.saleType === 'RETAIL').length;
  const wholesaleCount = filteredSales.filter((s) => s.saleType === 'WHOLESALE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {isAdmin ? 'All Sales Orders & Invoices' : 'My Sales Orders & Cash Memos'}
          </h2>
          <p className="text-xs text-slate-600 font-medium">
            {isAdmin
              ? 'Complete sales history, digital cash memos, and itemized customer billing'
              : 'Keep track of all your confirmed retail and wholesale sales'}
          </p>
        </div>

        {!isAdmin && (
          <button
            onClick={() => setIsSellModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>SELL PRODUCT</span>
          </button>
        )}
      </div>

      {/* Summary KPI chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-purple-100/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-600 uppercase">Total Filtered Sales</span>
          <div className="text-2xl font-extrabold text-purple-900 mt-1">৳{totalRevenue.toLocaleString()}</div>
          <p className="text-[11px] text-slate-600 mt-0.5">{filteredSales.length} total orders</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100/80 shadow-xs">
          <span className="text-[11px] font-bold text-purple-700 uppercase">Retail Orders (খুচরা)</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{retailCount} Orders</div>
          <p className="text-[11px] text-slate-600 mt-0.5">End-consumer purchases</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100/80 shadow-xs">
          <span className="text-[11px] font-bold text-indigo-700 uppercase">Wholesale Orders (পাইকারি)</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{wholesaleCount} Orders</div>
          <p className="text-[11px] text-slate-600 mt-0.5">Bulk dealer store supply</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-purple-100/80 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, customer or executive..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-purple-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['ALL', 'RETAIL', 'WHOLESALE'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSaleTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                saleTypeFilter === t
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {t === 'ALL' ? 'All Invoices' : t === 'RETAIL' ? 'Retail (খুচরা)' : 'Wholesale (পাইকারি)'}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-3xl border border-purple-100/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Date & Time</th>
                {isAdmin && <th className="py-3 px-4">Executive Name</th>}
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Ordered Items</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Cash Memo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-purple-50/20 transition-colors">
                  <td className="py-3 px-4 font-mono font-extrabold text-slate-900">{sale.invoiceNo}</td>

                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                    <div className="font-semibold text-slate-900">{sale.createdAtDate}</div>
                    <div className="text-[10px] text-slate-600">{sale.createdAtTime}</div>
                  </td>

                  {isAdmin && (
                    <td className="py-3 px-4 font-bold text-purple-900 whitespace-nowrap">
                      {sale.agentName}
                    </td>
                  )}

                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{sale.customerName || 'Direct Customer'}</div>
                    {sale.customerPhone && (
                      <div className="text-[10px] text-slate-600">{sale.customerPhone}</div>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sale.saleType === 'RETAIL'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {sale.saleType}
                    </span>
                  </td>

                  <td className="py-3 px-4 max-w-xs truncate text-slate-700 font-medium">
                    {sale.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}
                  </td>

                  <td className="py-3 px-4 text-right font-extrabold text-slate-900 text-sm">
                    ৳{sale.grandTotal.toLocaleString()}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => {
                        setSelectedSaleForInvoice(sale);
                        setIsInvoiceModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 font-bold text-xs transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Memo</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
