# Sales Squad — Project Summary

## What it is
A single-user, browser-based sales metrics tracker and calculator. No server, no login — runs entirely from the local file system using `localStorage` for data persistence. Built with plain HTML, CSS, and vanilla JavaScript.

**Location:** Open `index.html` directly in any browser.

---

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | App shell — HTML structure, loads all scripts |
| `css/style.css` | All styling — navy/red colour scheme, responsive layout |
| `js/data.js` | Data layer — localStorage read/write/delete + CSV export |
| `js/metrics.js` | All calculations — rates, aggregation, forecasting, trend grouping |
| `js/charts.js` | Chart.js wrappers — 6 chart types |
| `js/app.js` | Full UI — rendering, navigation, modals, event handling |

---

## Five Sections

### 1. Dashboard
The main view. Has a period selector (Today / Week / Month / Quarter / Year) that drives all metrics shown.
- **8 KPI cards:** Leads, Conversations, Show Rate, Avg Deal Value, Units Sold, Revenue, Pipeline Value, Weighted Forecast
- **4 conversion rate cards** with colour-coded progress bars:
  - Lead → Prospect, Prospect → Client, Lead → Client, Win Rate
  - Win Rate falls back to Prospect → Client rate if no pipeline deals are closed yet
- **Target vs Actual** — progress bars comparing actuals against your set targets
- **Period Forecast** — projected end-of-period revenue/units based on current daily run rate
- **3 charts:** Conversion Funnel, Revenue Trend (all-time by month), Pipeline by Stage (doughnut)
- **Time Metrics** — avg lead time, prospect time, total acquisition time, won/lost counts

### 2. Activity Log
Daily data entry — the raw inputs that drive all activity-based metrics.
- Fields per entry: Date, Leads, Conversations, Meetings Scheduled, Meetings Attended, Units Sold, Revenue (£), Notes
- Filter by period, edit/delete any entry, totals row at the bottom of the table

### 3. Pipeline
Individual deal tracking — drives pipeline value, weighted forecast, win rate, and time metrics.
- Fields per deal: Name, Stage, Probability (%), Value (£), Lead Date, Prospect Date, Close Date, Notes
- 6 stages: Lead → Prospect → Meeting → Negotiation → Won → Lost
- Probability auto-fills when stage changes (Lead=10%, Prospect=25%, Meeting=50%, Negotiation=75%, Won=100%, Lost=0%)
- Stats bar: Open Pipeline value, Weighted Forecast, Won Value, Win Rate, Avg Acquisition Time
- Filter by stage with deal counts per stage

### 4. Reports
Analysis and export view with its own period and granularity selector (by Day / Week / Month).
- **5 charts:** Revenue Trend, Conversion Activity Trend, Funnel, Pipeline by Stage, Target vs Actual
- **Period Summary** — 8 key stats in a grid
- **Pipeline Summary** — 8 pipeline stats in a grid
- **Exports:** Activity CSV, Pipeline CSV, Print Report (print stylesheet hides navigation/buttons)

### 5. Settings
- Set targets for each period (Weekly / Monthly / Quarterly / Annual): Leads, Conversations, Meetings, Units, Revenue
- Data Management: export CSVs or wipe all data (with confirmation)

---

## Data Storage

Three `localStorage` keys:

| Key | Contains |
|-----|---------|
| `ss_entries` | Array of daily activity log records |
| `ss_pipeline` | Array of individual pipeline deals |
| `ss_targets` | Target numbers per period |

---

## Calculations & Metrics

| Metric | Formula |
|--------|---------|
| Lead → Prospect rate | Conversations ÷ Leads |
| Prospect → Client rate | Units Sold ÷ Conversations |
| Lead → Client rate | Units Sold ÷ Leads |
| Show rate | Meetings Attended ÷ Meetings Scheduled |
| Avg deal value | Revenue ÷ Units Sold |
| Pipeline value | Sum of all open deal values |
| Weighted forecast | Sum of (Deal Value × Probability) for open deals |
| Win rate | Won Deals ÷ (Won + Lost Deals) — falls back to Prospect → Client if no closed pipeline deals |
| Period forecast | Current pace × remaining days in period |
| Avg lead/prospect time | Average days between stage dates on pipeline deals |

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-17 | V1 built — all five sections, localStorage persistence, Chart.js charts, CSV export |
| 2026-03-17 | Win Rate fix — falls back to Prospect → Client rate when no closed pipeline deals exist |

---

## Planned Future Work
- Database backend (replacing localStorage)
- Multi-user / multi-client support
- Additional users/clients beyond single-user mode
