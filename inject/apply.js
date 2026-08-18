// ============================================================
// APPLICATION FILLER — fills and submits the "Apply to <Company>" modal.
// Requires: sleep, waitFor, visible, setValue, labelTextOf,
//           findButtonByText, coverLetter, answerQuestion, CV, CONFIG, GENERIC_ANSWER
// ============================================================

const APPLY_SELECTORS = {
  // sendButtonText matches all Wellfound submit button variants
  sendButtonText: /\bapply\b|^send$|^submit$|send application|submit application/i,
};

/**
 * findApplyPanel — locates Wellfound’s apply side-panel / dialog.
 *
 * Wellfound renders the apply form as a RIGHT-SIDE PANEL (not a dialog).
 * It may have class="ApplicationForm", "ApplyPanel", "applyPanel", etc.
 * or role="dialog". We try multiple strategies and return the MOST SPECIFIC
 * visible container that actually contains the apply form.
 */
function findApplyPanel() {
  const hasFormFields = (el) =>
    el.querySelector('textarea') ||
    el.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])') ||
    el.querySelector('select');

  const PANEL_SEL = [
    '[role="dialog"]',
    '[class*="ApplicationForm" i]',
    '[class*="application-form" i]',
    '[class*="applyPanel" i]',
    '[class*="apply-panel" i]',
    '[class*="applyForm" i]',
    '[class*="ApplyForm"]',
    '[class*="applyDrawer" i]',
    '[class*="sidePanel" i]',
  ].join(', ');

  const candidates = [...document.querySelectorAll(PANEL_SEL)]
    .filter((el) => visible(el) && /apply to /i.test(el.textContent) && hasFormFields(el));

  const fallback = [...document.querySelectorAll('div, section, form, aside')]
    .filter((el) => {
      if (!visible(el) || el === document.body || el === document.documentElement) return false;
      if (!/apply to /i.test(el.textContent)) return false;
      if (!hasFormFields(el)) return false;
      return el.querySelectorAll('*').length <= 300;
    });

  const all = [...new Set([...candidates, ...fallback])];
  if (!all.length) return null;

  all.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
  return all.find((el) => el.querySelector('textarea')) || all[0];
}

/**
 * findCardApplyButton — locates the primary Apply button on a job card or detail pane.
 */
