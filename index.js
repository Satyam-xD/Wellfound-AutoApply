#!/usr/bin/env node
/**
 * index.js — Multi-platform Job Auto-Applier Orchestrator
 * ========================================================
 *
 * Runs Wellfound and Naukri auto-appliers either simultaneously
 * (default) or individually. Automatically wraps with nodemon
 * for live file watching and reload.
 *
 * USAGE:
 *   npm start                           Runs both simultaneously with live reloading
 *   node index.js all --live            Both Wellfound + Naukri simultaneously
 *   node index.js wellfound --live      Only Wellfound
 *   node index.js naukri --live         Only Naukri
 *   node index.js all login             One-time: log in to both platforms
 *   node index.js wellfound login       One-time: log in to Wellfound only
 *   node index.js naukri login          One-time: log in to Naukri only
 */
'use strict';

const path = require('path');

// ── Auto-wrap with nodemon for live hot-reloading ─────────────
const isLoginMode = process.argv.includes('login');
const noWatch     = process.argv.includes('--no-watch');
const isChild     = process.env.NODEMON_ACTIVE === '1';

if (!isLoginMode && !noWatch && !isChild) {
  process.env.NODEMON_ACTIVE = '1';
  let nodemon;
  try {
    nodemon = require('nodemon');
  } catch (_) {
    // If nodemon is not available, proceed with plain node execution
  }

  if (nodemon) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
      args.push('all', '--live');
    }

    nodemon({
      script: path.join(__dirname, 'index.js'),
      args,
      watch:  ['index.js', '.env', 'wellfound', 'naukri'],
      ext:    'js,json,env',
      ignore: [
        '.wellfound-chrome-profile/**',
        '.naukri-chrome-profile/**',
        '.*-chrome-profile/**',
        'apply-state-*.json',
        'applications*.csv',
        '*.png',
        'node_modules/**',
      ],
    });

    nodemon
      .on('start', () => {
        console.log('[nodemon] Auto-reload watcher active.');
      })
      .on('restart', (files) => {
        const names = files ? files.map((f) => path.basename(f)).join(', ') : 'files';
        console.log(`\n[nodemon] Detected changes in (${names}) — reloading...`);
      })
      .on('quit', () => {
        process.exit(0);
      });

    return;
  }
}

// ── Platform Runners ──────────────────────────────────────────
const { runWellfound } = require('./wellfound');
const { runNaukri }    = require('./naukri');

const SITE_ARG   = (process.argv[2] || 'all').toLowerCase();
const LOGIN_MODE = process.argv.includes('login');
const LIVE       = process.argv.includes('--live');
const OFFSCREEN  = process.argv.includes('--offscreen');

const VALID_SITES = ['wellfound', 'naukri', 'all'];
if (!VALID_SITES.includes(SITE_ARG)) {
  console.error('Usage: node index.js [wellfound|naukri|all] [login|--live|--offscreen]');
  process.exit(1);
}

const ts  = () => new Date().toLocaleString('en-IN');
const log = (msg) => console.log(`[${ts()}] [main] ${msg}`);

process.on('unhandledRejection', (e) =>
  log(`unhandledRejection (ignored): ${String(e?.message || e).split('\n')[0]}`)
);
process.on('uncaughtException', (e) =>
  log(`uncaughtException (ignored): ${String(e?.message || e).split('\n')[0]}`)
);

const openContexts = new Set();

async function closeAllBrowsers() {
  for (const ctx of openContexts) {
    try { await ctx.close(); } catch (_) {}
  }
  openContexts.clear();
}

['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach((sig) => {
  process.once(sig, async () => {
    log(`${sig} received — closing all browsers cleanly...`);
    await closeAllBrowsers();
    process.exit(0);
  });
});

const runners = {
  wellfound: (opts) => runWellfound({ ...opts, openContexts }),
  naukri:    (opts) => runNaukri({ ...opts, openContexts }),
};

// ── Main Orchestrator ─────────────────────────────────────────
(async () => {
  const sitesToRun = SITE_ARG === 'all'
    ? ['wellfound', 'naukri']
    : [SITE_ARG];

  const opts = { live: LIVE, loginMode: LOGIN_MODE, offscreen: OFFSCREEN };

  if (LOGIN_MODE) {
    log(`Starting login mode for: ${sitesToRun.join(' then ')}`);
    for (const s of sitesToRun) {
      await runners[s](opts);
    }
  } else {
    if (sitesToRun.length > 1) {
      log('🚀 Launching WELLFOUND + NAUKRI simultaneously in parallel!');
    }
    await Promise.all(sitesToRun.map((s) => runners[s](opts)));
  }

  log('🏁 All requested platform runs complete.');
})().catch((err) => {
  console.error(`[FATAL] ${err.message}`);
  process.exit(1);
});
