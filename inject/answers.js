// ============================================================
// ANSWER BANK — maps application questions → CV-backed answers.
// Requires: CV, CV_SUMMARY, geminiAsk (all defined in earlier inject files)
// ============================================================

// ── Cover letter ─────────────────────────────────────────────

/**
 * coverLetter — generates the personalized cover letter from the CV profile template.
 * Fast, instant, and reliable with clean company name.
 */
function coverLetter(company, title) {
  const cleanComp = cleanCompany(company);
  const recipient = cleanComp ? cleanComp + ' team' : 'Hiring Manager';
  const skillsList = (CV.skills || '').split(',').slice(0, 6).map((s) => s.trim()).filter(Boolean).join(', ') || 'modern software engineering';
  const h = CV.highlights || [];

  return (
    `Dear ${recipient},\n\n` +
    `I'd like to apply for the ${title || 'Software Engineer'} position at ${cleanComp || 'your company'}.\n\n` +
    `I'm ${CV.name}, currently ${CV.currentRole || 'a software developer'} with hands-on experience in ` +
    `${skillsList}. ` +
    `A recent highlight: ${h[0] || 'building full-stack features end to end'}.\n\n` +
    `${h[1] ? h[1] + ' ' : ''}` +
    `${h[2] ? h[2] + '.' : ''}\n\n` +
    `I'm excited about this role as it directly aligns with my stack, and I'm eager to contribute immediately with zero ramp-up time.\n\n` +
    `Thank you for your time.\n\n` +
    `Sincerely,\n${CV.name}\n${CV.phone} · ${CV.email}\n${CV.linkedin} · ${CV.github} · ${CV.portfolio}`
  );
}

// ── Factual Q&A bank ─────────────────────────────────────────
// Each entry: [regex to match the question label, answer string]

const FACTUAL_QA = [
  [/primary (programming )?language|favorite (coding )?language|core language|coding language|main language/i,
    'JavaScript, TypeScript, Python'],
  [/technologies|tech stack|skills/i,
    CV.skills || 'JavaScript, TypeScript, React, Node.js, Python'],
  [/company name|current (company|employer)|organi[sz]ation/i,
    CV.company || ''],
  [/years? of (work |professional )?experience|how (long|many years)|total experience/i,
    `I have ${CV.yearsOfExperience || '0-1 years of experience'}. Hands-on with ${(CV.skills || '').split(',').slice(0, 6).join(', ') || 'modern web development'}.`],
  [/notice period|when can you (start|join)|start date|joining/i,
    CV.startDate],
  [/current .{0,15}(ctc|salary|compensation)/i,
    CV.currentSalary || ''],
  [/(expected|desired) .{0,15}(ctc|salary|compensation|pay)|salary expectation/i,
    CV.expectedSalary],
  [/remote|work from home|wfh/i,
    `Yes, I am fully set up for remote work and can collaborate effectively across any timezone.`],
  [/reloc|move to|shift to|based out of|work from (our )?office|on-?site/i,
    `Yes — I am based in India and open to relocating anywhere in India (Bangalore, Delhi, Hyderabad, Mumbai, Pune, Noida). I am also open to remote roles globally.`],
  [/visa|sponsorship|work authorization|legally authorized|right to work|citizen/i,
    CV.workAuth],
  [/where are you (based|located)|current location|city/i,
    `India (Lakhimpur Kheri, UP) — open to relocating anywhere in India or working remotely globally.`],
  [/linkedin/i,          CV.linkedin],
  [/github/i,            CV.github],
  [/portfolio|personal website/i, CV.portfolio],
  [/link/i,              CV.links],
  [/phone|contact number|mobile/i, CV.phone],
  [/e-?mail/i,           CV.email],
  [/your name|full name|\bname\b/i, CV.name],
  [/education|degree|university|college/i, CV.education],
  [/gender/i,            CV.gender || 'Male'],
  [/date of birth|dob|birthday/i, CV.dob],
];

const GENERIC_ANSWER = (() => {
  const hPart = CV.highlights.slice(0, 2).filter(Boolean).join('; ');
  return `I'm ${CV.name}, ${CV.currentRole || 'a software developer'}.` +
    (hPart ? ` Key highlights: ${hPart}.` : '');
})();

/** Regex for open-ended / essay-style questions — best answered by Gemini */
const OPEN_ENDED_RE =
  /why (do you want|are you interested|this role|this company|us|join)|tell (us|me) about yourself|introduce yourself|about you|(biggest|proudest|favorite) (project|achievement)|describe your (experience|background|skills?)|what (can you|do you) bring|strength|weakness|challenge|motivation|passion|goal|career/i;

/**
 * answerQuestion — answers form questions.
 * Known fields are answered instantly from FACTUAL_QA (no API calls).
 * Gemini is ONLY called for open-ended essay-style questions.
 * Short factual unknowns fall back to GENERIC_ANSWER immediately.
 */
async function answerQuestion(questionText) {
  // 1. Check known fields first (instant, 0 API calls)
  for (const [pattern, answer] of FACTUAL_QA) {
    if (pattern.test(questionText)) return answer || '';
  }

  // 2. Only call Gemini for genuinely open-ended / essay questions.
  //    Simple short factual unknowns return GENERIC_ANSWER directly —
  //    this avoids burning API quota and getting bad answers on numeric/select fields.
  if ((CONFIG.geminiKey || CONFIG.ollamaModel) && OPEN_ENDED_RE.test(questionText)) {
    log(`  🤖 Calling Gemini for open-ended question: "${questionText.slice(0, 50)}..."`);
    const ans = await geminiAsk(
      `Answer this job application question on behalf of ${CV.name}.\n` +
      `Question: "${questionText}"\n\n` +
      `Candidate Profile:\n${CV_SUMMARY}\n\n` +
      `Rules: Answer in first person, 2-4 sentences, professional tone, no markdown, no bullet points. Be concise and relevant to the candidate profile.`
    );
    if (ans) return ans;
  }

  return GENERIC_ANSWER;
}