function findCardApplyButton(scope) {
  const host = scope || document;
  return [...host.querySelectorAll('button, [role="button"], a')]
    .filter((b) => visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true')
    .find((b) => {
      const text = (b.textContent || b.value || '').trim();
      if (/^(applied|save|saved|share|bookmark)$/i.test(text)) return false;
      return /^apply(\s+now)?$/i.test(text) || /^apply to /i.test(text);
    }) || null;
}

/**
 * openApplyForm — Wellfound shows job details first; click Apply to open the form.
 */
async function openApplyForm(scope) {
  if (findApplyPanel()) return true;

  const host = scope || document;
  let applyBtn = findCardApplyButton(host);

  if (!applyBtn) {
    applyBtn = await waitFor(() => findCardApplyButton(document), 8000);
  }

  if (applyBtn) {
    applyBtn.scrollIntoView({ block: 'center' });
    await sleep(500);
    applyBtn.click();
    log('  📋 Clicked Apply to open application form');
    await sleep(2500);
  }

  return !!(await waitFor(() => findApplyPanel(), 12000));
}

/**
 * isExperienceHardBlocked — only true when Wellfound actually blocks applying.
 * Informational hints like "improve your odds" must NOT skip the job.
 */
function isExperienceHardBlocked(scope) {
  const text = (scope?.textContent || '').replace(/\s+/g, ' ');
  if (/you (?:do not|don't) meet the (?:minimum )?experience/i.test(text)) return true;
  if (/outside the years of experience (?:required|for this role)/i.test(text)) return true;
  if (/not eligible(?: to apply)?.*experience/i.test(text)) return true;
  return false;
}

/**
 * closeModal — dismisses the apply overlay either via a close button or Escape.
 */
function closeModal(scope) {
  const host = scope || document;
  const closeBtn =
    host.querySelector('button[aria-label*="close" i], [data-test*="close" i]') ||
    document.querySelector('button[aria-label*="close" i], [data-test*="close" i]') ||
    findButtonByText(host,     /^×$|^✕$|^close$/i) ||
    findButtonByText(document, /^×$|^✕$|^close$/i);

  if (closeBtn) {
    closeBtn.click();
  } else {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    window.dispatchEvent(  new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  }
}

/**
 * fillAndSubmit — the core apply logic for one job.
 *
 * Steps:
 *   1. Wait for the "Apply to <Company>" modal / pane
 *   2. Detect hard blocks (location-gated, disabled submit)
 *   3. Fill cover-letter textarea
 *   4. Fill any extra text / email / tel / number inputs
 *   5. Handle location-mismatch prompt
 *   6. Select dropdowns, radio groups, checkboxes
 *   7. Click the Send / Apply / Submit button (or dry-run)
 *
 * Returns true if application was sent (or dry-run counted), false if skipped.
 */
async function fillAndSubmit(company, title) {
  // ── 1. Wait for the apply panel (click Apply first if needed) ──
  let modal = await waitFor(() => findApplyPanel(), 8000);
  if (!modal) {
    const opened = await openApplyForm();
    if (!opened) {
      log('⚠ No apply panel found — skipping (Apply form never opened)');
      log('  (Expected "Apply to <Company>" header with form fields)');
      return false;
    }
    modal = findApplyPanel();
  }
  if (!modal) {
    log('⚠ No apply panel found — skipping (panel never appeared)');
    return false;
  }
  log(`  🔍 Panel found: <${modal.tagName.toLowerCase()}> — ${modal.querySelectorAll('*').length} child nodes`);

  // ── 2. Hard blocks ──────────────────────────────────────────
  if (/not accepting applications from your (current )?location/i.test(modal.textContent)) {
    log('🚫 Location-blocked by company — skipping');
    closeModal(modal);
    return false;
  }

  if (isExperienceHardBlocked(modal)) {
    log('🚫 Experience requirement hard-block — skipping');
    closeModal(modal);
    return false;
  }

  // ── 3. Cover letter ─────────────────────────────────────────
  const effectiveCompany = getCompany() || company || '';
  const textareas = [...modal.querySelectorAll('textarea')].filter(visible);
  if (textareas.length) {
    const letter = coverLetter(effectiveCompany, title);
    setValue(textareas[0], letter);
    log('✍ Cover letter filled');
    await sleep(400);
  }

  // ── 4. Extra text / number / email / tel inputs ─────────────
  const extraInputSel =
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])' +
    ':not([type="submit"]):not([type="file"]):not([type="button"])';
  const extraFields = [
    ...textareas.slice(1),
    ...[...modal.querySelectorAll(extraInputSel)].filter((f) => visible(f) && !f.value),
  ];

  for (const field of extraFields) {
    const label = labelTextOf(field);
    if (/search/i.test(label)) continue; // skip page search boxes

    let answer = await answerQuestion(label);

    // Coerce to the correct type
    if (field.type === 'number' || field.inputMode === 'numeric') {
      if (/years?.*exp|experience|how many years/i.test(label)) {
        // Extract just the leading digit from e.g. "0-1 years (Internships...)"
        const m = String(CV.yearsOfExperience || '0').match(/^\d+/);
        answer = m ? m[0] : '0';
      } else {
        const m = String(answer).match(/\d+/);
        answer = m ? m[0] : '0';
      }
    } else if (field.type === 'tel') {
      answer = CV.phone || answer;
    } else if (field.type === 'email') {
      answer = CV.email || answer;
    }

    const required =
      field.required ||
      field.getAttribute('aria-required') === 'true' ||
      /\*/.test(label);

    if (answer === GENERIC_ANSWER && !required) {
      log(`⏭ Optional unknown field skipped: "${label.slice(0, 55)}"`);
      continue;
    }

    setValue(field, answer);
    log(`✍ Answered: "${label.slice(0, 60)}"`);
    await sleep(250);
  }

  // ── 5. Wellfound location-mismatch prompt ──────────────────
  if (/does not support the locations|update your location preferences/i.test(modal.textContent)) {
    const relocateBtn = [...modal.querySelectorAll('label, [role="radio"], button, div')]
      .filter(visible)
      .find((el) => /i can relocate/i.test(el.textContent) && el.textContent.length < 80);

    if (relocateBtn) {
      relocateBtn.click();
      log('📍 Chose "I can relocate to…"');
      await sleep(800);

      // Pick the offered location from the native select or a combobox
      const nativeSel = [...modal.querySelectorAll('select')].filter(visible).pop();
      const combo     = [...modal.querySelectorAll('[role="combobox"], input[id*="react-select" i]')]
                          .filter(visible).pop();

      if (nativeSel) {
        const opts = [...nativeSel.options].filter((o) => o.value && !/select|choose/i.test(o.text));
        if (opts.length) { setValue(nativeSel, opts[0].value); log(`📍 Location: ${opts[0].text.trim()}`); }
      } else if (combo) {
        combo.focus(); combo.click(); await sleep(600);
        const opt = await waitFor(
          () => [...document.querySelectorAll('[role="option"]')].find(visible),
          3000
        );
        if (opt) {
          opt.click();
          log(`📍 Location: ${opt.textContent.trim().slice(0, 40)}`);
        } else {
          for (const key of ['ArrowDown', 'Enter']) {
            combo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
            await sleep(300);
          }
          log('📍 Location picked via keyboard fallback');
        }
      } else {
        log('⚠ Relocate chosen but no location picker found');
      }
      await sleep(500);
    }
  }

  // ── 6a. Native <select> dropdowns ──────────────────────────
  const YES_RE         = /yes|willing|open to|agree|relocat|remote|immediat|i am able|i can/i;
  const NO_RE          = /^no\b|do not|don't|not required|false/i;
  const NEGATIVE_Q_RE  = /sponsorship|require.*visa|need.*visa|non-compete|felony|criminal|disciplinary/i;
  const PLACEHOLDER_RE = /^select|^choose|^--|^pick/i;

  for (const sel of [...modal.querySelectorAll('select')].filter(visible)) {
    const opts = [...sel.options].filter((o) => o.value && !PLACEHOLDER_RE.test(o.text.trim()));
    if (!opts.length) continue;
    const label = labelTextOf(sel);
    let pick = null;
    if (/years?.*exp|experience/i.test(label)) {
      // For a fresher with 0-1 years experience, prefer the lowest / entry-level option
      const expYears = String(CV.yearsOfExperience || '0').match(/^\d+/)?.[0] || '0';
      pick =
        opts.find((o) => /\b0\b|^0[-–]1|fresher|entry|0\s*-\s*1|less than 1|< ?1|no exp/i.test(o.text)) ||
        opts.find((o) => new RegExp(`\\b${expYears}\\b`).test(o.text)) ||
        opts[0]; // fallback: first option (usually lowest exp)
    } else if (NEGATIVE_Q_RE.test(label)) {
      pick = opts.find((o) => NO_RE.test(o.text)) || opts.find((o) => !YES_RE.test(o.text)) || opts[0];
    } else {
      pick =
        opts.find((o) => YES_RE.test(o.text)) ||
        opts.find((o) => CV.location && o.text.toLowerCase().includes(CV.location.split(',')[0].trim().toLowerCase())) ||
        opts[0];
    }
    setValue(sel, pick.value);
    log(`☑ Dropdown "${label.slice(0, 45)}" → "${pick.text.trim()}"`);
    await sleep(200);
  }

  // ── 6b. Radio groups ────────────────────────────────────────
  const radioGroups = {};
  for (const r of [...modal.querySelectorAll('input[type="radio"]')].filter(visible)) {
    const key = r.name || labelTextOf(r);
    (radioGroups[key] ||= []).push(r);
  }
  for (const group of Object.values(radioGroups)) {
    const ctx = (
      group[0].closest('fieldset')?.textContent ||
      group.map((r) => labelTextOf(r)).join(' ')
    ).slice(0, 200);

    let pick = null;
    if (/gender|^sex\b/i.test(ctx)) {
      pick = group.find((r) => { const l = labelTextOf(r); return /male/i.test(l) && !/female/i.test(l); });
    } else if (/disability|disabled/i.test(ctx)) {
      pick = group.find((r) => /no disability|not disabled|^no\b|none/i.test(labelTextOf(r)));
    } else if (/years?.*exp|experience/i.test(ctx)) {
      // Pick the lowest/fresher option for experience radio groups
      pick =
        group.find((r) => /\b0\b|^0[-–]1|fresher|entry|less than 1|< ?1|no exp/i.test(labelTextOf(r))) ||
        group[0];
    } else if (NEGATIVE_Q_RE.test(ctx)) {
      pick = group.find((r) => NO_RE.test(labelTextOf(r))) || group.find((r) => !YES_RE.test(labelTextOf(r))) || group[0];
    }
    pick = pick || group.find((r) => YES_RE.test(labelTextOf(r))) || group[0];
    if (!pick.checked) { pick.click(); await sleep(200); }
    log(`☑ Radio: "${labelTextOf(pick).slice(0, 50)}"`);
  }

  // ── 6c. Checkboxes ──────────────────────────────────────────
  for (const cb of [...modal.querySelectorAll('input[type="checkbox"]')].filter(visible)) {
    const own       = labelTextOf(cb);
    const groupText = (
      cb.closest('fieldset')?.querySelector('legend')?.textContent ||
      cb.closest('fieldset, [role="group"]')?.textContent || ''
    ).trim();
    const isLocation = /relocat|locat|city|office|work from|based in|move to/i.test(groupText);
    const matchLoc = !isLocation || /india|delhi|bangalore|bengaluru|hyderabad|mumbai|pune|noida|remote|anywhere|all/i.test(own) || (CV.location && own.toLowerCase().includes(CV.location.split(',')[0].trim().toLowerCase()));
    if (!cb.checked && matchLoc && (isLocation || /relocat|agree|confirm|authoriz|terms|acknowledge|remote/i.test(own))) {
      cb.click();
      await sleep(200);
      log(`☑ Checked: "${own.slice(0, 50)}"`);
    }
  }

  // ── 7. Find and click Send / Apply / Submit ─────────────────

  if (isExperienceHardBlocked(modal)) {
    log('🚫 Experience hard-block appeared after form load — skipping');
    closeModal(modal);
    return false;
  }

  const sendBtn = await waitFor(
    () => findButtonByText(modal, APPLY_SELECTORS.sendButtonText),
    12000
  );

  if (!sendBtn) {
    const anyBtn = [...modal.querySelectorAll('button, [type="submit"]')]
      .find((b) => APPLY_SELECTORS.sendButtonText.test(b.textContent.trim()));
    log(anyBtn && (anyBtn.disabled || anyBtn.getAttribute('aria-disabled') === 'true')
      ? '🚫 Submit button is disabled (required fields missing) — skipping'
      : '⚠ No enabled Submit button found after 12s — skipping');

    closeModal(modal);
    return false;
  }

  if (CONFIG.DRY_RUN) {
    log(`🔍 DRY_RUN — would click: "${sendBtn.textContent.trim()}"`);
    closeModal(modal);
    return true; // counted as a dry-run application
  }

  sendBtn.scrollIntoView({ block: 'center' });
  await sleep(600); // wait for scroll + layout to settle before measuring coordinates

  // ── Trusted click via Playwright supervisor ────────────────────────────────
  // Programmatic element.click() inside an injected script creates isTrusted=false
  // events — Wellfound's React handlers silently ignore these.
  // Solution: pass the button's exact screen coordinates to the Playwright
  // supervisor so it can fire page.mouse.click(x, y) — a real CDP mouse event
  // that IS trusted. This avoids the supervisor having to search for the button.
  const btnRect  = sendBtn.getBoundingClientRect();
  const clickX   = Math.round(btnRect.left + btnRect.width  / 2);
  const clickY   = Math.round(btnRect.top  + btnRect.height / 2);
  const btnLabel = sendBtn.textContent.trim().slice(0, 50);

  window.__aaSubmitDone    = false;
  window.__aaReadyToSubmit = { x: clickX, y: clickY, label: btnLabel };
  log(`  🖱 Signalling supervisor to click: "${btnLabel}" at (${clickX}, ${clickY})`);

  const supervisorClicked = await waitFor(() => window.__aaSubmitDone, 9000, 300);

  if (!supervisorClicked) {
    // Supervisor timed out — fall back to direct programmatic events
    log('  ⚠ Supervisor click timed out — using direct click fallback');
    sendBtn.focus();
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
      try {
        sendBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      } catch (e) {
        log(`⚠ Fallback event "${type}" dispatch failed: ${e.message.split('\n')[0]}`);
      }
    });
    if (typeof sendBtn.click === 'function') sendBtn.click();
    // Also try submitting the parent <form> directly
    const form = sendBtn.closest('form');
    if (form) {
      try { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); } catch (e) {
        log(`⚠ Fallback form submit dispatch failed: ${e.message.split('\n')[0]}`);
      }
    }
  }

  // ── 8. Wait for actual submission confirmation ───────────────
  // STRICT: only trust explicit Wellfound server-confirmed success text.
  // React isTrusted=false clicks can update UI locally (button disappears,
  // "applied" text appears in modal) WITHOUT firing the actual API request.
  // Counting modal-disappearing or button-gone as success = false positives.
  log('  ⏳ Submitted, waiting for Wellfound confirmation...');

  const SUCCESS_RE = /application submitted|application sent|you've applied|successfully applied|your application has been/i;

  const confirmed = await waitFor(() => {
    const modalText = modal.textContent || '';
    const bodyText  = document.body.textContent || '';

    // Server-confirmed success text in the modal
    if (SUCCESS_RE.test(modalText)) return 'modal-text';

    // Wellfound sometimes shows a toast OUTSIDE the modal
    if (SUCCESS_RE.test(bodyText)) return 'page-toast';

    // Button text changed to "Applied" / "Pending Review" (distinct from the submit button text)
    const pendingEl = [...modal.querySelectorAll('button, span, div')]
      .filter(visible)
      .find((el) => /^(applied|pending review|application pending)$/i.test(el.textContent.trim()));
    if (pendingEl) return 'pending-badge';

    return false;
  }, 15000);

  if (confirmed) {
    log(`✅ application sent (${confirmed})`);
    await sleep(2500);
    return true;
  }

  // No server confirmation received — diagnose what happened
  const stillOpen = visible(modal) && document.contains(modal);
  const submitGone = !findButtonByText(modal, APPLY_SELECTORS.sendButtonText);
  const errorEl = modal.querySelector(
    'p[class*="error" i], span[class*="error" i], div[class*="errorMessage" i], [class*="fieldError" i]'
  );

  if (errorEl && visible(errorEl) && errorEl.textContent.trim().length > 3) {
    log(`🚫 Form field error: "${errorEl.textContent.trim().slice(0, 80)}"`);
  } else if (!stillOpen) {
    log('⚠ Modal closed without a Wellfound server confirmation — isTrusted click likely failed, application NOT sent');
  } else if (submitGone) {
    log('⚠ Submit button gone (React local state) but no server confirmation — application NOT counted to avoid false CSV entries');
  } else {
    log('⚠ No confirmation after 15s — skipping');
  }

  closeModal(modal);
  return false;
}
