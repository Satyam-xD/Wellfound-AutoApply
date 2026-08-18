// ============================================================
// JOB FINDER — discovers matching job cards on the Wellfound feed.
// Requires: visible, cleanTitle, CONFIG (injected config object)
// ============================================================

/** Job titles we actively target (Satyam's actual tech stack). */
const TITLE_KEYWORDS = [
  // Entry-level markers
  'fresher', 'entry level', 'entry-level', 'junior', 'trainee', 'associate', 'associate engineer', 'associate software', 'intern', 'software intern',
  // Full Stack / MERN
  'full stack', 'fullstack', 'full-stack', 'mern',
  // Frontend
  'frontend', 'front end', 'front-end', 'react', 'next.js', 'nextjs',
  // Backend
  'backend', 'back end', 'back-end', 'node.js', 'node js', 'express',
  // AI / GenAI / LLM
  'ai engineer', 'ai developer', 'genai', 'gen ai', 'llm', 'ai full stack', 'full stack ai',
  // General Software Engineering — broad catch for plain "Software Engineer", "Developer" etc.
  'software engineer', 'software developer', 'web developer', 'sde', 'sde-1', 'sde 1',
  'javascript developer', 'javascript engineer', 'typescript', 'python developer',
  // Catch plain "developer" / "engineer" titles that don't include a domain word above
  'developer', 'engineer',
];

/** Titles that indicate seniority or an unrelated domain — skip these. */
const TITLE_BLOCKLIST = [
  // Seniority / leadership
  'senior', 'sr.', 'sr ', 'staff', 'principal', 'director', 'manager',
  'lead', 'head of', 'head,', 'vp ', 'vice president',
  // Infrastructure / platform
  'architect', 'founding engineer', 'devops', 'sre', 'infrastructure',
  'platform engineer', 'cloud engineer', 'network engineer', 'systems engineer',
  'reliability engineer', 'security engineer', 'cybersecurity', 'devsecops',
  // Data / ML Ops (not AI/GenAI roles)
  'data engineer', 'data scientist', 'analytics', 'business intelligence',
  'bi developer', 'bi engineer', 'tableau', 'mlops', 'ml engineer',
  // QA / Testing
  'qa ', 'quality assurance', 'test engineer', 'tester', 'automation engineer',
  // Design / Product / Business
  'designer', 'ux', 'ui/ux', 'product manager', 'product designer',
  'sales', 'marketing', 'growth',
  'teacher', 'trainer', 'tutor', 'instructor', 'coach',
  'product associate', 'e-commerce', 'ecommerce', 'operations',
  'customer support', 'customer success', 'business development', 'account manager',
  // Hardware / specialized
  '.net', 'c#', 'php', 'ruby', 'golang', 'ios developer', 'android native',
  'flutter', 'embedded', 'firmware', 'hardware', 'mechanical', 'electrical',
  'blockchain', 'solidity', 'database administrator', 'dba',
  'laravel', 'wordpress', 'shopify', 'magento',
  'machine learning engineer', 'ml engineer', 'deep learning',
  'forward deployed', 'salesforce', 'sap ',
];

const ALREADY_APPLIED_RE = /^applied$/i;

/**
 * titleOk — returns true if the job matches our tech stack and experience level.
 *
 * @param {string} rawTitle   The raw job title text from the anchor.
 * @param {string} jobRowText The text of THIS job's immediate row (narrow context).
 *                            Must NOT be the full company card text — see findJobRows.
 */
function titleOk(rawTitle, jobRowText = '') {
  const clean = cleanTitle(rawTitle);
  const lower = clean.toLowerCase();

  // 1. Block senior or unrelated roles based on title only
  if (TITLE_BLOCKLIST.some((k) => lower.includes(k))) return false;

  // 2. Skip roles requiring more experience than the candidate has.
  //    We use jobRowText (narrow row context) so we never miss an exp tag.
  //    Patterns caught: "2+ years", "3 years exp", "minimum 2 years",
  //    "at least 2 years", "2-4 years", etc.
  //    "1+ years" is also caught because Wellfound's mismatch warning fires
  //    for anything above the 0–1-year fresher band.
  const rowLower = jobRowText.toLowerCase();
  const expDemandRe = /(?:minimum\s+|at\s+least\s+)?([2-9]|[1-9]\d)\s*\+?\s*(?:years?|yrs?)(?:\s*(?:of\s*)?(?:exp(?:erience)?)?)?|1\s*\+\s*(?:years?|yrs?)/i;
  if (expDemandRe.test(rowLower)) return false;

  // 3. Must match at least one target keyword in the cleaned title
  return TITLE_KEYWORDS.some((k) => lower.includes(k));
}

