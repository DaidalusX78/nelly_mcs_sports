# Nelly Mc's Marbella — Weekly Sports Coverage Generator

Interactive weekly sports schedule poster builder and live fixture ingestion tool for **Nelly Mc's Marbella**.

Generates a clean, editable A4 schedule (`11:30–23:59` `Europe/Madrid` local time, Monday–Sunday) with competition crests, tick-to-select checkboxes, inline editing, HTML snapshot export, and auto-formatted 2-page PDF/Print output.

---

## Current Release

- **Active Poster App:** `nelly_sports_v01.04.html` (`v01.04`)
- **Versioning Scheme:** `nelly_sports_vXX.YY.html` — upon each update or `--bump`, the current file version increments (e.g. `v01.03` -> `v01.04`) and displays inside the `<title>`, toolbar badge (`#toolbarVersionBadge`), footer credit (`#footerVersionLabel`), and `APP_VERSION`.
- **Archive Policy:** Previous HTML releases are stored in `Archive/` (git-ignored) so only the current active HTML release is tracked at the project root.

---

## Project Structure

```text
nelly_mcs_sports/
├── nelly_sports_v01.04.html   # Interactive self-contained poster & PDF/Print builder
├── fetch-weekly-sports.js     # Automated weekly fixture fetcher & HTML updater (Node 18+)
├── package.json               # npm scripts & project metadata
├── .env.example               # Template for API_SPORTS_KEY and optional feeds
├── .gitignore                 # Excludes .env, Archive/, *.pdf, OS artifacts
├── Prompt.txt                 # Weekly sports scheduling specification
├── api_data.txt               # API endpoint reference notes
└── README.md
```

---

## Quick Start

### 1. View / Edit Manually in Browser
Double-click `nelly_sports_v01.04.html` in any modern browser:
- **Tick fixtures** to select them for the final poster (unselected fixtures remain readable on screen and are hidden when exporting/printing).
- **Edit inline** or add custom fixtures/notes from the **Add Panel**.
- **Save Edits (.html)** downloads an updated self-contained HTML snapshot with your checked/edited state preserved.
- **Export PDF (Max 2 Pages)** automatically fits selected sports onto at most 2 A4 pages (`Nelly Mc's Weekly_Sport_dd_mmm_yyyy.pdf`).

### 2. Automated Weekly Fixture Ingestion (`fetch-weekly-sports.js`)
Requires **Node.js 18+** (uses built-in `fetch`, zero third-party npm dependencies).

1. Copy `.env.example` to `.env` and add your free API-Sports key:
   ```bash
   cp .env.example .env
   ```
   ```env
   API_SPORTS_KEY=your_actual_key_here
   ```
2. Preview without modifying files:
   ```bash
   node fetch-weekly-sports.js --dry-run
   # or for a specific Monday:
   node fetch-weekly-sports.js --from=2026-11-30 --dry-run
   ```
3. Fetch fixtures and update the active HTML file:
   ```bash
   node fetch-weekly-sports.js
   ```
4. Fetch fixtures, move the previous HTML into `Archive/`, and bump the version (`v01.04` -> `v01.05`):
   ```bash
   node fetch-weekly-sports.js --bump
   ```

> **Security:** Never commit `.env` or hardcode `API_SPORTS_KEY` inside client-side HTML files.

---

## Integrated Data Sources

| Sport | Primary Source | Auth | Endpoint / Notes |
| --- | --- | --- | --- |
| **Football** (EPL, UCL, UEL, UECL, Scottish Premiership [Old Firm only], World Cup, Euros, Nations League) | [API-Football v3](https://v3.football.api-sports.io/) | `x-apisports-key` (`.env`) | `/fixtures?league=...&season=...&from=...&to=...&timezone=Europe/Madrid` (falls back to ESPN `soccer/eng.1` if key absent) |
| **Rugby Union** (Internationals, URC, Champions Cup, Six Nations) | [API-Rugby v1](https://v1.rugby.api-sports.io/) | `x-apisports-key` (`.env`) | `/games?date=YYYY-MM-DD&timezone=Europe/Madrid` (falls back to ESPN `rugby/six-nations` & `rugby/urc`) |
| **Formula 1** (Qualifying, Sprint, Race) | [Jolpica F1](https://api.jolpi.ca/ergast/f1/) | None (`User-Agent`) | `/ergast/f1/{year}.json` |
| **Golf & Extra Coverage** | ESPN Public JSON | None (`User-Agent`) | `/apis/site/v2/sports/{sport}/{league}/scoreboard` (`/golf/pga`, `/golf/eur`) |
| **GAA** (Senior Football & Hurling) | Official `.ics` / iCal Feeds (optional) | None | Set comma-separated `GAA_ICS_URLS` in `.env` or add manually in the poster drawer |

All timestamps are converted to **`Europe/Madrid`** local time and filtered strictly to **`11:30–23:59`**.

---

## Architecture Note: Web vs. PWA vs. Native App

For a workflow executed **once a week** to curate fixtures and export an A4 PDF/print poster:

- **Recommended — Web App + Local CLI Fetcher (current setup):** Zero build/app-store overhead, works on any Mac/Windows browser offline once generated, relies natively on browser print & `html2pdf.js`, and keeps `API_SPORTS_KEY` safely server/CLI-side in `.env`.
- **Optional Upgrade — Light PWA / Hosted Internal Web Page:** If staff want an icon on a tablet/desktop dock without touching local files, serve the built HTML via GitHub Pages or an internal URL and add a `manifest.json` + lightweight serverless/GitHub Actions proxy for the weekly API fetch.
- **Not Recommended — Native Mobile/Desktop App:** Overkill for a single weekly PDF-poster workflow and duplicates browser A4 layout/print capabilities unnecessarily.
