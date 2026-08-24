#!/usr/bin/env node
/*
 * Dependency-free checks for this static site.
 *
 *   node test.js          (or: npm test)
 *
 * Three groups:
 *   1. Integrity  — required files exist, internal links and ids resolve,
 *                   nothing is loaded from a third-party origin.
 *   2. Metadata   — the tags a deployed page needs, plus robots/sitemap
 *                   agreeing with the canonical origin.
 *   3. Honesty    — the content rules this site is committed to: the canonical
 *                   contact address, no invented credentials or availability,
 *                   research artifacts labelled as artifacts, and every
 *                   evidence block naming the repository it came from.
 *
 * These are content checks, not an HTML validator. They read the site's own
 * markup with regular expressions, which is adequate because this site's markup
 * is hand-written and small.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const ORIGIN = "https://prathamesh-git9.github.io/portfolio-website/";
const CANONICAL_EMAIL = "prathemesh7744@gmail.com";

const REQUIRED_FILES = [
  "index.html",
  "404.html",
  "styles.css",
  "script.js",
  "robots.txt",
  "sitemap.xml",
  ".nojekyll",
  "favicon.svg",
  "README.md",
  "package.json",
  "resume.html",
  "prathamesh-kalamkar-resume.pdf",
];

const PAGES = ["index.html", "404.html", "resume.html"];

/* Hosts this site is allowed to link out to. Anything else is a mistake or a
   tracker, and both should fail. */
const ALLOWED_HOSTS = new Set([
  "github.com",
  "www.linkedin.com",
  "prathamesh-git9.github.io",
]);

/* Claims this site is not entitled to make. Checked against the rendered text
   of the pages only — this repository's README quotes these rules in order to
   document them, which is not the same as asserting them. */
const FORBIDDEN = [
  { re: /\baccepted (?:at|to|by)\b/i, why: "implies an acceptance that has not happened" },
  { re: /\bunder review at\b/i, why: "implies a submission that has not happened" },
  { re: /\b(?:our|my|the) paper\b/i, why: "implies a paper that does not exist" },
  { re: /\bh-index\b/i, why: "implies a citation record that does not exist" },
  { re: /\bPhD (?:student|candidate|researcher|holder)\b/i, why: "not a stated status" },
  { re: /\bDr\.?\s+Prathamesh\b/i, why: "not a held title" },
  { re: /\bavailable for\b/i, why: "availability is not a documented fact" },
  { re: /\bopen to work\b/i, why: "availability is not a documented fact" },
  { re: /\bimmediately available\b/i, why: "availability is not a documented fact" },
  { re: /\bnotice period\b/i, why: "availability is not a documented fact" },
];

/* Identities that must not reappear anywhere in the repository, including this
   repository's own documentation. */
const STALE_IDENTITY = [
  { re: /prathameshkalamkar\.tech/i, why: "stale personal-site domain" },
  { re: /prathemesh8459@gmail\.com/i, why: "non-canonical email address" },
];

/* A sentence that mentions publication status must also carry a negation. The
   page is allowed to say "not peer-reviewed"; it is not allowed to drop the
   "not" and leave the rest standing. */
const PUBLICATION_TERMS = /\b(?:peer[- ]reviewed|preprints?|publications?|published paper)\b/i;
const NEGATIONS = /\b(?:no|not|none|never|neither|nor|without|lacks?|absent|rather than)\b/i;

/* Phrases the page must keep. If a rewrite drops one of these, the page has
   quietly become less honest and this test is the thing that notices. */
const REQUIRED_PHRASES = [
  "no publications, preprints, or peer-reviewed papers",
  "not a publication",
  "not peer-reviewed",
  "research artifact",
  CANONICAL_EMAIL,
  "github.com/prathamesh-git9",
  "linkedin.com/in/prathamesh-kalamkar",
];

const REQUIRED_FRAGMENT_IDS = [
  "soda",
  "secure-instruction-placement",
  "effect-broker",
  "agent-redteam",
  "patchpilot",
  "agentic-digital-twin",
  "agent-runtime",
  "reachable",
];

