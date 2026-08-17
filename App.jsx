import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from './lib/supabase';
import {
  Trash2, Plus, Download, Calendar, TrendingUp, PieChart as PieIcon, FileText,
  ChevronLeft, ChevronRight, Check, ArrowUpRight, ArrowDownRight, Sparkles, LogOut,
} from 'lucide-react';

const BASE = import.meta.env.BASE_URL;

const css = `
  @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
  @keyframes slideX { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes fillWidth { from { width: 0; } to { width: var(--w); } }
  @keyframes checkPop { 0% { transform: scale(0.6); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
  .fade-up { animation: fadeUp 0.5s ease-out backwards; }
  .fade-in { animation: fadeIn 0.4s ease-out backwards; }
  .pop-in { animation: popIn 0.35s ease-out backwards; }
  .slide-x { animation: slideX 0.4s ease-out backwards; }
  .fill-bar { animation: fillWidth 0.9s cubic-bezier(0.22,1,0.36,1) forwards; }
  .check-pop { animation: checkPop 0.3s ease-out; }
  .press { transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease; }
  .press:active { transform: scale(0.96); }
  .hoverable { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .hoverable:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(11,18,41,0.08); }
  .scroll-x { -ms-overflow-style: none; scrollbar-width: none; }
  .scroll-x::-webkit-scrollbar { display: none; }
  * { box-sizing: border-box; }
`;

const PRIORITY_META = {
  high: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'High', dot: '#EF4444' },
  medium: { color: '#D97706', bg: 'rgba(217,119,6,0.12)', label: 'Medium', dot: '#D97706' },
  low: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Low', dot: '#10B981' },
};

const RANK_COLORS = [
  'linear-gradient(145deg, #F97316, #EA580C)',
  'linear-gradient(145deg, #14B8A6, #0D9488)',
  'linear-gradient(145deg, #3B82F6, #2563EB)',
  'linear-gradient(145deg, #8B5CF6, #7C3AED)',
];

