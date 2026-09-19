"use client";
/* Initial client preferences, session hydration and external dialog state are synchronized in effects. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  LayoutDashboard,
  ChartNoAxesCombined,
  Wallet,
  Settings,
  Plus,
  Search,
  Download,
  X,
  Pencil,
  Trash2,
  ChevronRight,
  LogOut,
  CircleHelp,
  SlidersHorizontal,
  CreditCard,
  Target,
} from "lucide-react";
import { ThemeToggle } from "@/components/penny/theme";
import UserTour from "@/components/penny/user-tour";
import { supabase } from "@/lib/supabase";
import {
  Budget,
  Transaction,
  categories,
  colors,
  money,
  cents,
  totals,
  csv,
  demoRows,
} from "@/lib/finance";

const dateToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Transactions", icon: ArrowLeftRight },
  { name: "Budgets", icon: Target },
  { name: "Reports", icon: ChartNoAxesCombined },
  { name: "Settings", icon: Settings },
];
export default function Home() {
  const [view, setView] = useState("Overview");
  const [tourRequest, setTourRequest] = useState(0);
  const [month, setMonth] = useState("2026-09");
  const [rows, setRows] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [demo, setDemo] = useState(!supabase);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const [currency, setCurrency] = useState("USD");
  const [modal, setModal] = useState<"transaction" | "budget" | "auth" | null>(
    null,
  );
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [pendingDelete, setPendingDelete] = useState<{id: string; table: "transactions" | "budgets"} | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const deleteLock = useRef(false);
  useEffect(() => {
    if (pendingDelete) deleteDialog.current?.showModal();
    else deleteDialog.current?.close();
  }, [pendingDelete]);
  const dialog = useRef<HTMLDialogElement>(null);
  const demoInitialized = useRef(false);
  useEffect(() => {
    setMonth(dateToday().slice(0, 7));
    setCurrency(localStorage.getItem("penny-currency") || "USD");
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error)
        setError("Unable to restore your session. Please sign in again.");
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setRows([]);
      setBudgets([]);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (demo) {
      if (demoInitialized.current) return;
      demoInitialized.current = true;
      setRows(demoRows(dateToday().slice(0, 7)));
      setBudgets([
        {
          id: "b1",
          category: "Food & drinks",
          amount: 45000,
          month: dateToday().slice(0, 7),
        },
        {
          id: "b2",
          category: "Shopping",
          amount: 25000,
          month: dateToday().slice(0, 7),
        },
        {
          id: "b3",
          category: "Transport",
          amount: 12000,
          month: dateToday().slice(0, 7),
        },
      ]);
      return;
    }
    demoInitialized.current = false;
    if (!user || !supabase) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const all: Transaction[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase!
            .from("transactions")
            .select("*")
            .order("date", { ascending: false })
            .order("id")
            .range(offset, offset + 999);
          if (error) throw error;
          all.push(...data);
          if (data.length < 1000) break;
        }
        const { data, error } = await supabase!
          .from("budgets")
          .select("*")
          .eq("month", month);
        if (error) throw error;
        if (active) {
          setRows(all);
          setBudgets(data);
        }
      } catch {
        if (active)
          setError(
            "Could not load your data. Check your connection and Supabase setup, then reload.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, demo, month]);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
    setError("");
  }, [modal]);
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx) return;
    const abort = new AbortController();
    try {
      Promise.resolve(
        ctx.registerTool(
          {
            name: "start_expense_entry",
            description:
              "Open the expense entry form; does not save a transaction.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object");
              setEditing(null);
              setModal("transaction");
              return { status: "form_opened" };
            },
          },
          { signal: abort.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => abort.abort();
  }, []);
  const selected = rows.filter((x) => x.date.startsWith(month));
  const sum = totals(selected);
  const fmt = (v: number) => money(v, currency);
  const filtered = selected
    .filter(
      (x) =>
        (type === "all" || x.type === type) &&
        (category === "all" || x.category === category) &&
        `${x.title} ${x.notes} ${x.account}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const spending = categories
    .map((name, i) => ({
      name,
      color: colors[i],
      amount: selected
        .filter((x) => x.type === "expense" && x.category === name)
        .reduce((s, x) => s + x.amount, 0),
    }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const monthBudgets = budgets.filter((x) => x.month === month);
  function openAdd() {
    setEditing(null);
    setModal("transaction");
  }
  function exportRows() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv(filtered)], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `penny-${month}-${currency}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (!demo && !user)
        throw new Error("Please sign in to save your expenses.");
      const amount = cents(String(f.get("amount")));
      if (modal === "transaction") {
        const value = {
          title: String(f.get("title")).trim(),
          amount,
          type: String(f.get("type")) as Transaction["type"],
          category: String(f.get("category")),
          account: String(f.get("account")),
          date: String(f.get("date")),
          notes: String(f.get("notes")).trim(),
        };
        if (!value.title || !value.date)
          throw new Error("Add a description and date.");
        let item: Transaction = {
          ...value,
          id: editing?.id ?? crypto.randomUUID(),
        };
        if (!demo) {
          const result = editing
            ? await supabase!
                .from("transactions")
                .update(value)
                .eq("id", editing.id)
                .select()
                .single()
            : await supabase!
                .from("transactions")
                .insert({ ...value, user_id: user!.id })
                .select()
                .single();
          if (result.error)
            throw new Error(
              "Could not save. Check your connection and database setup.",
            );
          item = result.data;
        }
        setRows((old) => [item, ...old.filter((x) => x.id !== item.id)]);
      } else {
        let budget: Budget = {
          id: crypto.randomUUID(),
          category: String(f.get("category")),
          amount,
          month,
        };
        const existing = budgets.find(
          (x) => x.category === budget.category && x.month === month,
        );
        if (existing) budget.id = existing.id;
        if (!demo) {
          const { data, error } = await supabase!
            .from("budgets")
            .upsert(
              { ...budget, user_id: user!.id },
              { onConflict: "user_id,category,month" },
            )
            .select()
            .single();
          if (error)
            throw new Error("Could not save budget. Please try again.");
          budget = data;
        }
        setBudgets((old) => [budget, ...old.filter((x) => x.id !== budget.id)]);
      }
      setModal(null);
      setNotice(
        demo
          ? "Updated sample data. Changes reset when you reload."
          : "Saved to your account.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  function remove(id: string, table: "transactions" | "budgets") {
    setDeleteError("");
    setPendingDelete({ id, table });
  }
  async function confirmDelete() {
    if (!pendingDelete || deleteLock.current) return;
    deleteLock.current = true;
    setBusy(true);
    setDeleteError("");
    const { id, table } = pendingDelete;
    try {
      if (!demo) {
        const { error } = await supabase!.from(table).delete().eq("id", id);
        if (error) throw error;
      }
      if (table === "transactions") setRows(old => old.filter(x => x.id !== id));
      else setBudgets(old => old.filter(x => x.id !== id));
      setPendingDelete(null);
      setNotice("Deleted.");
    } catch {
      setDeleteError("Could not delete. Please try again.");
    } finally {
      deleteLock.current = false;
      setBusy(false);
    }
  }
  async function authenticate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    try {
      const { error } =
        authMode === "signup"
          ? await supabase.auth.signUp({ email, password })
          : authMode === "reset"
            ? await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + "/?reset=1",
              })
            : authMode === "update"
              ? await supabase.auth.updateUser({ password })
              : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setDemo(false);
      setModal(null);
      setNotice(
        authMode === "signup"
          ? "Check your email to confirm your account."
          : authMode === "reset"
            ? "If your account exists, a reset email is on its way."
            : "Account updated.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("reset")) {
      setAuthMode("update");
      setModal("auth");
    }
  }, []);
  function renderBudgetList() {
    return (
      <>
        {monthBudgets.length === 0 ? (
          <div className="empty">
            No budgets this month. Set one to keep your spending on track.
          </div>
        ) : (
          monthBudgets.map((b) => {
            const spent =
              spending.find((x) => x.name === b.category)?.amount ?? 0;
            const percent = (spent / b.amount) * 100;
            return (
              <div className="budget" key={b.id}>
                <div className="spread">
                  <strong>{b.category}</strong>
                  <span>
                    {Math.round(percent)}%
                    {view === "Budgets" && (
                      <button
                        aria-label={`Delete ${b.category} budget`}
                        className="icon-button"
                        disabled={busy}
                        onClick={() => remove(b.id, "budgets")}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </span>
                </div>
                <div className="track">
                  <i
                    style={{
                      width: `${Math.min(percent, 100)}%`,
                      background:
                        percent > 100
                          ? "#d85868"
                          : colors[categories.indexOf(b.category)],
                    }}
                  />
                </div>
                <div className="spread muted">
                  <span>
                    {fmt(spent)} <small>of {fmt(b.amount)}</small>
                  </span>
                  <span>
                    {percent > 100
                      ? "Over budget"
                      : fmt(b.amount - spent) + " left"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </>
    );
  }
  function renderTransactions({ short = false }: { short?: boolean }) {
    const shown = short ? filtered.slice(0, 5) : filtered;
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Date</th>
              <th>Amount</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id}>
                <td>
                  <div className="transaction-name">
                    <span
                      className="category-icon"
                      style={{
                        background:
                          colors[categories.indexOf(x.category)] + "18",
                        color: colors[categories.indexOf(x.category)],
                      }}
                    >
                      {x.type === "income" ? (
                        <ArrowDownLeft size={19} />
                      ) : (
                        <CreditCard size={19} />
                      )}
                    </span>
                    <div>
                      <strong>{x.title}</strong>
                      <small>{x.account}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="tag">{x.category}</span>
                </td>
                <td className="muted">
                  {new Date(x.date + "T12:00:00").toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td
                  className={
                    "amount " + (x.type === "income" ? "positive" : "")
                  }
                >
                  {x.type === "income" ? "+" : "−"}
                  {fmt(x.amount)}
                </td>
                <td>
                  <div className="actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${x.title}`}
                      onClick={() => {
                        setEditing(x);
                        setModal("transaction");
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={busy}
                      aria-label={`Delete ${x.title}`}
                      onClick={() => remove(x.id, "transactions")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && (
          <div className="empty">
            {loading
              ? "Loading your transactions…"
              : "No transactions found. Add an expense or adjust your filters."}
          </div>
        )}
      </div>
    );
  }
  const weeks = [0, 1, 2, 3, 4]
    .filter(
      (i) =>
        i * 7 <
        new Date(
          Number(month.slice(0, 4)),
          Number(month.slice(5)),
          0,
        ).getDate(),
    )
    .map((i) => ({
      label: `${i * 7 + 1}–${Math.min((i + 1) * 7, new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate())}`,
      expense: selected
        .filter(
          (x) =>
            x.type === "expense" &&
            Math.floor((Number(x.date.slice(-2)) - 1) / 7) === i,
        )
        .reduce((s, x) => s + x.amount, 0),
      income: selected
        .filter(
          (x) =>
            x.type === "income" &&
            Math.floor((Number(x.date.slice(-2)) - 1) / 7) === i,
        )
        .reduce((s, x) => s + x.amount, 0),
    }));
  const chartMax = Math.max(...weeks.flatMap((x) => [x.expense, x.income]), 1);
  return (
    <div className="shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("Overview")}>
          <span>p</span>penny<span className="brand-dot">.</span>
        </button>
        <div className="sidebar-theme"><ThemeToggle /></div>
        <div className="workspace">
          <span className="avatar">P</span>
          <div>
            Personal workspace
            <small>
              {demo
                ? "Sample account"
                : user?.email || "Your everyday finances"}
            </small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {navigation.map((n) => (
            <button
              className={view === n.name ? "active" : ""}
              onClick={() => setView(n.name)}
              key={n.name}
            >
              <n.icon size={20} />
              {n.name}
              {view === n.name && <span className="nav-mark" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="tip">
            <Wallet size={22} />
            <strong>A little clarity goes a long way.</strong>
            <p>Make room for what matters. One expense at a time.</p>
          </div>
          <button onClick={() => setView("Settings")}>
            <CircleHelp size={18} />
            Help & setup
          </button>
          {user && (
            <button
              onClick={async () => {
                const result = await supabase!.auth.signOut();
                if (result.error) setError("Could not sign out. Try again.");
              }}
            >
              <LogOut size={18} />
              Sign out
            </button>
          )}
          <div className="profile">
            <span className="avatar">
              {user?.email?.[0].toUpperCase() || "P"}
            </span>
            <div>
              {user?.email?.split("@")[0] || "Personal account"}
              <small>{demo ? "Preview mode" : "Supabase account"}</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <ChevronRight size={14} /> <strong>{view}</strong>
          </span>
          <div className="top-right">
            <span className="privacy">
              {demo ? "Sample data" : "Private workspace"}
            </span>
            <span className="avatar mini">P</span>
          </div>
        </header>
        <div className="content" key={view}>
          {demo && (
            <div className="demo-banner">
              <span>
                Explore with sample data. Preview changes are not saved.
              </span>
              <button onClick={() => setView("Settings")}>
                Connect your account <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          {!demo && !user && ready && (
            <div className="demo-banner">
              <span>Sign in to start tracking your expenses.</span>
              <button
                onClick={() => {
                  setAuthMode("signin");
                  setModal("auth");
                }}
              >
                Sign in
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR MONEY, IN FOCUS</div>
              <h1>
                {view === "Overview" ? "A clearer view of your money." : view}
              </h1>
              <p>
                {view === "Overview"
                  ? "Here's where you stand this month."
                  : view === "Transactions"
                    ? "Every little thing, all in one place."
                    : view === "Budgets"
                      ? "Give your spending a little direction."
                      : view === "Reports"
                        ? "Understand the habits behind the numbers."
                        : "Make Penny yours."}
              </p>
            </div>
            <button
              className="primary"
              onClick={openAdd}
              disabled={!demo && !user}
            >
              <Plus size={18} />
              Add transaction
            </button>
          </div>
          {error && !modal && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {view !== "Settings" && (
            <div className="period-row">
              <div className="period">
                <label htmlFor="month">Month</label>
                <input
                  id="month"
                  type="month"
                  value={month}
                  onChange={(e) => e.target.value && setMonth(e.target.value)}
                />
              </div>
              <button className="secondary" onClick={exportRows}>
                <Download size={16} />
                Export CSV
              </button>
            </div>
          )}
          {(view === "Overview" || view === "Reports") && (
            <>
              <div className="stats">
                <div className="stat featured">
                  <div>
                    Monthly balance <Wallet size={19} />
                  </div>
                  <h2>{fmt(sum.balance)}</h2>
                  <span>Income minus expenses</span>
                  <div className="decor-circle" />
                </div>
                <div className="stat">
                  <div>
                    Total income{" "}
                    <span className="stat-icon green">
                      <ArrowDownLeft size={19} />
                    </span>
                  </div>
                  <h2>{fmt(sum.income)}</h2>
                  <span>
                    {selected.filter((x) => x.type === "income").length} income
                    transactions
                  </span>
                </div>
                <div className="stat">
                  <div>
                    Total expenses{" "}
                    <span className="stat-icon pink">
                      <ArrowUpRight size={19} />
                    </span>
                  </div>
                  <h2>{fmt(sum.expense)}</h2>
                  <span>
                    {selected.filter((x) => x.type === "expense").length}{" "}
                    expense transactions
                  </span>
                </div>
                <div className="stat">
                  <div>
                    Savings rate{" "}
                    <span className="stat-icon purple">
                      <Target size={19} />
                    </span>
                  </div>
                  <h2>
                    {sum.income
                      ? Math.round((sum.balance / sum.income) * 100) + "%"
                      : "—"}
                  </h2>
                  <span>
                    {sum.income
                      ? "Of your monthly income"
                      : "Add income to see your rate"}
                  </span>
                </div>
              </div>
              <div className="chart-grid">
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h3>Cash flow</h3>
                      <p>Your income and spending, week by week</p>
                    </div>
                    <div className="legend">
                      <span>
                        <i style={{ background: "#7757d5" }} />
                        Income
                      </span>
                      <span>
                        <i style={{ background: "#d7cdf3" }} />
                        Expenses
                      </span>
                    </div>
                  </div>
                  <div
                    className="chart"
                    role="img"
                    aria-label="Weekly income and expenses bar chart"
                  >
                    {weeks.map((w, i) => (
                      <div className="bar-group" key={i}>
                        <div className="bars">
                          <div
                            title={`Income: ${fmt(w.income)}`}
                            style={{
                              height: `${(w.income / chartMax) * 100}%`,
                              background: "#7757d5",
                            }}
                          />
                          <div
                            title={`Expenses: ${fmt(w.expense)}`}
                            style={{
                              height: `${(w.expense / chartMax) * 100}%`,
                              background: "#d7cdf3",
                            }}
                          />
                        </div>
                        <span>{w.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="chart-caption">
                    Days of the month · {currency}
                  </div>
                  {view === "Reports" && (
                    <div className="report-values">
                      {weeks.map((w, i) => (
                        <p key={i}>
                          Days {w.label}: {fmt(w.income)} in / {fmt(w.expense)}{" "}
                          out
                        </p>
                      ))}
                    </div>
                  )}
                </section>
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h3>Spending breakdown</h3>
                      <p>Where your money went</p>
                    </div>
                  </div>
                  <div className="breakdown">
                    <div
                      className="donut"
                      style={{
                        background: sum.expense
                          ? `conic-gradient(${spending.map((x, i) => `${x.color} ${(spending.slice(0, i).reduce((s, x) => s + x.amount, 0) / sum.expense) * 100}% ${(spending.slice(0, i + 1).reduce((s, x) => s + x.amount, 0) / sum.expense) * 100}%`).join(",")})`
                          : "#eeedf3",
                      }}
                    >
                      <div>
                        <small>Total spent</small>
                        <strong>{fmt(sum.expense)}</strong>
                      </div>
                    </div>
                    <div className="category-legend">
                      {spending.length ? (
                        spending.slice(0, 4).map((x) => (
                          <div key={x.name}>
                            <span>
                              <i style={{ background: x.color }} />
                              {x.name}
                            </span>
                            <strong>
                              {Math.round((x.amount / sum.expense) * 100)}%
                            </strong>
                          </div>
                        ))
                      ) : (
                        <p className="muted">No expenses this month.</p>
                      )}
                    </div>
                  </div>
                  {view === "Reports" &&
                    spending.map((x) => (
                      <div className="report-line" key={x.name}>
                        <span>{x.name}</span>
                        <strong>{fmt(x.amount)}</strong>
                      </div>
                    ))}
                </section>
              </div>
            </>
          )}
          {view === "Overview" && (
            <div className="lower-grid">
              <section className="card table-card">
                <div className="card-heading">
                  <h3>Recent transactions</h3>
                  <button
                    className="text-button"
                    onClick={() => setView("Transactions")}
                  >
                    View all <ChevronRight size={15} />
                  </button>
                </div>
                {renderTransactions({ short: true })}
              </section>
              <section className="card">
                <div className="card-heading">
                  <h3>Monthly budgets</h3>
                  <button
                    className="icon-button"
                    aria-label="Add budget"
                    disabled={!demo && !user}
                    onClick={() => setModal("budget")}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {renderBudgetList()}
                <button
                  className="budget-link"
                  onClick={() => setView("Budgets")}
                >
                  Manage budgets <ChevronRight size={15} />
                </button>
              </section>
            </div>
          )}
          {view === "Transactions" && (
            <section className="card table-card">
              <div className="filters">
                <label className="search">
                  <Search size={18} />
                  <input
                    placeholder="Search transactions…"
                    aria-label="Search transactions"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Transaction type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                </select>
                <select
                  aria-label="Category filter"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <SlidersHorizontal size={18} />
              </div>
              {renderTransactions({})}
              <div className="table-footer">
                {filtered.length} transactions · {fmt(totals(filtered).expense)}{" "}
                in expenses
              </div>
            </section>
          )}
          {view === "Budgets" && (
            <section className="card budget-page">
              <div className="card-heading">
                <h3>Your monthly plan</h3>
                <button
                  className="primary"
                  disabled={!demo && !user}
                  onClick={() => setModal("budget")}
                >
                  <Plus size={16} />
                  Set budget
                </button>
              </div>
              {renderBudgetList()}
              <p className="muted">
                Set a budget for an existing category to update its limit.
                Budgets apply to the selected month.
              </p>
            </section>
          )}
          {view === "Settings" && (
            <div className="settings-grid">
              <section className="card">
                <h3>Preferences</h3>
                <div className="settings-theme"><ThemeToggle /></div>
                <button
                  className="secondary"
                  onClick={() => setTourRequest((value) => value + 1)}
                >
                  <CircleHelp size={17} />
                  Replay guided tour
                </button>
                <label className="field">
                  Currency
                  <select
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      localStorage.setItem("penny-currency", e.target.value);
                    }}
                  >
                    {["USD", "INR", "EUR", "GBP", "CAD", "AUD", "JPY"].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      ),
                    )}
                  </select>
                </label>
                <p className="muted">
                  Use one currency for your account. Changing this label does
                  not convert existing amounts. Amounts support two decimal
                  places.
                </p>
              </section>
              <section className="card">
                <h3>Account & storage</h3>
                <p className="muted">
                  {supabase
                    ? "Your Supabase connection is configured. Sign in to save and sync your expenses."
                    : "Supabase is not connected yet. Follow the project README to create your free project, apply the database setup, and add your project URL and publishable key."}
                </p>
                {supabase && (
                  <button
                    className="primary"
                    onClick={() => {
                      setAuthMode("signin");
                      setModal("auth");
                    }}
                  >
                    {user ? "Switch account" : "Sign in / Create account"}
                  </button>
                )}
                <p className="muted">
                  Preview data is fictional and never uploaded to your account.
                </p>
                {!demo && !user && (
                  <button className="secondary" onClick={() => setDemo(true)}>
                    Explore sample data
                  </button>
                )}
              </section>
            </div>
          )}
          <footer>
            Penny <span>Small steps. Better money habits.</span>
          </footer>
        </div>
      </main>
      <dialog ref={deleteDialog} className="delete-dialog" aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={event => { event.preventDefault(); if (!deleteLock.current) setPendingDelete(null); }}>
        <div className="delete-symbol"><Trash2 size={25} /></div>
        <h2 id="delete-title">Delete {pendingDelete?.table === "budgets" ? "budget" : "transaction"}?</h2>
        <p id="delete-description">This will permanently remove {pendingDelete?.table === "transactions" ? <strong>{rows.find(row => row.id === pendingDelete.id)?.title || "this transaction"}</strong> : "this budget"}. This cannot be undone.</p>
        {deleteError && <p className="error" role="alert">{deleteError}</p>}
        <div className="delete-actions">
          <button className="secondary" autoFocus disabled={busy} onClick={() => setPendingDelete(null)}>Cancel</button>
          <button className="delete-confirm" disabled={busy} onClick={confirmDelete}>{busy ? "Deleting…" : "Delete"}</button>
        </div>
      </dialog>
      <UserTour request={tourRequest} onNavigate={setView} />
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setModal(null);
        }}
        onClose={() => {
          if (!busy) setModal(null);
        }}
      >
        <div className="modal-heading">
          <h2>
            {modal === "auth"
              ? authMode === "signup"
                ? "Create an account"
                : authMode === "reset"
                  ? "Reset password"
                  : authMode === "update"
                    ? "Choose a new password"
                    : "Welcome back"
              : modal === "budget"
                ? "Set monthly budget"
                : editing
                  ? "Edit transaction"
                  : "Add transaction"}
          </h2>
          <button
            className="icon-button"
            disabled={busy}
            aria-label="Close dialog"
            onClick={() => setModal(null)}
          >
            <X />
          </button>
        </div>
        {modal === "auth" ? (
          <form onSubmit={authenticate}>
            {authMode !== "update" && (
              <label className="field">
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
            )}
            {authMode !== "reset" && (
              <label className="field">
                Password
                <input
                  name="password"
                  type="password"
                  minLength={authMode === "signin" ? 1 : 12}
                  autoComplete={
                    authMode === "signin" ? "current-password" : "new-password"
                  }
                  required
                />
              </label>
            )}
            <button className="primary full" disabled={busy}>
              {busy
                ? "Please wait…"
                : authMode === "signup"
                  ? "Create account"
                  : authMode === "reset"
                    ? "Send reset link"
                    : authMode === "update"
                      ? "Update password"
                      : "Sign in"}
            </button>
            <div className="auth-links">
              <button
                type="button"
                onClick={() =>
                  setAuthMode(authMode === "signup" ? "signin" : "signup")
                }
              >
                {authMode === "signup"
                  ? "Already have an account? Sign in"
                  : "Create an account"}
              </button>
              <button type="button" onClick={() => setAuthMode("reset")}>
                Forgot password?
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={save} key={modal + (editing?.id || "new")}>
            {modal === "transaction" && (
              <>
                <label className="field">
                  Description
                  <input
                    autoFocus
                    name="title"
                    placeholder="e.g. Weekly groceries"
                    maxLength={120}
                    required
                    defaultValue={editing?.title}
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    Type
                    <select
                      name="type"
                      defaultValue={editing?.type || "expense"}
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </label>
                  <label className="field">
                    Date
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={editing?.date || dateToday()}
                    />
                  </label>
                </div>
              </>
            )}
            <div className="form-grid">
              <label className="field">
                Amount ({currency})
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                  defaultValue={
                    editing ? (editing.amount / 100).toFixed(2) : undefined
                  }
                />
              </label>
              <label className="field">
                Category
                <select
                  name="category"
                  defaultValue={editing?.category || categories[0]}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            {modal === "transaction" && (
              <>
                <label className="field">
                  Payment account
                  <select
                    name="account"
                    defaultValue={editing?.account || "Debit card"}
                  >
                    {["Debit card", "Credit card", "Bank", "Cash", "Other"].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="field">
                  Notes (optional)
                  <textarea
                    name="notes"
                    maxLength={1000}
                    defaultValue={editing?.notes}
                    rows={3}
                  />
                </label>
              </>
            )}
            {demo && (
              <p className="muted">Sample preview · changes reset on reload.</p>
            )}
            <button
              className="primary full"
              disabled={busy || (!demo && !user)}
            >
              {busy
                ? "Saving…"
                : "Save " + (modal === "budget" ? "budget" : "transaction")}
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </dialog>
    </div>
  );
}