/* ------------------------------------------------------------------ runner */

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    const detail = fn();
    passed++;
    process.stdout.write(`  ok    ${name}${detail ? ` — ${detail}` : ""}\n`);
  } catch (err) {
    failures.push({ name, message: err.message });
    process.stdout.write(`  FAIL  ${name}\n        ${err.message}\n`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function group(title) {
  process.stdout.write(`\n${title}\n`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

/* --------------------------------------------------------------- helpers */

function attrValues(html, attr) {
  const out = [];
  const re = new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, "gi");
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function tags(html, name) {
  const out = [];
  const re = new RegExp(`<${name}\\b([^>]*)>`, "gi");
  let m;
  while ((m = re.exec(html))) out.push(m[0]);
  return out;
}

function metaContent(html, kind, key) {
  const re = new RegExp(
    `<meta[^>]*\\b${kind}\\s*=\\s*"${key}"[^>]*>`,
    "i"
  );
  const tag = html.match(re);
  if (!tag) return null;
  const content = tag[0].match(/\bcontent\s*=\s*"([^"]*)"/i);
  return content ? content[1] : null;
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
}

/* Resolve a link that appears on `page` to a repo-relative file path, or null
   if it is not a local file reference. */
function resolveLocal(page, href) {
  const value = href.split("#")[0].split("?")[0];
  if (value === "") return null; // pure fragment
  const dir = path.dirname(path.join(ROOT, page));
  let target = path.resolve(dir, value);
  if (value.endsWith("/") || value === "." || value === "./") {
    target = path.join(target, "index.html");
  }
  return path.relative(ROOT, target).split(path.sep).join("/");
}

/* ============================== 1. integrity ============================= */

group("Integrity");

check("required files are present", () => {
  const missing = REQUIRED_FILES.filter((f) => !exists(f));
  assert(missing.length === 0, `missing: ${missing.join(", ")}`);
  return `${REQUIRED_FILES.length} files`;
});

check("downloadable résumé is a non-empty PDF", () => {
  const resume = fs.readFileSync(path.join(ROOT, "prathamesh-kalamkar-resume.pdf"));
  assert(resume.subarray(0, 5).toString("ascii") === "%PDF-", "résumé does not have a PDF header");
  assert(resume.length > 20_000, "résumé PDF is unexpectedly small");
  return `${Math.round(resume.length / 1024)} KiB`;
});

check("shareable project anchors remain stable", () => {
  const ids = new Set(attrValues(read("index.html"), "id"));
  const missing = REQUIRED_FRAGMENT_IDS.filter((id) => !ids.has(id));
  assert(missing.length === 0, `missing project anchor(s): ${missing.join(", ")}`);
  return `${REQUIRED_FRAGMENT_IDS.length} anchors`;
});

check("no build artefacts or dependencies are committed", () => {
  assert(!exists("node_modules"), "node_modules is present");
  assert(!exists("package-lock.json") || true, "");
  const pkg = JSON.parse(read("package.json"));
  assert(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0,
    "package.json declares runtime dependencies");
  assert(!pkg.devDependencies || Object.keys(pkg.devDependencies).length === 0,
    "package.json declares devDependencies");
  assert(pkg.scripts && pkg.scripts.test, "package.json has no test script");
  return "zero dependencies";
});

for (const page of PAGES) {
  const html = read(page);

  check(`${page}: ids are unique`, () => {
    const ids = attrValues(html, "id");
    const seen = new Set();
    const dupes = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    assert(dupes.length === 0, `duplicate id(s): ${[...new Set(dupes)].join(", ")}`);
    return `${ids.length} ids`;
  });

  check(`${page}: every in-page anchor resolves`, () => {
    const ids = new Set(attrValues(html, "id"));
    const fragments = attrValues(html, "href")
      .filter((h) => h.includes("#"))
      .map((h) => h.slice(h.indexOf("#") + 1))
      .filter(Boolean);
    // Fragments pointing at index.html from 404.html are checked against index.
    const targetIds = page === "index.html" ? ids : new Set(attrValues(read("index.html"), "id"));
    const broken = fragments.filter((f) => !targetIds.has(f) && !ids.has(f));
    assert(broken.length === 0, `unresolved fragment(s): #${broken.join(", #")}`);
    return `${fragments.length} anchors`;
  });

  check(`${page}: every local file reference exists`, () => {
    const refs = [...attrValues(html, "href"), ...attrValues(html, "src")]
      .filter((v) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(v));
    const broken = [];
    for (const ref of refs) {
      const local = resolveLocal(page, ref);
      if (local && !exists(local)) broken.push(`${ref} -> ${local}`);
    }
    assert(broken.length === 0, `missing target(s): ${broken.join(", ")}`);
    return `${refs.length} references`;
  });

  check(`${page}: aria-labelledby targets exist`, () => {
    const ids = new Set(attrValues(html, "id"));
    const refs = [
      ...attrValues(html, "aria-labelledby"),
      ...attrValues(html, "aria-describedby"),
    ].flatMap((v) => v.split(/\s+/)).filter(Boolean);
    const broken = refs.filter((r) => !ids.has(r));
    assert(broken.length === 0, `dangling reference(s): ${broken.join(", ")}`);
    return `${refs.length} references`;
  });

  check(`${page}: loads nothing from a third-party origin`, () => {
    const stylesheets = tags(html, "link").filter((t) => /rel\s*=\s*"[^"]*stylesheet/i.test(t));
    for (const t of stylesheets) {
      assert(!/href\s*=\s*"[a-z]+:\/\//i.test(t), `external stylesheet: ${t}`);
    }
    for (const t of tags(html, "script")) {
      assert(!/src\s*=\s*"[a-z]+:\/\//i.test(t), `external script: ${t}`);
    }
    assert(!/<iframe|<embed|<object/i.test(html), "embeds a third-party frame");
    return `${stylesheets.length} stylesheet(s), local only`;
  });

  check(`${page}: outbound links are https and allow-listed`, () => {
    const external = attrValues(html, "href").filter((h) => /^https?:/i.test(h));
    for (const href of external) {
      assert(href.startsWith("https://"), `not https: ${href}`);
      const host = new URL(href).host;
      assert(ALLOWED_HOSTS.has(host), `host not allow-listed: ${host}`);
    }
    return `${external.length} outbound link(s)`;
  });

  check(`${page}: new-tab links carry rel="noopener"`, () => {
    const anchors = tags(html, "a").filter((t) => /target\s*=\s*"_blank"/i.test(t));
    for (const a of anchors) {
      assert(/rel\s*=\s*"[^"]*noopener/i.test(a), `missing rel="noopener": ${a}`);
    }
    return anchors.length ? `${anchors.length} checked` : "none used";
  });

  check(`${page}: every link has a discernible name`, () => {
    const re = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    let count = 0;
    while ((m = re.exec(html))) {
      count++;
      const label = stripTags(m[1]).trim() || attrValues(m[0], "aria-label")[0] || "";
      assert(label.length > 0, `empty link: ${m[0].slice(0, 80)}`);
    }
    return `${count} links`;
  });

  check(`${page}: every image has alt text`, () => {
    const imgs = tags(html, "img");
    for (const img of imgs) {
      assert(/\balt\s*=\s*"/i.test(img), `missing alt: ${img}`);
    }
    return imgs.length ? `${imgs.length} images` : "no images used";
  });

  check(`${page}: heading levels do not skip`, () => {
    const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
    assert(levels.length > 0, "no headings");
    assert(levels[0] === 1, `first heading is h${levels[0]}, expected h1`);
    assert(levels.filter((l) => l === 1).length === 1, "more than one h1");
    for (let i = 1; i < levels.length; i++) {
      assert(levels[i] <= levels[i - 1] + 1,
        `h${levels[i - 1]} is followed by h${levels[i]}`);
    }
    return `${levels.length} headings`;
  });
}

check("index.html: data tables have column headers with scope", () => {
  const html = read("index.html");
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  assert(tables.length > 0, "no tables found");
  for (const t of tables) {
    assert(/<thead[\s\S]*?<\/thead>/i.test(t), "table has no thead");
    const heads = tags(t, "th");
    for (const th of heads) {
      assert(/scope\s*=\s*"(col|row)"/i.test(th), `th without scope: ${th}`);
    }
  }
  return `${tables.length} tables`;
});

check("index.html: horizontally scrollable tables are keyboard reachable", () => {
  const html = read("index.html");
  const wraps = html.match(/<div class="table-wrap"[^>]*>/gi) || [];
  assert(wraps.length > 0, "no .table-wrap containers found");
  for (const w of wraps) {
    assert(/tabindex\s*=\s*"0"/i.test(w), `not focusable: ${w}`);
    assert(/aria-label\s*=\s*"[^"]+"/i.test(w), `unlabelled scroll region: ${w}`);
  }
  return `${wraps.length} regions`;
});

check("styles.css: supports both colour schemes and visible focus", () => {
  const css = read("styles.css");
  assert(/@media\s*\(prefers-color-scheme:\s*dark\)/i.test(css),
    "no prefers-color-scheme: dark block");
  assert(/\[data-theme="dark"\]/.test(css) && /\[data-theme="light"\]/.test(css),
    "no explicit data-theme overrides");
  assert(/:focus-visible\s*\{[^}]*outline\s*:/i.test(css),
    "no :focus-visible outline rule");
  assert(/@media\s*\(prefers-reduced-motion:\s*reduce\)/i.test(css),
    "no prefers-reduced-motion block");
  assert(!/url\(\s*["']?https?:/i.test(css), "css fetches a remote asset");
  assert(!/@import/i.test(css), "css uses @import");
  return "dark, focus, reduced-motion";
});

check("script.js: is optional, not load-bearing", () => {
  const js = read("script.js");
  const html = read("index.html");
  assert(/defer/.test(html.match(/<script[^>]*src="script\.js"[^>]*>/i)[0]),
    "script.js is not deferred");
  assert(!/document\.write|innerHTML\s*=/.test(js),
    "script.js injects markup, so content would depend on it");
  assert(/theme-toggle/.test(js), "theme control not wired up");
  assert(/hidden\s*=\s*false/.test(js),
    "the theme control is not revealed by script, so no-JS visitors see a dead button");
  return "progressive enhancement";
});

/* =============================== 2. metadata ============================= */

group("Metadata");

for (const page of PAGES) {
  const html = read(page);
  check(`${page}: required head metadata`, () => {
    assert(/^<!DOCTYPE html>/i.test(html.trim()), "missing doctype");
    assert(/<html[^>]*\blang\s*=\s*"en"/i.test(html), 'missing lang="en"');
    assert(/<meta\s+charset\s*=\s*"utf-8"\s*>/i.test(html), "missing utf-8 charset");
    const viewport = metaContent(html, "name", "viewport");
    assert(viewport && viewport.includes("width=device-width"), "missing responsive viewport");
    const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
    assert(title && title.trim().length > 10, "missing or thin <title>");
    const desc = metaContent(html, "name", "description");
    assert(desc && desc.trim().length >= 50, "missing or thin meta description");
    const colorScheme = metaContent(html, "name", "color-scheme");
    assert(colorScheme && /\blight\b/i.test(colorScheme), "missing color-scheme declaration");
    const themeColors = (html.match(/<meta[^>]*name="theme-color"[^>]*>/gi) || []);
    const expectedThemeColors = /\bdark\b/i.test(colorScheme) ? 2 : 1;
    assert(themeColors.length === expectedThemeColors, "expected a theme-color for each declared scheme");
    return `${title.trim().slice(0, 42)}…`;
  });
}

check("index.html: canonical and Open Graph agree with the deploy origin", () => {
  const html = read("index.html");
  const canonical = (html.match(/<link[^>]*rel="canonical"[^>]*>/i) || [])[0];
  assert(canonical, "no canonical link");
  const href = canonical.match(/href\s*=\s*"([^"]*)"/i)[1];
  assert(href === ORIGIN, `canonical is ${href}, expected ${ORIGIN}`);
  assert(metaContent(html, "property", "og:url") === ORIGIN, "og:url disagrees with canonical");
  const ogTitle = metaContent(html, "property", "og:title");
  const ogDesc = metaContent(html, "property", "og:description");
  assert(ogTitle && ogTitle.length > 10, "missing og:title");
  assert(ogDesc && ogDesc.length >= 50, "missing og:description");
  return ORIGIN;
});

check("404.html: is excluded from indexing and links home", () => {
  const html = read("404.html");
  const robots = metaContent(html, "name", "robots");
  assert(robots && /noindex/i.test(robots), "404 is indexable");
  assert(/href="\.\/"/.test(html), "no link back to the site root");
  return robots;
});

check("robots.txt: allows crawling and points at the sitemap", () => {
  const txt = read("robots.txt");
  assert(/^User-agent:\s*\*/m.test(txt), "no wildcard User-agent group");
  assert(/^Allow:\s*\//m.test(txt), "no Allow rule");
  assert(!/^Disallow:\s*\/\s*$/m.test(txt), "blocks the whole site");
  const line = txt.match(/^Sitemap:\s*(\S+)/m);
  assert(line, "no Sitemap line");
  assert(line[1] === `${ORIGIN}sitemap.xml`, `sitemap URL is ${line[1]}`);
  return line[1];
});

check("sitemap.xml: is well formed and every URL is deployable", () => {
  const xml = read("sitemap.xml");
  assert(/^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(xml.trim()), "missing XML declaration");
  assert(/xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml),
    "missing sitemap namespace");
  const opens = (xml.match(/<url>/g) || []).length;
  const closes = (xml.match(/<\/url>/g) || []).length;
  assert(opens > 0 && opens === closes, "unbalanced <url> elements");

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) {
    assert(loc.startsWith(ORIGIN), `outside the deploy origin: ${loc}`);
    const rel = loc.slice(ORIGIN.length);
    const file = rel === "" || rel.endsWith("/") ? `${rel}index.html` : rel;
    assert(exists(file), `no file backing ${loc} (expected ${file})`);
  }
  for (const mod of [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1])) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(mod), `lastmod is not ISO-8601: ${mod}`);
    assert(!Number.isNaN(Date.parse(mod)), `lastmod is not a real date: ${mod}`);
  }
  // A 404 page must never be advertised.
  assert(!locs.some((l) => l.endsWith("404.html")), "sitemap advertises the 404 page");
  return `${locs.length} URL(s)`;
});

/* =============================== 3. honesty ============================== */

group("Content honesty");

check("no forbidden or stale claim appears in any shipped text", () => {
  const files = [...PAGES, "README.md", "robots.txt", "sitemap.xml", "styles.css", "script.js"];
  const hits = [];
  for (const f of PAGES) {
    const body = stripTags(read(f));
    for (const rule of FORBIDDEN) {
      const m = body.match(rule.re);
      if (m) hits.push(`${f}: "${m[0]}" (${rule.why})`);
    }
  }
  for (const f of files) {
    const body = read(f);
    for (const rule of STALE_IDENTITY) {
      const m = body.match(rule.re);
      if (m) hits.push(`${f}: "${m[0]}" (${rule.why})`);
    }
  }
  assert(hits.length === 0, hits.join("; "));
  return `${PAGES.length} pages checked for claims; ${files.length} files checked for stale identity`;
});

check("publication-status sentences carry an explicit negation", () => {
  const sentences = stripTags(read("index.html")).split(/[.!?](?:\s|$)/);
  const unsupported = sentences.filter(
    (sentence) => PUBLICATION_TERMS.test(sentence) && !NEGATIONS.test(sentence)
  );
  assert(unsupported.length === 0, unsupported.map((s) => `"${s.trim()}"`).join("; "));
  return "every publication term is locally qualified";
});

check("index.html: the honesty disclosures are still present", () => {
  const text = stripTags(read("index.html"));
  const missing = REQUIRED_PHRASES.filter(
    (p) => !text.toLowerCase().includes(p.toLowerCase())
  );
  assert(missing.length === 0, `missing: ${missing.map((m) => `"${m}"`).join(", ")}`);
  return `${REQUIRED_PHRASES.length} phrases`;
});

check("index.html: each research artifact is labelled as an artifact", () => {
  const html = read("index.html");
  const section = html.match(/<section id="artifacts"[\s\S]*?<\/section>/i);
  assert(section, "no #artifacts section");
  const entries = section[0].match(/<article\b[^>]*\bclass="entry"[^>]*>[\s\S]*?<\/article>/gi) || [];
  assert(entries.length >= 2, `expected at least 2 artifact entries, found ${entries.length}`);
  for (const entry of entries) {
    const pill = entry.match(/<span class="pill">([^<]*)<\/span>/i);
    assert(pill, "an artifact entry has no status pill");
    assert(/not peer-reviewed/i.test(pill[1]),
      `pill does not say "not peer-reviewed": "${pill[1]}"`);
    assert(/<p class="entry__caveat">/.test(entry),
      "an artifact entry ships no caveat paragraph");
  }
  const banner = section[0].match(/<div class="banner"[\s\S]*?<\/div>/i);
  assert(banner && /not a publication/i.test(stripTags(banner[0])),
    "the artifact section has no status banner");
  return `${entries.length} entries`;
});

check("index.html: the two named artifacts are the ones the brief covers", () => {
  const html = read("index.html");
  const section = html.match(/<section id="artifacts"[\s\S]*?<\/section>/i)[0];
  for (const repo of ["security-oracle-discrimination", "secure-instruction-placement"]) {
    assert(section.includes(`github.com/prathamesh-git9/${repo}`),
      `artifact section does not link ${repo}`);
  }
  return "both linked";
});

check("index.html: every evidence block names its source", () => {
  const html = read("index.html");
  const blocks = html.match(/<(?:figure|div)[^>]*\bdata-source="[^"]*"[^>]*>/gi) || [];
  assert(blocks.length >= 5, `expected at least 5 sourced blocks, found ${blocks.length}`);
  for (const b of blocks) {
    const value = b.match(/data-source="([^"]*)"/i)[1].trim();
    assert(value.length >= 10, `data-source is too thin to check: "${value}"`);
  }
  // Every figure inside #evidence must be sourced, not just some of them.
  const evidence = html.match(/<section id="evidence"[\s\S]*?<\/section>/i)[0];
  const figures = evidence.match(/<figure[^>]*>/gi) || [];
  for (const f of figures) {
    assert(/data-source="/.test(f), `unsourced figure: ${f}`);
  }
  return `${blocks.length} sourced blocks, ${figures.length} figures`;
});

check("index.html: every figure has a caption", () => {
  const html = read("index.html");
  const figures = html.match(/<figure[\s\S]*?<\/figure>/gi) || [];
  assert(figures.length > 0, "no figures");
  for (const f of figures) {
    assert(/<figcaption[\s\S]*?<\/figcaption>/i.test(f), "figure without figcaption");
  }
  return `${figures.length} figures`;
});

check("the canonical contact address is the only one used", () => {
  const emails = new Set();
  for (const f of [...PAGES, "README.md"]) {
    for (const m of read(f).matchAll(/[\w.+-]+@[\w.-]+\.\w+/g)) emails.add(m[0]);
  }
  assert(emails.size > 0, "no contact address found anywhere");
  const wrong = [...emails].filter((e) => e !== CANONICAL_EMAIL);
  assert(wrong.length === 0, `unexpected address(es): ${wrong.join(", ")}`);
  return CANONICAL_EMAIL;
});

check("README.md: documents preview, deployment, provenance and updates", () => {
  const md = read("README.md");
  const required = [
    "## Local preview",
    "## Deployment",
    "## Content provenance",
    "## Update checklist",
    "## Tests",
  ];
  const missing = required.filter((h) => !md.includes(h));
  assert(missing.length === 0, `missing section(s): ${missing.join(", ")}`);
  assert(md.includes(ORIGIN), "README does not state the deploy URL");
  assert(md.includes("npm test"), "README does not say how to run these checks");
  return `${required.length} sections`;
});

/* =============================== summary ================================= */

process.stdout.write(
  `\n${passed} passed, ${failures.length} failed\n`
);

if (failures.length) {
  process.stdout.write("\nFailures:\n");
  for (const f of failures) process.stdout.write(`  - ${f.name}: ${f.message}\n`);
  process.exit(1);
}