const CHART_COLORS = ['#0891B2', '#14B8A6', '#3B82F6', '#8B5CF6', '#F97316', '#D97706', '#10B981'];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [monthlyPlans, setMonthlyPlans] = useState({});
  const [activeNav, setActiveNav] = useState('planner');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next.toISOString().slice(0, 7);
  });

  const [incomeForm, setIncomeForm] = useState({ source: '', amount: '' });
  const [expenseForm, setExpenseForm] = useState({ category: '', amount: '', priority: 'medium' });
  const [transactionForm, setTransactionForm] = useState({ amount: '', category: '', type: 'expense', date: new Date().toISOString().split('T')[0] });
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setTransactions([]);
      setMonthlyPlans({});
      return;
    }

    const loadData = async () => {
      setDataLoading(true);
      const [profileResult, transactionsResult, incomesResult, expensesResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').eq('id', user.id).maybeSingle(),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('transaction_date', { ascending: false }),
        supabase.from('planned_incomes').select('*').eq('user_id', user.id).order('due_date', { ascending: true }),
        supabase.from('planned_expenses').select('*').eq('user_id', user.id).order('due_date', { ascending: true }),
      ]);

      if (profileResult.data) setProfile(profileResult.data);
      if (transactionsResult.data) {
        setTransactions(transactionsResult.data.map((t) => ({
          id: t.id, amount: Number(t.amount), category: t.category || '', type: t.type, date: t.transaction_date, description: t.description,
        })));
      }

      const plans = {};
      (incomesResult.data || []).forEach((i) => {
        const month = (i.due_date || new Date().toISOString().slice(0, 10)).slice(0, 7);
        if (!plans[month]) plans[month] = { incomes: [], expenses: [] };
        plans[month].incomes.push({ id: i.id, source: i.source, amount: Number(i.amount) });
      });
      (expensesResult.data || []).forEach((e) => {
        const month = (e.due_date || new Date().toISOString().slice(0, 10)).slice(0, 7);
        if (!plans[month]) plans[month] = { incomes: [], expenses: [] };
        plans[month].expenses.push({ id: e.id, category: e.category || '', amount: Number(e.amount), priority: e.priority || 'medium', fulfilled: Boolean(e.completed) });
      });
      setMonthlyPlans(plans);
      setDataLoading(false);
    };

    loadData();
  }, [user]);

  const currentPlan = monthlyPlans[selectedMonth] || { incomes: [], expenses: [] };

  const updatePlanLocal = (month, updater) => {
    setMonthlyPlans((prev) => {
      const existing = prev[month] || { incomes: [], expenses: [] };
      return { ...prev, [month]: updater(existing) };
    });
  };

  const addIncome = async (e) => {
    e.preventDefault();
    if (!user || !incomeForm.source || !incomeForm.amount) return;
    const { data, error } = await supabase.from('planned_incomes').insert({
      user_id: user.id, source: incomeForm.source, amount: parseFloat(incomeForm.amount), due_date: `${selectedMonth}-01`,
    }).select().single();
    if (error) return alert(error.message);
    updatePlanLocal(selectedMonth, (plan) => ({ ...plan, incomes: [...plan.incomes, { id: data.id, source: data.source, amount: Number(data.amount) }] }));
    setIncomeForm({ source: '', amount: '' });
    setShowIncomeForm(false);
  };

  const addExpense = async (e) => {
    e.preventDefault();
    if (!user || !expenseForm.category || !expenseForm.amount) return;
    const { data, error } = await supabase.from('planned_expenses').insert({
      user_id: user.id, description: expenseForm.category, category: expenseForm.category, amount: parseFloat(expenseForm.amount), priority: expenseForm.priority, due_date: `${selectedMonth}-01`, completed: false,
    }).select().single();
    if (error) return alert(error.message);
    updatePlanLocal(selectedMonth, (plan) => ({ ...plan, expenses: [...plan.expenses, { id: data.id, category: data.category || data.description, amount: Number(data.amount), priority: data.priority, fulfilled: Boolean(data.completed) }] }));
    setExpenseForm({ category: '', amount: '', priority: 'medium' });
    setShowExpenseForm(false);
  };

  const toggleFulfilled = async (id) => {
    const item = currentPlan.expenses.find((e) => e.id === id);
    if (!item) return;
    const { error } = await supabase.from('planned_expenses').update({ completed: !item.fulfilled }).eq('id', id).eq('user_id', user.id);
    if (error) return alert(error.message);
    updatePlanLocal(selectedMonth, (plan) => ({ ...plan, expenses: plan.expenses.map((e) => (e.id === id ? { ...e, fulfilled: !e.fulfilled } : e)) }));
  };

  const deleteIncome = async (id) => {
    const { error } = await supabase.from('planned_incomes').delete().eq('id', id).eq('user_id', user.id);
    if (error) return alert(error.message);
    updatePlanLocal(selectedMonth, (plan) => ({ ...plan, incomes: plan.incomes.filter((i) => i.id !== id) }));
  };

  const deleteExpense = async (id) => {
    const { error } = await supabase.from('planned_expenses').delete().eq('id', id).eq('user_id', user.id);
    if (error) return alert(error.message);
    updatePlanLocal(selectedMonth, (plan) => ({ ...plan, expenses: plan.expenses.filter((e) => e.id !== id) }));
  };

  const changeMonth = (offset) => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() + offset);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const getMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-');
    return new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const totalIncome = currentPlan.incomes.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = currentPlan.expenses.reduce((s, e) => s + e.amount, 0);
  const fulfilledTotal = currentPlan.expenses.filter((e) => e.fulfilled).reduce((s, e) => s + e.amount, 0);
  const pendingTotal = totalExpenses - fulfilledTotal;
  const projectedBalance = totalIncome - totalExpenses;
  const fulfilledPct = totalExpenses > 0 ? (fulfilledTotal / totalExpenses) * 100 : 0;

  const priorityRank = { high: 0, medium: 1, low: 2 };
  const sortedExpenses = useMemo(() => {
    return [...currentPlan.expenses].sort((a, b) => {
      if (a.fulfilled !== b.fulfilled) return a.fulfilled ? 1 : -1;
      if (priorityRank[a.priority] !== priorityRank[b.priority]) return priorityRank[a.priority] - priorityRank[b.priority];
      return b.amount - a.amount;
    });
  }, [currentPlan.expenses]);

  const topPriorities = useMemo(() => {
    return [...currentPlan.expenses]
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.amount - a.amount)
      .slice(0, 4);
  }, [currentPlan.expenses]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    currentPlan.expenses.forEach((e) => {
      if (!map[e.category]) map[e.category] = { planned: 0, fulfilled: 0 };
      map[e.category].planned += e.amount;
      if (e.fulfilled) map[e.category].fulfilled += e.amount;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v }));
  }, [currentPlan.expenses]);

  const pieData = categoryBreakdown.map((c) => ({ name: c.name, value: c.planned }));

  // Transactions tab
  const addTransaction = async (e) => {
    e.preventDefault();
    if (!user || !transactionForm.amount || !transactionForm.category) return;
    const { data, error } = await supabase.from('transactions').insert({
      user_id: user.id, amount: parseFloat(transactionForm.amount), category: transactionForm.category, description: transactionForm.category, type: transactionForm.type, transaction_date: transactionForm.date,
    }).select().single();
    if (error) return alert(error.message);
    setTransactions((prev) => [{ id: data.id, amount: Number(data.amount), category: data.category || '', type: data.type, date: data.transaction_date, description: data.description }, ...prev]);
    setTransactionForm({ amount: '', category: '', type: 'expense', date: new Date().toISOString().split('T')[0] });
  };

  const deleteTransaction = async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
    if (error) return alert(error.message);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const getCurrentMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };
  const monthTransactions = [...transactions].filter((t) => t.date.startsWith(getCurrentMonth())).reverse();
  const actualIncome = monthTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const actualExpenses = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const exportReport = () => {
    const report = { month: selectedMonth, totalIncome, totalExpenses, fulfilledTotal, pendingTotal, projectedBalance, incomes: currentPlan.incomes, expenses: currentPlan.expenses };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `budget-tracker-${selectedMonth}.json`; a.click();
  };

  // ---- Style tokens ----
  const heroBg = {
    background: `radial-gradient(160px 160px at 92% -8%, rgba(245,158,11,0.55), transparent 70%),
                  radial-gradient(180px 180px at -8% 112%, rgba(45,212,191,0.45), transparent 70%),
                  linear-gradient(135deg, #0B1229 0%, #0F3B57 55%, #0891B2 120%)`,
  };
  const splitBg = {
    background: `radial-gradient(90px 90px at 4% -10%, rgba(59,130,246,0.55), transparent 70%),
                  radial-gradient(90px 90px at 98% 112%, rgba(249,115,22,0.5), transparent 70%),
                  linear-gradient(120deg, #0B1229 0%, #123354 100%)`,
  };

  const pageStyle = { minHeight: '100vh', background: '#F4F3F1', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", color: '#14171F', paddingBottom: '5.5rem' };
  const shell = { maxWidth: 480, margin: '0 auto', padding: '1.25rem 1.25rem 0' };
  const card = { background: '#FFFFFF', borderRadius: 20, border: '1px solid #ECEAE6', boxShadow: '0 1px 2px rgba(20,23,31,0.04)' };

  const NAV_ITEMS = [
    { id: 'planner', label: 'Planner', icon: Calendar },
    { id: 'tracker', label: 'Activity', icon: TrendingUp },
    { id: 'analytics', label: 'Insights', icon: PieIcon },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  if (authLoading) {
    return <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>Loading…</div>;
  }

  if (passwordRecovery) {
    return <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div style={pageStyle}>
      <style>{css}</style>

      {/* Top bar */}
      <div style={shell}>
        <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src={`${BASE}icon-192.png`} alt="Bernance" style={{ width: 40, height: 40, borderRadius: 12, boxShadow: '0 4px 10px rgba(11,18,41,0.25)' }} />
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#8A8F98', fontWeight: 500 }}>{getGreeting()}</p>
              <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{profile?.full_name || user?.email?.split('@')[0] || 'User'}</p>
            </div>
          </div>
          <button className="press" onClick={() => supabase.auth.signOut()} title="Log out" style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid #ECEAE6', background: '#fff', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <LogOut size={17} />
          </button>
        </div>
      </div>

      {/* PLANNER TAB */}
      {activeNav === 'planner' && (
        <div style={shell}>
          {/* Month navigator + hero */}
          <div className="pop-in hoverable" style={{ ...card, ...heroBg, border: 'none', borderRadius: 24, padding: '1.5rem', color: '#fff', position: 'relative', overflow: 'hidden', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <button className="press" onClick={() => changeMonth(-1)} style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.02em', opacity: 0.9 }}>{getMonthName(selectedMonth)}</span>
              <button className="press" onClick={() => changeMonth(1)} style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <ChevronRight size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75, fontWeight: 500 }}>Projected Balance</p>
            <p style={{ margin: '0.35rem 0 0.25rem', fontSize: '2.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              ₦{projectedBalance.toLocaleString()}
            </p>
            <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.65 }}>
              Expected income minus planned expenses for the month
            </p>

            {totalExpenses > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.4rem' }}>
                  <span>Fulfilled</span>
                  <span>{fulfilledPct.toFixed(0)}% · ₦{fulfilledTotal.toLocaleString()} of ₦{totalExpenses.toLocaleString()}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                  <div className="fill-bar" style={{ '--w': `${fulfilledPct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #2DD4BF, #F59E0B)' }} />
                </div>
              </div>
            )}
          </div>

          {/* Income / Expenses split */}
          <div className="pop-in" style={{ ...splitBg, borderRadius: 20, padding: '1.25rem 1.5rem', color: '#fff', display: 'flex', alignItems: 'center', marginBottom: '1.5rem', animationDelay: '0.05s' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <ArrowUpRight size={16} color="#4ADE80" />
                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Income</span>
              </div>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>₦{totalIncome.toLocaleString()}</p>
            </div>
            <div style={{ width: 1, height: 38, background: 'rgba(255,255,255,0.2)', margin: '0 1rem' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <ArrowDownRight size={16} color="#FB7185" />
                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Planned</span>
              </div>
              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>₦{totalExpenses.toLocaleString()}</p>
            </div>
          </div>

          {/* Top priorities horizontal scroll */}
          {topPriorities.length > 0 && (
            <div className="fade-up" style={{ marginBottom: '1.5rem', animationDelay: '0.1s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.85rem' }}>
                <Sparkles size={16} color="#D97706" />
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Top priorities</h2>
              </div>
              <div className="scroll-x" style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                {topPriorities.map((item, idx) => (
                  <div key={item.id} className="pop-in hoverable" style={{
                    minWidth: 130, borderRadius: 18, padding: '1rem', color: '#fff',
                    background: RANK_COLORS[idx % RANK_COLORS.length],
                    animationDelay: `${0.05 * idx}s`, position: 'relative', opacity: item.fulfilled ? 0.55 : 1,
                  }}>
                    <div style={{ width: 24, height: 24, borderRadius: 999, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, marginBottom: '1.75rem' }}>
                      {idx + 1}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.category}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '1.05rem', fontWeight: 700 }}>₦{item.amount.toLocaleString()}</p>
                    {item.fulfilled && <Check size={14} style={{ position: 'absolute', top: 12, right: 12 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Income */}
          <div className="fade-up" style={{ ...card, padding: '1.25rem', marginBottom: '1rem', animationDelay: '0.12s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showIncomeForm ? '1rem' : 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Expected income</h3>
              <button className="press" onClick={() => setShowIncomeForm((s) => !s)} style={{ width: 30, height: 30, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg,#0891B2,#0B1229)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transform: showIncomeForm ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>
                <Plus size={16} />
              </button>
            </div>

            {showIncomeForm && (
              <form onSubmit={addIncome} className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                <input type="text" placeholder="Source (e.g. Salary)" value={incomeForm.source} onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })} style={inputStyle} />
                <input type="number" placeholder="Amount (₦)" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} style={inputStyle} />
                <button type="submit" className="press" style={{ ...primaryBtn, background: 'linear-gradient(135deg,#0891B2,#0B1229)' }}>Add income</button>
              </form>
            )}

            {currentPlan.incomes.length === 0 && !showIncomeForm && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#9CA3AF' }}>No income added for this month yet.</p>
            )}

            {currentPlan.incomes.map((inc, idx) => (
              <div key={inc.id} className="slide-x" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0', borderTop: idx === 0 ? 'none' : '1px solid #F1F0EE', animationDelay: `${idx * 0.05}s` }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{inc.source}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0891B2' }}>₦{inc.amount.toLocaleString()}</span>
                  <button className="press" onClick={() => deleteIncome(inc.id)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', display: 'flex' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Expense */}
          <div className="fade-up" style={{ ...card, padding: '1.25rem', marginBottom: '1.5rem', animationDelay: '0.16s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showExpenseForm ? '1rem' : 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Planned expenses</h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#9CA3AF' }}>Tick items off as you pay them</p>
              </div>
              <button className="press" onClick={() => setShowExpenseForm((s) => !s)} style={{ width: 30, height: 30, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transform: showExpenseForm ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                <Plus size={16} />
              </button>
            </div>

            {showExpenseForm && (
              <form onSubmit={addExpense} className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
                <input type="text" placeholder="Category (e.g. Rent, Food)" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} style={inputStyle} />
                <input type="number" placeholder="Amount (₦)" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} style={inputStyle} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['high', 'medium', 'low'].map((p) => (
                    <button key={p} type="button" onClick={() => setExpenseForm({ ...expenseForm, priority: p })} className="press" style={{
                      flex: 1, padding: '0.55rem', borderRadius: 10, border: expenseForm.priority === p ? `1.5px solid ${PRIORITY_META[p].color}` : '1px solid #E8E6E3',
                      background: expenseForm.priority === p ? PRIORITY_META[p].bg : '#fff', color: expenseForm.priority === p ? PRIORITY_META[p].color : '#6B7280',
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                    }}>{p}</button>
                  ))}
                </div>
                <button type="submit" className="press" style={{ ...primaryBtn, background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>Add expense</button>
              </form>
            )}

            {sortedExpenses.length === 0 && !showExpenseForm && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#9CA3AF' }}>No planned expenses yet — add what's ahead.</p>
            )}

            <div style={{ marginTop: showExpenseForm ? '0.5rem' : 0 }}>
              {sortedExpenses.map((exp, idx) => (
                <div key={exp.id} className="slide-x" style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0',
                  borderTop: idx === 0 ? 'none' : '1px solid #F1F0EE', opacity: exp.fulfilled ? 0.55 : 1,
                  animationDelay: `${idx * 0.04}s`, transition: 'opacity 0.3s ease',
                }}>
                  <button
                    onClick={() => toggleFulfilled(exp.id)}
                    className={exp.fulfilled ? 'check-pop' : ''}
                    style={{
                      width: 26, height: 26, borderRadius: 999, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: exp.fulfilled ? 'none' : `2px solid ${PRIORITY_META[exp.priority].color}`,
                      background: exp.fulfilled ? 'linear-gradient(135deg,#2DD4BF,#0891B2)' : 'transparent',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {exp.fulfilled && <Check size={14} color="#fff" strokeWidth={3} />}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, textDecoration: exp.fulfilled ? 'line-through' : 'none', color: exp.fulfilled ? '#9CA3AF' : '#14171F' }}>{exp.category}</p>
                    <span style={{ display: 'inline-block', marginTop: '0.2rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: PRIORITY_META[exp.priority].color, background: PRIORITY_META[exp.priority].bg, padding: '0.15rem 0.5rem', borderRadius: 999 }}>
                      {PRIORITY_META[exp.priority].label}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: exp.fulfilled ? '#9CA3AF' : '#14171F' }}>₦{exp.amount.toLocaleString()}</span>
                  <button className="press" onClick={() => deleteExpense(exp.id)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', display: 'flex' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Category progress */}
          {categoryBreakdown.length > 0 && (
            <div className="fade-up" style={{ ...card, padding: '1.25rem', marginBottom: '1.5rem', animationDelay: '0.2s' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Fulfilled vs planned</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {categoryBreakdown.map((cat, idx) => {
                  const pct = cat.planned > 0 ? (cat.fulfilled / cat.planned) * 100 : 0;
                  return (
                    <div key={cat.name} className="fade-up" style={{ animationDelay: `${idx * 0.06}s` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                        <span style={{ color: '#9CA3AF' }}>₦{cat.fulfilled.toLocaleString()} / ₦{cat.planned.toLocaleString()}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: '#F1F0EE', overflow: 'hidden' }}>
                        <div className="fill-bar" style={{ '--w': `${pct}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${CHART_COLORS[idx % CHART_COLORS.length]}, #2DD4BF)` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {activeNav === 'tracker' && (
        <div style={shell}>
          <h1 className="fade-up" style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Activity</h1>
          <p className="fade-up" style={{ fontSize: '0.85rem', color: '#8A8F98', margin: '0 0 1.25rem', animationDelay: '0.05s' }}>Actual income & spending this month</p>

          <div className="fade-up hoverable" style={{ ...splitBg, borderRadius: 20, padding: '1.1rem 1.4rem', color: '#fff', display: 'flex', marginBottom: '1.25rem', animationDelay: '0.08s' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>Income</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '1.15rem', fontWeight: 700 }}>₦{actualIncome.toLocaleString()}</p>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', margin: '0 1rem' }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>Expenses</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '1.15rem', fontWeight: 700 }}>₦{actualExpenses.toLocaleString()}</p>
            </div>
          </div>

          <div className="fade-up" style={{ ...card, padding: '1.25rem', marginBottom: '1.25rem', animationDelay: '0.1s' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Log a transaction</h3>
            <form onSubmit={addTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <input type="number" placeholder="Amount (₦)" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} style={inputStyle} />
              <input type="text" placeholder="Category" value={transactionForm.category} onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })} style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select value={transactionForm.type} onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
                <input type="date" value={transactionForm.date} onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              </div>
              <button type="submit" className="press" style={{ ...primaryBtn, background: 'linear-gradient(135deg,#0891B2,#0B1229)' }}>Add transaction</button>
            </form>
          </div>

          <div className="fade-up" style={{ ...card, padding: '1.25rem', animationDelay: '0.14s' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>Recent</h3>
            {monthTransactions.length === 0 ? (
              <p style={{ color: '#9CA3AF', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>No transactions yet</p>
            ) : (
              monthTransactions.map((t, idx) => (
                <div key={t.id} className="slide-x" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0', borderTop: idx === 0 ? 'none' : '1px solid #F1F0EE', animationDelay: `${idx * 0.04}s` }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{t.category}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>{t.date}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: t.type === 'income' ? '#0891B2' : '#14171F' }}>{t.type === 'income' ? '+' : '−'}₦{t.amount.toLocaleString()}</span>
                    <button className="press" onClick={() => deleteTransaction(t.id)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', display: 'flex' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {activeNav === 'analytics' && (
        <div style={shell}>
          <h1 className="fade-up" style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Insights</h1>
          <p className="fade-up" style={{ fontSize: '0.85rem', color: '#8A8F98', margin: '0 0 1.25rem', animationDelay: '0.05s' }}>{getMonthName(selectedMonth)} planned spending</p>

          {pieData.length === 0 ? (
            <div className="fade-up" style={{ ...card, padding: '2.5rem 1.5rem', textAlign: 'center', color: '#9CA3AF' }}>
              <PieIcon size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Add planned expenses to see your breakdown</p>
            </div>
          ) : (
            <>
              <div className="fade-up hoverable" style={{ ...card, padding: '1.5rem', marginBottom: '1.25rem' }}>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `₦${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="fade-up" style={{ ...card, padding: '1.25rem', animationDelay: '0.08s' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>By category</h3>
                {categoryBreakdown.sort((a, b) => b.planned - a.planned).map((cat, idx) => (
                  <div key={cat.name} className="slide-x" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0', borderTop: idx === 0 ? 'none' : '1px solid #F1F0EE', animationDelay: `${idx * 0.05}s` }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: CHART_COLORS[idx % CHART_COLORS.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 500 }}>{cat.name}</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>₦{cat.planned.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* REPORTS TAB */}
      {activeNav === 'reports' && (
        <div style={shell}>
          <h1 className="fade-up" style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Reports</h1>
          <p className="fade-up" style={{ fontSize: '0.85rem', color: '#8A8F98', margin: '0 0 1.25rem', animationDelay: '0.05s' }}>Export your {getMonthName(selectedMonth)} plan</p>

          <div className="pop-in" style={{ ...heroBg, borderRadius: 20, padding: '1.5rem', color: '#fff', marginBottom: '1.25rem' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.75 }}>Net projected</p>
            <p style={{ margin: '0.3rem 0 1rem', fontSize: '1.9rem', fontWeight: 800 }}>₦{projectedBalance.toLocaleString()}</p>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.7 }}>INCOME</p>
                <p style={{ margin: '0.15rem 0 0', fontSize: '1rem', fontWeight: 700 }}>₦{totalIncome.toLocaleString()}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.7 }}>PLANNED</p>
                <p style={{ margin: '0.15rem 0 0', fontSize: '1rem', fontWeight: 700 }}>₦{totalExpenses.toLocaleString()}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.7 }}>FULFILLED</p>
                <p style={{ margin: '0.15rem 0 0', fontSize: '1rem', fontWeight: 700 }}>₦{fulfilledTotal.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <button onClick={exportReport} className="press" style={{ ...primaryBtn, background: 'linear-gradient(135deg,#0891B2,#0B1229)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Download size={16} /> Export as JSON
          </button>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderTop: '1px solid #ECEAE6', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', padding: '0.6rem 0.5rem' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button key={item.id} onClick={() => setActiveNav(item.id)} className="press" style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0', cursor: 'pointer' }}>
                <div style={{ width: 40, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'linear-gradient(135deg,#0891B2,#0B1229)' : 'transparent', transition: 'background 0.25s ease' }}>
                  <Icon size={18} color={active ? '#fff' : '#9CA3AF'} strokeWidth={active ? 2.4 : 2} />
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: active ? 700 : 500, color: active ? '#0B1229' : '#9CA3AF' }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const resetFields = () => { setError(''); setMessage(''); };

  const switchMode = (next) => {
    setMode(next);
    resetFields();
    setPassword('');
    setConfirmPassword('');
  };

  const submit = async (e) => {
    e.preventDefault();
    resetFields();

    if (mode === 'signup' && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + BASE,
      });
      if (error) setError(error.message);
      else setMessage('Reset link sent. Check your email, then follow the link to set a new password.');
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName.trim() } } });
      if (error) setError(error.message);
      else if (!data.session) setMessage('Account created. Check your email to confirm your account, then log in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  };

  const titleCopy = {
    login: 'Plan your money before you spend it.',
    signup: 'Plan your money before you spend it.',
    forgot: "We'll email you a link to reset your password.",
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F3F1', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 24, border: '1px solid #ECEAE6', padding: '2rem', boxShadow: '0 12px 40px rgba(20,23,31,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src={`${BASE}icon-192.png`} alt="Bernance" style={{ width: 58, height: 58, borderRadius: 16, marginBottom: '0.75rem' }} />
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Bernance</h1>
          <p style={{ margin: '0.35rem 0 0', color: '#8A8F98', fontSize: '0.88rem' }}>{titleCopy[mode]}</p>
        </div>

        {mode !== 'forgot' && (
          <div style={{ display: 'flex', background: '#F4F3F1', borderRadius: 12, padding: 4, marginBottom: '1rem' }}>
            {['login', 'signup'].map((item) => (
              <button key={item} type="button" onClick={() => switchMode(item)} style={{ flex: 1, border: 'none', borderRadius: 9, padding: '0.65rem', background: mode === item ? '#fff' : 'transparent', fontWeight: 700, color: mode === item ? '#0B1229' : '#8A8F98', cursor: 'pointer', boxShadow: mode === item ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                {item === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>
        )}

        {mode === 'forgot' && (
          <button type="button" onClick={() => switchMode('login')} className="press" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: '#0891B2', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginBottom: '1rem' }}>
            <ChevronLeft size={16} /> Back to log in
          </button>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {mode === 'signup' && <input required type="text" placeholder="Name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />}
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

          {mode !== 'forgot' && (
            <input required minLength={6} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          )}
          {mode === 'signup' && (
            <input required minLength={6} type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
          )}

          {error && <p style={{ margin: 0, color: '#DC2626', fontSize: '0.8rem' }}>{error}</p>}
          {message && <p style={{ margin: 0, color: '#059669', fontSize: '0.8rem' }}>{message}</p>}

          <button disabled={loading} type="submit" className="press" style={{ ...primaryBtn, marginTop: '0.25rem', background: 'linear-gradient(135deg,#0891B2,#0B1229)', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset email'}
          </button>

          {mode === 'login' && (
            <button type="button" onClick={() => switchMode('forgot')} className="press" style={{ background: 'none', border: 'none', color: '#8A8F98', fontSize: '0.8rem', cursor: 'pointer', padding: '0.25rem 0', textAlign: 'center' }}>
              Forgot password?
            </button>
          )}
        </form>

        <p style={{ margin: '1rem 0 0', textAlign: 'center', color: '#9CA3AF', fontSize: '0.72rem', lineHeight: 1.5 }}>Your financial data is private to your account.</p>
      </div>
    </div>
  );
}

function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F3F1', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 24, border: '1px solid #ECEAE6', padding: '2rem', boxShadow: '0 12px 40px rgba(20,23,31,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src={`${BASE}icon-192.png`} alt="Bernance" style={{ width: 58, height: 58, borderRadius: 16, marginBottom: '0.75rem' }} />
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{done ? 'Password updated' : 'Set a new password'}</h1>
          <p style={{ margin: '0.35rem 0 0', color: '#8A8F98', fontSize: '0.88rem' }}>
            {done ? 'You can now continue into your account.' : 'Choose a new password for your account.'}
          </p>
        </div>

        {done ? (
          <button onClick={onDone} className="press" style={{ ...primaryBtn, width: '100%', background: 'linear-gradient(135deg,#0891B2,#0B1229)' }}>
            Continue
          </button>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <input required minLength={6} type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            <input required minLength={6} type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
            {error && <p style={{ margin: 0, color: '#DC2626', fontSize: '0.8rem' }}>{error}</p>}
            <button disabled={loading} type="submit" className="press" style={{ ...primaryBtn, marginTop: '0.25rem', background: 'linear-gradient(135deg,#0891B2,#0B1229)', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Please wait…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '0.75rem 0.9rem',
  border: '1px solid #E8E6E3',
  borderRadius: 12,
  fontSize: '0.9rem',
  background: '#FAFAF9',
  outline: 'none',
  width: '100%',
};

const primaryBtn = {
  padding: '0.8rem',
  border: 'none',
  borderRadius: 12,
  color: '#fff',
  fontWeight: 700,
  fontSize: '0.9rem',
  cursor: 'pointer',
};
