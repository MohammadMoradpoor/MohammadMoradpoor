export const USER_AGENT = 'public-builder-profile';

const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function fail(field, message) {
  throw new Error(`${field} ${message}`);
}

function assertPlain(value, field, maxLength) {
  if (typeof value !== 'string' || value.trim() === '') fail(field, 'must be a non-empty string.');
  if (value !== value.trim()) fail(field, 'must not include surrounding whitespace.');
  if (/[\u0000-\u001F\u007F]/.test(value)) fail(field, 'must not include control characters.');
  if (value.length > maxLength) fail(field, `must be at most ${maxLength} characters.`);
  if (EMAIL.test(value)) fail(field, 'must not include an email address.');
}

function assertUsername(value, field) {
  assertPlain(value, field, 39);
  if (!USERNAME.test(value)) fail(field, 'must be a GitHub username.');
}

function assertInteger(value, field, min, max, required = true) {
  if (value === undefined) {
    if (required) fail(field, 'is required.');
    return;
  }
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(field, `must be an integer from ${min} to ${max}.`);
  }
}

function assertStringList(value, field, maxItems, maxLength) {
  if (value === undefined) return;
  if (!Array.isArray(value)) fail(field, 'must be an array.');
  if (value.length > maxItems) fail(field, `must contain at most ${maxItems} items.`);
  const seen = new Set();
  for (const item of value) {
    assertPlain(item, field, maxLength);
    const key = item.toLowerCase();
    if (seen.has(key)) fail(field, 'contains a duplicate value.');
    seen.add(key);
  }
}

function assertRepositoryList(value, field, maxItems) {
  if (value === undefined) return;
  if (!Array.isArray(value)) fail(field, 'must be an array.');
  if (value.length > maxItems) fail(field, `must contain at most ${maxItems} items.`);
  const seen = new Set();
  for (const item of value) {
    assertPlain(item, field, 120);
    if (!REPOSITORY.test(item)) fail(field, 'must use owner/repository identifiers.');
    const key = item.toLowerCase();
    if (seen.has(key)) fail(field, 'contains a duplicate repository.');
    seen.add(key);
  }
}

function assertHttpsUrl(value, field) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(field, 'must be an https URL.');
  }
  if (url.protocol !== 'https:') fail(field, 'must be an https URL.');
}

export function validateProfileConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Profile configuration must be an object.');
  }

  assertUsername(config.username, 'username');
  if (config.tagline !== undefined) assertPlain(config.tagline, 'tagline', 120);
  assertStringList(config.roles, 'roles', 4, 40);
  assertStringList(config.techStack, 'techStack', 8, 24);
  assertInteger(config.activityWindowDays, 'activityWindowDays', 1, 3650);
  assertInteger(config.topRepositories, 'topRepositories', 0, 5);
  assertInteger(config.contributedOrganizations, 'contributedOrganizations', 0, 7);
  assertInteger(config.recentContributionRepositories, 'recentContributionRepositories', 0, 5);
  assertInteger(config.mergedPullRequestSearchPages, 'mergedPullRequestSearchPages', 1, 10, false);
  assertInteger(
    config.contributedOrganizationPrioritySearchPages,
    'contributedOrganizationPrioritySearchPages',
    1,
    10,
    false,
  );
  assertStringList(config.contributedOrganizationPriority, 'contributedOrganizationPriority', 10, 39);
  for (const login of config.contributedOrganizationPriority ?? []) assertUsername(login, 'contributedOrganizationPriority');
  assertRepositoryList(config.featuredContributionRepositories, 'featuredContributionRepositories', 5);

  if (config.featuredAffiliations !== undefined) {
    if (!Array.isArray(config.featuredAffiliations)) fail('featuredAffiliations', 'must be an array.');
    if (config.featuredAffiliations.length > 7) fail('featuredAffiliations', 'must contain at most 7 items.');
    for (const affiliation of config.featuredAffiliations) {
      if (!affiliation || typeof affiliation !== 'object' || Array.isArray(affiliation)) {
        fail('featuredAffiliations', 'must contain organization objects.');
      }
      assertUsername(affiliation.login, 'featuredAffiliations.login');
      assertPlain(affiliation.label, 'featuredAffiliations.label', 40);
      assertPlain(affiliation.relationship, 'featuredAffiliations.relationship', 80);
    }
  }

  if (config.creatorBenchmarkCountries === undefined || !Array.isArray(config.creatorBenchmarkCountries)) {
    fail('creatorBenchmarkCountries', 'must be an array.');
  }
  if (config.creatorBenchmarkCountries.length > 4) fail('creatorBenchmarkCountries', 'must contain at most 4 countries.');
  const countryKeys = new Set();
  for (const country of config.creatorBenchmarkCountries) {
    if (!country || typeof country !== 'object' || Array.isArray(country)) {
      fail('creatorBenchmarkCountries', 'must contain country objects.');
    }
    assertPlain(country.key, 'creatorBenchmarkCountries.key', 40);
    assertPlain(country.label, 'creatorBenchmarkCountries.label', 40);
    assertPlain(country.path, 'creatorBenchmarkCountries.path', 80);
    const key = country.key.toLowerCase();
    if (key === 'world' || countryKeys.has(key)) fail('creatorBenchmarkCountries', 'contains a duplicate key.');
    countryKeys.add(key);
  }

  if (config.links !== undefined) {
    if (!Array.isArray(config.links)) fail('links', 'must be an array.');
    if (config.links.length > 4) fail('links', 'must contain at most 4 items.');
    const seen = new Set();
    for (const link of config.links) {
      if (!link || typeof link !== 'object' || Array.isArray(link)) fail('links', 'must contain link objects.');
      assertPlain(link.label, 'links.label', 24);
      assertPlain(link.url, 'links.url', 200);
      assertHttpsUrl(link.url, 'links.url');
      const key = link.url.toLowerCase();
      if (seen.has(key)) fail('links', 'contains a duplicate URL.');
      seen.add(key);
    }
  }

  return config;
}

export function snapshotOwnedBy(snapshot, username) {
  const login = snapshot?.profile?.login;
  return typeof login === 'string'
    && typeof username === 'string'
    && login.toLowerCase() === username.toLowerCase();
}

export function personalizeSnapshot(snapshot, config) {
  if (!snapshotOwnedBy(snapshot, config.username)) {
    throw new Error(
      `Snapshot login "${snapshot?.profile?.login ?? ''}" does not match configured username "${config.username}".`,
    );
  }
  return {
    ...snapshot,
    tagline: config.tagline ?? snapshot.tagline ?? '',
    roles: config.roles ?? snapshot.roles ?? [],
    techStack: config.techStack ?? snapshot.techStack ?? [],
  };
}
