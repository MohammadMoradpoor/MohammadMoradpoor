# Public ranking methodology

The rendered profile uses portfolio-first presentation. Follower rank, the Builder Index, GitRanks, country comparisons, and empty contribution or organization panels are kept out of the image. The snapshot still stores those public figures. `config/presentation.json` can set `mode` to `metrics` when the legacy scoreboard is required. Curated project summaries live in `config/portfolio-projects.json` and are not rewritten from GitHub statistics. ClinMira-AI and nexus-ai are excluded from the showcase.

The profile card separates direct world positions from a transparent activity score.

## Direct world positions

Follower rank is calculated as one plus the number of public GitHub user accounts with more followers. Top project rank is one plus the number of public, non-fork repositories with more stars than the profile's most-starred original repository. Both counts come from GitHub Search at refresh time.

## GitRanks creator rank

The creator panel uses the position, ranked-profile count, top percentage, monthly movement, and indexed star total published on the configured account's [GitRanks ranking page](https://gitranks.com/profile/MohammadMoradpoor/ranks). It does not infer the account's rank by inserting a different star total into a leaderboard.

GitRanks indexes profiles on its own schedule, so its star total can differ from the live GitHub total. The panel labels its indexed stars separately. Its date records when the source was read, not when GitRanks last indexed GitHub. The collector reads the public page through Jina Reader and parses the creator card from its server-rendered data. If the upstream page changes or cannot be read, it retains the prior verified result with a cached label and its original date. Without a prior result, it shows unavailable values.

## Country rank comparisons