/**
 * findJobRows — scrapes job cards from the current Wellfound feed page.
 * Returns an array of job objects: { href, title, company, salary, linkEl, rowText }.
 *
 * Guards:
 *  - Redirects to /jobs feed if we're on an individual job page.
 *  - Skips "Applied" cards.
 *  - Skips jobs posted > 14 days ago.
 *  - Only includes anchors whose href matches the /jobs/<id>-slug pattern.
 */
function findJobRows() {
  // If the SPA routed us to a single job page, bounce back to the feed
  if (location.pathname.startsWith('/jobs/') && location.pathname !== '/jobs') {
    log('⚠ On individual job page — bouncing back to feed...');
    if (window.next?.router?.push) window.next.router.push('/jobs');
    else location.href = 'https://wellfound.com/jobs';
    return [];
  }

  const rows = [];

  for (const anchor of document.querySelectorAll('a[href*="/jobs/"]')) {
    const href = anchor.getAttribute('href') || '';
    if (!/\/jobs\/\d/.test(href)) continue;          // must have numeric ID
    if (!visible(anchor)) continue;
    if (anchor.textContent.trim().length < 4) continue;

    // ── Company-level card (used for badge/date/company-name detection) ──
    let card = anchor.closest('[data-test="StartupResult"]') ||
               anchor.closest('[class*="StartupResult" i]') ||
               anchor.closest('[class*="result" i]');

    if (!card) {
      card = anchor.closest('div');
      for (let i = 0; i < 4 && card && card.textContent.trim().length < 60; i++) {
        card = card.parentElement;
      }
      card = card || anchor.parentElement;
    }

    // ── Job-row element: the narrowest ancestor that contains THIS job's metadata ──
    // Walk up from the anchor until we find a container that includes salary/exp tags
    // but is still much smaller than the full company card.
    let jobRow = anchor.parentElement;
    for (let i = 0; i < 6 && jobRow && jobRow !== card; i++) {
      const t = jobRow.textContent || '';
      // Stop as soon as this element contains salary, years, or job-type info
      if (/(?:₹|\$|€|years?|yrs?|remote|full.?time|part.?time|contract|internship)/i.test(t)) break;
      jobRow = jobRow.parentElement;
    }
    // Fallback: use the card itself but cap at 600 chars to avoid company blurbs
    const jobRowText = (jobRow && jobRow !== card)
      ? (jobRow.textContent || '')
      : (card.textContent || '').slice(0, 600);

    // Skip "Applied" cards
    const badges = [...card.querySelectorAll('button, span, div')]
      .map((el) => el.textContent.trim());
    if (badges.some((t) => ALREADY_APPLIED_RE.test(t))) continue;

    // Skip stale listings (> 14 days)
    const posted = card.textContent.match(/posted (?:about )?(\d+)\+? ?(day|week|month)s? ago/i);
    if (posted) {
      const n = +posted[1];
      const unit = posted[2].toLowerCase();
      const days = unit === 'day' ? n : unit === 'week' ? n * 7 : n * 30;
      if (days > 14) continue;
    }

    // Company name: find heading or logo within THIS startup card only
    const companyRaw = (
      card.querySelector('h2, [class*="startupName" i], a[href^="/company/"]')?.textContent?.trim() ||
      card.querySelector('img[alt]')?.alt ||
      ''
    );
    const company = cleanCompany(companyRaw);

    // Job title: prefer dedicated title element over full anchor text (which includes location/salary noise)
    const titleEl =
      anchor.querySelector('h3, h4, [class*="jobTitle" i], [class*="JobTitle" i]') ||
      card.querySelector('h3, h4, [class*="jobTitle" i], [class*="JobTitle" i]');
    const titleRaw = titleEl?.textContent?.trim() || anchor.textContent;
    const title = cleanTitle(titleRaw);

    // Apply button on the card — preferred click target over the title link
    const applyBtn = findCardApplyButton(card);

    // Salary: grab the first currency match from the job row text (more accurate)
    const salary = (
      (jobRowText + card.textContent).match(/(?:₹|\$|€)\s?[\d.,k]+\s?(?:[–-]\s?(?:₹|\$|€)?\s?[\d.,k]+)?k?/i) || ['']
    )[0].trim();

    rows.push({
      href:       (anchor.href || '').split('?')[0],
      title,
      company,
      salary,
      linkEl:     anchor,
      applyBtn,
      card,
      rowText:    jobRowText,   // narrow row text — used for exp filtering in titleOk()
      cardText:   card.textContent, // full card text — used for loop.js exp scrape
    });
  }

  return rows;
}
