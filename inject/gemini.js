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
  `Location: ${CV.location || 'India'} (open to onsite anywhere in India + remote globally)`,
  `Notice Period: ${CV.noticePeriod}`,
  `Expected Salary: ${CV.expectedSalary}`,
  `GitHub: ${CV.github}`,
  `LinkedIn: ${CV.linkedin}`,
  `Portfolio: ${CV.portfolio}`,
  `Key Projects:\n- ${(CV.highlights || []).filter(Boolean).join('\n- ')}`,
].join('\n').trim();

/**
 * geminiAsk — calls Gemini 2.5 Flash with the given prompt.
 * Returns the response text, or null if the key is missing / call fails.
 */
async function geminiAsk(prompt) {
  if (!CONFIG.geminiKey) return null;
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
    log(`Gemini call failed: ${e.message.split('\n')[0]}`);
    return null;
  }
}
