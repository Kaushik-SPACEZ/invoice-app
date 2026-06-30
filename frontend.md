# FRONTEND SPECIFICATION — INVOICE ERP

---

## 1. DESIGN PHILOSOPHY

- **Modern premium SaaS** — not a traditional ERP. Think Linear, Vercel dashboard, Stripe.
- **Dark mode default**, light mode toggle persisted to localStorage.
- **Glassmorphism + solid contrast hybrid** — glass cards on dark backgrounds, solid fills on light.
- **Micro-interactions everywhere** — every button, card, input has a motion response.
- **Data-dense but visually light** — lots of info, zero clutter.
- **INR currency** throughout (`₹` symbol, Indian number formatting: 1,24,500).

---

## 2. COLOR SYSTEM

### Dark Mode Backgrounds
| Token | Hex | Usage |
|---|---|---|
| bg-base | `#0A0F1E` | Page background |
| bg-surface | `#111827` | Sidebar, navbar |
| bg-card | `#1F2937` | Cards, panels |
| bg-elevated | `#2D3748` | Dropdowns, tooltips |
| border-default | `#374151` | Card borders |
| border-subtle | `#1F2937` | Dividers |

### Light Mode Backgrounds
| Token | Hex | Usage |
|---|---|---|
| bg-base | `#F9FAFB` | Page background |
| bg-surface | `#FFFFFF` | Sidebar, navbar |
| bg-card | `#F3F4F6` | Cards |
| border-default | `#E5E7EB` | Card borders |

### Brand / Primary
| Token | Hex |
|---|---|
| primary | `#6366F1` |
| primary-dark | `#4F46E5` |
| primary-light | `#818CF8` |
| primary-glow | `rgba(99,102,241,0.25)` |

### Semantic Colors
| Token | Hex | Usage |
|---|---|---|
| success | `#10B981` | Profit, positive trends, approved |
| warning | `#F59E0B` | Low stock, yellow confidence |
| danger | `#EF4444` | Errors, red confidence, danger buttons |
| info | `#3B82F6` | Info badges, links |

### Text
| Token | Dark Mode | Light Mode |
|---|---|---|
| text-primary | `#F9FAFB` | `#111827` |
| text-secondary | `#9CA3AF` | `#6B7280` |
| text-muted | `#6B7280` | `#9CA3AF` |

### Marketplace Brand Colors
| Marketplace | Hex |
|---|---|
| Amazon | `#FF9900` |
| Flipkart | `#2874F0` |
| Meesho | `#F43397` |

### Confidence Score Colors
| Level | Background | Text |
|---|---|---|
| ≥ 95% (Green) | `rgba(16,185,129,0.15)` | `#10B981` |
| 80–94% (Yellow) | `rgba(245,158,11,0.15)` | `#F59E0B` |
| < 80% (Red) | `rgba(239,68,68,0.15)` | `#EF4444` |

### Chart Colors (in order)
`#6366F1`, `#10B981`, `#F59E0B`, `#3B82F6`, `#EC4899`, `#8B5CF6`, `#14B8A6`, `#F97316`

### Gradients
```css
--gradient-primary: linear-gradient(135deg, #6366F1, #8B5CF6);
--gradient-success: linear-gradient(135deg, #059669, #10B981);
--gradient-hero: linear-gradient(135deg, #0A0F1E 0%, #1a1040 50%, #0d1f3c 100%);
--gradient-card-glow: 0 0 40px rgba(99,102,241,0.15);
```

---

## 3. TYPOGRAPHY

**Fonts** (Google Fonts):
- Heading: `Plus Jakarta Sans` — weights 600, 700, 800
- Body: `Inter` — weights 400, 500, 600
- Mono (amounts, codes, invoice numbers): `JetBrains Mono` — weight 400, 500

**Scale:**
| Name | rem | px |
|---|---|---|
| xs | 0.75rem | 12px |
| sm | 0.875rem | 14px |
| base | 1rem | 16px |
| lg | 1.125rem | 18px |
| xl | 1.25rem | 20px |
| 2xl | 1.5rem | 24px |
| 3xl | 1.875rem | 30px |
| 4xl | 2.25rem | 36px |
| 5xl | 3rem | 48px |

---

## 4. SPACING & LAYOUT

- Grid: **12-column**, gap 24px
- Container max-width: **1440px**
- Sidebar width: **256px** expanded / **68px** collapsed
- Navbar height: **64px**
- Border radius: sm=4px, md=8px, lg=12px, xl=16px, 2xl=24px, full=9999px
- Shadows:
  ```css
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.3);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.4);
  --shadow-glow: 0 0 40px rgba(99,102,241,0.2);
  ```

