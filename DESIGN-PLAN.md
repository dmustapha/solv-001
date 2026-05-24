# SOLV-001 — Production Design Upgrade Plan
> Generated: 2026-05-24 | Design Forge v2 | Dials: DV=6, MI=6, VD=7

---

## Summary

SOLV-001's design is a strong **Terminal Ledger** foundation — ultra-dark palette, amber accent,
Inter + JetBrains Mono, CSS custom properties, panel/wire system. What's missing is the layer
of production polish that separates "demo app" from "world-class AI product": icons, skeletons,
CSS-native interactions, SSE stream animation, and the 20 micro-details judges notice subconsciously.

Completed in this session:
- [x] SVG logomark (Precision Diamond) — `public/logo-icon.svg`
- [x] Combination mark — `public/logo.svg`
- [x] Favicon — `public/favicon.svg`
- [x] `SolvLogo` React component — `src/components/SolvLogo.tsx`
- [x] AppNav logo integration
- [x] Landing page nav + footer logo
- [x] `layout.tsx` — favicon, full OG/Twitter metadata
- [x] `brand.json` — brand contract file

---

## Phase A — CSS Architecture Upgrade (High Impact, Low Risk)

### A1: Replace all JS hover with CSS
Current state: every interactive element uses `onMouseEnter`/`onMouseLeave` to swap inline styles.
This is fragile, can't be overridden by :focus/:active, and doesn't work with keyboard nav.

**Pattern to eliminate:**
```tsx
onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; }}
onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-2)"; }}
```

**Replace with CSS custom property transitions:**
Add to globals.css:
```css
.nav-tab {
  color: var(--text-2);
  transition: color 150ms ease;
}
.nav-tab:hover { color: var(--text-1); }
.nav-tab[data-active="true"] { color: var(--amber); border-bottom: 2px solid var(--amber); }

.btn-amber {
  color: var(--amber);
  border: 1px solid var(--amber);
  background: transparent;
  transition: background 150ms ease, box-shadow 150ms ease;
}
.btn-amber:hover { background: rgba(232,160,16,0.08); }
.btn-amber:focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: 2px;
}

.card-interactive {
  transition: background 120ms ease;
}
.card-interactive:hover { background: var(--surf-2); }
```

**Files to update:** AppNav.tsx, TaskSubmitForm.tsx, TaskHistoryPanel.tsx, TreasuryPanel.tsx, page.tsx

### A2: Add focus-visible styles globally
Current: no keyboard focus indicators. Accessibility failure.

Add to globals.css:
```css
:focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: 2px;
}
/* Remove default for mouse users */
:focus:not(:focus-visible) { outline: none; }
```

### A3: Panel border-radius upgrade
Current: `border-radius: 2px` (nearly square). Feels dated for 2026.
Target: 4px for panels, 6px for cards, 8px for inputs/textareas.

Update globals.css `.panel` rule:
```css
.panel { border-radius: 4px; }
```
Update TaskSubmitForm cards: `border-radius: 6px`
Update textarea in TaskSubmitForm: `border-radius: 6px`
Update nav buttons: `border-radius: 4px`

### A4: Shadow system
Add to globals.css — glow shadows for primary CTAs and focused elements:
```css
:root {
  --shadow-amber: 0 0 20px rgba(232,160,16,0.10), 0 0 40px rgba(232,160,16,0.04);
  --shadow-green: 0 0 16px rgba(0,200,128,0.12);
  --shadow-panel: 0 2px 16px rgba(0,0,0,0.4);
}
```

---

## Phase B — Icon System (Medium Impact, 1-Day Work)

Install Lucide React (lightest icon set, tree-shakeable):
```bash
npm install lucide-react
```

### Icon assignments per component:

| Location | Current | Replace with |
|----------|---------|-------------|
| TaskHistoryPanel — status dot | colored `w-1.5 h-1.5 rounded-full` | Keep dots for small sizes; add `CheckCircle`, `Clock`, `XCircle`, `Loader2` at row level |
| TaskSubmitForm — task cards | text-only | `Brain`, `Shield`, `FileText`, `ArrowRight`, `Eye`, `AlertCircle` category icons |
| AppNav — disconnect button | "Disconnect" text | `LogOut` icon, 14px |
| AppNav — Arc Testnet indicator | green dot + text | Keep; add `Wifi` or `Radio` icon at 12px |
| TreasuryPanel — section labels | text labels | `Wallet`, `TrendingUp`, `Clock`, `BarChart2` small icons before labels |
| Proof page — checkmarks | none | `CheckCircle2` in green for each verified item |
| Status page — task count badge | plain number | Stays as-is (badge pattern is clean) |
| Error states | plain text | `AlertTriangle` icon before error messages |

