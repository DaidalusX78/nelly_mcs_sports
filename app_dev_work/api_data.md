# Nelly Mc's Marbella — Sports API Reference & Credentials

> **Security Note:** This file lives in `app_dev_work/` (git-ignored). Do not commit raw API keys to GitHub. Active runtime secrets are stored in `.env`.

---

## 1. API-Sports (Football v3 & Rugby v1)
- **Dashboard:** https://dashboard.api-football.com/profile?access
- **Header Auth:** `x-apisports-key: 72e78121badd04c25fc9bb9a57dfc3a1`
- **Plan Limit:** Free tier (100 requests/day per sport). Note: API-Sports Free plan restricts `/fixtures` & `/games` queries to a rolling 3-day window (`today - 1` to `today + 1`); out-of-window dates are complemented automatically by ESPN Public Scoreboards.

### Endpoints
- **API-Football v3 Base:** `https://v3.football.api-sports.io/`
  - Status check: `GET /status`
  - Fixtures: `GET /fixtures?league={id}&season={YYYY}&from={YYYY-MM-DD}&to={YYYY-MM-DD}&timezone=Europe/Madrid`
  - Target League IDs:
    - `39` — English Premier League
    - `2` — UEFA Champions League
    - `3` — UEFA Europa League
    - `848` — UEFA Conference League
    - `179` — Scottish Premiership *(filtered strictly to Celtic vs Rangers)*
    - `5` — UEFA Nations League
    - `4` — UEFA European Championship
    - `1` — FIFA World Cup
- **API-Rugby v1 Base:** `https://v1.rugby.api-sports.io/`
  - Games: `GET /games?date={YYYY-MM-DD}&timezone=Europe/Madrid`
  - Filtered to: Six Nations, United Rugby Championship (URC), European Rugby Champions Cup, Autumn Nations Series, Rugby Union Internationals.

---

## 2. RapidAPI Darts (Sportbex Darts API)
- **RapidAPI Page:** https://rapidapi.com/sportbex-api-default-api/api/darts-api
- **Headers:**
  - `x-rapidapi-key: dd0fbc32e4msh978c8d41de97bddp110384jsn1661914c1d03`
  - `x-rapidapi-host: darts-api.p.rapidapi.com`
- **Endpoints (`3503` = Darts sport ID):**
  - Competitions: `GET https://darts-api.p.rapidapi.com/competitions/3503`
  - Events by competition: `GET https://darts-api.p.rapidapi.com/event/3503/{competitionId}`
  - Markets: `GET https://darts-api.p.rapidapi.com/markets/3503/{eventId}`
  - Market book: `GET https://darts-api.p.rapidapi.com/listMarketBook/3503`
- **Note:** Upstream Sportbex Darts intermittently returns HTTP `502`; the fetcher handles errors defensively without aborting other sports.

---

## 3. GAA Official Fixtures (eCal Widget & `.ics` Calendar Feeds)
- **Provided Widget URL:**
  `https://sync.ecal.com/schedules?widgetId=63580b65551c29000eeada0d&apiKey=vs8NpqYol0Fnz8wDiWDlbMoWPUiCWUTj2GNcwo6gwo635808df&`
- **eCal API v3 Discovered Endpoints:**
  - `widgetId`: `63580b65551c29000eeada0d`
  - `apiKey`: `vs8NpqYol0Fnz8wDiWDlbMoWPUiCWUTj2GNcwo6gwo635808df`
  - List all 69 County Football & Hurling calendars:
    `GET https://api-cdn.ecal.com/apiv3/widget/button/63580b65551c29000eeada0d/calendars?apiKey=vs8NpqYol0Fnz8wDiWDlbMoWPUiCWUTj2GNcwo6gwo635808df`
  - Create/fetch unified subscriber `.ics` feed:
    `POST https://api-cdn.ecal.com/apiv3/subscriber?apiKey=vs8NpqYol0Fnz8wDiWDlbMoWPUiCWUTj2GNcwo6gwo635808df`
  - Unified All-County GAA `.ics` URL (all 69 calendars):
    `https://ics.ecal.com/ecal-sub/6b007ba68bc4640002888f6d/GAA.ics`

---

## 4. Jolpica F1 (Ergast-Compatible API)
- **Auth:** None required (include custom `User-Agent` header)
- **Base URL:** `https://api.jolpi.ca/ergast/f1/`
- **Endpoints:**
  - Season races & sessions: `GET https://api.jolpi.ca/ergast/f1/{YYYY}.json`
  - Covers: Sprint, Qualifying, and Race UTC dates/times (converted to `Europe/Madrid`).

---

## 5. ESPN Public JSON Scoreboards (7-Day Multi-Sport Coverage & Fallback)
- **Auth:** None required (`Accept: application/json`)
- **Base URL:** `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`
- **Working Slugs:**
  - **Football (`soccer/...`):** `eng.1` (EPL), `uefa.champions` (UCL), `uefa.europa` (UEL), `uefa.europa.conf` (UECL), `sco.1` (Scottish Premiership, filtered to Celtic vs Rangers), `uefa.nations` (Nations League), `fifa.world` (World Cup), `uefa.euro` (Euros)
  - **Rugby Union (`rugby/...`):** `289234` (International Test Match), `180659` (Six Nations), `270557` (URC), `271937` (European Rugby Champions Cup), `164205` (Rugby World Cup)
  - **Golf (`golf/...`):** `pga` (PGA Tour), `eur` (DP World Tour)

---

## 6. Other Free Reference Options
- **TheSportsDB:** https://www.thesportsdb.com/ (free test key `3`, or Patreon key)
- **Football-Data.org:** https://www.football-data.org/ (free tier: 10 calls/min)
