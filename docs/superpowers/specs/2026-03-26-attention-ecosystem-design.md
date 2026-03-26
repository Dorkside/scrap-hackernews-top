# The Attention Ecosystem — HN Front Page Analysis

## Context

This repo (`scrap-hackernews-top`) has been collecting hourly snapshots of the HN top 30 stories since Dec 30, 2024 — ~10,700 Markdown files, ~321,000 story-slot records. The data exists but nobody has done anything with it. This is a curiosity-driven exploration treating the HN front page as an attention ecosystem: 30 ecological niches where stories compete for survival.

**Goal:** Build an analysis pipeline that parses the full dataset, computes five ecosystem-inspired metrics, and outputs a self-contained HTML report with charts and plain-English findings.

**Constraints:** Pure Node.js, no new runtime dependencies. Charts rendered as inline SVG. Everything runs locally with `npm run analyze`.

---

## Architecture

```
data/*.md  →  [Parser]  →  timeline[]  →  [Analyzers]  →  metrics{}  →  [Reporter]  →  report.html
```

Three files:
- `src/parse.js` — Parse all .md files into a normalized timeline
- `src/analyze.js` — Entry point, orchestrates parsing + analysis + report
- `src/report.js` — Generate self-contained HTML report

### Stage 1: Parse & Normalize (`src/parse.js`)

**Input:** All `data/hn-top-*.md` files

**Parsing logic:**
- Filename → timestamp (parse ISO from filename, e.g. `2024-12-30T09-39-55-230Z`)
- Regex each story block:
  ```
  /^(\d+)\. \[(.+?)\]\((.+?)\)\n\s+- Points: (\S+)\n\s+- Comments: (\S+)\n\s+- Posted by: (.+)$/gm
  ```
  Note: Points and Comments use `(\S+)` not `(\d+)` because real data contains `undefined` values on jobs/new stories. Parse with `parseInt(val) || 0`.

- Domain extraction: Check URL validity before calling `new URL()`:
  ```js
  function extractDomain(url) {
    if (!url || url === 'undefined') return 'news.ycombinator.com';
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return 'unknown'; }
  }
  ```

**Output:** Array of records, sorted by timestamp:
```js
{
  timestamp: Date,
  rank: number,      // 1-30
  title: string,
  url: string,       // may be "undefined" for Ask HN etc.
  domain: string,    // e.g. "github.com" or "news.ycombinator.com"
  points: number,
  comments: number,
  author: string,
  storyId: string    // identity key (see below)
}
```

**Story identity:** URL is the primary key for stories with valid URLs. For stories where `url === "undefined"`, use `title + '|' + author` as a fallback identity key. This prevents all Ask HN / Tell HN / job posts from collapsing into one "immortal" story. Normalize URLs by stripping trailing slashes and `www.` prefix.

**I/O strategy:** Read files in batches of 100 using `Promise.all` to avoid fd exhaustion while maintaining good throughput. Log progress every 1,000 files.

**Edge cases:**
- Stories with `undefined` URLs → keep in dataset, domain = "news.ycombinator.com", use title+author identity
- Stories with `undefined` Points/Comments → parse as 0
- Malformed files → skip with warning, don't crash
- Missing snapshots (scraper downtime) → handled in analysis stage (see survival curves)

### Stage 2: Ecosystem Analyses

Each analysis is a pure function: `timeline[] → { data, findings[] }` where `findings` are plain-English strings summarizing what was discovered.

#### Analysis 1: Story Survival Curves

Track each unique story (by `storyId`) across consecutive snapshots. A story "appears" when first seen and "dies" when absent from two consecutive snapshots (to handle brief ranking fluctuations).

**Handling gaps:** Before applying the two-miss rule, detect gaps in the snapshot timeline (>90 min between consecutive timestamps). If a gap spans the two "misses," don't count it as death — the story may have survived through the gap. Only count deaths where both misses occur during continuous coverage.