### Task card icon map (TaskSubmitForm grid):
```tsx
import { Brain, Shield, FileText, Coins, Clock, Eye, BarChart2, Lightbulb } from "lucide-react";

const TASK_ICONS: Record<TaskType, React.ComponentType> = {
  wallet_intelligence:    Brain,
  counterparty_vet:       Shield,
  contract_summary:       FileText,
  conditional_payment:    Coins,
  scheduled_disbursement: Clock,
  wallet_watch:           Eye,
  contract_watch:         BarChart2,
  general:                Lightbulb,
};
```

---

## Phase C — SSE Stream Animation (High Impact for Demo)

The 15s wait is the #1 UX friction. Currently: text appears sequentially with no visual feedback
on what's happening "inside" the agent.

### C1: Streaming text cursor animation
Add to globals.css:
```css
.cursor-blink::after {
  content: "▋";
  animation: blink 700ms step-end infinite;
  margin-left: 1px;
  color: var(--amber);
}
```

### C2: SSE phase progress bar (Dashboard composing state)
When task is submitted, show a progress bar that advances through known phases:
```
[═════════░░░░░░░░░░░░░░░] Receiving payment...
[════════════════░░░░░░░░] Claude reasoning...
[═══════════════════════░] Executing nanopayments...
[═══════════════════════] Complete
```

Implementation: In Dashboard.tsx, map SSE event types to progress steps:
- `treasury_snapshot` received → 15% (payment verified)
- `reasoning_chunk` → 15-50% (reasoning phase, increments per chunk)
- `reasoning_complete` → 55%
- `trace: nanopayment` → 55-85% (3 payments, ~10% each)
- `trace: result` → 90%
- `complete` → 100%

Component: `<TaskProgressBar phase={currentSSEPhase} reasoning={reasoningChunks} />`

### C3: Reasoning stream — typewriter effect
When `reasoning_chunk` SSE events arrive, display them with a typewriter/streaming effect
rather than just appending text. Use the existing `animate-fade-up` for each chunk.

### C4: Claude.ai-style composing input box
Current: standard textarea with amber border on focus.
Target: large rounded container (border-radius: 12px) with inner padding, subtle gradient border
on focus, model indicator, similar to Claude.ai input box.

```tsx
// Composing state wrapper:
<div className="relative w-full max-w-2xl mx-auto">
  <div className="relative border-2 rounded-xl p-4 transition-all"
    style={{ borderColor: focused ? "var(--amber)" : "var(--wire)",
             background: "var(--surf-2)",
             boxShadow: focused ? "var(--shadow-amber)" : "none" }}>
    <textarea className="w-full bg-transparent resize-none focus:outline-none" ... />
    <div className="flex items-center justify-between mt-3 pt-3 border-t"
         style={{ borderColor: "var(--wire)" }}>
      <span className="text-[11px] font-mono" style={{ color: "var(--text-3)" }}>
        claude-sonnet-4-6 · Arc Testnet
      </span>
      <button type="submit">Run task →</button>
    </div>
  </div>
</div>
```

---

## Phase D — Loading Skeletons (Medium Impact, Polish Signal)

Current: "Loading..." plain text in TreasuryPanel. No skeleton states anywhere.
Target: pulse-shimmer skeleton blocks that match the content shape.

Add to globals.css:
```css
.skeleton {
  background: linear-gradient(90deg, var(--surf) 0%, var(--surf-2) 50%, var(--surf) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
  border-radius: 3px;
}
```

### Skeleton locations:
- `TreasuryPanel`: When `treasury === null`, show skeleton blocks for USDC balance,
  USYC position, and metrics rows
- `TaskHistoryPanel`: When loading initial tasks, show 3-4 skeleton task rows
- `Dashboard`: Initial load state before wallet connected — show grayed skeleton of the grid

### TreasuryPanel skeleton example:
```tsx
{!treasury && (
  <div className="px-4 py-3 flex flex-col gap-4">
    <div className="skeleton h-8 w-24 mb-2" />      {/* USDC balance */}
    <div className="skeleton h-6 w-32" />           {/* USYC position */}
    <div className="skeleton h-4 w-full" />         {/* row */}
    <div className="skeleton h-4 w-4/5" />          {/* row */}
    <div className="skeleton h-4 w-3/5" />          {/* row */}
  </div>
)}
```

---

## Phase E — Toast Notification System (Medium Impact)

Current: errors appear as inline `<p>` elements. No success confirmations.
Target: toast notifications for key events with auto-dismiss.

Simple implementation using React state (no library needed):

```tsx
// src/hooks/useToast.ts
type Toast = { id: string; message: string; type: "success" | "error" | "info"; }

// Place <ToastContainer> in Dashboard root layout
// Usage:
toast.success("Task submitted — awaiting reasoning...")
toast.error("Payment signing failed")
toast.info("Switched to Arc Testnet")
```

