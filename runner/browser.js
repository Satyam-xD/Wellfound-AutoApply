/**
 * runner/browser.js
 * Launches a persistent Chrome/Edge/Chromium context with stealth patches.
 */
'use strict';

const path = require('path');

// Try playwright-extra with stealth (hides automation fingerprints);
// fall back to plain playwright-core if the plugin isn't installed.
let chromium;
try {
  const { addExtra } = require('playwright-extra');
  chromium = addExtra(require('playwright-core').chromium);
  chromium.use(require('puppeteer-extra-plugin-stealth')());
  console.log('[browser] Stealth plugin loaded ✓');
} catch (_) {
  ({ chromium } = require('playwright-core'));
  console.log('[browser] Stealth not available — using plain Playwright');
}

/**
 * launchBrowser — returns an open PersistentContext.
 *
 * @param {string}  profileDir  Path to the Chrome profile directory (relative to project root or absolute).
 * @param {boolean} offscreen   Move the window off-screen so it doesn't steal focus.
 */
async function launchBrowser(profileDir, offscreen = false) {
  const fullProfile = path.isAbsolute(profileDir)
    ? profileDir
    : path.join(__dirname, '..', profileDir);

  const baseArgs = [
    // ── Stealth: hide automation signals ───────────────────────────────────────
    '--disable-blink-features=AutomationControlled', // removes navigator.webdriver=true
    '--disable-infobars',                            // hides "Chrome is being controlled" bar

    // ── Removed (these are caught by WAF / Cloudflare):
    //   --disable-web-security       (disables CORS, a strong bot signal)
    //   --allow-running-insecure-content
    //   --no-sandbox                 (not needed on Windows, signals automation)

    // ── Stability / performance ────────────────────────────────────────────────
    '--disable-dev-shm-usage',
    '--disable-popup-blocking',
    '--disable-extensions-except=',  // allow extensions (stealth plugin needs this)
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',

    ...(offscreen ? ['--window-position=-32000,-32000'] : []),
  ];

  const baseOpts = {
    headless:  false,                          // headless mode is blocked by Cloudflare
    viewport:  { width: 1280, height: 900 },
    locale:    'en-IN',
    timezoneId: 'Asia/Kolkata',
    args: baseArgs,
  };

  // Try installed Chrome → Edge → bundled Chromium in that order
  for (const channel of ['chrome', 'msedge', null]) {
    try {
      const launchOpts = channel ? { ...baseOpts, channel } : baseOpts;
      const ctx = await chromium.launchPersistentContext(fullProfile, launchOpts);
      console.log(`[browser] Launched successfully (channel=${channel || 'bundled chromium'})`);
      return ctx;
    } catch (e) {
      console.log(`[browser] channel=${channel ?? 'bundled'} failed: ${e.message.split('\n')[0]}`);
    }
  }
  throw new Error('Could not launch any browser — is Chrome or Edge installed?');
}

module.exports = { launchBrowser };
