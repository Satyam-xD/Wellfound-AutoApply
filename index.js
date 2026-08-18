#!/usr/bin/env node
/**
 * index.js — Wellfound Auto-Apply entry point
 * ============================================
 *
 * USAGE:
 *   node index.js wellfound login     One-time: open Chrome, log in manually,
 *                                     close the window. Session saved for all future runs.
 *
 *   node index.js wellfound           Dry run: fills every form field but does NOT click
 *                                     Submit. Great for testing without sending anything.
 *
 *   node index.js wellfound --live    Live mode: actually clicks Apply / Submit.
 *                                     Results logged to applications.csv.
 *
 *   node index.js wellfound --offscreen   Run the browser off-screen (won't steal focus).
 *
 * NPM SCRIPTS (from package.json):
 *   npm run wellfound           → dry run
 *   npm run wellfound:live      → live apply
 *   npm run wellfound:login     → save login session
 */
'use strict';

const { CV, CREDS, geminiKey, ollamaModel } = require('./config');
const { launchBrowser }                     = require('./runner/browser');
const { ensureLoggedIn }                    = require('./runner/auth');
const { buildScript }                       = require('./runner/script-builder');
const DailyState                            = require('./runner/daily-state');
const { logApplication }                    = require('./runner/csv-logger');
const { runSupervisor }                     = require('./runner/supervisor');
const SITES                                 = require('./runner/sites');

// ── CLI args ──────────────────────────────────────────────────
const SITE_ARG   = process.argv[2];
const LOGIN_MODE = process.argv.includes('login');
const LIVE       = process.argv.includes('--live');
const OFFSCREEN  = process.argv.includes('--offscreen');

const site = SITES[SITE_ARG];
if (!site) {
  console.error('Usage: node index.js wellfound [login|--live|--offscreen]');
  process.exit(1);
}

const ts  = ()    => new Date().toLocaleString('en-IN');
const log = (msg) => console.log(`[${ts()}] [${SITE_ARG}] ${msg}`);

// Suppress noise from Playwright's CDP session during page navigations.
// Defined AFTER ts/log so they are always available inside the handlers.
process.on('unhandledRejection', (e) =>
  log(`unhandledRejection (ignored): ${String(e?.message || e).split('\n')[0]}`)
);
process.on('uncaughtException', (e) =>
  log(`uncaughtException (ignored): ${String(e?.message || e).split('\n')[0]}`)
);

// ── Main ──────────────────────────────────────────────────────
(async () => {
  // ── Validate .env loaded correctly ────────────────────────────
  if (!CV.name || !CV.email) {
    log('⚠ .env is missing NAME or EMAIL. Copy .env.example → .env and fill it in.');
    process.exit(1);
  }
  log(`CV: ${CV.name} <${CV.email}>`);

  const dayState = new DailyState(SITE_ARG, site.dailyCap);

  if (!LOGIN_MODE && dayState.atCap) {
    log(`Daily cap of ${site.dailyCap} already reached (${dayState.count} today) — exiting.`);
    return;
  }

  log(`Mode: ${LIVE ? '🟢 LIVE — will actually apply' : '🔵 DRY RUN — fills but does not submit'}`);
  log(`Target: up to ${dayState.target} applications (${dayState.count} submitted today, cap ${site.dailyCap})`);

  // ── Launch browser ─────────────────────────────────────────────
  const ctx      = await launchBrowser(site.profile, OFFSCREEN);
  const mainPage = ctx.pages()[0] || (await ctx.newPage());

  // ── Login-only mode ────────────────────────────────────────────
  if (LOGIN_MODE) {
    await mainPage.goto(site.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    log('Chrome is open — log in to Wellfound, then CLOSE the browser window.');
    log('Session cookies are saved automatically to: ' + site.profile);
    await new Promise((res) => ctx.on('close', res));
    log('Session saved. Run: node index.js ' + SITE_ARG + (LIVE ? ' --live' : ''));
    return;
  }

  // ── Ensure we're logged in ─────────────────────────────────────
  await ensureLoggedIn(mainPage, site, CREDS, log);

  // ── Build the injected script ─────────────────────────────────
  const script = buildScript({
    CV,
    geminiKey,
    ollamaModel,
    dryRun:          !LIVE,
    maxApplications: dayState.target,
  });
  log(`Script assembled: ${(script.length / 1024).toFixed(1)} KB`);

  // ── Run ───────────────────────────────────────────────────────
  await runSupervisor({
    ctx,
    mainPage,
    site,
    script,
    target:         dayState.target,
    live:           LIVE,
    dayState,
    logApplication: (job) => logApplication(SITE_ARG, job),
    log,
  });

  log('Closing browser...');
  await ctx.close();
})().catch((e) => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
