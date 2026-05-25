"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useInView, useCountUp } from "@/hooks/animations";
import { TASK_LABELS } from "@/lib/constants";
import { TASK_PRICING } from "@/types";
import SolvLogo from "@/components/SolvLogo";

/* ─── Ticker content ─────────────────────────────────────────────────────── */
const TICKER_ITEMS = [
  { label: "PROTOCOL", value: "solv-001" },
  { label: "NETWORK", value: "Arc Testnet" },
  { label: "PAYMENT", value: "EIP-3009" },
  { label: "EXPENSES", value: "x402" },
  { label: "YIELD", value: "USYC / Hashnote" },
  { label: "STACK", value: "Circle 4-Tool" },
  { label: "RUNTIME", value: "24/7 Autonomous" },
  { label: "SETTLEMENT", value: "On-Chain" },
  { label: "CURRENCY", value: "USDC" },
  { label: "CHAIN ID", value: "5042002 — ARC" },
];

/* ─── Flow cards ─────────────────────────────────────────────────────────── */
const FLOWS = [
  {
    id:    "income",
    label: "INCOME LAYER",
    title: "EIP-3009",
    sub:   "Signed payment authorizations collected on task submission. No approve-then-transfer. No gas from you.",
    color: "var(--green)",
    code: `// User signs — gasless for the agent
USDC.transferWithAuthorization(
  from:        payer,
  to:          agent_wallet,
  value:       task_price,
  validBefore: deadline,
  nonce:       bytes32,
  signature:   sig          // EIP-712
)`,
  },
  {
    id:    "expense",
    label: "EXPENSE LAYER",
    title: "x402",
    sub:   "Per-call micropayments to external data APIs. Pay only for what the task actually needs. No subscriptions.",
    color: "var(--amber)",
    code: `// HTTP 402 → auto-pay → retry
GET /api/wallet-intelligence
→ 402 Payment Required
   X-Payment-Amount: 0.004 USDC
   X-Payment-Recipient: 0x...

→ POST with payment header
→ 200 OK  // data returned`,
  },
  {
    id:    "yield",
    label: "CAPITAL LAYER",
    title: "USYC / Hashnote",
    sub:   "Idle USDC sweeps into Hashnote's T-bill yield token. Earns while waiting for tasks. Redeems on demand.",
    color: "var(--blue)",
    code: `// Idle capital → yield
if balance > operating_reserve * 1.5:
  USDC.approve(teller, sweep_amount)
  Teller.deposit(sweep_amount)
  // → USYC minted, earning APY

// On redemption need:
  Teller.redeem(usyc_amount)
  // → USDC returned`,
  },
];

/* ─── Pricing rows ───────────────────────────────────────────────────────── */

/* ─── Stat box ───────────────────────────────────────────────────────────── */
function StatBox({
  label, value, suffix = "", decimals = 0, delay = 0, after = false,
}: {
  label: string; value: number; suffix?: string; decimals?: number; delay?: number; after?: boolean;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const display = useCountUp(value, 1400, inView, decimals);
  return (
    <div
      ref={ref}
      className="flex flex-col gap-1 animate-fade-up opacity-0"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-2)" }}>
        {label}
      </span>
      <span className="text-[28px] leading-none font-mono font-semibold" style={{ color: "var(--amber)" }}>
        {after ? `${display}${suffix}` : `${suffix}${display}`}
      </span>
    </div>
  );
}

/* ─── Flow card ─────────────────────────────────────────────────────────── */
function FlowCard({ flow, delay }: { flow: typeof FLOWS[0]; delay: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="flex flex-col gap-4 panel p-6 opacity-0 animate-fade-up"
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: "both",
        borderTopColor: flow.color,
        borderTopWidth: 2,
      }}
    >
      <div>
        <div className="label mb-2">{flow.label}</div>
        <div className="text-[22px] font-mono font-semibold" style={{ color: flow.color }}>
          {flow.title}
        </div>
        <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "var(--text-2)" }}>
          {flow.sub}
        </p>
      </div>
      <pre className="code-block whitespace-pre overflow-x-auto">{flow.code}</pre>
    </div>
  );
}

