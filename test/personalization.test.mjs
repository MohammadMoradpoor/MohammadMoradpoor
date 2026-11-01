import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { personalizeSnapshot, snapshotOwnedBy, validateProfileConfig } from '../scripts/lib/config.mjs';
import { refreshGitRanksCreator } from '../scripts/lib/gitranks.mjs';
import { finalizeSnapshot } from '../scripts/lib/model.mjs';
import { renderProfileSvg } from '../scripts/lib/profile-svg.mjs';
import { renderPublicBuilderSvg } from '../scripts/lib/svg.mjs';
import { creatorBenchmarkCache, historyForAccount } from '../scripts/update-profile.mjs';
import { renderPublicWorkSvg } from '../scripts/lib/work-svg.mjs';
import { THEMES } from '../scripts/lib/theme.mjs';

const root = new URL('..', import.meta.url);

function validConfig(overrides = {}) {
  return {
    username: 'fixtureuser',
    activityWindowDays: 365,
    topRepositories: 5,
    contributedOrganizations: 7,
    recentContributionRepositories: 5,
    creatorBenchmarkCountries: [{ key: 'usa', label: 'USA', path: 'United States' }],
    ...overrides,
  };
}

function sample(overrides = {}) {
  return finalizeSnapshot({
    profile: {
      login: 'fixtureuser',
      name: 'Ada Lovelace',
      followers: 3,
      originalRepositoryCount: 2,
      ...overrides.profile,
    },
    metrics: {
      ownedStars: 5,
      commits: 4,
      pullRequests: 3,
      issues: 2,
      reviews: 1,
      windowDays: 365,
      ...overrides.metrics,
    },
    ranking: {
      followerWorld: { position: 10 },
      topProjectWorld: { position: 20 },
      ...overrides.ranking,
    },
    topRepositories: overrides.topRepositories ?? [
      { name: 'demo', stars: 5, forks: 1, languages: [], updatedAt: '2026-01-01T00:00:00Z' },
    ],
    recentContributions: overrides.recentContributions ?? [],
    ecosystemOrganizations: overrides.ecosystemOrganizations ?? [],
    techStack: Object.hasOwn(overrides, 'techStack') ? overrides.techStack : ['Python'],
    tagline: Object.hasOwn(overrides, 'tagline') ? overrides.tagline : 'Building agentic LLM systems and ML backends.',
    roles: Object.hasOwn(overrides, 'roles') ? overrides.roles : ['AI Software Engineer', 'LLM Systems', 'ML Engineering'],
  }, null, new Date('2026-08-24T12:00:00Z'));
}

function taglineOf(svg) {
  return svg.match(/class="tagline"[^>]*>([^<]*)</)[1];
}

async function textFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await textFiles(path));
    else files.push(path);
  }
  return files;
}

test('normal profile renders configured identity and public sections', () => {
  const data = sample();
  for (const compact of [false, true]) {
    const svg = renderProfileSvg(data, [], { compact, theme: 'light' });
    assert.match(svg, /Ada Lovelace/);
    assert.match(svg, /@fixtureuser/);
    assert.match(svg, /Building agentic LLM systems and ML backends\./);
    assert.match(svg, /FIG_000 \/ PUBLIC ENGINEERING PROFILE/);
    assert.match(svg, /FIG_001 \/ ENGINEERING IDENTITY/);
    assert.doesNotMatch(svg, /WORLD FOLLOWER RANK|BUILDER INDEX|GITRANKS|ECOSYSTEM REACH|No public merged contributions/);
    assert.doesNotMatch(svg, /undefined|NaN/);
  }
});

test('missing display name falls back to the username', () => {
  const data = sample({ profile: { name: null } });
  const blank = sample({ profile: { name: '   ' } });
  for (const snapshot of [data, blank]) {
    const svg = renderPublicBuilderSvg(snapshot, []);
    assert.match(svg, /aria-label="FIXTUREUSER"/);
    assert.match(svg, /<title id="title">fixtureuser public GitHub profile<\/title>/);
    assert.doesNotMatch(svg, />null</);
  }
});

test('long display names stay inside the original desktop width', () => {
  const name = 'A'.repeat(80);
  const svg = renderPublicBuilderSvg(sample({ profile: { name } }), []);
  assert.match(svg, /width="1200"/);
  assert.match(svg, new RegExp(`aria-label="${name}"`));
});

