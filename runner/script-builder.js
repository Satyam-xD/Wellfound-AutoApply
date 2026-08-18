/**
 * runner/script-builder.js
 * Reads all inject/ files in dependency order and assembles them into a
 * single self-contained IIFE string that Playwright can evaluate in the page.
 *
 * Concatenation order (each file depends only on things defined above it):
 *   utils.js → gemini.js → answers.js → apply.js → finder.js → loop.js
 *
 * The CONFIG and CV objects are injected at the top of the IIFE by the
 * runner (never hard-coded in the inject files themselves).
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const INJECT_DIR = path.join(__dirname, '..', 'inject');

/** Files loaded in strict dependency order. */
const INJECT_FILES = ['utils.js', 'gemini.js', 'answers.js', 'apply.js', 'finder.js', 'loop.js'];

/**
 * buildScript — assembles and returns the full injection string.
 *
 * @param {object} opts
 * @param {object}  opts.CV               CV data from config.js
 * @param {string}  opts.geminiKey        Gemini API key (may be empty)
 * @param {boolean} opts.dryRun           true → fill but don't submit
 * @param {number}  opts.maxApplications  Stop after this many applies
 */
function buildScript({ CV, geminiKey, ollamaModel = 'llama3', dryRun, maxApplications }) {
  // Validate that all inject files exist before we start
  for (const file of INJECT_FILES) {
    const p = path.join(INJECT_DIR, file);
    if (!fs.existsSync(p)) {
      throw new Error(`Missing inject file: inject/${file}\nRun the project from the wellfound_autoApply directory.`);
    }
  }

  const parts = INJECT_FILES.map((file) => {
    const content = fs.readFileSync(path.join(INJECT_DIR, file), 'utf8');
    return `\n// ===== inject/${file} =====\n${content}`;
  });

  const CONFIG = {
    DRY_RUN:          dryRun,
    MAX_APPLICATIONS: maxApplications,
    MIN_DELAY_MS:     60_000,   // 1 min minimum between real applications
    MAX_DELAY_MS:     150_000,  // 2.5 min maximum
    geminiKey:        geminiKey || '',
    ollamaModel:      ollamaModel || 'llama3',
  };

  // The outer IIFE:
  //   1. Guard against double-injection (window.__aaBusy)
  //   2. Inject CONFIG and CV as plain objects (no PII in the inject files)
  //   3. Concatenate all inject module bodies
  return `
(async function wellfoundAutoApply() {
  'use strict';
  if (window.__aaBusy) {
    console.log('[auto-apply] Already running — skipping re-injection');
    return;
  }
  window.__aaBusy = true;

  // --- Injected by runner (from .env / config.js) ---
  const CONFIG = ${JSON.stringify(CONFIG, null, 2)};
  const CV     = ${JSON.stringify(CV,     null, 2)};
  // --------------------------------------------------

  try {
${parts.join('\n')}
  } catch (err) {
    console.error('[auto-apply] Fatal error:', err && err.message, err && err.stack);
  } finally {
    window.__aaBusy = false;
  }
})();
`.trim();
}

module.exports = { buildScript };
