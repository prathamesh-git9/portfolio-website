# portfolio-website

The static research portfolio for **Prathamesh Kalamkar**, deployed at
<https://prathamesh-git9.github.io/portfolio-website/>.

Plain HTML, CSS and JavaScript. No build step, no package manager at runtime, no
framework, no external fonts, no images, no analytics, no cookies, and no
third-party requests of any kind. The whole site is nine files.

```
index.html      the single content page
404.html        not-found page (relative links, minimal inline fallback styling)
styles.css      the design system: tokens, layout, typography, components
script.js       two progressive enhancements — theme override, contents highlighting
favicon.svg     scheme-aware monogram
robots.txt      crawl policy + sitemap pointer
sitemap.xml     one URL, the canonical origin
.nojekyll       tells GitHub Pages to serve the files as-is
test.js         the checks described below
package.json    only so that `npm test` works; zero dependencies
```

## Local preview

Any static file server works. The site must be served over HTTP rather than
opened as a `file://` URL, because `localStorage` (used by the theme control)
is unavailable on the file protocol in some browsers.

```powershell
# Python, already on most machines
python -m http.server 8000

# or Node, if you would rather not install Python
npx --yes serve . -l 8000
```

Then open <http://127.0.0.1:8000/>.

Nothing needs to be compiled, watched, or installed. Edit a file, reload the
page.

> Note on `404.html` in local preview: it uses relative links so that it works
> both locally and at a one-segment-deep URL on GitHub Pages (the common case).
> A 404 served for a *deeply* nested path will not resolve `styles.css`, which
> is why the page carries a small inline fallback style block.

## Tests

```powershell
npm test          # or: node test.js
```

`test.js` has no dependencies and reads the site's own markup. It checks three
things:

1. **Integrity** — every required file is present; ids are unique; every in-page
   anchor and every local file reference resolves; `aria-labelledby` targets
   exist; heading levels do not skip; no stylesheet, script, or frame is loaded
   from a third-party origin; outbound links are HTTPS and on an allow-list;
   data tables have `scope`d column headers; scrollable table regions are
   keyboard reachable; `styles.css` supports dark mode, visible focus and
   reduced motion; `script.js` stays optional rather than load-bearing.
2. **Metadata** — doctype, `lang`, charset, responsive viewport, a real
   `<title>` and description on both pages; `color-scheme` and a `theme-color`
   per scheme; canonical and Open Graph URLs that agree with the deploy origin;
   `404.html` marked `noindex` and linking home; `robots.txt` allowing crawling
   and naming the sitemap; a well-formed `sitemap.xml` whose every `<loc>` is
   inside the origin and backed by a real file, with ISO-8601 `lastmod`.
3. **Content honesty** — this is the part worth keeping. It fails the build if
   the page starts claiming things it should not:
   - page-level forbidden claim patterns for unsupported acceptance, review,
     academic status, credentials, or employment availability;
   - repository-wide guards against the stale custom domain and non-canonical
     email address;
   - a sentence-level rule requiring publication terms to carry an explicit
     negation;
   - a list of phrases that must *remain* present, including the "no
     publications, preprints, or peer-reviewed papers" disclosure;
   - every entry in the research-artifacts section must carry a status pill
     reading "not peer-reviewed" and a caveat paragraph;
   - every figure in the evidence section must carry a `data-source` attribute
     naming the repository and file the numbers came from, and a `<figcaption>`;
   - the canonical email address must be the only address anywhere in the site
     or this README;
   - this README must keep the sections you are reading.

The forbidden and required lists live at the top of `test.js`. If a future edit
is legitimately allowed to change one — say, a paper genuinely is accepted —
change the rule deliberately in the same commit that changes the claim.

## Deployment

GitHub Pages, from the repository root. There is nothing to build, so no
workflow is required.

1. Push this repository to `https://github.com/prathamesh-git9/portfolio-website`.
2. In **Settings → Pages**, set **Source** to *Deploy from a branch*, and choose
   branch `main`, folder `/ (root)`.
3. Wait for the first deploy, then confirm
   <https://prathamesh-git9.github.io/portfolio-website/> loads and that
   `styles.css`, `script.js` and `favicon.svg` return 200.
4. Confirm a bad path such as `/portfolio-website/nope` renders `404.html`.

`.nojekyll` is committed so that Pages skips Jekyll processing and serves every
file literally.

