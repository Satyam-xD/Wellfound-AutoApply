/**
 * runner/auth.js
 * Checks whether the browser is logged in to Wellfound.
 * If not, auto-fills credentials and waits up to 2 minutes for the user
 * to complete any CAPTCHA / Google OAuth step.
 */
'use strict';

/**
 * ensureLoggedIn — navigates to the first search URL, checks login state,
 * auto-fills credentials if needed, and waits for login to complete.
 *
 * @param {import('playwright').Page} page
 * @param {object} site    Site config from SITES map (has .searches, .loginUrl)
 * @param {object} creds   { email, password } from config.js
 * @param {Function} log   Logging function
 * @returns {Promise<boolean>} true if logged in
 */
async function ensureLoggedIn(page, site, creds, log) {
  log('Checking Wellfound login status...');

  await page.goto(site.searches[0], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) =>
    log(`⚠ Navigation to job feed failed: ${e.message.split('\n')[0]}`)
  );
  await page.waitForTimeout(5000);

  const loggedIn = await _isLoggedIn(page);
  if (loggedIn) { log('✅ Already logged in — proceeding.'); return true; }

  // ── Auto-fill credentials ────────────────────────────────────
  const { email, password } = creds;
  if (!email || !password) {
    log('⚠ No credentials in .env — please log in manually in the Chrome window (2 min).');
  } else {
    log(`🔑 Auto-logging in as ${email}...`);
    await page.goto('https://wellfound.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) =>
      log(`⚠ Navigation to login page failed: ${e.message.split('\n')[0]}`)
    );
    await page.waitForTimeout(3000);
    await _autoFill(page, email, password, log);
  }

  // ── Wait up to 2 minutes for login confirmation ──────────────
  log('⏳ Waiting for login to complete (up to 2 min, handles Google OAuth / CAPTCHA)...');
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    const url  = page.url();
    const done = await _isLoggedIn(page);
    if (done || /wellfound\.com\/(jobs|home|discover)/i.test(url)) {
      log('✅ Login confirmed! Navigating to job feed...');
      await page.goto(site.searches[0], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) =>
        log(`⚠ Post-login navigation failed: ${e.message.split('\n')[0]}`)
      );
      await page.waitForTimeout(3000);
      return true;
    }
  }

  log('⚠ Login timed out — proceeding anyway (applications may fail).');
  await page.goto(site.searches[0], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) =>
    log(`⚠ Final navigation to job feed failed: ${e.message.split('\n')[0]}`)
  );
  return false;
}

// ── Helpers ──────────────────────────────────────────────────

async function _isLoggedIn(page) {
  return page.evaluate(() => {
    // Positive signals — elements that only appear when you ARE logged in
    const hasProfileMenu = !!(
      document.querySelector('[data-test*="user-menu" i], [class*="userAvatar" i], [class*="profileMenu" i], [aria-label*="profile" i], [aria-label*="account" i]') ||
      document.querySelector('a[href*="/u/"], a[href*="/profile"], a[href*="/dashboard"]')
    );
    if (hasProfileMenu) return true;

    // Negative signals — elements that only appear on the logged-OUT page.
    // NOTE: Wellfound always has a "Join" / "Sign up" link in the nav for EMPLOYERS,
    // so we only use /login and /sign_in as hard "not logged in" signals.
    const hasLoginLink = !!document.querySelector('a[href*="/login"], a[href*="sign_in"]');
    const hasAuthButtons = [...document.querySelectorAll('a, button')].some((el) => {
      const t = el.textContent?.trim() || '';
      return /^log\s*in$/i.test(t);
    });
    return !hasLoginLink && !hasAuthButtons;
  }).catch(() => false);
}

async function _autoFill(page, email, password, log) {
  try {
    const emailSel = 'input[type="email"], input[name="email"], input[placeholder*="email" i]';
    await page.waitForSelector(emailSel, { timeout: 8000 });
    await page.click(emailSel);
    await page.fill(emailSel, email);
    log(`  ✍ Email filled: ${email}`);
    await page.waitForTimeout(500);

    // Some Wellfound login flows show password after "Continue"
    const passSel = 'input[type="password"]';
    let passField = await page.$(passSel);
    if (!passField) {
      const nextBtn = await page.$(
        'button[type="submit"], button:has-text("Continue"), button:has-text("Next")'
      );
      if (nextBtn) { await nextBtn.click(); await page.waitForTimeout(2000); }
      try { await page.waitForSelector(passSel, { timeout: 8000 }); } catch (_) { /* password field may already be visible */ }
      passField = await page.$(passSel);
    }
    if (passField) {
      await page.click(passSel);
      await page.fill(passSel, password);
      log('  ✍ Password filled');
      await page.waitForTimeout(600);
    }

    // Click the submit button
    const submitBtn =
      await page.$('button[type="submit"], [name="commit"]') ||
      await page.evaluateHandle(() =>
        [...document.querySelectorAll('button')]
          .find((b) => /log in|sign in/i.test(b.textContent))
      );
    if (submitBtn && (await submitBtn.asElement())) {
      await submitBtn.click();
      log('  Login form submitted — waiting for redirect...');
    }
  } catch (e) {
    log(`  ⚠ Auto-fill error: ${e.message.split('\n')[0]} — complete login manually.`);
  }
}

module.exports = { ensureLoggedIn };