test('long taglines are shortened to the header line', () => {
  const data = sample({ tagline: 'Word '.repeat(40).trim() });
  const desktop = taglineOf(renderPublicBuilderSvg(data, [], { compact: false }));
  const mobile = taglineOf(renderPublicBuilderSvg(data, [], { compact: true }));
  assert.ok(desktop.length <= 96);
  assert.ok(mobile.length <= 48);
  assert.match(desktop, /…$/);
  assert.match(mobile, /…$/);
});

test('multiple roles stay on one desktop line and wrap to the original mobile second line', () => {
  const data = sample({
    roles: ['AI Software Engineer', 'Applied AI', 'LLM Systems', 'ML Engineering'],
  });
  const desktop = renderPublicBuilderSvg(data, [], { compact: false });
  const mobile = renderPublicBuilderSvg(data, [], { compact: true });
  assert.match(desktop, /AI SOFTWARE ENGINEER · APPLIED AI · LLM SYSTEMS · ML ENGINEERING/);
  assert.equal([...desktop.matchAll(/class="roles"/g)].length, 1);
  assert.match(mobile, /AI Software Engineer · Applied AI · LLM Systems/);
  assert.match(mobile, />ML Engineering</);
  assert.equal([...mobile.matchAll(/class="roles"/g)].length, 2);
});

test('no public repositories keep the repository sections without invented projects', () => {
  const data = sample({
    topRepositories: [],
    ranking: { topProjectWorld: { position: null } },
  });
  const overview = renderPublicBuilderSvg(data, []);
  const work = renderPublicWorkSvg(data, []);
  assert.doesNotMatch(overview, /SELECTED OPEN SOURCE|WORLD FOLLOWER RANK/);
  assert.doesNotMatch(work, /FIG_005 \/ TOP 5 REPOSITORIES|aria-label="demo"/);
});

test('fewer than five repositories are not duplicated', () => {
  const data = sample({
    topRepositories: [
      { name: 'alpha-repo', stars: 2, forks: 1, languages: [], updatedAt: '2026-01-01T00:00:00Z' },
      {
        name: 'beta-repo',
        stars: 1,
        forks: 0,
        languages: [{ name: 'Python', color: '#3572A5', percentage: 100 }],
        updatedAt: '2026-01-02T00:00:00Z',
      },
    ],
  });
  const work = renderPublicWorkSvg(data, { mode: 'metrics' });
  assert.equal((work.match(/aria-label="alpha-repo"/g) ?? []).length, 1);
  assert.equal((work.match(/aria-label="beta-repo"/g) ?? []).length, 1);
  assert.match(work, /No language breakdown reported/);
});

test('no merged contributions keep the empty-state line', () => {
  const work = renderPublicWorkSvg(sample({ recentContributions: [] }), { mode: 'metrics' });
  assert.match(work, /No public merged contributions found/);
  assert.doesNotMatch(renderPublicWorkSvg(sample({ recentContributions: [] }), []), /No public merged contributions found/);
});

test('no verified organizations keep the ecosystem section without logos', () => {
  const svg = renderPublicBuilderSvg(sample({ ecosystemOrganizations: [] }), [], { mode: 'metrics' });
  assert.match(svg, /ECOSYSTEM REACH/);
  assert.doesNotMatch(svg, /<image /);
  assert.doesNotMatch(renderPublicBuilderSvg(sample({ ecosystemOrganizations: [] }), []), /ECOSYSTEM REACH/);
});

test('unavailable GitRanks and country comparisons stay unavailable', () => {
  const svg = renderPublicBuilderSvg(sample(), [], { mode: 'metrics' });
  assert.match(svg, /GITRANKS UNAVAILABLE/);
  assert.match(svg, /COMPARISONS UNAVAILABLE/);
  assert.match(svg, /aria-label="N\/A"/);
  assert.match(svg, /Rank unavailable/);
  const portfolio = renderPublicBuilderSvg(sample(), []);
  assert.doesNotMatch(portfolio, /GITRANKS|COUNTRY RANK|COMPARISONS UNAVAILABLE/);
});

test('verified zeros stay zero and an unknown rank stays N\/A', () => {
  const data = sample({
    profile: { followers: 0 },
    metrics: { ownedStars: 0 },
    ranking: { followerWorld: { position: null }, topProjectWorld: { position: null } },
  });
  const svg = renderPublicBuilderSvg(data, [], { mode: 'metrics' });
  assert.match(svg, /0 PUBLIC FOLLOWERS/);
  assert.match(svg, /aria-label="0"/);
  assert.match(svg, /aria-label="N\/A"/);
});