If the site is ever moved to a different origin — a custom domain, a user page,
or `/` instead of `/portfolio-website/` — three things must change together:
the `<link rel="canonical">` and `og:url` in `index.html`, the `<loc>` in
`sitemap.xml`, the `Sitemap:` line in `robots.txt`, and the `ORIGIN` constant in
`test.js`. The test suite fails until all four agree.

## Content provenance

Factual claims on the page are derived from the repositories or documents listed
below. The prose is a synthesis, while numerical results and status labels are
kept at the precision of their sources.

| Claim on the page | Source |
| --- | --- |
| Framing, the "how I work" principles, the project one-liners in *Also public* | `prathamesh-git9/README.md` (GitHub profile README) |
| Figures 1 and 3 — oracle discrimination, decoy false alarms | `security-oracle-discrimination` — `README.md`, `RESEARCH.md` §4.1 and §4.2 |
| Figure 2 — detection and fix blindness across 140 CVE fix pairs | `security-oracle-discrimination` — `README.md`, `results/PRODUCTION.md` |
| Cross-study callout (ρ = +0.782, 83% agreement, 19/30 cells) | `security-oracle-discrimination` — `RESEARCH.md` §4bis |
| Secure-instruction-placement design, pilots, holdout, 96-run schedule, 3/3 mutation audit, 48 tests | `secure-instruction-placement/README.md` |
| effect-broker crash matrix, safety classes, 68 passed / 11 skipped at `61906b2` | `effect-broker/README.md` |
| agent-redteam oracles, causal proof, authorization gate, 153 passed | `agent-redteam/README.md` |
| PatchPilot behaviour, vendor extensions, Ed25519 manifests, no-execution guarantee | `patchpilot/README.md` |
| Figure 4 and the injection-filter negative result; digital-twin authority gate; 191 tests | `agentic-digital-twin/README.md` |
| Education, roles and dates; Dublin; canonical email; GitHub and LinkedIn URLs | `PhD_2028/PROFILE_INTAKE.md` |

Deliberate omissions, each one a decision rather than an oversight:

- **No publications, preprints, ORCID or Google Scholar.** None exist. The page
  says so in the hero rather than staying quiet about it.
- **`security-oracle-discrimination` and `secure-instruction-placement` are
  labelled research artifacts, not papers.** Both repositories say this
  explicitly; the page repeats it in a banner, in a status pill on each entry,
  and in a caveat paragraph under each entry.
- **The stale custom domain was dropped**, and `test.js` fails if it
  reappears.
- **`prathemesh7744@gmail.com` is the canonical address.** The other address
  that appears in some sources is not used anywhere, and `test.js` enforces
  that.
- **No availability, notice period, salary, visa or immigration statement.**
  None of it is a documented, current fact suitable for a public page.
- **No claim of collaborators, supervisors, referees, or affiliations** beyond
  the two degrees and three roles listed, which come straight from the profile
  intake.
- **Every favourable number is shipped with the caveat its source states** — the
  bootstrap-over-cases note, detection rates as floors, "the corpus is small and
  hand-built", "the eval set and the alias map were written in the same
  sitting". The unflattering measurements (12 of 20 fabrications accepted; 0 of
  10 held-out injections caught) are on the page on purpose.

## Update checklist

Run through this whenever the content changes.

- [ ] Every new number traces to a command output or a file in a linked
      repository — and the caveat that repository states came across with it.
- [ ] A new research item is labelled with its true status. If it is not
      peer-reviewed, the status pill says so.
- [ ] No new claim about publication, acceptance, review, affiliation,
      supervision, credentials, or availability has crept in.
- [ ] Links: new outbound hosts added to `ALLOWED_HOSTS` in `test.js` only if
      they genuinely belong; dead links removed rather than left "for now".
- [ ] `sitemap.xml` `<lastmod>` bumped; the "Last reviewed" date in the
      `index.html` footer bumped to match.
- [ ] Contrast and focus still hold in both light and dark — tab through the
      page once, including the table scroll regions.
- [ ] The page still works with JavaScript disabled: the theme control is
      hidden, and everything else reads normally.
- [ ] `npm test` passes.
- [ ] Reload at 320&nbsp;px, 768&nbsp;px and 1440&nbsp;px; the contents rail
      should switch between the horizontal strip and the sticky left rail
      without clipping.

## Licence

Site content © 2026 Prathamesh Kalamkar. The code in this repository is MIT;
linked repositories retain their own licences and must be checked individually.
