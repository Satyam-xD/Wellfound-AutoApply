// ============================================================
// UTILITIES — injected into the browser page alongside all other inject/ files.
// All symbols defined here are in scope for every file that follows.
// ============================================================

/**
 * log() — prefixes every message with "[auto-apply]" so the
 * Playwright runner's console listener can pick it up reliably.
 */
function log(...args) {
  const msg = args.map(String).join(' ');
  console.log(`[auto-apply] ${msg}`);
}

/** Promise-based delay. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * humanDelay — random wait between CONFIG.MIN_DELAY_MS and CONFIG.MAX_DELAY_MS.
 * Emits a countdown update every second so the terminal stays informed.
 */
async function humanDelay() {
  const totalMs = CONFIG.MIN_DELAY_MS + Math.random() * (CONFIG.MAX_DELAY_MS - CONFIG.MIN_DELAY_MS);
  let remainingSec = Math.round(totalMs / 1000);

  while (remainingSec > 0) {
    log(`⏳ [Timer] Next application in: ${remainingSec}s`);
    await sleep(1000);
    remainingSec--;
  }
}

/**
 * waitFor — polls fn() every `interval` ms until it returns a truthy value,
 * or until `timeout` ms elapses, then returns null.
 */
async function waitFor(fn, timeout = 15000, interval = 300) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = fn();
      if (result) return result;
    } catch (_) { /* element may not exist yet */ }
    await sleep(interval);
  }
  return null;
}

/**
 * visible — returns true only if the element is attached to the DOM,
 * has non-zero bounding rect, and is not hidden via CSS.
 */
const visible = (el) => {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
};

/**
 * setValue — React 16/17/18/19 compatible field setter.
 * Resets React's internal _valueTracker so synthetic change/input events fire correctly.
 */
function setValue(el, rawVal) {
  const value = String(rawVal ?? '');
  const proto = Object.getPrototypeOf(el);
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

  // Clear React's value tracker so it recognizes the value change
  if (el._valueTracker) {
    el._valueTracker.setValue('');
  }

  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }

  // Fire input, change, and blur events with bubbling
  el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
}

/**
 * labelTextOf — finds the human-readable label text for a form field.
 * Tries: explicit <label for>, aria-label, aria-labelledby, placeholder,
 * wrapping <label>, then the nearest ancestor field container.
 */
function labelTextOf(field) {
  if (field.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
    if (lbl) return lbl.textContent.trim();
  }
  if (field.getAttribute('aria-label'))
    return field.getAttribute('aria-label').trim();
  if (field.getAttribute('aria-labelledby')) {
    const ids = field.getAttribute('aria-labelledby').split(/\s+/);
    const text = ids.map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
    if (text) return text;
  }
  const wrapped = field.closest('label');
  if (wrapped) return wrapped.textContent.replace(field.value || '', '').trim();
  if (field.placeholder) return field.placeholder.trim();
  const ancestor = field.closest(
    '[class*="field" i], [class*="input" i], [class*="form-group" i], fieldset, div'
  );
  return (ancestor?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * findButtonByText — finds the first visible, enabled button/submit/role=button
 * inside `scope` whose text or value matches `pattern`.
 */
function findButtonByText(scope, pattern) {
  const host = scope || document;
  return [...host.querySelectorAll(
    'button, input[type="submit"], [role="button"], [type="button"]'
  )].find((b) => {
    if (!visible(b)) return false;
    if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
    const text = (b.textContent || b.value || '').trim();
    return pattern.test(text);
  });
}

/**
 * cleanTitle — strips extra metadata (salary, remote/onsite tags, recruiter notes)
 * from a job link's text to isolate the pure job title.
 */
function cleanTitle(raw) {
  if (!raw) return '';
  let t = raw
    .replace(/(?:₹|\$|€)\s?[\d.,kLM]+(?:\s?[–-]\s?(?:₹|\$|€)?\s?[\d.,kLM]+)?/gi, '')
    .replace(/\b(?:Remote only|Remote\s*\([^)]+\)|Onsite or remote|In office|Everywhere|Hybrid)\b/gi, '')
    .replace(/\b(?:Actively Hiring|Recruiter recently active|Posted(?:\s+\d+\+?\s*)?(?:today|yesterday|\d+\s*days?\s*ago|\d+\s*weeks?\s*ago)|icn_repost|No equity)\b/gi, '')
    .replace(/\b(?:India|Hyderabad|Delhi|Bangalore(?:\s*Urban)?|Bengaluru|Pune|Mumbai|Noida|United States|New York(?:\s*City)?|San Francisco|California|Boston|Atlanta|Seattle|Chicago|Los Angeles|Europe|Canada|Brazil)\b/gi, '')
    .replace(/\bL\s*[–-]\s*L\b/gi, '')
    .replace(/[•·|].*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const cut = t.match(/^(.+?)(?:Remote|Onsite|In office|Posted|Recruiter|Actively|$)/i);
  return (cut ? cut[1] : t).replace(/\s+/g, ' ').trim();
}

/**
 * cleanCompany — isolates pure company name from tags, logos, and mission statements.
 */
function cleanCompany(raw) {
  if (!raw) return '';
  return raw
    .replace(/^apply to /i, '')
    // Split on common noise words that appear after the company name in Wellfound card text.
    // Use a case-insensitive split that doesn't require a word boundary before the keyword
    // (textContent sometimes concatenates words without whitespace e.g. "HealthActively").
    .split(/(?:Actively|Hiring|solves|elevates?|employees|Transforming|clinical|Building|Empowering|Leading|Backed|Seed|Series\s*[A-C]|Stealth)/i)[0]
    .replace(/(?:company )?logo/i, '')
    .replace(/[•·|].*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * getCompany — reads the clean company name from the "Apply to <Company>" modal header.
 */
function getCompany() {
  const allHeaders = [...document.querySelectorAll('h1, h2, h3, [role="dialog"] h1, [role="dialog"] h2, [role="dialog"] h3')];
  const applyHeader = allHeaders.find((h) => visible(h) && /apply to /i.test(h.textContent));
  if (applyHeader) {
    const m = applyHeader.textContent.match(/apply to ([^\n\r•·]+)/i);
    if (m) return cleanCompany(m[1]);
  }
  const link = document.querySelector('[role="dialog"] a[href*="/company/"]');
  if (link && visible(link)) return cleanCompany(link.textContent);
  return '';
}
