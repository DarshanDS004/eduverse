# `earnings.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `earnings.html` |
| **File Type** | Frontend Page — Instructor Portal |
| **Location** | `pages/instructor/earnings.html` |
| **Page Title** | Earnings — EduVerse |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This page provides instructors with a **financial overview** of their earnings from the platform. It shows:
- Total earnings, course earnings, material earnings, and transaction count
- A **bar chart** of revenue trend over the selected time period
- A **doughnut chart** breaking down earnings by source (Courses vs Materials)
- A full transaction history table

---

## 2. Responsibility

- Fetch earnings data from `GET /instructor/earnings?days=<n>`
- Display four KPI stat cards (total, course, material earnings + transaction count)
- Render a Chart.js bar chart for revenue trend over time
- Render a Chart.js doughnut chart for earnings breakdown
- Render a detailed transaction table (date, student, item, type, amount, status)
- Allow filtering by time period (7 / 30 / 90 / 365 days)
- Enforce instructor-only access

---

## 3. Imports / Dependencies

### External CDN

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | Typography |
| `Feather Icons 4.29.1` | SVG icons |
| `Chart.js 4.4.1` | Revenue bar chart + breakdown doughnut chart |

### Local CSS / JS
Same set as all other portal pages: `variables.css`, `reset.css`, `global.css`, `components.css`, `layout.css`, `utils.js`, `store.js`, `api.js`, `auth.js`, `init.js`.

---

## 4. Core Logic Breakdown

### Step 1 — Theme Bootstrap
Synchronous dark mode check from `localStorage`.

### Step 2 — Auth Guard
Standard instructor role check IIFE.

### Step 3 — DOMContentLoaded
Standard app shell setup (feather, user info, sidebar, theme, dropdown, logout, helpers).

### Step 4 — `loadEarnings()` — Data Fetch & Render
```js
async function loadEarnings() {
  var days = document.getElementById('earnings-period').value;
  var res = await Api.get('/instructor/earnings', { days: days });
  var d = (res && res.data) || {};
  // 1. Update KPI stat cards
  // 2. Render revenue trend bar chart (if data exists)
  // 3. Render breakdown doughnut chart (if earnings > 0)
  // 4. Render transactions table
}
```

### Step 5 — Revenue Trend Bar Chart
```js
if (d.revenue_trend && d.revenue_trend.length) {
  if (revChart) revChart.destroy();
  revChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data: vals, backgroundColor: 'rgba(5,150,105,0.7)', borderRadius: 6 }] },
    options: { scales: { y: { ticks: { callback: v => '₹' + v } } } }
  });
}
```
The Y-axis tick formatter prepends `₹` to all values. Chart is destroyed before recreation on filter change.

### Step 6 — Earnings Breakdown Doughnut
Only rendered if `course_earnings + material_earnings > 0`:
```js
if (ce + me > 0) {
  breakChart = new Chart(ctx2, {
    type: 'doughnut',
    data: { labels: ['Courses', 'Materials'], datasets: [{ data: [ce, me], backgroundColor: ['#3b82f6', '#f59e0b'] }] }
  });
}
```

### Step 7 — Transactions Table
Dynamically builds HTML table rows from `d.transactions[]`.

---

## 5. Functions / Methods

### `loadEarnings()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Fetch and render all earnings data |
| **Parameters** | None (reads from `#earnings-period`) |
| **Returns** | `Promise<void>` |
| **API Call** | `GET /instructor/earnings?days=<n>` |

**Expected API response shape:**
```json
{
  "data": {
    "total_earnings": 15000,
    "course_earnings": 10000,
    "material_earnings": 5000,
    "transaction_count": 42,
    "revenue_trend": [{ "label": "Apr 1", "date": "2025-04-01", "amount": 500 }],
    "transactions": [
      {
        "created_at": "2025-04-01T10:00:00Z",
        "student_name": "Ravi Kumar",
        "item_title": "Python Basics",
        "type": "purchase",
        "amount": 299,
        "status": "completed"
      }
    ]
  }
}
```

---

### Transaction Table Rendering (inline)

