import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeProfileAssets } from './lib/assets.mjs';
import { personalizeSnapshot, validateProfileConfig } from './lib/config.mjs';
import { validatePortfolioProjects, validatePresentation } from './lib/presentation.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = validateProfileConfig(JSON.parse(await readFile(resolve(root, 'config/profile.json'), 'utf8')));
const presentation = validatePresentation(JSON.parse(await readFile(resolve(root, 'config/presentation.json'), 'utf8')));
const portfolio = validatePortfolioProjects(JSON.parse(await readFile(resolve(root, 'config/portfolio-projects.json'), 'utf8')));
const snapshot = JSON.parse(await readFile(resolve(root, 'data/public-profile.json'), 'utf8'));
const history = JSON.parse(await readFile(resolve(root, 'data/public-profile-history.json'), 'utf8'));

let personalized;
try {
  personalized = personalizeSnapshot(snapshot, config);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

await writeProfileAssets(root, {
  ...personalized,
  presentation,
  portfolioProjects: portfolio.projects,
  publicCode: portfolio.publicCode ?? [],
}, Array.isArray(history) ? history : []);
console.log('Rendered light/dark desktop/mobile profile PNGs and local SVG intermediates');
