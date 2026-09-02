// ============================================================
// NAUKRI APPLY MODULE — handles job detail page apply, 1-click apply,
// questionnaire modals, and chatbot forms on Naukri.
// ============================================================

const NAUKRI_SUCCESS_RE = /applied successfully|application sent|successfully applied|already applied|you have applied/i;

/**
 * applyOnJobDetailsPage — handles applying when on a Naukri /job-listings-... page.
 * @returns {Promise<boolean>} true if applied
 */
async function applyOnJobDetailsPage() {
  await sleep(2000); // let the page hydrate

  // 1. Scrape title & company
  const titleEl = document.querySelector('h1.styles_jd-header-title__rZwM1, h1[class*="header-title" i], h1[class*="jd-header" i], h1');
  const title = titleEl?.textContent?.trim() || 'Software Engineer';

  const compEl = document.querySelector('a.styles_jd-header-comp-name__MvqAI, [class*="header-comp-name" i], [class*="comp-name" i], [class*="company-name" i], a[href*="/overview/"]');
  const company = compEl?.textContent?.trim() || '';

  const expEl = document.querySelector('[class*="experience" i], [class*="exp-wrap" i], [class*="exp" i]');
  const expRequired = expEl?.textContent?.trim() || '';

  const salEl = document.querySelector('[class*="salary" i], [class*="sal-wrap" i]');
  const salary = salEl?.textContent?.trim() || '';

  // Log in standard format so supervisor captures job metadata for CSV
  log(`▶ Applying: ${title} @ ${company} | ${location.href} | ${salary} | ${expRequired}`);

  // 2. Check if already applied
  const isAlreadyApplied = [...document.querySelectorAll('button, span, div')].filter(visible).some((el) => {
    const t = el.textContent?.trim() || '';
    return /^(?:already applied|applied)$/i.test(t);
  });

  if (isAlreadyApplied) {
    log(`  ℹ Already applied to ${company} for "${title}" — skipping`);
    return false;
  }

  // 3. Find the apply button
  const applyBtn = await waitFor(() => {
    const candidates = [
      document.querySelector('#apply-button'),
      document.querySelector('button.apply-button'),
      document.querySelector('button[class*="apply-button" i]'),
      document.querySelector('button[id*="apply" i]'),
      ...document.querySelectorAll('button, a[role="button"]')
    ].filter(Boolean).filter(visible);

    return candidates.find((b) => {
      const t = b.textContent?.trim() || '';
      return /^(?:easy\s+)?apply$/i.test(t) || /^apply on company site$/i.test(t);
    });
  }, 7000);

  if (!applyBtn) {
    log(`  ⚠ No apply button found on job page for "${title}" — moving on`);
    return false;
  }

  if (/company site|external/i.test(applyBtn.textContent || '')) {
    log(`  ⏭ Skipping external apply: "${title}" @ ${company}`);
    return false;
  }

  if (CONFIG.DRY_RUN) {
    log(`  🔍 DRY_RUN — would click Apply: "${title}" @ ${company}`);
    return true;
  }

  // 4. Click Apply
  applyBtn.scrollIntoView({ block: 'center' });
  await sleep(400);
  applyBtn.click();
  log(`  🖱 Clicked Apply on job page: "${title}" @ ${company}`);
  await sleep(2500);

  // 5. Handle chatbot / questionnaire steps if present
  let attempts = 0;
  while (attempts < 5) {
    const modal = document.querySelector(
      '[role="dialog"], [class*="apply-modal" i], [class*="chatbot" i], [class*="bot-container" i], ' +
      '[class*="apply-question" i], [class*="aQuestions" i], div.apply-message'
    );
    if (!modal || !visible(modal)) break;
    if (NAUKRI_SUCCESS_RE.test(modal.textContent || '')) break;

    log(`  📋 Filling questionnaire step ${attempts + 1}...`);
    await fillNaukriQuestionnaire(modal);
    await sleep(1500);
    attempts++;
  }

  // 6. Wait for success confirmation
  const confirmed = await waitFor(() => {
    const text = document.body.textContent || '';
    if (NAUKRI_SUCCESS_RE.test(text)) return true;
    return !![...document.querySelectorAll('button, span, div')].filter(visible).find((el) =>
      /^(?:applied|already applied)$/i.test(el.textContent.trim())
    );
  }, 8000);

  if (confirmed) {
    log(`  ✅ Applied to ${company} for "${title}"`);
    closeNaukriModal();
    return true;
  }

  log(`  ⚠ No confirmation for "${title}" — moving on`);
  closeNaukriModal();
  return false;
}

/**
 * applyDirectOnCard — handles 1-click apply directly from the search card if present.
 */
