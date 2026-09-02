// ============================================================
// NAUKRI MAIN LOOP — orchestrates discovery, navigation, apply, and delays.
// ============================================================

const NAUKRI_SEEN_KEY = 'naukri_autoApply_seen_v1';
const naukriSeen = new Set(JSON.parse(localStorage.getItem(NAUKRI_SEEN_KEY) || '[]'));

function markNaukriSeen(href) {
  if (!href) return;
  naukriSeen.add(href);
  try {
    localStorage.setItem(NAUKRI_SEEN_KEY, JSON.stringify([...naukriSeen].slice(-1000)));
  } catch (_) {}
}

function returnToSearchPage() {
  const lastSearch = sessionStorage.getItem('naukri_last_search');
  if (lastSearch && location.href !== lastSearch) {
    log(`🔙 Returning to search results: ${lastSearch}`);
    location.href = lastSearch;
  } else if (window.history.length > 1) {
    log('🔙 Navigating back to search results via history...');
    window.history.back();
  }
}

// ── Check Current Page Type ─────────────────────────────────
const isJobPage = /job-listings|job-overview|\/jd\//i.test(location.href);

if (isJobPage) {
  // ──────────────────────────────────────────────────────────
  // 1. WE ARE ON A JOB DETAILS PAGE
  // ──────────────────────────────────────────────────────────
  log(`📄 Job details page loaded: ${location.href}`);
  markNaukriSeen(location.href.split('?')[0]);

  let appliedOk = false;
  try {
    appliedOk = await applyOnJobDetailsPage();
  } catch (err) {
    log(`⚠ Error applying on job page: ${err.message}`);
    closeNaukriModal();
  }

  if (appliedOk) {
    log('⏳ Application completed — taking delay before next job...');
    await humanDelay();
  } else {
    await sleep(1500);
  }

  returnToSearchPage();

} else {
  // ──────────────────────────────────────────────────────────
  // 2. WE ARE ON A SEARCH RESULTS PAGE
  // ──────────────────────────────────────────────────────────
  sessionStorage.setItem('naukri_last_search', location.href);

  log(`🚀 Naukri search feed active. DRY_RUN=${CONFIG.DRY_RUN} | max=${CONFIG.MAX_APPLICATIONS} | ${naukriSeen.size} seen`);
  await sleep(2000);

  let cards = findNaukriJobRows();
  let validJobs = cards.filter((j) => {
    const cleanHref = j.href.split('?')[0];
    return !naukriSeen.has(j.href) && !naukriSeen.has(cleanHref) && isNaukriTitleOk(j.title, j.snippet);
  });

  if (!validJobs.length) {
    log(`  (${cards.length} cards on page | 0 eligible unapplied — scrolling for more...)`);

    // Try scrolling down to lazy-load more cards
    let prevCount = cards.length;
    let gotNew = false;
    for (let s = 0; s < 4 && !gotNew; s++) {
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(1500);
      const cur = findNaukriJobRows();
      if (cur.length > prevCount) {
        const newEligible = cur.filter((j) => {
          const cleanHref = j.href.split('?')[0];
          return !naukriSeen.has(j.href) && !naukriSeen.has(cleanHref) && isNaukriTitleOk(j.title, j.snippet);
        });
        if (newEligible.length > 0) { gotNew = true; }
        prevCount = cur.length;
      }
    }

    if (gotNew) {
      cards = findNaukriJobRows();
      validJobs = cards.filter((j) => {
        const cleanHref = j.href.split('?')[0];
        return !naukriSeen.has(j.href) && !naukriSeen.has(cleanHref) && isNaukriTitleOk(j.title, j.snippet);
      });
    }

    // If still none, try clicking "Next" pagination button
    if (!validJobs.length) {
      const nextBtn = [...document.querySelectorAll('a')]
        .filter(visible)
        .find((a) => /next\s*(page)?$/i.test(a.textContent.trim()) || a.getAttribute('aria-label') === 'Next');

      if (nextBtn) {
        log('📄 Going to next pagination page...');
        nextBtn.click();
        await sleep(3000);
        return;
      }

      log('🔄 All jobs on this search feed exhausted — signalling supervisor to rotate search URL...');
      window.__aaFinished = true;
      return;
    }
  }

  // Pick the first eligible job
  const job = validJobs[0];
  markNaukriSeen(job.href);
  markNaukriSeen(job.href.split('?')[0]);

  log(`▶ Target Job: "${job.title}" @ ${job.company || 'Naukri'}`);

  // If the card has a direct apply button on the card itself
  if (job.applyBtn && visible(job.applyBtn) && !job.isExternal) {
    log('  📌 Applying directly from search card...');
    const applied = await applyDirectOnCard(job);
    if (applied) {
      await humanDelay();
    }
    // Reload search feed to refresh cards
    window.location.reload();
  } else {
    // Navigate directly to the job details page in the SAME tab!
    log(`  🌐 Opening job details: ${job.href}`);
    location.href = job.href;
  }
}
