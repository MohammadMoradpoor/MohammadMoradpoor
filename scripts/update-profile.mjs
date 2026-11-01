import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchPublicGitHubProfile, resolveGitHubToken } from './lib/github.mjs';
import { refreshGitRanksCreator } from './lib/gitranks.mjs';
import { refreshCreatorBenchmarks } from './lib/creator-benchmarks.mjs';
import { personalizeSnapshot, snapshotOwnedBy, validateProfileConfig } from './lib/config.mjs';
import { validatePortfolioProjects, validatePresentation } from './lib/presentation.mjs';
import { finalizeSnapshot } from './lib/model.mjs';
import { writeProfileAssets } from './lib/assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(root, 'config/profile.json');
const presentationPath = resolve(root, 'config/presentation.json');
const portfolioPath = resolve(root, 'config/portfolio-projects.json');
const snapshotPath = resolve(root, 'data/public-profile.json');
const historyPath = resolve(root, 'data/public-profile-history.json');

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export function historyForAccount(history, previousSnapshot, username) {
  if (!snapshotOwnedBy(previousSnapshot, username)) return [];
  const login = username.toLowerCase();
  return (Array.isArray(history) ? history : []).filter((entry) =>
    typeof entry?.login === 'string' && entry.login.toLowerCase() === login);
}

export function creatorBenchmarkCache(snapshot, username) {
  if (!snapshotOwnedBy(snapshot, username)) return null;
  const cache = snapshot?.ranking?.creatorBenchmarks ?? null;
  if (!cache) return null;
  if (typeof cache.profileLogin === 'string' && cache.profileLogin.toLowerCase() !== username.toLowerCase()) {
    return null;
  }
  return cache;
}

function historyEntry(snapshot) {
  return {
    login: snapshot.profile.login,
    date: snapshot.generatedAt.slice(0, 10),
    builderIndex: snapshot.builderIndex.score,
    followerRank: snapshot.ranking.followerWorld.position,
    topProjectRank: snapshot.ranking.topProjectWorld.position,
    gitRanksCreatorRank: snapshot.ranking.gitRanksCreator?.position ?? null,
    creatorBenchmarkRanks: Object.fromEntries(
      Object.entries(snapshot.ranking.creatorBenchmarks?.positions ?? {}).map(([key, value]) => [key, value.position]),
    ),
    followers: snapshot.profile.followers,
    ownedStars: snapshot.metrics.ownedStars,
    commits: snapshot.metrics.commits,
    pullRequests: snapshot.metrics.pullRequests,
    issues: snapshot.metrics.issues,
    reviews: snapshot.metrics.reviews,
  };
}

export function updateHistory(history, snapshot, changed, limit = 365) {
  if (!changed && history.length) {
    return history;
  }

  const entry = historyEntry(snapshot);
  const next = [...history];
  const last = next.at(-1);
  if (last?.date === entry.date) {
    next[next.length - 1] = entry;
  } else {
    next.push(entry);
  }
  return next.slice(-limit);
}

async function main() {
  const config = validateProfileConfig(await readJson(configPath));
  const presentation = validatePresentation(await readJson(presentationPath));
  const portfolio = validatePortfolioProjects(await readJson(portfolioPath));
  const [storedSnapshot, storedHistory] = await Promise.all([
    readJson(snapshotPath),
    readJson(historyPath, []),
  ]);
  const previousSnapshot = snapshotOwnedBy(storedSnapshot, config.username) ? storedSnapshot : null;
  const previousHistory = historyForAccount(storedHistory, storedSnapshot, config.username);
  const token = resolveGitHubToken();
  const now = new Date();
  const publicProfile = await fetchPublicGitHubProfile(config, token, now);
  [publicProfile.ranking.gitRanksCreator, publicProfile.ranking.creatorBenchmarks] = await Promise.all([
    refreshGitRanksCreator(config.username, previousSnapshot?.ranking?.gitRanksCreator ?? null, now),
    refreshCreatorBenchmarks(
      publicProfile.metrics.ownedStars,
      config.creatorBenchmarkCountries,
      creatorBenchmarkCache(previousSnapshot, config.username),
      now,
    ),
  ]);
  if (publicProfile.ranking.creatorBenchmarks && typeof publicProfile.ranking.creatorBenchmarks === 'object') {
    publicProfile.ranking.creatorBenchmarks.profileLogin = config.username;
  }
  publicProfile.presentation = presentation;
  publicProfile.portfolioProjects = portfolio.projects;
  publicProfile.publicCode = portfolio.publicCode ?? [];
  const snapshot = finalizeSnapshot(personalizeSnapshot(publicProfile, config), previousSnapshot, now);
  const changed = snapshot.fingerprint !== previousSnapshot?.fingerprint;
  const history = updateHistory(previousHistory, snapshot, changed);

  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeProfileAssets(root, snapshot, history);
  await Promise.all([
    writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`),
    writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`),
  ]);

  console.log(
    JSON.stringify({
      changed,
      generatedAt: snapshot.generatedAt,
      builderIndex: snapshot.builderIndex.score,
      followerRank: snapshot.ranking.followerWorld.position,
      topProjectRank: snapshot.ranking.topProjectWorld.position,
      gitRanksCreator: snapshot.ranking.gitRanksCreator,
      creatorBenchmarks: snapshot.ranking.creatorBenchmarks,
      publicSignals: {
        commits: snapshot.metrics.commits,
        pullRequests: snapshot.metrics.pullRequests,
        issues: snapshot.metrics.issues,
        reviews: snapshot.metrics.reviews,
      },
    }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
