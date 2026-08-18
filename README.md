# 🚀 Wellfound Auto-Apply (v2.0)

> Automated, intelligent job application system for [Wellfound](https://wellfound.com) (formerly AngelList Talent) built with **Playwright**, **Local AI (Ollama)**, and **Google Gemini**.

[![Repository](https://img.shields.io/badge/GitHub-Satyam--xD%2FWellfound--Apply-blue?style=flat&logo=github)](https://github.com/Satyam-xD/Wellfound-Apply)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat&logo=node.js)](https://nodejs.org)
[![Playwright](https://img.shields.io/badge/Playwright-Automation-orange?style=flat&logo=playwright)](https://playwright.dev)
[![License: ISC](https://img.shields.io/badge/License-ISC-purple.svg)](https://opensource.org/licenses/ISC)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Requirements](#-requirements)
- [Getting Started](#-getting-started)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. One-Time Login](#3-one-time-login)
  - [4. Dry Run Mode](#4-dry-run-mode)
  - [5. Live Mode](#5-live-mode)
- [CLI & Script Reference](#-cli--script-reference)
- [Customization Guide](#-customization-guide)
- [Automated Scheduling (Task Scheduler)](#-automated-scheduling-task-scheduler)
- [Troubleshooting & FAQ](#-troubleshooting--faq)
- [Disclaimer](#-disclaimer)

---

## 🌟 Overview

**Wellfound Auto-Apply** streamlines and automates the process of finding and applying to matching software engineering jobs on Wellfound:

1. Launches a stealth Chrome session reusing your saved login.
2. Traverses role-specific and location-based `/jobs` feeds.
3. Filters opportunities based on tech stack, experience requirements, and blocklists.
4. Generates personalized cover letters tailored to the target company and role.
5. Resolves open-ended questions using **Local Ollama** (with fallback to **Google Gemini 2.5 Flash**).
6. Fills all form inputs, dropdowns, and checkboxes.
7. Tracks all submitted applications in `applications.csv` while strictly adhering to a configurable daily cap (default: 50/day).

---

## ✨ Key Features

- 🎯 **Smart Feed & Role Filtering**:
  - Matches candidate keywords (Frontend, Backend, Full Stack, MERN, React, Node.js, AI/GenAI, SDE).
  - Skips senior, lead, and manager positions automatically via title blocklists.
  - Detects experience mismatch criteria (e.g., `2+ years`, `3-5 years`) to avoid rejected applications.
  - Automatically skips listings posted more than 14 days ago and previously applied jobs.

- 🧠 **Dual AI Question Answering**:
  - **Local Ollama** support (100% free, local privacy, e.g. `llama3`) for open-ended questions.
  - **Google Gemini 2.5 Flash** fallback when Ollama is offline.
  - Built-in **Factual Q&A Bank** for instant matching (CTC, notice period, relocation, work authorization, social links).

- ✍️ **Dynamic Personalized Cover Letters**:
  - Generates tailored cover letters on the fly using candidate highlights, specific company names, and applied roles.

- 🛡️ **Anti-Bot & Humanized Automation**:
  - Uses `playwright-extra` and `puppeteer-extra-plugin-stealth`.
  - Coordinate-based trusted CDP mouse clicks with accessibility-tree fallbacks.
  - Human-paced randomized delays (60–150s between applications) to protect your account.

- 🔄 **Multi-Search Feed Rotation**:
  - Cycles through targeted role feeds and geographic search URLs (Remote, Bangalore, Delhi, Hyderabad, Pune, etc.) when a feed runs dry or reaches idle limits.

- 📴 **Offscreen Execution**:
  - Optional `--offscreen` mode to run Chrome without stealing your desktop focus.

- 📊 **Tracking & Safety Caps**:
  - Enforces a safe daily cap (default 50/day) tracked in `apply-state-wellfound.json`.
  - Logs all submitted applications with details (Role, Company, Salary, JD, URL) to `applications.csv`.
  - Default **DRY RUN** mode fills forms without submitting so you can preview everything safely.

---

## 📁 Architecture

The project follows a clean separation of concerns between Node.js supervisor (`runner/`) and in-browser evaluation (`inject/`):

```text
├── index.js                     # Main CLI entry point & workflow orchestrator
├── config.js                    # Zero-dependency .env loader & profile builder
├── .env.example                 # Template for candidate profile & credentials
├── runner/                      # Playwright-side automation & orchestration
│   ├── auth.js                  # Session verification & login detection
│   ├── browser.js               # Chrome profile launcher & stealth setup
│   ├── csv-logger.js            # Appends application data to applications.csv
│   ├── daily-state.js           # Enforces & persists daily application limits
│   ├── script-builder.js        # Compiles inject modules into single secure payload
│   ├── sites.js                 # Search feeds, URLs, and site configuration registry
│   └── supervisor.js            # Feed navigation, CDP click relay & cycle watcher
└── inject/                      # In-page browser evaluation scripts
    ├── utils.js                 # DOM helpers, delay timers, and string cleaners
    ├── gemini.js                # AI integration (Ollama / Gemini API calls)
    ├── answers.js               # Cover letter generator & regex Q&A dictionary
    ├── finder.js                # Feed scraper, card parser & keyword filtering
    ├── apply.js                 # Modal form filler (inputs, radios, selects, relocation)
    └── loop.js                  # Main iteration loop over matching jobs
```

---

## 🛠️ Requirements

- **Node.js** 18.0 or higher
- **Google Chrome** installed
- A **Wellfound account** with your profile, contact information, and resume uploaded

---

## 🚀 Getting Started

### 1. Clone Repository

```powershell
git clone https://github.com/Satyam-xD/Wellfound-Apply.git
cd Wellfound-Apply
npm install
```

### 2. Environment Configuration

Copy [.env.example](file:///d:/well/.env.example) to `.env`:

```powershell
copy .env.example .env
```

Open `.env` and fill in your details:

```env
# Personal Info
NAME="Your Name"
EMAIL="your.email@example.com"
PHONE="+91-XXXXXXXXXX"
LOCATION="Your City, India"
CURRENT_ROLE="Software Engineer"
COMPANY="Your Current/Past Company"
EDUCATION="B.Tech in Computer Science"
YEARS_EXPERIENCE="1 year"

# Technical Profile
SKILLS="JavaScript, TypeScript, React, Next.js, Node.js, Express, Python, PostgreSQL, Docker"
HIGHLIGHTS="Built scalable full-stack applications||Engineered high-performance React frontends||Automated backend pipelines and APIs"

# Application Answers & Compensation
NOTICE_PERIOD="Immediate / 15 days"
CURRENT_CTC="6"
EXPECTED_CTC="12-15"
DOB="2000-01-01"
GENDER="Male"
WORK_AUTH="Authorized to work in country of residence"

# Links & Portfolio
GITHUB_URL="https://github.com/yourusername"
LINKEDIN_URL="https://linkedin.com/in/yourusername"
PORTFOLIO_URL="https://yourportfolio.com"

# AI Fallback (Optional)
OLLAMA_MODEL="llama3"
GEMINI_KEY="your_gemini_api_key_here"
```

> 🔒 **Security Notice**: `.env`, browser profile cookies, and generated CSVs are automatically ignored by `.gitignore` to protect your privacy.

### 3. One-Time Login

Launch Chrome once to log in and save your session cookies:

```powershell
node index.js wellfound login
# or
npm run login
```

1. Chrome opens on `https://wellfound.com/login`.
2. Sign in to your Wellfound account.
3. Once logged in, close the browser window.
4. Your session is saved to `.wellfound-chrome-profile/` for all future runs.

### 4. Dry Run Mode

Test the applier safely without submitting any applications:

```powershell
node index.js wellfound
# or
npm run dry
```

Watch the runner fill cover letters and extra questions in real time. In dry run mode, the script does **not** click the final Submit button.

### 5. Live Mode

When ready to submit real applications:

```powershell
node index.js wellfound --live
# or
npm start
```

To run offscreen in the background without stealing window focus:

```powershell
node index.js wellfound --live --offscreen
# or
npm run offscreen
```

---

## 📜 CLI & Script Reference

| Command | NPM Script | Description |
|---|---|---|
| `node index.js wellfound login` | `npm run login` | Opens browser for manual login and saves cookie session |
| `node index.js wellfound` | `npm run dry` | **Dry run**: Fills forms and logs actions without submitting |
| `node index.js wellfound --live` | `npm start` | **Live mode**: Automatically applies and submits applications |
| `node index.js wellfound --live --offscreen` | `npm run offscreen` | Runs live mode offscreen without stealing active window focus |

---

## ⚙️ Customization Guide

### 1. Job Matching & Filtering (`inject/finder.js`)
- `TITLE_KEYWORDS`: List of positive keyword patterns (e.g. `'full stack'`, `'react'`, `'node.js'`, `'intern'`, `'associate'`).
- `TITLE_BLOCKLIST`: List of excluded patterns (e.g. `'senior'`, `'staff'`, `'lead'`, `'manager'`, `'devops'`).
- `titleOk()`: Filters out jobs with `2+ years` experience tags.

### 2. Search Feeds & Limits (`runner/sites.js`)
- `searches`: Array of Wellfound search URLs to rotate through.
- `dailyCap`: Max applications permitted per day (default `50`).

### 3. Answer Bank (`inject/answers.js`)
- `FACTUAL_QA`: Regex rules mapping question labels to candidate answers.
- `coverLetter()`: Template function generating the personalized cover letter text.

---

## ⏰ Automated Scheduling (Task Scheduler)

To run the automation automatically every day on Windows, register a scheduled task via PowerShell:

```powershell
$repo = "D:\well"   # Adjust to your local repository directory
$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "index.js wellfound --live --offscreen" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Daily -At 11:00AM
Register-ScheduledTask -TaskName "WellfoundAutoApply" -Action $action -Trigger $trigger -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries)
```

### Scheduled Task Management:
```powershell
Start-ScheduledTask WellfoundAutoApply       # Trigger task immediately
Disable-ScheduledTask WellfoundAutoApply     # Pause schedule
Enable-ScheduledTask WellfoundAutoApply      # Resume schedule
Unregister-ScheduledTask WellfoundAutoApply  # Remove schedule
```

---

## ❓ Troubleshooting & FAQ

- **Cloudflare / DataDome verification challenge:**
  - Run `node index.js wellfound login`, complete the verification challenge manually in the open window, close the window, and restart the runner.

- **Session expired:**
  - Delete the `.wellfound-chrome-profile/` folder and re-run `node index.js wellfound login`.

- **PowerShell Execution Policy warning on `npm`:**
  - Run directly via `node index.js wellfound ...` or enable scripts via:
    ```powershell
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
    ```

- **Reset daily application count:**
  - Delete `apply-state-wellfound.json` or adjust the count integer inside it.

- **Application skipped:**
  - External redirects (listings directing to Greenhouse, Lever, Workday) or jobs that open full-page without an inline modal are skipped automatically.

---

## ⚠️ Disclaimer

Automating job applications may be subject to Wellfound's Terms of Service. This tool is intended for personal productivity and includes anti-bot protections, humanized delays, and daily limits. Use responsibly and verify with dry run mode before running live.
