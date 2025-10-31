// backend/src/utils/moderation.js

const BLACKLISTED_TERMS = [
  "work from home scam",
  "bitcoin",
  "crypto",
  "get rich quick",
  "wire transfer",
  "western union",
  "adult",
  "xxx",
  "escort",
  "casino",
  "betting",
];

const SUSPICIOUS_DOMAINS = [
  ".bit",
  ".onion",
  "tinyurl.com",
  "bit.ly",
  "goo.gl",
  "t.co",
];

function containsContactInfo(text) {
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const phoneRegex = /(?:\+\d{1,3}[ -]?)?(?:\(?\d{3}\)?[ -]?)?\d{3}[ -]?\d{4}/;
  const whatsappRegex = /whatsapp|wa\.?me|telegram|tg:\/\//i;
  return (
    emailRegex.test(text) || phoneRegex.test(text) || whatsappRegex.test(text)
  );
}

function containsSuspiciousLinks(text) {
  const urlRegex = /https?:\/\/[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:\/?#\[\]@!$&'()*+,;=.]+/gi;
  const matches = text.match(urlRegex) || [];
  if (matches.length === 0) return false;
  return matches.some((u) => SUSPICIOUS_DOMAINS.some((d) => u.includes(d)));
}

function hasCapsOveruse(text) {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 20) return false;
  const caps = (text.match(/[A-Z]/g) || []).length;
  return caps / letters.length > 0.6;
}

function detectBlacklisted(text) {
  const lower = text.toLowerCase();
  return BLACKLISTED_TERMS.filter((t) => lower.includes(t));
}

export function analyzeJobContent(job) {
  const title = String(job.title || "");
  const description = String(job.description || "");
  const responsibilities = String(job.responsibilities || "");
  const requirements = String(job.requirements || "");

  const combined = [title, description, responsibilities, requirements]
    .filter(Boolean)
    .join("\n\n");

  const flags = new Set();

  if (combined.length < 120) flags.add("short_description");
  if (containsSuspiciousLinks(combined)) flags.add("suspicious_link");
  if (containsContactInfo(combined)) flags.add("contact_info");
  if (hasCapsOveruse(combined)) flags.add("caps_overuse");
  const blacklisted = detectBlacklisted(combined);
  if (blacklisted.length) flags.add("blacklisted_term");

  // Heuristic spam score in [0,1]
  let spamScore = 0;
  if (flags.has("short_description")) spamScore += 0.2;
  if (flags.has("suspicious_link")) spamScore += 0.4;
  if (flags.has("contact_info")) spamScore += 0.3;
  if (flags.has("caps_overuse")) spamScore += 0.15;
  if (flags.has("blacklisted_term")) spamScore += 0.4;
  spamScore = Math.min(1, spamScore);

  const autoFlagged = spamScore >= 0.6 || flags.size >= 2;

  return {
    spamScore,
    flags: Array.from(flags),
    autoFlagged,
    lastAnalyzedAt: new Date(),
  };
}

export function shouldResetApprovalOnUpdate(update) {
  const contentFields = [
    "title",
    "description",
    "responsibilities",
    "requirements",
    "skills",
  ];
  return contentFields.some((k) => Object.prototype.hasOwnProperty.call(update, k));
}