Toast CSS: slide-in from bottom-right, auto-dismiss after 4s, amber for info/success, red for error.

```css
.toast {
  position: fixed;
  bottom: 24px; right: 24px;
  padding: 12px 16px;
  background: var(--surf-2);
  border: 1px solid var(--wire-2);
  border-left: 3px solid var(--amber);
  animation: slideInRight 300ms cubic-bezier(0.22,1,0.36,1);
  font-size: 13px;
  max-width: 320px;
  z-index: 9999;
}
.toast.error  { border-left-color: var(--red); }
.toast.success { border-left-color: var(--green); }
```

---

## Phase F — Per-Page Design Upgrades

### F1: Landing Page (/)

**Hero section:**
- Add subtle dot grid background pattern:
  ```css
  .dot-grid {
    background-image: radial-gradient(circle, var(--wire) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  ```
- Wrap the hero section in `dot-grid` with 30% opacity overlay
- The "It earns. It reasons. It compounds." headline is perfect — keep it
- Add amber gradient glow behind the hero text (very subtle)

**Flow cards:**
- Add syntax highlighting to code blocks: keywords in amber, strings in green, comments in --text-3
- Add subtle left-border color accent (already there) + top-border (2px) per card category
- Increase card padding from p-6 to p-7

**Pricing table:**
- Add alternating row background (every other row: very subtle `var(--surf)` tint)
- Add a "Most Popular" badge on contract_summary card
- Font: change task type names from `font-mono` to Inter (readability)

**Stats section:**
- The animated count-up is great — keep it
- Add small unit labels below each number (e.g., "USDC" below income)

**CTA section:**
- Add the SolvLogo above the heading
- Add background: subtle amber radial gradient at 3% opacity in the bottom-right corner

**Footer:**
- Add GitHub link with external icon
- Add "View on Arc Explorer →" link

### F2: Dashboard (/dashboard)

**Task type grid (idle state):**
- Move from 4-col to a layout where the grid is properly contained and centered
- Add category group labels: "Analysis" | "Automation" | "Monitoring" | "General"
- Add Lucide icons to each card (see Phase B icon assignments)
- Active hover: border-color → category accent, background → very subtle category tint

**Composing state:**
- Implement Claude.ai-style input box (see Phase C4)
- Add character counter that appears after 1000 chars (current: 1800 threshold is too late)
- Add model indicator: "claude-sonnet-4-6" in bottom-left of input
- "← Back" button: add `ChevronLeft` icon

**Running state (SSE stream):**
- Add `<TaskProgressBar>` component (see Phase C2)
- Show reasoning stream with typewriter effect (Phase C3)
- Show nanopayment trace events as they arrive with amber pulse animation
- Add "Agent is thinking..." ambient animation (slow amber dot pulse)

**Complete state:**
- Markdown rendering for task results (use `react-markdown` or manual regex for bold/headers/bullets)
- Add "Copy result" button (clipboard API)
- Add "Run another task →" CTA button that resets to idle

**History sidebar (left):**
- Add search/filter input at top: filter by task type or status
- Grouping: "Today" / "Yesterday" / "Earlier" date sections
- Better empty state: show the diamond logomark at 40px opacity instead of `░`
- Clicking a task should expand its result inline (accordion pattern)

### F3: Status Page (/status)

**Layout:**
- Consider moving TreasuryPanel to TOP of the sidebar instead of taking full height
- Add a "Last updated" timestamp with auto-refresh countdown (10s → "Refreshing in 7s...")
- Add a "Live" pulse indicator in the panel header

**Task list (global view):**
- Add filters: All / Complete / Running / Deferred
- Add wallet address filter (search by payer)
- Show more metadata per row: fee paid, task type icon

**Treasury sidebar:**
- Replace "Loading..." with skeleton (Phase D)
- Add mini sparkline charts for Today income/expense (using CSS bars, no charting library)
- Make the USDC balance animate when it updates (number transition)

### F4: Proof Page (/proof)

**Visual hierarchy:**
- Add green checkmark icons (Lucide `CheckCircle2`) to each verified section header
- Add a "VERIFIED ON-CHAIN" badge for each section with real Arc tx hashes
- MetricCard: add subtle green glow shadow for live metrics

**Content:**
- If no completed tasks: show a "Demo mode" note with a CTA to try a task
- Make the Claude reasoning sample expandable (show/hide full reasoning)
- Add the agent wallet Arc Explorer link more prominently (currently buried in TreasuryPanel)

**Typography:**
- h1 "Integration Proof": increase to 26px, add subtitle "All integrations verifiable on Arc testnet"
- Section headers (`.label`): add thin amber bottom border line as visual separator

---

## Phase G — Mobile Responsiveness