---

## 5. COMPONENT SPECS

### 5.1 Buttons

**Primary Button**
```
bg: linear-gradient(135deg, #6366F1, #8B5CF6)
text: white, font-semibold
border-radius: 9999px (pill)
padding: 10px 24px
```
Framer Motion:
```tsx
whileHover={{ scale: 1.02, boxShadow: "0 8px 25px rgba(99,102,241,0.45)" }}
whileTap={{ scale: 0.97 }}
transition={{ type: "spring", stiffness: 400, damping: 20 }}
```
Loading state: spinner icon + "Processing..." text, opacity 0.7, pointer-events none.

**Secondary Button**
```
bg: transparent
border: 1px solid #6366F1
text: #6366F1
border-radius: 9999px
```
Framer: `whileHover={{ backgroundColor: "rgba(99,102,241,0.08)" }}`

**Ghost Button**: no border, no bg, text color secondary. Hover: text-primary.

**Danger Button**: `bg: #EF4444`, white text. Hover: `bg: #DC2626`.

**Icon Button**: 40×40px circle, centered icon, ghost or secondary style.

---

### 5.2 Cards

**Metric Card** (KPI on dashboard)
```css
background: rgba(31,41,55,0.8);
backdrop-filter: blur(12px);
border: 1px solid rgba(99,102,241,0.2);
border-radius: 16px;
padding: 24px;
```
Layout: colored icon (top-left), large value (JetBrains Mono, 3xl), label (sm, muted), trend badge (bottom).

Framer:
```tsx
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.05 }}
```
Value animates with count-up on mount.

**Data Card**: same glass bg, header row (title + optional action), content area.

**Alert Card**: left border 4px colored (warning=amber, error=red, info=blue), icon + message.

---

### 5.3 Form Inputs

```css
background: #1F2937;
border: 1px solid #374151;
border-radius: 8px;
padding: 10px 14px;
color: #F9FAFB;
transition: border-color 0.2s, box-shadow 0.2s;
```
Focus: `border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99,102,241,0.2);`
Error: `border-color: #EF4444;` + red helper text below.
Disabled: `opacity: 0.5; cursor: not-allowed;`

---

### 5.4 Upload Zone

```css
border: 2px dashed #374151;
border-radius: 16px;
padding: 48px;
text-align: center;
transition: all 0.2s;
```
Drag-over state:
```css
border-color: #6366F1;
background: rgba(99,102,241,0.05);
```
Framer on drag: `scale: 1.01`, border pulses with `animate={{ borderColor: ["#374151", "#6366F1", "#374151"] }} transition={{ repeat: Infinity, duration: 1.5 }}`

---

### 5.5 Processing Steps (pill row)

States: pending (bg `#374151`, text muted) → active (bg `#6366F1`, text white, pulsing) → done (bg `#10B981`, text white, checkmark).

Active pulse:
```tsx
animate={{ boxShadow: ["0 0 0 0 rgba(99,102,241,0.4)", "0 0 0 8px rgba(99,102,241,0)"] }}
transition={{ repeat: Infinity, duration: 1.2 }}
```

---

### 5.6 Confidence Badge

```tsx
const color = score >= 95 ? 'emerald' : score >= 80 ? 'amber' : 'red'
// bg: rgba(color, 0.15), text: color-500
```
Framer: `initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: index * 0.04 }}`

---

### 5.7 Sidebar Navigation

```
Width expanded: 256px
Width collapsed: 68px
bg: #111827
border-right: 1px solid #1F2937
```
Nav item active: `bg: rgba(99,102,241,0.15); border-left: 2px solid #6366F1;`
Nav item hover: `bg: rgba(255,255,255,0.04);`

Framer collapse:
```tsx
<motion.aside
  animate={{ width: collapsed ? 68 : 256 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
>
```
Labels fade out when collapsed: `animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto" }}`

---

### 5.8 Top Navbar

Height 64px, `bg: rgba(17,24,39,0.8)`, `backdrop-filter: blur(12px)`, `border-bottom: 1px solid #1F2937`.
- Left: hamburger toggle + breadcrumb
- Right: search icon → command palette, notification bell (red badge count), dark/light toggle, user avatar + dropdown

---

### 5.9 Charts (Recharts)

**Revenue Area Chart**: `<AreaChart>`, gradient fill from `#6366F1` to transparent, line stroke `#6366F1`.