Each transaction row displays:
- **Date**: `toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })`
- **Student**: student name
- **Item**: item title (course or material name)
- **Type**: badge with neutral style (e.g., "purchase")
- **Amount**: green bold text with `₹` prefix
- **Status**: color-coded badge — `completed` = success (green), `pending` = warning (amber), other = danger (red)

**Empty state**: Shows 💰 emoji + "No transactions yet" message.

---

### Helper `fmt(n)` — inline

| Property | Detail |
|---|---|
| **Purpose** | Format a number as `₹N` |
| **Parameters** | `n` — number or null |
| **Returns** | String: `'₹0'` if null, else `'₹' + parseFloat(n).toFixed(0)` |

---

## 6. API Role

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `GET` | `/instructor/earnings` | `days` (7/30/90/365) | Fetch earnings summary + transactions |

---

## 7. UI Structure

```
.app-shell
└── .app-main
    └── .page-content
        ├── .page-header
        │   ├── Title: "Earnings"
        │   └── Period filter <select> (#earnings-period)
        ├── Stats row (4 cards)
        │   ├── #s-total       — Total Earnings
        │   ├── #s-courses     — Course Earnings
        │   ├── #s-materials   — Material Earnings
        │   └── #s-transactions — Total Transactions
        ├── 2-col grid
        │   ├── Revenue Trend card  → <canvas id="revenue-chart"> (bar)
        │   └── Breakdown card      → <canvas id="breakdown-chart"> (doughnut)
        └── Transactions table
            └── Columns: Date | Student | Item | Type | Amount | Status
```

---

## 8. Data Flow

```
Page Load → loadEarnings() (default: 30 days)
User changes period filter → loadEarnings() (re-fetch)

loadEarnings():
  GET /instructor/earnings?days=N
  → d.total_earnings → #s-total
  → d.course_earnings → #s-courses
  → d.material_earnings → #s-materials
  → d.transaction_count → #s-transactions
  → d.revenue_trend → Bar chart (destroy + rebuild)
  → d.course_earnings + material_earnings → Doughnut chart (destroy + rebuild)
  → d.transactions → Table rows HTML
```

---

## 9. Connections

| Dependency | Usage |
|---|---|
| `api.js` | `Api.get('/instructor/earnings', { days })` |
| `Chart.js` | Two chart instances |
| Sidebar navigation | Links to other portal pages |

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| API call fails | `catch(e)` → `console.error(e)` — no user-facing toast for data load failure |
| Empty transactions | Inline empty state HTML in table body |
| No revenue trend data | Chart creation is skipped (guarded by `d.revenue_trend && d.revenue_trend.length`) |
| Zero total earnings | Doughnut chart is skipped (guarded by `ce + me > 0`) |
| Null earnings values | `fmt()` helper returns `'₹0'` |

---

## 11. Edge Cases / Notes

- **Chart destruction pattern**: Both `revChart` and `breakChart` are module-level variables. On each `loadEarnings()` call, existing instances are destroyed before creating new ones to prevent duplicate canvas rendering.
- **Currency format**: All amounts are formatted as `₹` (Indian Rupee) with `toFixed(0)` (no decimals).
- **Transaction date format**: Uses `en-IN` locale with `day:'numeric', month:'short', year:'numeric'` — results in formats like "1 Apr 2025".
- **Y-axis callback**: The revenue chart's Y-axis uses a `callback` function to prefix values with `₹`. This is a Chart.js v4 feature.
- **Breakdown chart condition**: The doughnut only renders if total earnings > 0. This prevents a meaningless 0/0 chart.
- **No pagination**: All transactions for the period are rendered at once — there is no client-side pagination or limit on the table.

---

## 12. Summary

`earnings.html` is the **Earnings & Revenue page** of the EduVerse Instructor Portal. It gives instructors a clear financial picture with KPI stat cards, a time-period-filterable revenue trend bar chart, an earnings source breakdown doughnut, and a full transaction history table. All monetary values are in Indian Rupees (₹). The page is simple in structure — one API call drives all displayed data, with Chart.js handling the visual components.