/* ─── Pricing row ────────────────────────────────────────────────────────── */
function PricingRow({
  taskType, delay, inView,
}: {
  taskType: string; delay: number; inView: boolean;
}) {
  const pricing = TASK_PRICING[taskType as keyof typeof TASK_PRICING];
  const margin  = (
    ((pricing.price_usdc - pricing.estimated_cost_usdc) / pricing.price_usdc) * 100
  ).toFixed(0);

  return (
    <div
      className="flex items-center justify-between py-3 border-b"
      style={{
        borderColor: "var(--wire)",
        opacity:    inView ? 1 : 0,
        transform:  inView ? "translateY(0)" : "translateY(8px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-mono" style={{ color: "var(--text-1)" }}>
          {TASK_LABELS[taskType]}
        </span>
      </div>
      <div className="flex items-center gap-6">
        <span className="text-[11px] font-mono" style={{ color: "var(--text-2)" }}>
          est. cost{" "}
          <span style={{ color: "var(--red)" }}>${pricing.estimated_cost_usdc.toFixed(3)}</span>
        </span>
        <span className="text-[11px] font-mono" style={{ color: "var(--text-2)" }}>
          margin{" "}
          <span style={{ color: "var(--green)" }}>{margin}%</span>
        </span>
        <span className="text-[15px] font-mono font-semibold" style={{ color: "var(--amber)" }}>
          ${pricing.price_usdc.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

/* ─── Main landing page ──────────────────────────────────────────────────── */
export default function LandingPage() {
  const [statsRef, statsInView]       = useInView<HTMLDivElement>();
  const [pricingRef, pricingInViewRaw] = useInView<HTMLDivElement>();
  // Fallback: reveal pricing rows after 2.5s even if user never scrolls
  const [pricingForced, setPricingForced] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPricingForced(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const pricingInView = pricingInViewRaw || pricingForced;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* Scanline overlay — subtle CRT feel */}
      <div className="pointer-events-none fixed inset-0 z-50">
        <div
          className="absolute left-0 right-0 h-px animate-scanline"
          style={{ background: "rgba(232,160,16,0.03)" }}
        />
      </div>

      {/* ─── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 flex items-center justify-between px-8 py-3 border-b"
        style={{
          background:   "rgba(3,5,10,0.92)",
          borderColor:  "var(--wire)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-70">
            <SolvLogo size={18} />
            <span className="text-[13px] font-mono font-semibold tracking-widest" style={{ color: "var(--amber)" }}>
              SOLV-001
            </span>
          </Link>
          <span className="h-3 w-px" style={{ background: "var(--wire-2)" }} />
          <div className="hidden sm:flex items-center">
            {[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Status",    href: "/status" },
            ].map(tab => (
              <Link
                key={tab.href}
                href={tab.href}
                className="nav-tab px-3 py-1.5 text-[13px] font-medium"
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="label hidden md:block">Circle 4-Tool Stack</span>
          <div className="hidden sm:flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
              style={{ background: "var(--green)" }}
            />
            <span className="text-[11px] font-mono" style={{ color: "var(--green)" }}>LIVE</span>
          </div>
          <Link
            href="/dashboard"
            className="btn-amber text-[12px] font-medium px-3 py-1.5"
            style={{ borderRadius: "4px" }}
          >
            Open Dashboard →
          </Link>
        </div>
      </nav>

      {/* ─── Ticker ──────────────────────────────────────────────────────── */}
      <div
        className="ticker-wrap overflow-hidden border-b py-2"
        style={{ borderColor: "var(--wire)", background: "var(--surf)" }}
      >
        <div className="ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 px-6 text-[11px] font-mono shrink-0"
              style={{ color: "var(--text-2)" }}
            >
              <span style={{ color: "var(--text-3)" }}>{item.label}</span>
              <span style={{ color: "var(--wire-2)" }}>·</span>
              <span style={{ color: "var(--text-1)" }}>{item.value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative max-w-5xl mx-auto px-8 pt-24 pb-20">
        {/* Dot grid background */}
        <div
          className="dot-grid pointer-events-none absolute inset-0 -z-10"
          style={{ opacity: 0.55, maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 50%, transparent 100%)" }}
        />
        <div
          className="text-[11px] font-mono uppercase tracking-widest mb-6 animate-fade-up opacity-0 anim-delay-1"
          style={{ color: "var(--amber-dim)", animationFillMode: "both" }}
        >
          Autonomous Agent Finance · Arc Testnet
        </div>

        <h1 className="font-mono font-semibold leading-tight mb-6">
          <div
            className="animate-fade-up opacity-0 anim-delay-2"
            style={{ fontSize: "clamp(32px, 7vw, 56px)", color: "var(--text-1)", animationFillMode: "both" }}
          >
            It earns.
          </div>
          <div
            className="animate-fade-up opacity-0 anim-delay-3"
            style={{ fontSize: "clamp(32px, 7vw, 56px)", color: "var(--amber)", animationFillMode: "both" }}
          >
            It reasons.
          </div>
          <div
            className="animate-fade-up opacity-0 anim-delay-4"
            style={{ fontSize: "clamp(32px, 7vw, 56px)", color: "var(--green)", animationFillMode: "both" }}
          >
            It compounds.
          </div>
        </h1>

        <p
          className="text-[16px] leading-relaxed max-w-xl animate-fade-up opacity-0 anim-delay-5"
          style={{ color: "var(--text-2)", animationFillMode: "both" }}
        >
          SOLV-001 is a production AI agent that accepts tasks for USDC, pays its
          own expenses via x402 micropayments, and sweeps idle capital into Hashnote
          USYC yield — all on-chain, all autonomous.
        </p>

        <div
          className="flex items-center gap-4 mt-10 animate-fade-up opacity-0 anim-delay-6"
          style={{ animationFillMode: "both" }}
        >
          <Link
            href="/dashboard"
            className="btn-amber-lg px-6 py-3 text-[13px] font-mono font-semibold"
            style={{ borderRadius: "4px" }}
          >
            View Live Dashboard →
          </Link>
          <a
            href="#flows"
            className="link-hover text-[13px] font-mono"
            style={{ color: "var(--text-2)" }}
          >
            How it works ↓
          </a>
        </div>
      </section>

      {/* ─── Stats ───────────────────────────────────────────────────────── */}
      <section
        ref={statsRef}
        className="border-y"
        style={{ borderColor: "var(--wire)", background: "var(--surf)" }}
      >
        <div className="max-w-5xl mx-auto px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatBox label="Tasks Completed"   value={247}    delay={0}   />
          <StatBox label="Total Income"      value={183.45} suffix="$"  decimals={2} delay={100} />
          <StatBox label="USYC Position"     value={94.20}  suffix="$"  decimals={2} delay={200} />
          <StatBox label="Avg Margin"        value={94}     suffix="%" decimals={0} delay={300} after />
        </div>
      </section>

      {/* ─── Flows ───────────────────────────────────────────────────────── */}
      <section id="flows" className="max-w-5xl mx-auto px-8 py-20">
        <div className="mb-12">
          <div
            className="label mb-3 animate-fade-up opacity-0"
            style={{ animationFillMode: "both" }}
          >
            Three-Layer Architecture
          </div>
          <h2
            className="text-[30px] font-mono font-semibold animate-fade-up opacity-0 anim-delay-1"
            style={{ color: "var(--text-1)", animationFillMode: "both" }}
          >
            Earn, spend, and grow — on-chain.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {FLOWS.map((flow, i) => (
            <FlowCard key={flow.id} flow={flow} delay={i * 120} />
          ))}
        </div>
      </section>

      {/* ─── Divider ─────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-8">
        <div className="accent-line" />
      </div>

      {/* ─── Pricing ─────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-8 py-20">
        <div className="mb-10">
          <div className="label mb-3">Transparent Pricing</div>
          <h2
            className="text-[30px] font-mono font-semibold"
            style={{ color: "var(--text-1)" }}
          >
            Pay per task. No subscriptions.
          </h2>
          <p className="text-[14px] mt-2" style={{ color: "var(--text-2)" }}>
            Each task type has a fixed USDC fee, paid upfront via EIP-3009 signature.
          </p>
        </div>

        <div ref={pricingRef}>
          {Object.keys(TASK_PRICING).map((taskType, i) => (
            <PricingRow
              key={taskType}
              taskType={taskType}
              delay={i * 80}
              inView={pricingInView}
            />
          ))}
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────── */}
      <section
        className="border-t"
        style={{ borderColor: "var(--wire)", background: "var(--surf)" }}
      >
        <div className="max-w-5xl mx-auto px-8 py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <SolvLogo size={28} className="mb-4 opacity-60" />
            <div className="label mb-3">Ready to run a task?</div>
            <h2
              className="text-[28px] font-mono font-semibold"
              style={{ color: "var(--text-1)" }}
            >
              Connect your wallet and go.
            </h2>
            <p className="text-[14px] mt-2 max-w-md" style={{ color: "var(--text-2)" }}>
              Minimum trust. Sign a single EIP-3009 authorization. The agent handles
              everything else — reasoning, spending, settlement.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="btn-amber-lg px-8 py-4 text-[14px] font-mono font-semibold whitespace-nowrap shrink-0"
            style={{ borderRadius: "4px" }}
          >
            Open Dashboard →
          </Link>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <footer
        className="border-t px-8 py-6"
        style={{ borderColor: "var(--wire)" }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 transition-opacity hover:opacity-70">
              <SolvLogo size={14} />
              <span className="text-[11px] font-mono font-semibold" style={{ color: "var(--amber)" }}>
                SOLV-001
              </span>
            </Link>
            <span className="label">v1.0.0</span>
          </div>
          <div className="flex items-center gap-6 text-[11px] font-mono" style={{ color: "var(--text-3)" }}>
            <span>Arc Testnet · Chain 26</span>
            <span>Circle CCTP + Programmable Wallets</span>
            <span>Hashnote USYC</span>
            <a
              href="https://github.com/dmustapha/solv-001"
              target="_blank"
              rel="noopener noreferrer"
              className="link-hover"
              style={{ color: "var(--text-3)" }}
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
