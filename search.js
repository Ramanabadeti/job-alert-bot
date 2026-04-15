/**
 * Daily Job Alert Bot
 * Searches Adzuna for fresh full-stack dev jobs near Milwaukee (100 mi radius),
 * scores each against the candidate profile, and emails a ranked HTML report.
 *
 * Run: node search.js
 * Dry run (no email): node search.js --dry-run
 */

import fetch from 'node-fetch';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Candidate profile ─────────────────────────────────────────────────────────
// These are the skills extracted from your actual projects.
// Edit this list as you learn new technologies.

const CORE_SKILLS = [
  'react', 'node', 'node.js', 'nodejs', 'javascript', 'express',
  'rest api', 'restful', 'api', 'sql', 'sqlite', 'database',
  'jwt', 'authentication', 'auth', 'git', 'html', 'css',
  'full stack', 'fullstack', 'full-stack', 'web development',
  'frontend', 'backend', 'vite', 'npm'
];

const BONUS_SKILLS = [
  'typescript', 'python', 'mongodb', 'postgresql', 'postgres', 'mysql',
  'redis', 'docker', 'aws', 'azure', 'gcp', 'graphql', 'next.js', 'nextjs',
  'tailwind', 'tailwindcss', 'redux', 'socket.io', 'websocket', 'real-time',
  'ai', 'llm', 'openai', 'anthropic', 'claude', 'machine learning',
  'ci/cd', 'github actions', 'agile', 'scrum', 'recharts', 'd3', 'charts',
  'linux', 'bash', 'jest', 'testing', 'unit test', 'react native', 'mobile'
];

const SEARCH_QUERIES = [
  'full stack developer react node',
  'software engineer javascript react',
  'frontend developer react',
  'backend developer node.js',
  'web developer javascript'
];