async function applyDirectOnCard(job) {
  if (job.isExternal) return false;
  if (!job.applyBtn || !visible(job.applyBtn)) return false;

  log(`▶ Applying: ${job.title} @ ${job.company} | ${job.href} | ${job.salary} | ${job.expRequired}`);

  if (CONFIG.DRY_RUN) {
    log(`  🔍 DRY_RUN — would click Apply: "${job.title}" @ ${job.company}`);
    return true;
  }

  job.applyBtn.scrollIntoView({ block: 'center' });
  await sleep(400);
  job.applyBtn.click();
  log(`  🖱 Clicked card Apply: "${job.title}" @ ${job.company}`);
  await sleep(2500);

  // Handle any popup
  let attempts = 0;
  while (attempts < 5) {
    const modal = document.querySelector('[role="dialog"], [class*="apply-modal" i], [class*="chatbot" i]');
    if (!modal || !visible(modal)) break;
    if (NAUKRI_SUCCESS_RE.test(modal.textContent || '')) break;
    await fillNaukriQuestionnaire(modal);
    await sleep(1500);
    attempts++;
  }

  const confirmed = await waitFor(() => {
    return NAUKRI_SUCCESS_RE.test(document.body.textContent || '');
  }, 6000);

  if (confirmed) {
    log(`  ✅ Applied to ${job.company} for "${job.title}"`);
    closeNaukriModal();
    return true;
  }

  closeNaukriModal();
  return false;
}

/**
 * fillNaukriQuestionnaire — fills inputs, selects, and radios inside Naukri's apply drawer.
 */
async function fillNaukriQuestionnaire(container) {
  // 1. Radio groups (Yes/No, notice period, experience)
  const radios = [...container.querySelectorAll('input[type="radio"]')].filter(visible);
  const radioGroups = {};
  for (const r of radios) {
    const name = r.name || 'unnamed_' + radios.indexOf(r);
    radioGroups[name] = radioGroups[name] || [];
    radioGroups[name].push(r);
  }

  for (const group of Object.values(radioGroups)) {
    const groupText = (
      group[0].closest('fieldset')?.textContent ||
      group[0].closest('[role="group"], [class*="question" i], [class*="field" i]')?.textContent ||
      ''
    ).trim();

    let pick = null;
    if (/notice\s*period|join/i.test(groupText)) {
      pick = group.find((r) => /immediate|0[-–]15|15\s*days|< ?15/i.test(labelTextOf(r))) || group[0];
    } else if (/relocat|move/i.test(groupText)) {
      pick = group.find((r) => /yes/i.test(labelTextOf(r))) || group[0];
    } else if (/experience/i.test(groupText)) {
      pick = group.find((r) => /0|fresher|entry|< ?1/i.test(labelTextOf(r))) || group[0];
    } else {
      pick = group.find((r) => /yes/i.test(labelTextOf(r))) || group[0];
    }

    if (pick && !pick.checked) {
      pick.click();
      await sleep(200);
    }
  }

  // 2. Text / Number inputs
  const inputs = [...container.querySelectorAll('input[type="text"], input[type="number"], textarea')].filter(visible);
  for (const inp of inputs) {
    if (inp.value && inp.value.trim() !== '') continue;
    const label = labelTextOf(inp).toLowerCase();

    let val = '';
    if (/current\s*ctc|current\s*salary/i.test(label))        val = CV.currentCTC  || '0';
    else if (/expected\s*ctc|expected\s*salary/i.test(label)) val = CV.expectedCTC || '4';
    else if (/experience|years/i.test(label))                 val = '0';
    else if (/notice\s*period/i.test(label))                  val = 'Immediate';
    else if (/location|city/i.test(label))                    val = CV.location?.split(',')[0]?.trim() || 'India';
    else                                                       val = await answerQuestion(label);

    if (val) {
      setValue(inp, val);
      await sleep(200);
    }
  }

  // 3. Select dropdowns
  const selects = [...container.querySelectorAll('select')].filter(visible);
  for (const sel of selects) {
    if (sel.value && sel.value !== '0') continue;
    const label = labelTextOf(sel).toLowerCase();
    let opt = null;
    if (/notice/i.test(label)) {
      opt = [...sel.options].find((o) => /immediate|15\s*days|0/i.test(o.text));
    } else if (/experience/i.test(label)) {
      opt = [...sel.options].find((o) => /0|1|fresher/i.test(o.text));
    }
    if (!opt && sel.options.length > 1) opt = sel.options[1];
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
    }
  }

  // 4. Submit / Next button in questionnaire
  await sleep(300);
  const actionBtn = [...container.querySelectorAll('button, [role="button"]')]
    .filter(visible)
    .find((b) => !b.disabled && /save|submit|apply|send|continue|next/i.test(b.textContent.trim()));

  if (actionBtn) {
    actionBtn.scrollIntoView({ block: 'center' });
    await sleep(300);
    actionBtn.click();
    log('  🖱 Clicked questionnaire action button');
    await sleep(2000);
  }
}

/**
 * closeNaukriModal — closes any popup or drawer covering the page.
 */
function closeNaukriModal() {
  const closeBtns = [
    ...document.querySelectorAll(
      '[class*="cross" i], [class*="close" i], button[aria-label*="close" i], ' +
      '.drawer-close, .modal-close, [class*="closeBtn" i]'
    ),
  ].filter(visible);

  if (closeBtns.length) {
    try { closeBtns[0].click(); } catch (_) {}
  }

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}
