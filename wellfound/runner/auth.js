/**
 * wellfound/auth.js
 * Wellfound authentication check and credential auto-fill.
 */
'use strict';

/**
 * ensureLoggedIn — verifies if Wellfound is authenticated, auto-fills credentials
 * if not, and waits for user / OAuth confirmation.
 *
 * @param {import('playwright').Page} page
 * @param {object} site   Wellfound site config
 * @param {object} creds  { email, password }
 * @param {Function} log  Site logger
 */
async function ensureLoggedIn(page, site, creds, log) {
  log('Checking Wellfound login status...');

  await page.goto(site.searches[0], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) =>
    log(`⚠ Navigation to job feed failed: ${e.message.split('\n')[0]}`)
  );
  await page.waitForTimeout(4000);

  const loggedIn = await isWellfoundLoggedIn(page);
  if (loggedIn) {
    log('✅ Already logged in to Wellfound — proceeding.');
    return true;
  }

  const { email, password } = creds;
  if (!email || !password) {
    log('⚠ No credentials in .env — please log in manually in the browser window (2 min).');
  } else {
    log(`🔑 Auto-logging in to Wellfound as ${email}...`);
    await page.goto(site.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) =>
      log(`⚠ Navigation to login page failed: ${e.message.split('\n')[0]}`)
    );
    await page.waitForTimeout(3000);
    await autoFillWellfound(page, email, password, log);
  }

  log('⏳ Waiting for Wellfound login to complete (up to 2 min, handles OTP / CAPTCHA)...');
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    const url  = page.url();
    const done = await isWellfoundLoggedIn(page);
    const urlConfirmed = /wellfound\.com\/(jobs|home|discover)/i.test(url);

    if (done || urlConfirmed) {
      log('✅ Wellfound login confirmed! Navigating to job feed...');
      await page.goto(site.searches[0], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) =>
        log(`⚠ Post-login navigation failed: ${e.message.split('\n')[0]}`)
      );
      await page.waitForTimeout(3000);
      return true;
    }
  }

  log('⚠ Wellfound login timed out — proceeding anyway (applications may fail).');
  await page.goto(site.searches[0], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) =>
    log(`⚠ Final navigation to job feed failed: ${e.message.split('\n')[0]}`)
  );
  return false;
}

async function isWellfoundLoggedIn(page) {
  return page.evaluate(() => {
    const hasProfileMenu = !!(
      document.querySelector('[data-test*="user-menu" i], [class*="userAvatar" i], [class*="profileMenu" i], [aria-label*="profile" i], [aria-label*="account" i]') ||
      document.querySelector('a[href*="/u/"], a[href*="/profile"], a[href*="/dashboard"]')
    );
    if (hasProfileMenu) return true;

    const hasLoginLink = !!document.querySelector('a[href*="/login"], a[href*="sign_in"]');
    const hasAuthButtons = [...document.querySelectorAll('a, button')].some((el) => {
      const t = el.textContent?.trim() || '';
      return /^log\s*in$/i.test(t);
    });
    return !hasLoginLink && !hasAuthButtons;
  }).catch(() => false);
}

async function autoFillWellfound(page, email, password, log) {
  try {
    const emailSel = 'input[type="email"], input[name="email"], input[placeholder*="email" i]';
    await page.waitForSelector(emailSel, { timeout: 8000 });
    await page.click(emailSel);
    await page.fill(emailSel, email);
    log(`  ✍ Email filled: ${email}`);
    await page.waitForTimeout(500);

    const passSel = 'input[type="password"]';
    let passField = await page.$(passSel);
    if (!passField) {
      const nextBtn = await page.$(
        'button[type="submit"], button:has-text("Continue"), button:has-text("Next")'
      );
      if (nextBtn) { await nextBtn.click(); await page.waitForTimeout(2000); }
      try { await page.waitForSelector(passSel, { timeout: 8000 }); } catch (_) {}
      passField = await page.$(passSel);
    }
    if (passField) {
      await page.click(passSel);
      await page.fill(passSel, password);
      log('  ✍ Password filled');
      await page.waitForTimeout(600);
    }

    const submitBtn =
      await page.$('button[type="submit"], [name="commit"], button.btn-primary') ||
      await page.evaluateHandle(() =>
        [...document.querySelectorAll('button')]
          .find((b) => /log in|sign in|login/i.test(b.textContent))
      );
    if (submitBtn && (await submitBtn.asElement())) {
      await submitBtn.click();
      log('  Login form submitted — waiting for redirect...');
    }
  } catch (e) {
    log(`  ⚠ Auto-fill error: ${e.message.split('\n')[0]} — complete login manually.`);
  }
}

module.exports = { ensureLoggedIn, isWellfoundLoggedIn };
