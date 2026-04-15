# Job Alert Bot

Runs every weekday at **8 AM CST** via GitHub Actions. Searches Adzuna for full-stack developer jobs posted in the last 24 hours within 100 miles of Milwaukee, WI — scores each one against your skill profile and emails you a ranked HTML report.

---

## What You Get in Your Inbox

For every fresh job posting:
- **ATS Score (0–100)** — how well the JD matches your skills
- **Matched skills** — what you already have
- **Improvement tips** — what to emphasise in your resume/cover letter for that specific role
- **Apply Now** link

---

## One-Time Setup (15 minutes)

### 1. Get a free Adzuna API key
1. Go to [developer.adzuna.com](https://developer.adzuna.com)
2. Click **Register** — free, no credit card
3. Copy your **App ID** and **App Key**

### 2. Create a Gmail App Password
1. Sign in to your Gmail account
2. Enable 2-Step Verification if not already on: [myaccount.google.com/security](https://myaccount.google.com/security)
3. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Create a new app password — name it "Job Alert Bot"
5. Copy the 16-character password shown (format: `xxxx xxxx xxxx xxxx`)

### 3. Add GitHub Secrets
In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

Add these 5 secrets:

| Secret name | Value |
|---|---|
| `ADZUNA_APP_ID` | Your Adzuna App ID |
| `ADZUNA_APP_KEY` | Your Adzuna App Key |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | The 16-char App Password (no spaces) |
| `TO_EMAIL` | Email to receive alerts (can be same Gmail) |

### 4. Push this repo to GitHub

```bash
git init
git add .
git commit -m "Initial job alert bot"
git remote add origin https://github.com/Ramanabadeti/job-alert-bot.git
git push -u origin main
```

GitHub Actions will automatically activate the daily schedule.

---

## Run Manually

**Trigger from GitHub:** Go to your repo → Actions tab → "Daily Job Alerts" → Run workflow

**Run locally (dry run — no email, saves preview.html):**
```bash
cp .env.example .env   # fill in your credentials
npm install
node search.js --dry-run
open preview.html
```

**Run locally and send real email:**
```bash
node search.js
```

---

## Customise Your Profile

Edit the `CORE_SKILLS` and `BONUS_SKILLS` arrays in `search.js` to match your actual resume as you grow. The ATS score is calculated against these lists.

To change search location or radius, edit `SEARCH_QUERIES` and the `where` / `distance` params in `fetchJobs()`.

---

## Schedule

Runs **Monday–Friday at 8:00 AM CST**. You can also trigger it manually any time from the GitHub Actions tab.