**Marketplace Bar Chart**: `<BarChart>` grouped, colors per marketplace (Amazon=`#FF9900`, Flipkart=`#2874F0`, Meesho=`#F43397`).

**Expense Donut**: `<PieChart>` with `innerRadius`, custom tooltip.

**Sparkline**: tiny `<LineChart>` 80×32px, no axes, trend line only.

All charts: `animationDuration={800}`, `animationEasing="ease-out"`.

---

## 6. PAGES

### Login Page
**Layout**: Full screen split 50/50.

**Left panel** (`bg: linear-gradient(135deg, #0A0F1E, #1a1040)`):
- App name **"BizSync"** in 5xl bold white, Plus Jakarta Sans
- Tagline: *"From invoice to insight — automatically."* in lg muted
- 3 floating decorative metric cards (revenue, GST, profit) — blurred glass, rotating slowly
- Framer: cards float `animate={{ y: [0, -12, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}`

**Right panel** (centered card, max-w-md):
- Small logo icon
- "Welcome back" h2
- Email input
- Password input + show/hide eye toggle
- Remember me toggle switch
- Primary login button (full width)
- `— or continue with —` divider
- Google button (white bg, Google SVG icon, secondary style)
- "New here? Create account" link

Form stagger animation:
```tsx
variants={{ animate: { transition: { staggerChildren: 0.08 } } }}
// each field: initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }}
```

---

### Dashboard
**Layout**: Sidebar (256px) + main content area.

**Main content top bar**: "Good morning, Raj 👋" (2xl bold) + today's date + **Upload Invoice** primary button (top right, prominent).

**Row 1 — KPI Cards** (4 equal columns):
1. Today's Sales — icon: `TrendingUp` (green) — value in INR mono font — trend badge `+8% vs yesterday`
2. Monthly Revenue — icon: `BarChart3` (indigo) — trend `+12% vs last month`
3. GST Payable — icon: `Receipt` (amber) — "Due: 20th July" badge
4. Net Profit — icon: `DollarSign` (emerald) — trend `+5%`

**Row 2** (3 columns):
- Inventory Status (3 mini stats: Total Products, Low Stock, Out of Stock)
- Low Stock Alert list (top 5 products, each with mini progress bar)
- Recent Uploads (last 5 invoices, each with marketplace badge + status)

**Row 3** — Revenue Area Chart (full width, last 30 days, gradient fill)

**Row 4** (2 columns):
- Marketplace Performance grouped bar chart
- Expense breakdown donut chart

**Row 5** — Recent Activity feed (notification-style, last 10 events)

---

### Upload Invoice Page
**Layout**: Centered, max-w-2xl.

- Page title "Upload Invoices" + subtitle "PDF, JPG, or PNG — up to 10MB each"
- **Drag-drop zone** (200px tall): upload icon + "Drop invoices here" + "or click to browse" link + format badges (PDF / JPG / PNG)
- File queue list (appears after drop): each row has filename, size, animated progress bar, status icon
- **Process All** button (primary, appears after files added)

---

### Invoice Processing Page
Full-screen overlay.

Center: SVG circular progress ring (indigo, animated stroke-dashoffset), current stage name in 2xl bold below.

Bottom pills row (7 steps):
`Uploading → Reading Invoice → Extracting Data → Checking GST → Updating Inventory → Generating Reports → Done`

Background: subtle dot grid pattern with slow fade animation.

---

### AI Review Page
**Layout**: 2-column split (50% / 50%), full viewport height.

**Left — PDF Viewer**:
- `react-pdf` component, scrollable
- Zoom in/out controls (top bar)
- Page X of Y navigator
- Subtle drop shadow on document

**Right — Extracted Data Form** (scrollable):
- Sticky header: "Review Extracted Data" + overall confidence chip
- **Section: Invoice Details** — Invoice Number, Date, Marketplace dropdown
- **Section: Vendor** — Vendor Name, GSTIN
- **Section: Line Items** — editable table (SKU, Product, HSN, Qty, Unit Price, Tax%, Total) with add/delete row
- **Section: Tax Summary** — CGST, SGST, IGST, Total Tax (read-only calculated)
- **Section: Totals** — Subtotal, Tax, Grand Total

Each field: confidence badge to the right. Fields with <80% confidence: amber left border + warning icon.
Click any field → inline edit mode.

**Footer** (sticky bottom):
- `Reject Invoice` ghost danger button (left)
- `Approve Invoice` large primary green button (right)

