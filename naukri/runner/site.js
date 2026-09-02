/**
 * naukri/site.js
 * Naukri-specific configuration, search URLs, and route rules.
 */
'use strict';

module.exports = {
  name:       'naukri',
  profile:    '.naukri-chrome-profile',
  loginUrl:   'https://www.naukri.com/nlogin/login',
  profileUrl: 'https://www.naukri.com/mnjuser/profile',
  dailyCap:   50,
  searches: [
    'https://www.naukri.com/software-engineer-jobs?experience=0',
    'https://www.naukri.com/full-stack-developer-jobs?experience=0',
    'https://www.naukri.com/frontend-developer-jobs?experience=0',
    'https://www.naukri.com/backend-developer-jobs?experience=0',
    'https://www.naukri.com/react-js-developer-jobs?experience=0',
    'https://www.naukri.com/node-js-developer-jobs?experience=0',
    'https://www.naukri.com/python-developer-jobs?experience=0',
    'https://www.naukri.com/fresher-software-engineer-jobs',
    'https://www.naukri.com/web-developer-jobs?experience=0',
  ],
  /** Return true for pages where the inject script should run. */
  injectOn: (url) => /naukri\.com/.test(url) && !/naukri\.com\/nlogin/.test(url),
};