Current gaps:
- TaskSubmitForm grid: 4-col grid breaks at mobile (<640px) → needs `grid-cols-2 sm:grid-cols-4`
- Dashboard sidebar: disappears on mobile → needs responsive toggle
- Landing hero: 56px heading too large on 390px → use clamp

**Fixes:**
```tsx
// TaskSubmitForm grid
className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-3"

// Landing hero clamp
style={{ fontSize: "clamp(32px, 8vw, 56px)" }}

// Dashboard sidebar on mobile
// Add a `<Sheet>` or slide-in panel behavior for < 640px
// Or: stack history below the task form on mobile (flex-col on small screens)
```

---

## Phase H — Typography Audit

Current: text sizes range from 10px to 56px. Some inconsistencies:

| Element | Current | Target |
|---------|---------|--------|
| PricingRow task type name | `font-mono` | Inter |
| Landing hero subtext | `text-[16px]` | Good, keep |
| Panel section labels | `text-[10px] font-sans uppercase` (via `.label`) | Good, keep |
| Task card descriptions | `text-[11px]` | Bump to 12px for readability |
| Code blocks | `text-[11px]` | Good, keep |
| Landing flow card titles | `text-[22px] font-mono` | Good, keep |
| Task result text | varies | 14px Inter, `leading-relaxed` |
| Error messages | `text-[12px]` | Add icon prefix |

---

## Phase I — OG Image

Create a proper OG image at 1200×630. Options:

**Option A: Static PNG**
Design in Figma/Canva: dark background (#03050A), large diamond logomark (200px), "SOLV-001" in amber
mono, tagline "It earns. It reasons. It compounds." in white, "Arc Testnet · Circle 4-Tool Stack" in --text-2.
Export to `public/og-image.png`.

**Option B: Dynamic with `@vercel/og`**
Create `src/app/api/og/route.tsx` using ImageResponse:
```tsx
import { ImageResponse } from "next/og";
export function GET() {
  return new ImageResponse(
    <div style={{ background: "#03050A", display: "flex", ... }}>
      {/* SVG logomark + text */}
    </div>,
    { width: 1200, height: 630 }
  );
}
```
Then reference `/api/og` in metadata. Recommended for a hackathon project.

---

## Phase J — Quick Win Checklist

These can each be done in < 15 minutes:

- [ ] `<title>` tag: change from lowercase "solv-001" to "SOLV-001" ✅ (done)
- [ ] Favicon: point to `/favicon.svg` ✅ (done)
- [ ] AppNav logo mark ✅ (done)
- [ ] Landing footer logo ✅ (done)
- [ ] `border-radius: 4px` on all `.panel` elements (1 CSS line)
- [ ] Grid: `grid-cols-2 sm:grid-cols-4` on task type grid
- [ ] Add `cursor-pointer` to all interactive cards/rows that are missing it
- [ ] TaskHistoryPanel empty state: replace `░` with `<SolvLogo size={32} color="var(--wire-2)" />`
- [ ] Landing hero: add `dot-grid` CSS background to hero section
- [ ] "Try without wallet (demo mode)" checkbox: style with amber accent (currently unstyled)
- [ ] Task result: add monospace code block styling for result text
- [ ] Add `transition-colors` to ALL links in the app (currently missing on some)
- [ ] Proof page section headers: add `<CheckCircle2>` icon prefix on verified sections

---

## Execution Order (Prioritized by Judge Impact)

| Priority | Phase | Why it matters to judges |
|----------|-------|--------------------------|
| 1 | Phase C2-C4: SSE animation + Claude.ai input | 15s wait needs visual engagement; judges will run a task |
| 2 | Phase J: Quick wins | First impression; professional polish signal |
| 3 | Phase B: Icons on task grid | Grid feels bare without them; adds category clarity |
| 4 | Phase D: Skeletons | Status/proof pages look broken during load |
| 5 | Phase F2-F3: Dashboard/Status upgrades | Where judges spend most time |
| 6 | Phase A: CSS hover migration | Correctness, not visible to judges |
| 7 | Phase I: OG image | Social sharing for traction |
| 8 | Phase G: Mobile | Judges likely on desktop |

---

## Files Changed This Session

```
public/logo-icon.svg          ← NEW: logomark SVG
public/logo.svg               ← NEW: combination mark SVG
public/favicon.svg            ← NEW: favicon SVG (32×32 with background)
brand.json                    ← NEW: brand contract
src/components/SolvLogo.tsx   ← NEW: parametric React logo component
src/components/AppNav.tsx     ← UPDATED: uses SolvLogo + improved a11y
src/app/page.tsx              ← UPDATED: uses SolvLogo in nav + footer
src/app/layout.tsx            ← UPDATED: favicon + full OG/Twitter metadata
```