---

### Invoice List Page
Filter bar: Search input + Marketplace chips (All / Amazon / Flipkart / Meesho) + Date range + Status filter.

Table columns: `#` · Invoice No (mono) · Date · Marketplace (colored badge) · Customer · Amount (mono) · GST · Status · Actions

Status badges: `Approved` (green) · `Pending Review` (amber) · `Processing` (blue pulsing) · `Error` (red) · `Duplicate` (gray)

Row hover: subtle bg. Row click → detail drawer slides from right (360px). Pagination footer.

---

### Inventory Page
Stats row: Total SKUs · Low Stock (amber) · Out of Stock (red) · Total Value

Filter: search + category dropdown + stock level filter (All / Low / Zero).

Table: SKU (mono) · Product Name · Category · **Stock** (number + mini bar — green/amber/red) · Min Level · Unit Cost (mono) · Total Value (mono) · Actions (edit/delete icons)

Inline edit on row double-click.

---

### Sales Page
Period tabs: `Today` · `This Week` · `This Month` · `This Year`

Summary cards: Revenue · Orders · Avg Order Value · Returns (4 cards).

Marketplace mini-cards (3): Amazon / Flipkart / Meesho with brand color header, revenue + order count.

Table: Date · Invoice# · Marketplace badge · Customer · Products (collapsed, expand on hover) · Revenue · GST · Net Revenue.

Revenue trend area chart below table.

---

### Customers Page
Search + B2B/B2C filter chips.

Card grid (3 columns): each card = avatar circle (initials, colored bg) + name + GSTIN (mono, small) + city + "₹X total spent" + "Last order: X days ago".

Click → detail drawer: full profile tab + purchase history timeline.

---

### GST Page
Tabs: `Overview` · `Monthly Ledger` · `B2B` · `B2C` · `HSN Summary` · `Download Reports`

Overview tab: 3 KPI cards (Output Tax Collected / Input Tax Credit / Net GST Payable) + quarterly bar chart.

Monthly tab: table with Month · Taxable Value · CGST · SGST · IGST · Total.

Download tab: period selector (month picker) + format radio (PDF / Excel / CSV) + Generate button.

---

### Accounting Page
Tabs: `Journal Entries` · `Ledger` · `Profit & Loss` · `Balance Sheet`

