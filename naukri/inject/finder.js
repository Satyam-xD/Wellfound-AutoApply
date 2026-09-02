// ============================================================
// NAUKRI JOB FINDER — finds job tuples on Naukri search pages
// and filters by title, experience, and seen history.
// ============================================================

const NAUKRI_TITLE_ALLOW = [
  /\bsoftware\b/i,
  /\bdeveloper\b/i,
  /\bengineer\b/i,
  /\bfull[\s-]?stack\b/i,
  /\bfront[\s-]?end\b/i,
  /\bback[\s-]?end\b/i,
  /\bweb\s*(?:developer|engineer)?\b/i,
  /\bnode(?:\.js)?\b/i,
  /\breact(?:\.js)?\b/i,
  /\bjavascript\b/i,
  /\btypescript\b/i,
  /\bpython\b/i,
  /\bmern\b/i,
  /\bai\s*(?:engineer|developer)?\b/i,
  /\bllm\b/i,
  /\bintern\b/i,
  /\btrainee\b/i,
  /\bfresher\b/i,
  /\bassociate\b/i,
  /\bjr\b|\bjunior\b/i,
];

const NAUKRI_TITLE_BLOCK = [
  /\bsenior\b|\bsr\b|\bsr\./i,
  /\blead\b|\bprincipal\b|\bstaff\b/i,
  /\barchitect\b|\bmanager\b|\bdirector\b|\bvp\b/i,
  /\bqa\b|\btest\b|\bautomation tester\b|\bsdet\b/i,
  /\bdevops\b|\bsre\b|\bsysadmin\b/i,
  /\bdata\s*(?:analyst|scientist|analytics)\b/i,
  /\bsales\b|\bmarketing\b|\bbusiness analyst\b/i,
  /\bwordpress\b|\bphp\b|\bshopify\b|\blaravel\b/i,
  /\bdotnet\b|\b\.net\b|\bc#\b|\bjava\s+developer\b/i,
  /\bflutter\b|\bandroid\b|\bios\b|\bmobile developer\b/i,
];

const NAUKRI_EXP_BLOCK = [
  /\b[3-9]\s*(?:[-–]\s*[0-9]+)?\s*(?:years?|yrs?)/i,
  /\b1[0-9]\s*(?:[-–]\s*[0-9]+)?\s*(?:years?|yrs?)/i,
  /\b[3-9]\+\s*(?:years?|yrs?)/i,
];

function isNaukriTitleOk(title, snippet = '') {
  if (!title) return false;
  const t = title.trim();

  // Block senior/management/unrelated
  if (NAUKRI_TITLE_BLOCK.some((re) => re.test(t))) return false;

  // Block experience demands >= 3 years
  const combined = t + ' ' + snippet;
  if (NAUKRI_EXP_BLOCK.some((re) => re.test(combined))) {
    // Exception if expressly marked fresher/entry
    if (!/\bfresher|entry|0\s*[-–]\s*1|0\s*years/i.test(combined)) {
      return false;
    }
  }

  // Must match at least one allowed target role
  return NAUKRI_TITLE_ALLOW.some((re) => re.test(t));
}

/**
 * findNaukriJobRows — parses all job cards present on the Naukri search results page.
 */
function findNaukriJobRows() {
  const CARD_SELECTORS = [
    'div.srp-jobtuple-wrapper',
    'div.cust-job-tuple',
    'article.jobTuple',
    '[data-job-id]',
    'div[class*="styles_job-tuple" i]',
    'div[class*="jobTuple" i]',
  ].join(', ');

  const cards = [...document.querySelectorAll(CARD_SELECTORS)].filter(visible);

  const results = [];
  for (const card of cards) {
    const titleEl = card.querySelector('a.title, [class*="title" i] a, a[class*="title" i]');
    if (!titleEl) continue;

    const title = titleEl.textContent?.trim() || '';
    const href  = titleEl.href || '';
    if (!href) continue;

    const compEl = card.querySelector('a.comp-name, [class*="comp-name" i], a[class*="company" i], [class*="compName" i]');
    const company = compEl?.textContent?.trim() || '';

    const expEl = card.querySelector('span.exp-wrap, [class*="exp-wrap" i], [class*="experience" i]');
    const expRequired = expEl?.textContent?.trim() || '';

    const salEl = card.querySelector('span.sal-wrap, [class*="sal-wrap" i], [class*="salary" i]');
    const salary = salEl?.textContent?.trim() || '';

    const descEl = card.querySelector('div.job-desc, [class*="job-desc" i], [class*="jobDescription" i]');
    const snippet = descEl?.textContent?.trim() || '';

    // Direct apply button if present on card
    const applyBtn = card.querySelector('button[id*="apply" i], button[class*="apply" i], [class*="apply-button" i]');

    // Check if it's external "Apply on company site"
    const cardText = card.textContent || '';
    const isExternal = /apply on company site|company site/i.test(cardText);

    results.push({
      cardEl: card,
      titleEl,
      applyBtn,
      title,
      company,
      expRequired,
      salary,
      href,
      snippet,
      cardText,
      isExternal,
    });
  }

  return results;
}
