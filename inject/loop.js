// ============================================================
// MAIN APPLICATION LOOP — orchestrates job discovery → apply → delay.
// This is the last file concatenated into the IIFE, so it can use
// everything defined in utils, gemini, answers, apply, and finder.
// ============================================================

// Search URLs iterated when the current page runs out of matching jobs.
// The runner also rotates these externally on idle, but in-script rotation
// handles the case where the SPA router is available.
const SEARCH_PAGES = [
  '/jobs?roleSlugs[]=software-engineer',
  '/jobs?roleSlugs[]=full-stack-developer',
  '/jobs?roleSlugs[]=frontend-developer',
  '/jobs?roleSlugs[]=backend-developer',
  '/jobs?remote=true&roleSlugs[]=software-engineer',
  '/jobs?locationSlugs[]=india&roleSlugs[]=software-engineer',
  '/jobs?locationSlugs[]=bangalore-karnataka-india&roleSlugs[]=software-engineer',
  '/jobs?locationSlugs[]=delhi-india&roleSlugs[]=software-engineer',
  '/jobs?locationSlugs[]=hyderabad-telangana-india&roleSlugs[]=software-engineer',
  '/jobs?locationSlugs[]=pune-maharashtra-india&roleSlugs[]=software-engineer',
  '/jobs?locationSlugs[]=noida-uttar-pradesh-india&roleSlugs[]=software-engineer',
  '/jobs?remote=true&locationSlugs[]=india',
];

// Start from the index BEFORE the current page so that goToNextSearchPage()
// (which always increments first) lands on the correct next URL.
// If we're already on a search page, we stay within it before moving on.
const _currentIdx = SEARCH_PAGES.findIndex((p) => location.pathname + location.search === p);
let searchIdx = _currentIdx >= 0 ? _currentIdx - 1 : -1;

/**
 * goToNextSearchPage — moves to the next search URL via the SPA router.
 * Returns true if navigation was initiated, false if all pages exhausted.
 */
async function goToNextSearchPage() {
  searchIdx++;
  if (searchIdx >= SEARCH_PAGES.length) return false;
  const url = SEARCH_PAGES[searchIdx];
  log(`🌐 Moving to next search page: ${url}`);
  if (window.next?.router?.push) {
    window.next.router.push(url);
    await sleep(6000); // let new cards render
    window.scrollTo(0, 400);
    return true;
  }
  // SPA router unavailable → full page load (script will be re-injected by runner)
  log('⚠ SPA router not available — full page load. Runner will re-inject the script.');
  location.href = 'https://wellfound.com' + url;
  return false;
}

// ── Seen-jobs set: persisted in localStorage so re-injections don't re-apply ──
const SEEN_KEY = 'wf_autoApply_seen_v3';
const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
function markSeen(href) {
  seen.add(href);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-500)));
  } catch (e) { log(`⚠ localStorage quota exceeded — seen-jobs list will not persist: ${e.message.split('\n')[0]}`); }
}

// ── Main loop ───────────────────────────────────────────────
let applied = 0;
log(`🚀 Starting. DRY_RUN=${CONFIG.DRY_RUN} | max=${CONFIG.MAX_APPLICATIONS} | ${seen.size} jobs already seen`);
log('Keep this tab focused. Do not navigate away.');
await sleep(4500); // let the feed finish rendering on initial load

while (applied < CONFIG.MAX_APPLICATIONS) {
  const allRows = findJobRows();
  const jobs    = allRows.filter((j) => !seen.has(j.href) && titleOk(j.title, j.rowText));

  if (!jobs.length) {
    // Log why jobs were filtered out (helps debug title mismatches)
    if (allRows.length) {
      log(`(filtered: ${allRows.slice(0, 4).map((j) => `"${j.title}"`).join(', ')} …)`);
    }
    log(`(page: ${allRows.length} cards total, 0 match filters)`);

    // Try a "Load more" / "Show more" button first
    const moreBtn = findButtonByText(document, /load more|show more/i);
    if (moreBtn) { moreBtn.click(); await sleep(3000); continue; }

    // Infinite scroll: keep scrolling; new cards load in batches
    let grew = false;
    for (let s = 0; s < 8 && !grew; s++) {
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(2500);
      grew = findJobRows().some((j) => !seen.has(j.href) && titleOk(j.title, j.rowText));
    }
    if (grew) continue;

    // Page exhausted → move to next search URL
    if (await goToNextSearchPage()) continue;
    log('✅ All search pages exhausted — done for this run.');
    window.__aaFinished = true;
    break;
  }

  // ── Process the first matching job ──────────────────────────
  const job = jobs[0];
  markSeen(job.href);
  // Extract experience requirement from the card text before clicking
  const expRequired = (() => {
    const m = (job.cardText || job.rowText || '').match(/\b(fresher|entry.?level|[0-9]+\s*[-–]?\s*[0-9]*\s*\+?\s*(?:years?|yrs?)(?:\s*(?:of\s*)?exp(?:erience)?)?)/i);
    return m ? m[0].replace(/\s+/g, ' ').trim() : '';
  })();
  log(`▶ Applying: ${job.title} @ ${job.company || '?'} | ${job.href} | ${job.salary || ''} | ${expRequired}`);

  // Per-job try/catch: a single bad modal or DOM error must NOT kill the whole session.
  let ok = false;
  try {
    // Scroll the card into view before clicking
    job.linkEl.scrollIntoView({ block: 'center' });
    await sleep(700);

    // Prefer the card's Apply button — opens the form directly
    const clickTarget = job.applyBtn || job.linkEl;
    if (clickTarget.target === '_blank') clickTarget.setAttribute('target', '_self');
    clickTarget.click();
    await sleep(3500); // wait for apply panel or job detail pane

    const companyName = getCompany() || job.company || '';
    ok = await fillAndSubmit(companyName, job.title);
  } catch (jobErr) {
    log(`⚠ Unexpected error on "${job.title}": ${jobErr.message} — skipping to next job`);
    // Try to dismiss any stuck modal before continuing
    try { closeModal(document.querySelector('[role="dialog"]')); } catch (e) {
      log(`⚠ Could not close stuck modal: ${e.message.split('\n')[0]}`);
    }
  }

  if (ok) {
    applied++;
    log(`progress: ${applied}/${CONFIG.MAX_APPLICATIONS}`);
  }

  // Close the overlay before trying the next card
  await sleep(1000);
  closeModal(document.querySelector('[role="dialog"]'));
  await sleep(700);

  // Kill any lingering modal backdrops so they don't block future card clicks
  document.querySelectorAll('[role="dialog"], [class*="modal" i]').forEach((m) => {
    if (visible(m) && !/apply to/i.test(m.textContent)) {
      try { m.style.display = 'none'; } catch (_) { /* cosmetic — ignore */ }
    }
  });
  await sleep(400);

  // Human-paced wait between real applications; short pause in dry-run / failed apply
  if (ok && !CONFIG.DRY_RUN) {
    await humanDelay();
  } else {
    await sleep(2500);
  }
}

if (applied >= CONFIG.MAX_APPLICATIONS || searchIdx >= SEARCH_PAGES.length) {
  window.__aaFinished = true;
}

log(
  CONFIG.DRY_RUN
    ? `🏁 DRY RUN complete — ${applied} applications simulated. Set --live to apply for real.`
    : `🏁 Finished — applied to ${applied} jobs this run.`
);