Journal entries: filterable table (Date · Entry# · Description · Debit Account · Credit Account · Amount).

P&L: formatted financial statement layout (Revenue section, COGS, Gross Profit, Expenses breakdown, Net Profit — bold).

Balance Sheet: two-column layout (Assets left, Liabilities + Equity right).

---

### Reports Page
Card grid (3 columns):
- Sales Report · GST Report · Profit Report · Inventory Report · Marketplace Report · Customer Report · Expense Report · Custom Report

Each card: icon + name + description + date range inputs + format dropdown + **Generate** button.

Recent Reports list at bottom: filename · generated date · format badge · download icon.

---

### Marketplace Analytics Page
Platform tabs: `All Platforms` · `Amazon` · `Flipkart` · `Meesho`

Per tab:
- KPI cards: Sales · Revenue · Commission Paid · Returns
- Best Sellers table (rank · product · units sold · revenue · margin%)
- Settlement tracking table (period · expected · received · difference · status badge)
- Monthly trend line chart

---

### Notifications Page
`Mark All Read` button (top right).

Grouped: **Today** / **Yesterday** / **This Week**.

Each item: type icon (color-coded) + title (bold) + message + timestamp + unread dot (indigo). Click → mark read + navigate to relevant page.

---

### Audit Log Page
Filters: date range + action type dropdown + entity type.

Table: Timestamp · User · Action (colored badge) · Entity · Summary · Expand icon (shows old/new JSON diff on expand).

---

### Settings Page
Left sub-nav: Profile · Business Info · Marketplace Connections · Notifications · Security.

Profile: avatar upload, name, email fields.
Business Info: company name, GSTIN, address, phone.
Security: change password, active sessions.

---

## 7. FRAMER MOTION PATTERNS

```tsx
// Page transition wrapper (wrap every page)
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } }
}
export const PageWrapper = ({ children }) => (
  <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
    {children}
  </motion.div>
)

// Staggered list (wrap ul, animate li)
const listVariants = {
  animate: { transition: { staggerChildren: 0.05 } }
}
const listItemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 25 } }
}

// Count-up hook
export const useCountUp = (target: number, duration = 1200) => {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return value
}

// Modal
const modalVariants = {
  initial: { opacity: 0, scale: 0.95, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 28 } },
  exit: { opacity: 0, scale: 0.95, y: 12, transition: { duration: 0.15 } }
}
// Backdrop: initial={{ opacity:0 }} animate={{ opacity:1 }}

// Drawer (slide from right)
const drawerVariants = {
  initial: { x: "100%" },
  animate: { x: 0, transition: { type: "spring", stiffness: 350, damping: 35 } },
  exit: { x: "100%", transition: { duration: 0.2 } }
}

// Sidebar collapse
<motion.aside animate={{ width: collapsed ? 68 : 256 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />

// Confidence badge pop-in
<motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: index * 0.04 }} />
```

---

## 8. RESPONSIVE BREAKPOINTS

| Breakpoint | Width | Changes |
|---|---|---|
| mobile | < 640px | Single column, sidebar becomes bottom sheet drawer |
| tablet | 640–1024px | Sidebar collapsed by default, 2-col grids |
| desktop | > 1024px | Full sidebar expanded, all columns |

---

## 9. TECH STACK

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1",
    "framer-motion": "^11.2.10",
    "@tanstack/react-query": "^5.45.1",
    "zustand": "^4.5.4",
    "axios": "^1.7.2",
    "recharts": "^2.12.7",
    "react-dropzone": "^14.2.3",
    "react-pdf": "^7.7.3",
    "lucide-react": "^0.395.0",
    "react-hot-toast": "^2.4.1",
    "date-fns": "^3.6.0",
    "@headlessui/react": "^2.1.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vite": "^5.3.1",
    "@vitejs/plugin-react": "^4.3.1",
    "tailwindcss": "^3.4.4",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38"
  }
}
```

---

## 10. FOLDER STRUCTURE

```
src/
├── api/
│   ├── client.ts          # axios instance, interceptors
│   ├── auth.ts
│   ├── invoices.ts
│   ├── products.ts
│   ├── sales.ts
│   ├── customers.ts
│   ├── gst.ts
│   ├── accounting.ts
│   ├── reports.ts
│   ├── marketplace.ts
│   ├── dashboard.ts
│   ├── notifications.ts
│   └── settings.ts
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   ├── Drawer.tsx
│   │   ├── Tooltip.tsx
│   │   ├── Skeleton.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   ├── MarketplaceBadge.tsx
│   │   └── EmptyState.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Navbar.tsx
│   │   ├── PageWrapper.tsx
│   │   └── AppLayout.tsx
│   ├── charts/
│   │   ├── RevenueAreaChart.tsx
│   │   ├── MarketplaceBarChart.tsx
│   │   ├── ExpenseDonut.tsx
│   │   └── Sparkline.tsx
│   ├── dashboard/
│   │   ├── MetricCard.tsx
│   │   ├── LowStockList.tsx
│   │   └── RecentActivity.tsx
│   └── invoice/
│       ├── UploadZone.tsx
│       ├── ProcessingSteps.tsx
│       ├── ReviewSplitPanel.tsx
│       └── LineItemsTable.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useCountUp.ts
│   ├── useInvoiceUpload.ts
│   ├── useInvoiceStatus.ts
│   ├── useDarkMode.ts
│   └── useDebounce.ts
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── UploadInvoice.tsx
│   ├── InvoiceProcessing.tsx
│   ├── InvoiceReview.tsx
│   ├── InvoiceList.tsx
│   ├── InvoiceDetail.tsx
│   ├── Inventory.tsx
│   ├── Sales.tsx
│   ├── Customers.tsx
│   ├── GST.tsx
│   ├── Accounting.tsx
│   ├── Reports.tsx
│   ├── Marketplace.tsx
│   ├── Notifications.tsx
│   ├── AuditLog.tsx
│   └── Settings.tsx
├── store/
│   ├── authStore.ts
│   ├── uiStore.ts
│   └── notificationStore.ts
├── types/
│   └── index.ts
├── lib/
│   ├── queryClient.ts
│   ├── formatters.ts      # INR formatting, date formatting
│   └── utils.ts
├── styles/
│   └── globals.css
├── App.tsx
└── main.tsx
```

---

## 11. TAILWIND CONFIG

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#6366F1', dark: '#4F46E5', light: '#818CF8' },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        bg: { base: '#0A0F1E', surface: '#111827', card: '#1F2937', elevated: '#2D3748' },
        border: { default: '#374151', subtle: '#1F2937' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } }
      }
    }
  }
}
```