// ── Adzuna job search ─────────────────────────────────────────────────────────
async function fetchJobs(query) {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID,
    app_key: process.env.ADZUNA_APP_KEY,
    what: query,
    where: 'Milwaukee, WI',
    distance: '100',
    max_days_old: '1',
    results_per_page: '20',
    sort_by: 'date'
  });

  const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    throw new Error(`Adzuna error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.results || [];
}

async function searchAllJobs() {
  const seen = new Set();
  const jobs = [];

  for (const query of SEARCH_QUERIES) {
    try {
      const results = await fetchJobs(query);
      for (const job of results) {
        if (!seen.has(job.id)) {
          seen.add(job.id);
          jobs.push(job);
        }
      }
      // Respect API rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`Search failed for "${query}": ${err.message}`);
    }
  }

  return jobs;
}

// ── ATS scoring ───────────────────────────────────────────────────────────────
function scoreJob(job) {
  const text = `${job.title} ${job.description ?? ''}`.toLowerCase();

  const matchedCore  = CORE_SKILLS.filter(s => text.includes(s));
  const missingCore  = CORE_SKILLS.filter(s => !text.includes(s));
  const matchedBonus = BONUS_SKILLS.filter(s => text.includes(s));

  // 70% from core skills, 30% from bonus skills (capped at 5 bonus matches)
  const coreScore  = Math.round((matchedCore.length / CORE_SKILLS.length) * 70);
  const bonusScore = Math.min(matchedBonus.length * 6, 30);
  const total      = coreScore + bonusScore;

  // Prioritise missing CORE skills that actually appear in this JD
  // (i.e. skills the job wants that you haven't highlighted)
  const improvementTips = [];

  // Top 3 core skills the JD mentions that aren't matched
  const jdWantsMissing = missingCore
    .filter(s => text.includes(s.split(' ')[0])) // partial word match as fallback
    .slice(0, 3);

  if (jdWantsMissing.length) {
    jdWantsMissing.forEach(s =>
      improvementTips.push(`Mention "${s}" explicitly in your resume summary or cover letter`)
    );
  }

  // Bonus skills the JD values — emphasise them
  matchedBonus.slice(0, 2).forEach(s =>
    improvementTips.push(`Highlight your "${s}" experience — JD specifically mentions it`)
  );

  if (!improvementTips.length) {
    improvementTips.push('Strong match — apply with your current resume');
  }

  const rating =
    total >= 75 ? '🟢 Strong Match' :
    total >= 50 ? '🟡 Good Match'   :
                  '🔴 Partial Match';

  return { score: total, rating, matchedCore, matchedBonus, improvementTips };
}

// ── Email builder ─────────────────────────────────────────────────────────────
function buildEmail(jobs) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Chicago'
  });

  const scored = jobs
    .map(job => ({ job, ats: scoreJob(job) }))
    .sort((a, b) => b.ats.score - a.ats.score);

  const strong = scored.filter(x => x.ats.score >= 75).length;
  const good   = scored.filter(x => x.ats.score >= 50 && x.ats.score < 75).length;

  let html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#1a1a1a;">

<h1 style="font-size:22px;margin-bottom:4px;">📋 Daily Job Alerts</h1>
<p style="color:#555;margin-top:0;">${today} · Milwaukee, WI + 100-mile radius · Posted last 24 hours</p>

<div style="display:flex;gap:12px;margin:16px 0;">
  <div style="background:#dcfce7;padding:10px 16px;border-radius:8px;text-align:center;">
    <div style="font-size:24px;font-weight:700;">${strong}</div>
    <div style="font-size:12px;color:#166534;">Strong Match</div>
  </div>
  <div style="background:#fef9c3;padding:10px 16px;border-radius:8px;text-align:center;">
    <div style="font-size:24px;font-weight:700;">${good}</div>
    <div style="font-size:12px;color:#854d0e;">Good Match</div>
  </div>
  <div style="background:#f0f0f0;padding:10px 16px;border-radius:8px;text-align:center;">
    <div style="font-size:24px;font-weight:700;">${scored.length}</div>
    <div style="font-size:12px;color:#555;">Total Found</div>
  </div>
</div>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
`;

  for (const { job, ats } of scored) {
    const company  = job.company?.display_name ?? 'Company N/A';
    const location = job.location?.display_name ?? 'Location N/A';
    const salary   = job.salary_min
      ? `$${Math.round(job.salary_min / 1000)}k – $${Math.round((job.salary_max || job.salary_min) / 1000)}k/yr`
      : 'Salary not listed';

    const barColor =
      ats.score >= 75 ? '#22c55e' :
      ats.score >= 50 ? '#eab308' :
                        '#ef4444';

    const allMatched = [...new Set([...ats.matchedCore, ...ats.matchedBonus])];

    html += `
<div style="margin-bottom:20px;padding:16px;border:1px solid #e5e7eb;border-radius:10px;border-left:4px solid ${barColor};">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <h2 style="font-size:16px;margin:0 0 2px;">${job.title}</h2>
        <p style="margin:0;color:#6b7280;font-size:14px;">${company} &nbsp;·&nbsp; ${location} &nbsp;·&nbsp; ${salary}</p>
      </td>
      <td style="text-align:right;white-space:nowrap;">
        <span style="font-size:26px;font-weight:700;color:${barColor};">${ats.score}</span>
        <span style="font-size:12px;color:#6b7280;">/100</span>
        <br/>
        <span style="font-size:12px;">${ats.rating}</span>
      </td>
    </tr>
  </table>

  <div style="margin:10px 0 4px;">
    <strong style="font-size:13px;">✅ Matched skills:</strong>
    <span style="font-size:13px;color:#374151;">
      ${allMatched.length ? allMatched.join(', ') : 'none detected'}
    </span>
  </div>

  <div style="margin:6px 0;">
    <strong style="font-size:13px;">💡 To boost your chances:</strong>
    <ul style="margin:4px 0;padding-left:20px;font-size:13px;color:#374151;">
      ${ats.improvementTips.map(tip => `<li style="margin-bottom:2px;">${tip}</li>`).join('')}
    </ul>
  </div>

  <a href="${job.redirect_url}"
     style="display:inline-block;margin-top:8px;padding:8px 18px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">
    Apply Now →
  </a>
</div>
`;
  }

  html += `
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
<p style="font-size:12px;color:#9ca3af;">
  Automated daily alert for Raman Abadeti · Powered by Adzuna API ·
  Milwaukee, WI + 100 miles · Full-stack / Software Engineer roles
</p>
</body>
</html>`;

  return {
    subject: `[Job Alert] ${scored.length} fresh dev jobs near Milwaukee — ${scored.filter(x => x.ats.score >= 75).length} strong matches`,
    html
  };
}

// ── Email sender ──────────────────────────────────────────────────────────────
async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const info = await transporter.sendMail({
    from: `Job Alert Bot <${process.env.GMAIL_USER}>`,
    to: process.env.TO_EMAIL,
    subject,
    html
  });

  console.log(`Email sent → ${info.messageId}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🔍 Searching jobs near Milwaukee (100 mi) posted in the last 24 h...`);

  const jobs = await searchAllJobs();
  console.log(`Found ${jobs.length} unique jobs across ${SEARCH_QUERIES.length} queries.`);

  if (jobs.length === 0) {
    console.log('No jobs found today — skipping email.');
    return;
  }

  const { subject, html } = buildEmail(jobs);
  console.log(`Subject: ${subject}`);

  if (DRY_RUN) {
    console.log('Dry run — email not sent. HTML written to preview.html');
    const { writeFileSync } = await import('fs');
    writeFileSync('preview.html', html);
    return;
  }

  await sendEmail(subject, html);
  console.log('✅ Done!');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
