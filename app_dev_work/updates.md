# 🍺 Nelly Mc's Marbella — Sports Planner Project Updates

## [v01.10] — 2026-11-21

### ✅ Completed Tasks & Enhancements:

1. **Kickoff-Time Inline with `span.teams`**:
   - Adjusted `.match-row` to `align-items: flex-start` with baseline alignment in `.fixture-info`.
   - Set `.kickoff-time` to match font-size (`1.2rem`) and line-height (`1.3`) of `span.teams`, ensuring kickoff times are horizontally and vertically inline with team names across all rows.
   - Vertically aligned `.event-checkbox` with `margin-top: 3px`.

2. **Standardized Sport Ordering**:
   - Reordered sports rendering throughout `fetch-weekly-sports.js` and `nelly_sports_v01.10.html`:
     1. **Football** (Men's Premier League, World Cup, Euros, Nations League, Europa League, Champions League, Conference League, Scottish Premiership [Celtic vs Rangers only])
     2. **GAA** (Senior Football & Hurling)
     3. **Rugby Union** (Internationals, United Rugby Championship, European Champions Cup, 6 Nations, British & Irish Lions)
     4. **Golf** (Men's PGA Tour, DP World Tour, Ryder Cup, Majors)
     5. **Darts** (PDC World Darts Championship / PDC)
     6. **Formula One** (Qualifying & Race sessions)
   - Created `getSportRank()` ranking helper ensuring consistent ordering across both backend fetchers and browser rendering.

3. **Custom Sport Support in Manual Event Drawer**:
   - Added `"Custom..."` option to the `<select id="newSport">` dropdown.
   - Dynamic field (`#customSportField` / `#newCustomSport`) appears automatically when "Custom..." is selected.
   - Added validation ensuring custom sport name is supplied before submission.
   - Automatically falls back to a clean branded SVG badge for custom sports.

4. **Updated Event Title Placeholder**:
   - Changed `#newTitle` placeholder to `"e.g. Livepool vs Arsenal"`.

5. **How-To Guide Modal & Top-Right Header Icon**:
   - Added circular SVG question mark icon (`#helpGuideBtn`) in the top-right corner of the controls bar.
   - Designed a responsive, accessible How-To Guide modal (`#helpModal`) explaining:
     - Week selection and live fixture fetching
     - Selecting, filtering, and bulk deleting fixtures
     - Adding custom fixtures and announcement text banners
     - Using Undo and keyboard shortcuts
     - Exporting to CSV (Update Website) and generating print-ready PDFs
   - Supports closing via close button, backdrop click, or `Escape` key.

6. **Interactive Undo History Stack**:
   - Implemented 30-step undo history (`pushUndoState()` and `undoLastAction()`).
   - Added dedicated `Undo` button with curved arrow SVG icon in the toolbar.
   - Wired keyboard shortcut: <kbd>Ctrl+Z</kbd> / <kbd>Cmd+Z</kbd>.
   - Restores state across event checkboxes, single row deletions, bulk deletions, manual additions, and "Reset All".

7. **Scroll-Locked Sticky Controls Header**:
   - Wrapped `.control-bar`, `#addPanel` drawer, and `#statusToast` in `.sticky-header-container`.
   - Sticky locked to `top: 0` (`z-index: 1000`) with matching cream background.
   - All tool controls, feedback banners, and active toasts remain pinned and visible while scrolling through long schedules.

8. **Automation & Version Management**:
   - Fixed version sorting in `fetch-weekly-sports.js` to target highest version (`v01.10`).
   - Updated `index.html` to serve `nelly_sports_v01.10.html` by default.