test('empty and foreign history cannot create growth from another account', () => {
  const data = sample();
  assert.doesNotMatch(renderPublicBuilderSvg(data, []), /since /);
  assert.doesNotMatch(renderPublicBuilderSvg(data, [
    { login: 'previous-owner', date: '2026-08-01', ownedStars: 0, followerRank: 1 },
    { date: '2026-08-01', ownedStars: 0, followerRank: 1 },
  ]), /since /);
  assert.match(renderPublicBuilderSvg(data, [
    { login: 'fixtureuser', date: '2026-08-01', ownedStars: 1, followerRank: 11 },
  ], { mode: 'metrics' }), /since 01 Aug/);
});

test('missing optional identity fields render without the previous owner copy', () => {
  const config = validateProfileConfig(validConfig());
  assert.equal(config.tagline, undefined);
  assert.equal(config.roles, undefined);
  assert.equal(config.links, undefined);
  assert.equal(config.featuredContributionRepositories, undefined);
  const svg = renderProfileSvg(sample({ tagline: undefined, roles: undefined, techStack: undefined }), []);
  assert.doesNotMatch(svg, /Building AI agent infrastructure|CNCF Ambassador|Docker Captain|Google Developer Expert/);
});

test('desktop and mobile layouts and both themes stay distinct', () => {
  const data = sample();
  const desktop = renderProfileSvg(data, [], { compact: false, theme: 'dark' });
  const mobile = renderProfileSvg(data, [], { compact: true, theme: 'light' });
  assert.match(desktop, /width="1200"/);
  assert.match(mobile, /width="600"/);
  assert.match(desktop, new RegExp(THEMES.dark.paper));
  assert.match(mobile, new RegExp(THEMES.light.paper));
  assert.match(desktop, /FIG_001 \/ ENGINEERING IDENTITY/);
  assert.match(mobile, /FIG_002 \/ ENGINEERING FOCUS/);
  assert.notEqual(desktop.match(/viewBox="[^"]+"/)[0], mobile.match(/viewBox="[^"]+"/)[0]);
});

