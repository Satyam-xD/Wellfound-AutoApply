/**
 * runner/sites.js
 * Site configuration registry.
 * Each key is the CLI argument name (e.g. "wellfound").
 * Add new sites here — no changes to index.js needed.
 */
'use strict';

const SITES = {
  wellfound: {
    name:     'wellfound',
    profile:  '.wellfound-chrome-profile',
    loginUrl: 'https://wellfound.com/login',
    searches: [
      // ── Entry-level / 0-experience specific ──
      'https://wellfound.com/jobs?roleSlugs[]=software-engineer&yoe=0',
      'https://wellfound.com/jobs?roleSlugs[]=full-stack-developer&yoe=0',
      'https://wellfound.com/jobs?roleSlugs[]=frontend-developer&yoe=0',
      'https://wellfound.com/jobs?roleSlugs[]=backend-developer&yoe=0',
      'https://wellfound.com/jobs?roleSlugs[]=ai-engineer&yoe=0',
      'https://wellfound.com/jobs?roleSlugs[]=javascript-developer&yoe=0',
      'https://wellfound.com/jobs?roleSlugs[]=react-developer&yoe=0',
      'https://wellfound.com/jobs?roleSlugs[]=nodejs-developer&yoe=0',
      'https://wellfound.com/jobs?remote=true&roleSlugs[]=software-engineer&yoe=0',
      'https://wellfound.com/jobs?locationSlugs[]=india&roleSlugs[]=software-engineer&yoe=0',
      'https://wellfound.com/jobs?locationSlugs[]=bangalore-karnataka-india&roleSlugs[]=software-engineer&yoe=0',
      'https://wellfound.com/jobs?locationSlugs[]=delhi-india&roleSlugs[]=software-engineer&yoe=0',
      'https://wellfound.com/jobs?locationSlugs[]=hyderabad-telangana-india&roleSlugs[]=software-engineer&yoe=0',
      'https://wellfound.com/jobs?locationSlugs[]=pune-maharashtra-india&roleSlugs[]=software-engineer&yoe=0',
      'https://wellfound.com/jobs?locationSlugs[]=noida-uttar-pradesh-india&roleSlugs[]=software-engineer&yoe=0',
      'https://wellfound.com/jobs?remote=true&locationSlugs[]=india&yoe=0',
      // ── Broader fallback (no yoe filter) ──
      'https://wellfound.com/jobs?roleSlugs[]=software-engineer',
      'https://wellfound.com/jobs?roleSlugs[]=full-stack-developer',
      'https://wellfound.com/jobs?roleSlugs[]=frontend-developer',
      'https://wellfound.com/jobs?roleSlugs[]=backend-developer',
      'https://wellfound.com/jobs?roleSlugs[]=ai-engineer',
      'https://wellfound.com/jobs?roleSlugs[]=react-developer',
      'https://wellfound.com/jobs?roleSlugs[]=nodejs-developer',
      'https://wellfound.com/jobs?remote=true&roleSlugs[]=software-engineer',
      'https://wellfound.com/jobs?locationSlugs[]=india&roleSlugs[]=software-engineer',
      'https://wellfound.com/jobs?remote=true&locationSlugs[]=india',
    ],
    /** Return true for pages where the inject script should run. */
    injectOn: (url) => /wellfound\.com/.test(url) && !/wellfound\.com\/login/.test(url),
    dailyCap: 50,
  },
};

module.exports = SITES;