The World, India, USA, UK, and China comparisons use the same current owned-star total against the corresponding [GitRanks Stars leaderboards](https://gitranks.com/by/stars/1). Countries are configured in `creatorBenchmarkCountries` in `config/profile.json`.

Each comparison is one plus the number of leaderboard profiles with more stars than this account's public, non-fork, non-archived repositories have in total. These are score insertion benchmarks, not official country positions or residency claims. They remain separate from the creator rank reported on the account's GitRanks profile, which uses GitRanks' own indexed star total.

The collector requests uncached first pages through Jina Reader. It requires consecutive ranks starting at one, valid numeric scores, and an observed score boundary before publishing a position. Displayed scores can refresh before leaderboard ordering, so every higher score on the fetched page is counted. Upstream indexing can lag GitHub. If any comparison cannot be verified, the previous verified set retains its own star total and measurement date with a cached label; without a verified set, comparisons remain unavailable. Both GitRanks measurement timestamps remain in the snapshot but are excluded from its content fingerprint.

## Tech stack, repositories, and contributions

Tech stack labels are maintained in `config/profile.json`. The top five original public repositories are ranked by current GitHub stars. Fork counts, last push dates, and language shares are fetched through GitHub CLI. Language percentages use GitHub's reported code sizes; smaller languages are grouped as Other in the bar legend.

Selected contributions use `featuredContributionRepositories` in `config/profile.json` when that field is present. That selection stays fixed across automatic refreshes and is displayed in latest-merge order. When the field is omitted, the updater discovers public repositories from merged pull requests to other accounts, up to `recentContributionRepositories`. An empty array selects nothing and does not fall back to discovery. For each selected repository, a separate GitHub search counts all merged public pull requests authored by the configured account, across all years. Open and closed-but-unmerged PRs are excluded. The all-time totals are refreshed from GitHub on every update, and repositories without verified public merged PRs are omitted.

The green and red numbers sum additions and deletions across those merged PR diffs. They are not unique lines of code or the repository's current size; repeated changes can count the same line more than once. PR IDs are deduplicated before summing. A search returns at most 1,000 PRs; when the complete set cannot be collected, line totals are unavailable while the full search count is retained. If the featured list is not configured, repository discovery considers up to 1,000 recently updated public merged PRs to other accounts, including archived repositories, plus priority-ecosystem searches. Owned repositories are excluded before pagination so they cannot crowd out contributions to others. The latest merge dates come from the collected PRs. Stars and forks describe the contributed repository, not stars earned by a contribution.

## Builder Index

The Builder Index is a 0 to 100 score. It is not presented as a global rank because a global rank requires a reproducible comparison corpus.

Each input uses logarithmic scaling so one large number cannot overwhelm the full profile:

| Component | Weight | Public signal | Reference cap |
| --- | ---: | --- | ---: |
| Creation | 35% | Stars on original, owned repositories | 100,000 |
| Shipping | 25% | Commits in the trailing 365 days | 1,000 |
| Collaboration | 20% | Pull requests and reviews in the trailing 365 days | 250 PRs, 500 reviews |
| Maintenance | 10% | Issues opened in the trailing 365 days | 250 |
| Community | 10% | Followers | 10,000 |

The reference caps are normalization anchors, not claims about the global population. The model version and all component values are stored in `data/public-profile.json`.

## Privacy boundary

The collector uses public profile, repository, search, and contribution data. Contribution groups are accepted only when the repository visibility is `PUBLIC`.

The generator does not use GitHub's blended contribution totals because an authenticated response can include private activity. It does not store restricted contribution counts, private repository names, private organization names, commit messages, pull request titles, or issue titles.

Ecosystem marks combine organizations with at least one merged public pull request authored by the profile and public professional affiliations configured in `config/profile.json`. Searches explicitly request public repositories; the collector also rejects rows without `PUBLIC` visibility. Affiliation marks state their relationship in the SVG title. Duplicate brands are collapsed, verified priority ecosystems are shown first, and remaining marks are ordered by merged-pull-request depth. The card shows seven marks.

GitHub returns at most 100 repositories for each contribution category. The card labels the 365-day figures as public signals rather than lifetime totals.

## Freshness

The repository workflow runs daily at 05:17 UTC once it is on the default branch `master` and GitHub Actions is enabled. It also refreshes when generator code or configuration changes, and supports a manual Actions run. Each run installs locked dependencies, runs tests, collects public data using `gh api`, rebuilds the profile and work panels, and commits only generated profile files with `git`. It uses the repository's built-in `GITHUB_TOKEN` through `GH_TOKEN`; no personal token is required for the public data. The publishing job runs only for `MohammadMoradpoor/MohammadMoradpoor` on `master`. Forks and other branches cannot publish.

Saved snapshots and history are reused only when `profile.login` matches the configured username. A snapshot from another account is ignored, including its GitRanks cache and follower or star deltas. Rank slots that cannot be verified stay `N/A`. A verified zero stays zero. Missing merged contributions keep the existing “No public merged contributions found.” line.

GitHub Actions schedules and GitHub's image cache can delay visible updates.

Growth compares with the most recent saved snapshot from an earlier UTC day. The comparison date is shown next to the change. The 365-day activity window rolls forward, so its counts may decrease even when new activity occurs.

The README displays one continuous profile image, with links below it and one shared footer. GitHub's `#gh-light-mode-only` and `#gh-dark-mode-only` link markers follow the selected GitHub theme, including a manual theme choice that differs from the system setting. Each theme has a compact layout below 600px. All four PNGs (two widths, two themes) are generated from the same snapshot with `npm run render`. Both themes preserve the blueprint layout, with brighter text, blue accents, and diff colors on the dark background. Logo tiles retain a light surface so original brand marks stay legible. SVG intermediates are generated locally and are not committed. Automatic refreshes rebuild every theme and size without rewriting the README.

## Refresh locally

Install Node.js 20 or newer, GitHub CLI, and `rsvg-convert` (the `librsvg` package on macOS or `librsvg2-bin` on Ubuntu). Then run from this repository:

```sh
gh auth login
npm ci
npm run update
npm run verify
```

Set `username`, `tagline`, `roles`, `techStack`, and optional `links` in `config/profile.json`. The generator does not read the resume. GitHub statistics come from the public API during `npm run update`.

The updater reads through GitHub CLI and writes local files. It does not push. `npm run render` redraws the saved snapshot only when its login matches `username`, and it applies the tagline, roles, and tech stack from the current configuration. Once the workflow is on `master`, a manual refresh can be requested with `gh workflow run update-public-profile.yml --repo MohammadMoradpoor/MohammadMoradpoor`. The separate pull-request check runs tests and renders the saved snapshot without API credentials.