test('XML-special characters in identity and technology names are escaped', () => {
  const data = sample({
    profile: { name: 'A & B <C>' },
    tagline: 'Tools & "agents"',
    techStack: ['A&B <C>'],
  });
  const overview = renderPublicBuilderSvg(data, []);
  const work = renderPublicWorkSvg(data, []);
  assert.match(overview, /A &amp; B &lt;C&gt;/);
  assert.match(overview, /Tools &amp; &quot;agents&quot;/);
  assert.match(work, /aria-label="A&amp;B &lt;C&gt;"/);
  assert.doesNotMatch(overview, /<C>|Tools & "/);
});

test('foreign snapshots, history, and ranking caches are not reusable', async () => {
  const foreign = {
    profile: { login: 'previous-owner' },
    ranking: {
      creatorBenchmarks: { measuredValue: 10, profileLogin: 'previous-owner', positions: {} },
    },
  };
  assert.equal(snapshotOwnedBy(foreign, 'MohammadMoradpoor'), false);
  assert.equal(snapshotOwnedBy({ profile: { login: 'MohammadMoradpoor' } }, 'mohammadmoradpoor'), true);
  assert.deepEqual(historyForAccount([
    { login: 'previous-owner', date: '2026-01-01', followers: 9 },
    { date: '2026-01-02', followers: 3 },
  ], foreign, 'MohammadMoradpoor'), []);
  assert.equal(creatorBenchmarkCache(foreign, 'MohammadMoradpoor'), null);
  assert.equal(creatorBenchmarkCache({
    profile: { login: 'fixtureuser' },
    ranking: { creatorBenchmarks: { measuredValue: 1, profileLogin: 'previous-owner' } },
  }, 'fixtureuser'), null);
  assert.throws(
    () => personalizeSnapshot(foreign, validConfig({ username: 'fixtureuser' })),
    /does not match/,
  );
  const personalized = personalizeSnapshot(
    { profile: { login: 'FixtureUser' }, tagline: 'old', roles: ['Old'], techStack: ['Old'] },
    validConfig({ username: 'fixtureuser', tagline: 'New tagline', roles: ['AI Software Engineer'], techStack: ['Python'] }),
  );
  assert.equal(personalized.profile.login, 'FixtureUser');
  assert.equal(personalized.tagline, 'New tagline');
  assert.deepEqual(personalized.techStack, ['Python']);

  const rejected = await refreshGitRanksCreator('fixtureuser', {
    login: 'previous-owner',
    position: 80,
    stars: 10,
    measuredAt: '2026-09-25T13:00:00Z',
    source: 'https://gitranks.com/profile/previous-owner/ranks',
  }, new Date(), async () => {
    throw new Error('unavailable');
  });
  assert.equal(rejected.status, 'unavailable');
  assert.equal(rejected.position, undefined);
});

test('configuration rejects unsafe identity, skills, repositories, and affiliations', () => {
  assert.throws(() => validateProfileConfig(validConfig({ username: 'bad user' })), /username/);
  assert.throws(() => validateProfileConfig(validConfig({ roles: ['AI', 'ai'] })), /duplicate/);
  assert.throws(() => validateProfileConfig(validConfig({ techStack: ['Python', 'python'] })), /duplicate/);
  assert.throws(() => validateProfileConfig(validConfig({ tagline: 'mail me at person@invalid.test' })), /email/);
  assert.throws(() => validateProfileConfig(validConfig({ featuredContributionRepositories: ['not a repo'] })), /owner\/repository/);
  assert.throws(() => validateProfileConfig(validConfig({
    featuredAffiliations: [{ login: 'example-org', label: 'Example' }],
  })), /relationship/);
  assert.throws(() => validateProfileConfig(validConfig({
    links: [{ label: 'Site', url: 'http://example.com' }],
  })), /https/);
  const emptySelection = validateProfileConfig(validConfig({ featuredContributionRepositories: [] }));
  assert.deepEqual(emptySelection.featuredContributionRepositories, []);
});

test('published sources use the configured account and do not keep the previous owner', async () => {
  const config = validateProfileConfig(JSON.parse(await readFile(new URL('../config/profile.json', import.meta.url), 'utf8')));
  assert.equal(config.username, 'MohammadMoradpoor');
  assert.equal(config.tagline, 'Agentic AI systems and durable workflows.');
  assert.deepEqual(config.roles, ['AI Software Engineer', 'Applied AI', 'LLM Systems', 'ML Engineering']);
  assert.deepEqual(config.techStack, ['Python', 'TypeScript', 'FastAPI', 'SQL', 'Temporal']);
  assert.deepEqual(config.featuredAffiliations, []);
  assert.deepEqual(config.contributedOrganizationPriority, []);
  assert.equal(config.featuredContributionRepositories, undefined);

  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.equal(readme.includes(config.tagline), false);
  assert.match(readme, /Public statistics refresh automatically\. \[Sources and methodology\]\(RANKING\.md\)\./);
  assert.ok(readme.includes(`https://github.com/${config.username}?tab=repositories`));
  for (const link of config.links) assert.ok(readme.includes(link.url));
  assert.doesNotMatch(readme, /example\.com|twitter\.com|github\.com\/sponsors\//i);

  const workflow = await readFile(new URL('../.github/workflows/update-public-profile.yml', import.meta.url), 'utf8');
  assert.match(workflow, new RegExp(`github\\.repository == '${config.username}/${config.username}'`));
  assert.match(workflow, /refs\/heads\/master/);
  assert.match(workflow, /cron: "17 5 \* \* \*"/);

  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.name, 'public-builder-profile');

  const paths = [
    join(root.pathname, 'README.md'),
    join(root.pathname, 'RANKING.md'),
    join(root.pathname, 'package.json'),
    join(root.pathname, 'package-lock.json'),
    ...await textFiles(join(root.pathname, 'config')),
    ...await textFiles(join(root.pathname, '.github')),
    ...await textFiles(join(root.pathname, 'scripts')),
    ...await textFiles(join(root.pathname, 'data')),
    ...await textFiles(join(root.pathname, 'assets/fonts')),
  ];
  for (const path of paths) {
    if (path.endsWith('.ttf')) continue;
    const source = await readFile(path, 'utf8');
    if (!path.endsWith(`${join('assets', 'fonts', 'OFL.txt')}`)) {
      assert.doesNotMatch(source, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, path);
    }
  }
});
