#!/usr/bin/env node
'use strict';

/**
 * Automated Weekly Sports Fixture Fetcher for Nelly Mc's Marbella
 *
 * Fetches, normalizes (Europe/Madrid, 11:30-23:59), and embeds weekly fixtures
 * into the active `nelly_sports_vXX.YY.html` schedule builder.
 *
 * Usage:
 *   node fetch-weekly-sports.js [--from=YYYY-MM-DD] [--dry-run] [--bump] [--help]
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const ARCHIVE_DIR = path.join(ROOT_DIR, 'Archive');
const MADRID_TZ = 'Europe/Madrid';
const TIME_WINDOW_START = '11:30';
const TIME_WINDOW_END = '23:59';

const TARGET_FOOTBALL_LEAGUES = [
  { id: 39, name: 'English Premier League', isTournament: false },
  { id: 45, name: 'FA Cup', isTournament: false },
  { id: 48, name: 'EFL Carabao Cup', isTournament: false },
  { id: 2, name: 'UEFA Champions League', isTournament: false },
  { id: 3, name: 'UEFA Europa League', isTournament: false },
  { id: 848, name: 'UEFA Conference League', isTournament: false },
  { id: 179, name: 'Scottish Premiership', isTournament: false, oldFirmOnly: true },
  { id: 5, name: 'UEFA Nations League', isTournament: false },
  { id: 4, name: 'UEFA European Championship', isTournament: true },
  { id: 1, name: 'FIFA World Cup', isTournament: true }
];

const RUGBY_INCLUDE_KEYWORDS = [
  'six nations',
  'nations championship',
  'united rugby championship',
  'champions cup',
  'autumn nations',
  'international',
  'world cup',
  'test match',
  'british & irish lions',
  'british and irish lions',
  'lions'
];

function getSportRank(sportName = '') {
  const s = String(sportName).toLowerCase();
  if (s.includes('football') || s.includes('soccer')) return 1;
  if (s.includes('gaa') || s.includes('hurling') || s.includes('gaelic')) return 2;
  if (s.includes('rugby')) return 3;
  if (s.includes('golf')) return 4;
  if (s.includes('darts')) return 5;
  if (s.includes('formula') || s === 'f1') return 6;
  return 999;
}

// ---------------------------------------------------------------------------
// CLI & Environment Helpers
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    bump: false,
    from: null,
    help: false
  };

  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--bump') opts.bump = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--from=')) opts.from = arg.slice('--from='.length).trim();
  }
  return opts;
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

function printHelp() {
  console.log(`
Nelly Mc's Marbella - Weekly Sports Fetcher

Usage:
  node fetch-weekly-sports.js [options]

Options:
  --from=YYYY-MM-DD   Monday start date of the 7-day window (default: current/upcoming Monday in Madrid)
  --dry-run           Fetch & filter live fixtures without modifying HTML or Archive files
  --bump              Archive current HTML to Archive/ and increment filename/app version (v01.04 -> v01.05)
  --help, -h          Show this help message
`.trim());
}

// ---------------------------------------------------------------------------
// Date & Timezone Helpers (Europe/Madrid)
// ---------------------------------------------------------------------------

function toMadridDateTime(dateInput) {
  const dt = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(dt.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADRID_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = {};
  for (const p of formatter.formatToParts(dt)) {
    parts[p.type] = p.value;
  }

  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time_cet: `${hour}:${parts.minute}`
  };
}

function getMadridOffsetString(dateStr) {
  // Determine CET (+01:00) vs CEST (+02:00) for a given YYYY-MM-DD at noon UTC
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const tzPart = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADRID_TZ,
    timeZoneName: 'shortOffset'
  })
    .formatToParts(probe)
    .find(p => p.type === 'timeZoneName');

  const raw = tzPart ? tzPart.value : 'GMT+1';
  const match = raw.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return '+01:00';
  const sign = match[1];
  const hh = String(match[2]).padStart(2, '0');
  const mm = String(match[3] || '00').padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

function addDaysISO(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function getDefaultWeekStartMonday() {
  const madridNow = toMadridDateTime(new Date());
  const [y, m, d] = madridNow.date.split('-').map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun, 1=Mon
  if (utcDay === 1) return madridNow.date;
  const daysUntilMonday = utcDay === 0 ? 1 : 8 - utcDay;
  return addDaysISO(madridNow.date, daysUntilMonday);
}

function isValidISODate(val) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function isWithinWeekAndWindow(dateStr, timeStr, fromDate, toDate) {
  if (!dateStr || !timeStr) return false;
  return (
    dateStr >= fromDate &&
    dateStr <= toDate &&
    timeStr >= TIME_WINDOW_START &&
    timeStr <= TIME_WINDOW_END
  );
}

function formatWeekHeading(fromDate) {
  const [y, m, d] = fromDate.split('-').map(Number);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const suffix =
    d >= 11 && d <= 13
      ? 'th'
      : d % 10 === 1
        ? 'st'
        : d % 10 === 2
          ? 'nd'
          : d % 10 === 3
            ? 'rd'
            : 'th';
  return `Sports coverage - Week Starting ${d}${suffix} ${months[m - 1]}`;
}

function formatFullDateRangeComment(fromDate, toDate) {
  const fmt = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };
  return `${fmt(fromDate)} – ${fmt(toDate)}`;
}

// ---------------------------------------------------------------------------
// HTTP Helpers
// ---------------------------------------------------------------------------

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function isRealApiKey(key) {
  return Boolean(key && !key.startsWith('your_'));
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// 1. API-Sports Fetchers (Football v3 & Rugby v1)
// ---------------------------------------------------------------------------

function normalizeApiSportsStatus(shortCode) {
  const s = String(shortCode || '').toUpperCase();
  if (['FT', 'AET', 'PEN'].includes(s)) return 'finished';
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(s)) return 'live';
  if (['PST', 'CANC', 'ABD', 'SUSP', 'INT'].includes(s)) return s.toLowerCase();
  return 'not_started';
}

function isOldFirmMatch(home, away) {
  const h = (home || '').toLowerCase();
  const a = (away || '').toLowerCase();
  return (h.includes('celtic') && a.includes('rangers')) || (h.includes('rangers') && a.includes('celtic'));
}

async function fetchApiFootball(fromDate, toDate, apiKey) {
  const events = [];
  const warnings = [];
  const [year, month] = fromDate.split('-').map(Number);
  const clubSeason = month >= 7 ? year : year - 1;
  const headers = { 'x-apisports-key': apiKey };

  let planLimited = false;

  for (const league of TARGET_FOOTBALL_LEAGUES) {
    const season = league.isTournament ? year : clubSeason;
    const url = `https://v3.football.api-sports.io/fixtures?league=${league.id}&season=${season}&from=${fromDate}&to=${toDate}&timezone=${encodeURIComponent(MADRID_TZ)}`;

    try {
      const data = await fetchJson(url, headers);
      if (data.errors && Object.keys(data.errors).length > 0) {
        if (data.errors.plan) {
          planLimited = true;
        } else {
          warnings.push(`API-Football (${league.name}): ${JSON.stringify(data.errors)}`);
        }
        continue;
      }

      for (const item of data.response || []) {
        const home = item.teams?.home?.name || '';
        const away = item.teams?.away?.name || '';
        if (league.oldFirmOnly && !isOldFirmMatch(home, away)) continue;

        const madrid = toMadridDateTime(item.fixture?.date);
        if (!madrid || !isWithinWeekAndWindow(madrid.date, madrid.time_cet, fromDate, toDate)) {
          continue;
        }

        const venueParts = [item.fixture?.venue?.name, item.fixture?.venue?.city].filter(Boolean);
        events.push({
          sport: 'Football',
          competition: league.name,
          stage: item.league?.round || '',
          home_team: home,
          away_team: away,
          venue: venueParts.join(', ') || 'TBC',
          date: madrid.date,
          time_cet: madrid.time_cet,
          status: normalizeApiSportsStatus(item.fixture?.status?.short)
        });
      }
    } catch (err) {
      warnings.push(`API-Football (${league.name}) failed: ${err.message}`);
    }
  }

  if (planLimited) {
    warnings.push('API-Football Free plan covers rolling 3-day window; remaining week dates covered by ESPN.');
  }

  return { events, warnings };
}

function mapRugbyLeagueName(leagueName = '') {
  const low = leagueName.toLowerCase();
  if (low.includes('six nations')) return 'Six Nations';
  if (low.includes('nations championship')) return 'Nations Championship';
  if (low.includes('united rugby championship') || low === 'urc') return 'United Rugby Championship';
  if (low.includes('champions cup')) return 'European Rugby Champions Cup';
  if (low.includes('autumn nations')) return 'Autumn Nations Series';
  if (low.includes('lions')) return 'British & Irish Lions';
  if (low.includes('international') || low.includes('world cup') || low.includes('test')) {
    return 'Rugby Union Internationals';
  }
  return leagueName;
}

async function fetchApiRugby(fromDate, toDate, apiKey) {
  const events = [];
  const warnings = [];
  const headers = { 'x-apisports-key': apiKey };
  let planLimitedDays = 0;

  for (let i = 0; i < 7; i++) {
    const day = addDaysISO(fromDate, i);
    const url = `https://v1.rugby.api-sports.io/games?date=${day}&timezone=${encodeURIComponent(MADRID_TZ)}`;

    try {
      const data = await fetchJson(url, headers);
      if (data.errors && Object.keys(data.errors).length > 0) {
        if (data.errors.plan) {
          planLimitedDays++;
        } else {
          warnings.push(`API-Rugby (${day}): ${JSON.stringify(data.errors)}`);
        }
        continue;
      }

      for (const item of data.response || []) {
        const rawLeague = item.league?.name || '';
        const lowLeague = rawLeague.toLowerCase();
        if (!RUGBY_INCLUDE_KEYWORDS.some(k => lowLeague.includes(k))) continue;

        const madrid = toMadridDateTime(item.date);
        if (!madrid || !isWithinWeekAndWindow(madrid.date, madrid.time_cet, fromDate, toDate)) {
          continue;
        }

        events.push({
          sport: 'Rugby Union',
          competition: mapRugbyLeagueName(rawLeague),
          stage: item.week || 'Matchday',
          home_team: item.teams?.home?.name || '',
          away_team: item.teams?.away?.name || '',
          venue: item.country?.name || 'TBC',
          date: madrid.date,
          time_cet: madrid.time_cet,
          status: normalizeApiSportsStatus(item.status?.short)
        });
      }
    } catch (err) {
      warnings.push(`API-Rugby (${day}) failed: ${err.message}`);
    }
  }

  if (planLimitedDays > 0) {
    warnings.push(`API-Rugby Free plan skipped ${planLimitedDays} out-of-window day(s); full week covered by ESPN.`);
  }

  return { events, warnings };
}

// ---------------------------------------------------------------------------
// 2. Jolpica F1 Fetcher (Ergast-compatible, no API key required)
// ---------------------------------------------------------------------------

async function fetchJolpicaF1(fromDate, toDate, userAgent) {
  const events = [];
  const warnings = [];
  const startYear = Number(fromDate.slice(0, 4));
  const endYear = Number(toDate.slice(0, 4));
  const years = startYear === endYear ? [startYear] : [startYear, endYear];

  for (const year of years) {
    const url = `https://api.jolpi.ca/ergast/f1/${year}.json`;
    try {
      const data = await fetchJson(url, { 'User-Agent': userAgent });
      const races = data?.MRData?.RaceTable?.Races || [];

      for (const race of races) {
        const circuit = race.Circuit || {};
        const loc = circuit.Location || {};
        const venue = [circuit.circuitName, loc.country || loc.locality].filter(Boolean).join(', ') || 'TBC';

        const sessions = [];
        if (race.Sprint?.date && race.Sprint?.time) {
          sessions.push({ stage: 'Sprint', date: race.Sprint.date, time: race.Sprint.time });
        }
        if (race.Qualifying?.date && race.Qualifying?.time) {
          sessions.push({ stage: 'Qualifying', date: race.Qualifying.date, time: race.Qualifying.time });
        }
        if (race.date && race.time) {
          sessions.push({ stage: 'Race', date: race.date, time: race.time });
        }

        for (const s of sessions) {
          const isoUtc = s.time.endsWith('Z') ? `${s.date}T${s.time}` : `${s.date}T${s.time}Z`;
          const madrid = toMadridDateTime(isoUtc);
          if (!madrid || !isWithinWeekAndWindow(madrid.date, madrid.time_cet, fromDate, toDate)) {
            continue;
          }

          events.push({
            sport: 'Formula One',
            competition: race.raceName || 'Formula 1 Grand Prix',
            stage: s.stage,
            venue,
            date: madrid.date,
            time_cet: madrid.time_cet,
            status: 'not_started'
          });
        }
      }
    } catch (err) {
      warnings.push(`Jolpica F1 (${year}) failed: ${err.message}`);
    }
  }

  return { events, warnings };
}

// ---------------------------------------------------------------------------
// 3. ESPN Public JSON Scoreboards (Golf + Optional Football/Rugby Fallback)
// ---------------------------------------------------------------------------

async function fetchEspnScoreboard(sportPath, leagueSlug, dateParam = '') {
  const qs = dateParam ? `?dates=${dateParam}` : '';
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/${leagueSlug}/scoreboard${qs}`;
  return fetchJson(url, { Accept: 'application/json' });
}

async function fetchEspnGolf(fromDate, toDate) {
  const events = [];
  const warnings = [];
  const rangeParam = `${fromDate.replace(/-/g, '')}-${toDate.replace(/-/g, '')}`;
  const tours = [
    { slug: 'pga', label: 'PGA Tour' },
    { slug: 'eur', label: 'DP World Tour' }
  ];

  for (const tour of tours) {
    try {
      const data = await fetchEspnScoreboard('golf', tour.slug, rangeParam);
      for (const ev of data.events || []) {
        const comp = ev.competitions?.[0] || {};
        const startMadrid = toMadridDateTime(ev.date || comp.date);
        const endMadrid = ev.endDate ? toMadridDateTime(ev.endDate) : startMadrid;
        if (!startMadrid) continue;

        const overlaps =
          (startMadrid.date <= toDate && (endMadrid?.date || startMadrid.date) >= fromDate);
        if (!overlaps) continue;

        if (!isWithinWeekAndWindow(startMadrid.date, startMadrid.time_cet, fromDate, toDate)) {
          continue;
        }

        const venueObj = comp.venue || ev.venue || {};
        const venue = [venueObj.fullName, venueObj.address?.city, venueObj.address?.country]
          .filter(Boolean)
          .join(', ') || 'TBC';

        events.push({
          sport: 'Golf',
          competition: `${tour.label} — ${ev.name || ev.shortName || 'Tournament'}`,
          stage: comp.status?.type?.shortDetail || 'Tournament Play',
          venue,
          date: startMadrid.date,
          time_cet: startMadrid.time_cet,
          status: 'not_started'
        });
      }
    } catch (err) {
      warnings.push(`ESPN Golf (${tour.slug}) failed: ${err.message}`);
    }
  }

  return { events, warnings };
}

async function fetchEspnTeamSports(fromDate) {
  const events = [];
  const warnings = [];
  const leagues = [
    { sportPath: 'soccer', leagueSlug: 'eng.1', sport: 'Football', competition: 'English Premier League' },
    { sportPath: 'soccer', leagueSlug: 'eng.fa', sport: 'Football', competition: 'FA Cup' },
    { sportPath: 'soccer', leagueSlug: 'eng.league_cup', sport: 'Football', competition: 'EFL Carabao Cup' },
    { sportPath: 'soccer', leagueSlug: 'uefa.champions', sport: 'Football', competition: 'UEFA Champions League' },
    { sportPath: 'soccer', leagueSlug: 'uefa.europa', sport: 'Football', competition: 'UEFA Europa League' },
    { sportPath: 'soccer', leagueSlug: 'uefa.europa.conf', sport: 'Football', competition: 'UEFA Conference League' },
    { sportPath: 'soccer', leagueSlug: 'sco.1', sport: 'Football', competition: 'Scottish Premiership', oldFirmOnly: true },
    { sportPath: 'soccer', leagueSlug: 'uefa.nations', sport: 'Football', competition: 'UEFA Nations League' },
    { sportPath: 'soccer', leagueSlug: 'fifa.world', sport: 'Football', competition: 'FIFA World Cup' },
    { sportPath: 'soccer', leagueSlug: 'uefa.euro', sport: 'Football', competition: 'UEFA European Championship' },
    { sportPath: 'rugby', leagueSlug: '289234', sport: 'Rugby Union', competition: 'Rugby Union Internationals' },
    { sportPath: 'rugby', leagueSlug: '17567', sport: 'Rugby Union', competition: 'Nations Championship' },
    { sportPath: 'rugby', leagueSlug: '180659', sport: 'Rugby Union', competition: 'Six Nations' },
    { sportPath: 'rugby', leagueSlug: '270557', sport: 'Rugby Union', competition: 'United Rugby Championship' },
    { sportPath: 'rugby', leagueSlug: '271937', sport: 'Rugby Union', competition: 'European Rugby Champions Cup' },
    { sportPath: 'rugby', leagueSlug: '164205', sport: 'Rugby Union', competition: 'Rugby World Cup' }
  ];

  const queries = [];
  for (let i = 0; i < 7; i++) {
    const dayStr = addDaysISO(fromDate, i);
    const dateParam = dayStr.replace(/-/g, '');
    for (const lg of leagues) {
      queries.push({ ...lg, dateParam });
    }
  }

  const toDate = addDaysISO(fromDate, 6);
  const failedSlugs = new Set();

  await mapWithConcurrency(queries, 10, async feed => {
    try {
      const data = await fetchEspnScoreboard(feed.sportPath, feed.leagueSlug, feed.dateParam);
      for (const ev of data.events || []) {
        const madrid = toMadridDateTime(ev.date);
        if (!madrid || !isWithinWeekAndWindow(madrid.date, madrid.time_cet, fromDate, toDate)) {
          continue;
        }
        const comp = ev.competitions?.[0] || {};
        const competitors = comp.competitors || [];
        const home = competitors.find(c => c.homeAway === 'home')?.team?.displayName || '';
        const away = competitors.find(c => c.homeAway === 'away')?.team?.displayName || '';
        if (!home || !away) continue;
        if (feed.oldFirmOnly && !isOldFirmMatch(home, away)) continue;

        const venueObj = comp.venue || {};
        const venue = [venueObj.fullName, venueObj.address?.city].filter(Boolean).join(', ') || 'TBC';

        events.push({
          sport: feed.sport,
          competition: feed.competition,
          stage: comp.notes?.[0]?.headline || ev.season?.slug || 'Fixture',
          home_team: home,
          away_team: away,
          venue,
          date: madrid.date,
          time_cet: madrid.time_cet,
          status: normalizeApiSportsStatus(comp.status?.type?.shortDetail) === 'finished' || comp.status?.type?.completed
            ? 'finished'
            : 'not_started'
        });
      }
    } catch (err) {
      const tag = `${feed.sportPath}/${feed.leagueSlug}`;
      if (!failedSlugs.has(tag)) {
        failedSlugs.add(tag);
        warnings.push(`ESPN (${tag}) failed: ${err.message}`);
      }
    }
  });

  return { events, warnings };
}

// ---------------------------------------------------------------------------
// 4. GAA Official eCal Widget & .ics / iCal Feed Parser
// ---------------------------------------------------------------------------

function parseIcsTimestampToMadrid(rawVal, tzid = '') {
  const cleaned = rawVal.trim();
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss, z] = match;
  if (z === 'Z') {
    return toMadridDateTime(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
  }
  const lowTz = (tzid || '').toLowerCase();
  if (lowTz.includes('dublin') || lowTz.includes('london')) {
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)));
    const londonProbe = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      timeZoneName: 'shortOffset'
    }).formatToParts(dt).find(p => p.type === 'timeZoneName')?.value || 'GMT';
    const isBst = londonProbe.includes('+1');
    const utcDt = new Date(dt.getTime() - (isBst ? 3600000 : 0));
    return toMadridDateTime(utcDt);
  }
  return {
    date: `${y}-${m}-${d}`,
    time_cet: `${hh}:${mm}`
  };
}

async function discoverEcalIcsUrl(widgetUrl) {
  if (!widgetUrl) return null;
  const parsed = new URL(widgetUrl);
  const widgetId = parsed.searchParams.get('widgetId');
  const apiKey = parsed.searchParams.get('apiKey');
  if (!widgetId || !apiKey) return null;

  const calUrl = `https://api-cdn.ecal.com/apiv3/widget/button/${widgetId}/calendars?apiKey=${apiKey}`;
  const calData = await fetchJson(calUrl, { apikey: apiKey });
  const calendarIds = (calData.calendars || []).map(c => c.id).filter(Boolean);
  if (calendarIds.length === 0) return null;

  const subRes = await fetch(`https://api-cdn.ecal.com/apiv3/subscriber?apiKey=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({
      subscriptionWidgetId: widgetId,
      application: 'apple',
      email: 'sports@nellymcs.com',
      country: 'IE',
      calendarIds
    })
  });
  if (!subRes.ok) {
    throw new Error(`eCal subscriber HTTP ${subRes.status}`);
  }
  const subJson = await subRes.json();
  return subJson?.calendarURL?.httpsCalUrl || null;
}

async function fetchGaaEcalAndIcs(fromDate, toDate, icsUrlsRaw, widgetUrl, userAgent) {
  const events = [];
  const warnings = [];
  const urls = (icsUrlsRaw || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (widgetUrl && urls.length === 0) {
    try {
      const discovered = await discoverEcalIcsUrl(widgetUrl);
      if (discovered) urls.push(discovered);
    } catch (err) {
      warnings.push(`GAA eCal discovery failed: ${err.message}`);
    }
  } else if (widgetUrl) {
    try {
      const parsed = new URL(widgetUrl);
      const widgetId = parsed.searchParams.get('widgetId');
      const apiKey = parsed.searchParams.get('apiKey');
      if (widgetId && apiKey) {
        await fetchJson(`https://api-cdn.ecal.com/apiv3/widget/button/${widgetId}/calendars?apiKey=${apiKey}`, { apikey: apiKey });
      }
    } catch (err) {
      warnings.push(`GAA eCal widget check failed: ${err.message}`);
    }
  }

  for (const url of urls) {
    try {
      let text = await fetchText(url, { 'User-Agent': userAgent });
      if (text.includes('X-Built-On-Cache-Miss:true') && !text.includes('BEGIN:VEVENT')) {
        await new Promise(res => setTimeout(res, 1500));
        text = await fetchText(url, { 'User-Agent': userAgent });
      }
      const unfolded = text.replace(/\r?\n[ \t]/g, '');
      const blocks = unfolded.split('BEGIN:VEVENT').slice(1);

      for (const block of blocks) {
        const body = block.split('END:VEVENT')[0] || '';
        const getField = name => {
          const re = new RegExp(`^${name}(?:;([^:]*))?:(.*)$`, 'mi');
          const m = body.match(re);
          return m ? { params: m[1] || '', val: m[2].trim() } : { params: '', val: '' };
        };

        const summary = getField('SUMMARY').val.replace(/\\,/g, ',');
        const dtField = getField('DTSTART');
        const tzMatch = dtField.params.match(/TZID=([^;]+)/i);
        const location = getField('LOCATION').val.replace(/\\,/g, ',');
        const madrid = parseIcsTimestampToMadrid(dtField.val, tzMatch ? tzMatch[1] : '');
        if (!madrid || !isWithinWeekAndWindow(madrid.date, madrid.time_cet, fromDate, toDate)) {
          continue;
        }

        const vsParts = summary.split(/\s+(?:v|vs\.?)\s+/i);
        events.push({
          sport: 'GAA',
          competition: 'GAA Senior Championship / Club',
          stage: 'Fixture',
          home_team: vsParts.length === 2 ? vsParts[0].trim() : summary,
          away_team: vsParts.length === 2 ? vsParts[1].trim() : '',
          venue: location || 'TBC',
          date: madrid.date,
          time_cet: madrid.time_cet,
          status: 'not_started'
        });
      }
    } catch (err) {
      warnings.push(`GAA .ics (${url}) failed: ${err.message}`);
    }
  }

  return { events, warnings };
}

// ---------------------------------------------------------------------------
// 5. TheSportsDB Darts (v1 JSON API)
// ---------------------------------------------------------------------------

async function fetchTheSportsDbDarts(fromDate, toDate, apiKey = '123') {
  const events = [];
  const warnings = [];
  const key = (apiKey || '123').trim();

  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDaysISO(fromDate, i));
  }

  await mapWithConcurrency(days, 4, async day => {
    const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}/eventsday.php?d=${day}&s=Darts`;
    try {
      const data = await fetchJson(url);
      for (const item of data?.events || []) {
        if (String(item.strPostponed || '').toLowerCase() === 'yes') continue;

        let rawTs = item.strTimestamp || (item.dateEvent && item.strTime ? `${item.dateEvent}T${item.strTime}` : '');
        if (rawTs && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(rawTs)) {
          rawTs += 'Z';
        }
        const madrid = rawTs ? toMadridDateTime(rawTs) : null;
        if (!madrid || !isWithinWeekAndWindow(madrid.date, madrid.time_cet, fromDate, toDate)) {
          continue;
        }

        const compName = item.strLeague || 'PDC Darts';
        const title = item.strEvent || compName;
        const vsParts = title.split(/\s+(?:v|vs\.?)\s+/i);
        const home = item.strHomeTeam || (vsParts.length === 2 ? vsParts[0].trim() : title);
        const away = item.strAwayTeam || (vsParts.length === 2 ? vsParts[1].trim() : '');
        const venue = [item.strVenue, item.strCity, item.strCountry].filter(Boolean).join(', ') || 'TBC';

        events.push({
          sport: 'Darts',
          competition: compName,
          stage: item.intRound ? `Round ${item.intRound}` : 'Match',
          home_team: home,
          away_team: away,
          venue,
          date: madrid.date,
          time_cet: madrid.time_cet,
          status: normalizeApiSportsStatus(item.strStatus)
        });
      }
    } catch (err) {
      warnings.push(`TheSportsDB Darts (${day}) failed: ${err.message}`);
    }
  });

  return { events, warnings };
}

// ---------------------------------------------------------------------------
// Deduplication, Sorting & HTML Updating
// ---------------------------------------------------------------------------

function normalizeTeamKey(name = '') {
  return name
    .toLowerCase()
    .replace(/\b(fc|afc|cf)\b/g, '')
    .replace(/\butd\b/g, 'united')
    .replace(/[^a-z0-9]/g, '');
}

function deduplicateAndSort(events) {
  const seen = new Set();
  const unique = [];

  for (const ev of events) {
    const key = [
      ev.sport,
      ev.competition,
      ev.home_team ? normalizeTeamKey(ev.home_team) : (ev.stage || ''),
      normalizeTeamKey(ev.away_team),
      ev.date,
      ev.time_cet
    ]
      .join('|')
      .toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(ev);
  }

  unique.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const rankA = getSportRank(a.sport);
    const rankB = getSportRank(b.sport);
    if (rankA !== rankB) return rankA - rankB;
    if (a.time_cet !== b.time_cet) return a.time_cet.localeCompare(b.time_cet);
    return a.sport.localeCompare(b.sport);
  });

  return unique;
}

function findLatestHtmlFile() {
  const files = fs.readdirSync(ROOT_DIR);
  const candidates = files
    .map(name => {
      const m = name.match(/^nelly_sports_v(\d+)\.(\d+)\.html$/);
      if (!m) return null;
      return {
        name,
        major: Number(m[1]),
        minor: Number(m[2]),
        versionTag: `v${m[1]}.${m[2]}`
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.major !== b.major ? b.major - a.major : b.minor - a.minor));

  if (candidates.length === 0) {
    throw new Error(`No nelly_sports_vXX.YY.html file found in ${ROOT_DIR}`);
  }
  return candidates[0];
}

function incrementVersionTag(major, minor) {
  return {
    major,
    minor: minor + 1,
    versionTag: `v${String(major).padStart(2, '0')}.${String(minor + 1).padStart(2, '0')}`,
    semver: `${major}.0.${minor + 1}`
  };
}

function indentMultilineJson(obj, indentSpaces) {
  const pad = ' '.repeat(indentSpaces);
  return JSON.stringify(obj, null, 2)
    .split('\n')
    .map((line, idx) => (idx === 0 ? line : `${pad}${line}`))
    .join('\n');
}

function updateHtmlFile({ targetInfo, bump, fromDate, toDate, scheduleData }) {
  const srcPath = path.join(ROOT_DIR, targetInfo.name);
  let html = fs.readFileSync(srcPath, 'utf8');

  let activeVersionTag = targetInfo.versionTag;
  let destFilename = targetInfo.name;

  if (bump) {
    const nextVer = incrementVersionTag(targetInfo.major, targetInfo.minor);
    activeVersionTag = nextVer.versionTag;
    destFilename = `nelly_sports_${activeVersionTag}.html`;

    if (!fs.existsSync(ARCHIVE_DIR)) {
      fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }
    const archivedPath = path.join(ARCHIVE_DIR, targetInfo.name);
    fs.renameSync(srcPath, archivedPath);

    // Sync package.json version when bumping
    const pkgPath = path.join(ROOT_DIR, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.version = nextVer.semver;
      fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    }

    html = html
      .replace(
        /<title>Nelly Mc's Marbella - Sports Coverage(?:\s*\(v\d+\.\d+\))?<\/title>/,
        `<title>Nelly Mc's Marbella - Sports Coverage (${activeVersionTag})</title>`
      )
      .replace(
        /(id="(?:toolbarVersionBadge|helpModalVersionBadge)">)v\d+\.\d+(<\/span>)/g,
        `$1${activeVersionTag}$2`
      )
      .replace(
        /(id="footerVersionLabel">)v\d+\.\d+(<\/span>)/,
        `$1${activeVersionTag}$2`
      )
      .replace(
        /const APP_VERSION = 'v\d+\.\d+';/,
        `const APP_VERSION = '${activeVersionTag}';`
      );
  }

  // Update WEEK_START_DATE, #newDate default, and poster .week-banner
  const [y, m, d] = fromDate.split('-').map(Number);
  const bannerTitle = formatWeekHeading(fromDate);

  html = html
    .replace(
      /(?:const|let) WEEK_START_DATE = new Date\([^)]*\);[^\r\n]*/,
      `let WEEK_START_DATE = new Date(${y}, ${m - 1}, ${d}); // ${fromDate}`
    )
    .replace(
      /(<input type="date" id="toolbarWeekDate"[^>]*value=")[^"]*(")/,
      `$1${fromDate}$2`
    )
    .replace(
      /(<input type="date" id="newDate" value=")[^"]*(")/,
      `$1${fromDate}$2`
    )
    .replace(
      /(<h1 class="week-banner">)([^<$]*)(<\/h1>)/,
      `$1${bannerTitle}$3`
    )
    .replace(
      /(\* Weekly schedule JSON data for )[^\r\n]*/,
      `$1${formatFullDateRangeComment(fromDate, toDate)}`
    );

  // Replace SCHEDULE_DATA block safely using marker boundaries
  const startMarker = '    const SCHEDULE_DATA = ';
  const startIdx = html.indexOf(startMarker);
  const candidateEnds = [
    '\n    function mapRawEventToPosterItem',
    '\n    let INITIAL_EVENTS',
    '\n    const INITIAL_EVENTS'
  ]
    .map(m => html.indexOf(m, startIdx))
    .filter(idx => idx !== -1);
  const endIdx = candidateEnds.length > 0 ? Math.min(...candidateEnds) : -1;
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Could not locate SCHEDULE_DATA block inside target HTML file.');
  }

  const serializedData = indentMultilineJson(scheduleData, 4);
  html =
    html.slice(0, startIdx) +
    `${startMarker}${serializedData};\n` +
    html.slice(endIdx);

  const destPath = path.join(ROOT_DIR, destFilename);
  fs.writeFileSync(destPath, html, 'utf8');

  if (bump) {
    const indexPath = path.join(ROOT_DIR, 'index.html');
    const redirectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=${destFilename}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nelly Mc's Marbella - Weekly Sports Coverage (${activeVersionTag})</title>
  <link rel="icon" type="image/x-icon" href="assets/images/favicon.ico">
  <link rel="icon" type="image/webp" sizes="32x32" href="assets/images/favicon-32x32.webp">
  <link rel="icon" type="image/webp" sizes="16x16" href="assets/images/favicon-16x16.webp">
  <link rel="apple-touch-icon" sizes="128x128" href="assets/images/favicon-128x128.webp">
  <script>
    window.location.replace('${destFilename}');
  </script>
</head>
<body style="font-family: system-ui, sans-serif; padding: 2rem; text-align: center;">
  <p>Redirecting to <a href="${destFilename}">Nelly Mc's Marbella — Weekly Sports Coverage (${activeVersionTag})</a>...</p>
</body>
</html>
`;
    fs.writeFileSync(indexPath, redirectHtml, 'utf8');
  }

  return { destFilename, activeVersionTag };
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  loadEnvFile(path.join(ROOT_DIR, '.env'));
  loadEnvFile(path.join(ROOT_DIR, '..', '.env'));

  const fromDate = opts.from || getDefaultWeekStartMonday();
  if (!isValidISODate(fromDate)) {
    throw new Error(`Invalid --from date "${fromDate}". Expected YYYY-MM-DD.`);
  }
  const toDate = addDaysISO(fromDate, 6);

  const apiSportsKey = process.env.API_SPORTS_KEY || '';
  const theSportsDbKey = process.env.THESPORTSDB_API_KEY || '123';
  const gaaEcalWidgetUrl = process.env.GAA_ECAL_WIDGET_URL || '';
  const gaaIcsUrls = process.env.GAA_ICS_URLS || '';
  const userAgent = process.env.USER_AGENT || 'NellyMcsMarbellaSportsFetcher/1.0 (+https://nellymcs.com)';

  const htmlInfo = findLatestHtmlFile();
  console.log(`[Target] ${htmlInfo.name} (${htmlInfo.versionTag})`);
  console.log(`[Window] ${fromDate} to ${toDate} (${MADRID_TZ}, ${TIME_WINDOW_START}-${TIME_WINDOW_END})`);
  if (opts.dryRun) console.log('[Mode]   DRY RUN (no files will be modified)');

  const allEvents = [];
  const allWarnings = [];
  const inactiveNotes = [];

  if (isRealApiKey(apiSportsKey)) {
    console.log('[Fetch]  API-Sports Football & Rugby Union...');
    const [fbRes, rugbyRes] = await Promise.all([
      fetchApiFootball(fromDate, toDate, apiSportsKey),
      fetchApiRugby(fromDate, toDate, apiSportsKey)
    ]);
    allEvents.push(...fbRes.events, ...rugbyRes.events);
    allWarnings.push(...fbRes.warnings, ...rugbyRes.warnings);
  } else {
    const msg = 'API_SPORTS_KEY not set in .env; skipped API-Football & API-Rugby (using ESPN 7-day coverage).';
    console.log(`[Skip]   ${msg}`);
    inactiveNotes.push({ competition: 'API-Sports (Football & Rugby Union)', reason: msg });
  }

  console.log('[Fetch]  Jolpica F1, ESPN 7-Day Football/Rugby/Golf, GAA eCal/.ics & TheSportsDB Darts...');
  const [f1Res, golfRes, espnTeamRes, gaaRes, dartsRes] = await Promise.all([
    fetchJolpicaF1(fromDate, toDate, userAgent),
    fetchEspnGolf(fromDate, toDate),
    fetchEspnTeamSports(fromDate),
    fetchGaaEcalAndIcs(fromDate, toDate, gaaIcsUrls, gaaEcalWidgetUrl, userAgent),
    fetchTheSportsDbDarts(fromDate, toDate, theSportsDbKey)
  ]);

  allEvents.push(...f1Res.events, ...golfRes.events, ...espnTeamRes.events, ...gaaRes.events, ...dartsRes.events);
  allWarnings.push(...f1Res.warnings, ...golfRes.warnings, ...espnTeamRes.warnings, ...gaaRes.warnings, ...dartsRes.warnings);

  if (!gaaIcsUrls.trim() && !gaaEcalWidgetUrl.trim()) {
    inactiveNotes.push({
      competition: 'GAA (Senior Football & Hurling)',
      reason: 'No GAA_ICS_URLS or GAA_ECAL_WIDGET_URL configured in .env.'
    });
  } else if (gaaRes.events.length === 0) {
    inactiveNotes.push({
      competition: 'GAA (Inter-County & Club)',
      reason: 'Official GAA eCal feed active; no fixtures scheduled in this date/time window.'
    });
  }

  const events = deduplicateAndSort(allEvents);
  const madridNow = toMadridDateTime(new Date());
  const offset = getMadridOffsetString(madridNow.date);

  const scheduleData = {
    metadata: {
      date_range: { from: fromDate, to: toDate },
      timezone: `CET/CEST (${offset})`,
      time_filter: `${TIME_WINDOW_START}-${TIME_WINDOW_END}`,
      generated_at: `${madridNow.date}T${madridNow.time_cet}:00${offset}`
    },
    events,
    inactive_or_filtered_competitions: inactiveNotes
  };

  if (allWarnings.length > 0) {
    console.log('\n[Warnings]');
    for (const w of allWarnings) console.log(`  - ${w}`);
  }

  console.log(`\n[Result] Normalized ${events.length} event(s) in ${fromDate}..${toDate} (${TIME_WINDOW_START}-${TIME_WINDOW_END}):`);
  for (const ev of events) {
    const title = ev.home_team && ev.away_team ? `${ev.home_team} vs ${ev.away_team}` : `${ev.competition} — ${ev.stage}`;
    console.log(`  ${ev.date} ${ev.time_cet} | ${ev.sport.padEnd(11)} | ${ev.competition} | ${title}`);
  }

  if (opts.dryRun) {
    console.log('\n[Dry Run] Skipped HTML/Archive updates.');
    return;
  }

  const updated = updateHtmlFile({
    targetInfo: htmlInfo,
    bump: opts.bump,
    fromDate,
    toDate,
    scheduleData
  });

  console.log(`\n[Saved]  ${updated.destFilename} (${updated.activeVersionTag}) updated with ${events.length} fixture(s).`);
}

main().catch(err => {
  console.error(`[Error] ${err.message}`);
  process.exitCode = 1;
});
