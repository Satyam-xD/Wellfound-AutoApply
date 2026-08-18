// ============================================================
// GEMINI API HELPER
// Requires: CONFIG.geminiKey, CV (both injected by the runner)
// ============================================================

/**
 * CV_SUMMARY — a compact plain-text profile fed to Gemini prompts.
 * Built once at script start from the CV object.
 */
const CV_SUMMARY = [
  `Name: ${CV.name}`,
  `Current Role: ${CV.currentRole}`,
  `Experience: ${CV.yearsOfExperience}`,
  `Skills: ${CV.skills}`,
  `Education: ${CV.education}`,
  `Location: India (open to onsite anywhere in India + remote globally)`,
  `Notice Period: ${CV.noticePeriod}`,
  `Expected Salary: ${CV.expectedSalary}`,
  `GitHub: ${CV.github}`,
  `LinkedIn: ${CV.linkedin}`,
  `Portfolio: ${CV.portfolio}`,
  `Key Projects:\n- ${(CV.highlights || []).filter(Boolean).join('\n- ')}`,
].join('\n').trim();

/**
 * askOllama — queries local Ollama instance on http://127.0.0.1:11434/api/generate.
 * Returns generated string or null if Ollama is not running.
 */
async function askOllama(prompt) {
  const model = CONFIG.ollamaModel || 'llama3';
  try {
    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.response?.trim() || null;
  } catch (e) {
    // Ollama is not running or unreachable — not a fatal error
    log(`⚠ Ollama unreachable (${e.message.split('\n')[0]}) — falling back to Gemini`);
    return null;
  }
}

/**
 * geminiAsk — tries local Ollama first, falls back to Gemini 1.5 Flash.
 */
async function geminiAsk(prompt) {
  // 1. Try local Ollama first (100% free, local, no API limits)
  const ollamaAns = await askOllama(prompt);
  if (ollamaAns) {
    log(`🦙 Answered by local Ollama (${CONFIG.ollamaModel || 'llama3'})`);
    return ollamaAns;
  }

  // 2. Fall back to Gemini 2.5 Flash if API key is present
  if (CONFIG.geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 450 },
          }),
        }
      );
      if (!res.ok) { log(`Gemini HTTP ${res.status}`); return null; }
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (e) {
      log('Gemini call failed:', e.message);
      return null;
    }
  }

  return null;
}
