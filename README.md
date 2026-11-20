# Nelly Mc's Marbella — Weekly Sports Coverage Generator

Interactive weekly sports schedule poster builder and automated fixture ingestion pipeline for **Nelly Mc's Marbella**.

Generates an editable A4 schedule (`11:30–23:59` `Europe/Madrid` local time, Monday–Sunday) with local competition crests, tick-to-select checkboxes, inline editing, HTML snapshot export, **Main Website CSV export** (compatible with the main site Google Sheet CMS), and auto-formatted 2-page PDF/Print output.

---

## Live Links & Versioning

- **GitHub Pages (Live Web App Entry):** Enable GitHub Pages from `main` -> `/ (root)` in your GitHub repo settings to serve `https://daidalusx78.github.io/nelly_mcs_sports/` via [index.html](index.html), which automatically redirects to the latest versioned poster.
- **Active Poster App:** `nelly_sports_v01.05.html` (`v01.05`)
- **Versioning Scheme:** `nelly_sports_vXX.YY.html` — upon each update or `--bump`, the previous version moves to `Archive/` (git-ignored) and the new version displays inside `<title>`, `#toolbarVersionBadge`, `#footerVersionLabel`, `APP_VERSION`, and `index.html`.
- **Internal Working Notes:** `Archive/` and `app_dev_work/` (credentials, prompt notes, raw API docs) are excluded via `.gitignore`.

---

## Project Structure

```text
nelly_mcs_sports/
├── index.html                        # GitHub Pages entry redirecting to latest version
├── nelly_sports_v01.05.html          # Interactive self-contained poster & PDF/CSV builder
├── fetch-weekly-sports.js            # Automated weekly fixture fetcher & updater (Node 18+)
├── register-weekly-schedule.ps1      # Registers Windows Task Scheduler (Mondays 06:00)
├── assets/images/                    # Competition & venue crests loaded locally first
├── .github/workflows/weekly-schedule.yml  # GitHub Actions weekly Monday 06:00 automation
├── package.json                      # npm scripts & project metadata
├── .env.example                      # Safe template for API keys & feed URLs
├── .gitignore                        # Excludes .env, Archive/, app_dev_work/, *.pdf
└── README.md
```

---

## Quick Start

### 1. View, Edit & Export in Browser
Open `nelly_sports_v01.05.html` locally or via GitHub Pages:
- **Tick fixtures** to include them on the printed/PDF poster (unselected fixtures stay readable on screen and are hidden when exporting/printing).
- **Edit inline** or add custom fixtures/notes in the **Add Panel**.
- **Export Website CSV** downloads `Nelly_Mcs_Website_Sports_dd_mmm_yyyy.csv` formatted with columns `Date,Sport Category,Time,Competition,Match,Logo URL` (`DD/MM/YYYY`) ready to import/paste into the main Nelly Mc's Google Sheet (`js/menu.js` & `js/sports-print.js`).
- **Export .html** saves a self-contained snapshot preserving all edits and checked states.
- **Export to .pdf** auto-formats selected events onto at most 2 A4 pages (`Nelly Mc's Weekly_Sport_dd_mmm_yyyy.pdf`).

### 2. Automated Weekly Fixture Ingestion (`fetch-weekly-sports.js`)
Requires **Node.js 18+** (uses built-in `fetch`, zero third-party npm dependencies).

1. Ensure `.env` exists (either inside this folder or `../.env`; see `.env.example`):
   ```env
   API_SPORTS_KEY=...
   RAPIDAPI_KEY=...
   RAPIDAPI_DARTS_HOST=darts-api.p.rapidapi.com
   GAA_ECAL_WIDGET_URL=...
   GAA_ICS_URLS=https://ics.ecal.com/ecal-sub/6b007ba68bc4640002888f6d/GAA.ics
   ```
2. Preview normalized fixtures without modifying files:
   ```bash
   node fetch-weekly-sports.js --dry-run
   # or target a specific Monday:
   node fetch-weekly-sports.js --from=2026-11-30 --dry-run
   ```
3. Update the active HTML file in place:
   ```bash
   node fetch-weekly-sports.js
   ```
4. Update fixtures, archive the prior HTML into `Archive/`, sync `index.html`, and bump the version (`v01.05` -> `v01.06`):
   ```bash
   node fetch-weekly-sports.js --bump
   ```

---

## Integrated Data Sources

| Sport | Sources | Auth | Notes |
| --- | --- | --- | --- |
| **Football** (EPL, UCL, UEL, UECL, Scottish Premiership [Old Firm only], World Cup, Euros, Nations League) | [API-Football v3](https://v3.football.api-sports.io/) + ESPN 7-Day Scoreboards | `x-apisports-key` (`.env`) | Merges API-Sports with ESPN `eng.1`, `uefa.champions`, `uefa.europa`, `uefa.europa.conf`, `sco.1`, `uefa.nations`, `fifa.world`, `uefa.euro` across all 7 days |
| **Rugby Union** (Internationals, Six Nations, URC, Champions Cup, World Cup) | [API-Rugby v1](https://v1.rugby.api-sports.io/) + ESPN 7-Day Scoreboards | `x-apisports-key` (`.env`) | Merges API-Sports with ESPN `289234`, `180659`, `270557`, `271937`, `164205` |
| **Formula 1** (Sprint, Qualifying, Race) | [Jolpica F1](https://api.jolpi.ca/ergast/f1/) | `User-Agent` | `/ergast/f1/{year}.json` |
| **Golf** (PGA Tour & DP World Tour) | ESPN Public JSON | `Accept: application/json` | `/golf/pga/scoreboard`, `/golf/eur/scoreboard` |
| **Darts** (PDC & Major Tournaments) | RapidAPI Sportbex (`darts-api.p.rapidapi.com`) | `x-rapidapi-key` (`.env`) | `/competitions/3503`, `/event/3503/{competitionId}` (defensive fallback on upstream errors) |
| **GAA** (Senior Football & Hurling) | Official GAA eCal API + `.ics` feed | Widget/API key (`.env`) | `sync.ecal.com` / `api-cdn.ecal.com/apiv3` + `ics.ecal.com/.../GAA.ics` |

All timestamps are converted to **`Europe/Madrid`** local time and filtered strictly to **`11:30–23:59`**.

---

## Monday 06:00 Auto-Scheduler

Three scheduling options are pre-configured for Monday **06:00** weekly runs:
1. **Antigravity Daemon Schedule:** Cron `0 6 * * 1` triggers `node fetch-weekly-sports.js --bump` automatically when Antigravity is running.
2. **Windows Task Scheduler:** Run `.\register-weekly-schedule.ps1` once to register the local `NellyMcsWeeklySportsFetch` task every Monday at `06:00`.
3. **GitHub Actions Workflow:** [.github/workflows/weekly-schedule.yml](.github/workflows/weekly-schedule.yml) runs Mondays at `05:00 UTC` (if you add `API_SPORTS_KEY`, `RAPIDAPI_KEY`, etc. to **GitHub Repo -> Settings -> Secrets -> Actions**).