Compute:
- Median survival time (hours on front page)
- Survival distribution (histogram: what % of stories last 1h, 2h, 3h, ... 48h+)
- Top 10 longest-surviving stories ever
- Survival by domain (do github.com stories last longer than blog posts?)

**Chart:** Survival curve (x = hours, y = % of stories still on front page)

#### Analysis 2: Carrying Capacity

For each snapshot, count stories per domain. Across all snapshots, find:
- Max concurrent stories per domain (the "carrying capacity")
- How often domains hit their max
- Which domains most frequently have 2+ stories simultaneously
- Does having multiple stories from one domain accelerate or slow their individual decay?

**Chart:** Bar chart of top 15 domains by max concurrent stories, with median concurrent as a secondary bar

#### Analysis 3: Displacement Patterns

When a new story enters the top 10 with >200 points (a "predator"):
- What story was at rank 30 right before (the displaced)?
- Does the displaced story's domain matter?
- Do high-point stories preferentially displace low-point stories, or is it pure rank-based?
- "Kill radius": how many stories drop out within 2 hours of a mega-story appearing?

**Chart:** Scatter plot of predator points vs. number of stories displaced within 2 hours

#### Analysis 4: Biodiversity Index

Shannon entropy of domains per snapshot: `H = -Σ(p_i × log2(p_i))` where `p_i` is the fraction of stories from domain `i`.

Compute:
- Entropy time series (one value per snapshot)
- Daily average entropy (smoother curve)
- Lowest-entropy moments (most monolithic front pages)
- Highest-entropy moments (most diverse)
- Weekday vs. weekend entropy
- Does entropy correlate with time of day?

**Chart:** Time series of daily average entropy, with notable low/high points annotated

#### Analysis 5: The HN Clock

Aggregate across all days to find hourly patterns:
- Average story turnover per hour (what % of stories change between consecutive snapshots)
- Are there "quiet hours" where the front page barely changes?
- Peak churn hours
- Weekend vs. weekday rhythms
- Is there a "Monday morning reset" effect?

**Chart:** Grouped bar chart — 24 bars (one per UTC hour), each split into weekday vs. weekend turnover rate. Simpler and more readable than a radial chart, no polar coordinate math needed.

### Stage 3: HTML Report (`src/report.js`)

Self-contained HTML file with:
1. **Header**: "The Attention Ecosystem: 15 Months of Hacker News" + dataset stats
2. **Surprising Findings**: 5-7 bullet points pulling the most unexpected results from all analyses
3. **Five sections**: One per analysis, each with:
   - Section title + one-sentence summary
   - Inline SVG chart
   - Key metrics in a small data table
   - 2-3 sentence interpretation
4. **Methodology note**: Brief description of data source, parsing, and identity resolution

**SVG Charts:** Generated programmatically in Node.js as SVG strings. No charting library — line charts, bar charts, and scatter plots are straightforward to build with SVG `<line>`, `<rect>`, `<circle>`, and `<text>` elements via template literals.

**Styling:** Clean, minimal CSS. Dark background, monospace feel — HN-appropriate aesthetic.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/parse.js` | Create | Data parser module |
| `src/analyze.js` | Create | Main entry point + five analysis functions |
| `src/report.js` | Create | HTML report generator with inline SVG charts |
| `package.json` | Modify | Add `"analyze": "node src/analyze.js"` script |

No modifications to `src/index.js` (the existing scraper).

---

## Verification

1. **Parse validation:** Run parser on full dataset, log count of records parsed, files skipped, stories with undefined URLs. Expect ~320,000+ records from ~10,700 files. Verify undefined-URL stories are present (not silently dropped).
2. **Spot check:** Compare a few parsed records against their source .md files manually.
3. **Analysis smoke test:** Each analysis function should produce non-empty data and at least one finding string.
4. **Report output:** Open `report.html` in browser, verify all 5 sections render with charts and readable findings.
5. **Performance:** Full pipeline should complete in under 60 seconds on the ~10.7K file dataset.

Run with: `npm run analyze`
