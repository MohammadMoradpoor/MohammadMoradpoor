import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url);
const rootPath = root.pathname;
const strict = process.argv.includes('--strict') || process.env.AUDIT_STRICT === '1';
const failures = [];

function fail(message) {
  failures.push(message);
}

async function walk(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', 'preview', '.gstack'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, files);
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const required = [
  'README.md',
  'package.json',
  'config/profile.json',
  'config/presentation.json',
  'config/portfolio-projects.json',
  '.github/workflows/update-public-profile.yml',
  'assets/public-builder-profile.png',
  'assets/public-builder-profile-dark.png',
  'assets/public-builder-profile-mobile.png',
  'assets/public-builder-profile-mobile-dark.png',
];
for (const file of required) {
  try {
    await stat(new URL(file, root));
  } catch {
    fail(`Missing required file: ${file}`);
  }
}

const profile = JSON.parse(await readFile(new URL('config/profile.json', root), 'utf8'));
const presentation = JSON.parse(await readFile(new URL('config/presentation.json', root), 'utf8'));
const portfolio = JSON.parse(await readFile(new URL('config/portfolio-projects.json', root), 'utf8'));
const workflow = await readFile(new URL('.github/workflows/update-public-profile.yml', root), 'utf8');
if (profile.username !== 'MohammadMoradpoor') fail('Profile username is not the configured account.');
if (JSON.stringify(profile.techStack) !== JSON.stringify(['Python', 'TypeScript', 'FastAPI', 'SQL', 'Temporal'])) {
  fail('Tech stack order is not Python, TypeScript, FastAPI, SQL, Temporal.');
}
const toolIds = (presentation.toolchain?.items ?? []).map((item) => item.id).join(',');
if (toolIds !== 'linux,aws,cloud,deployment,docker,kubernetes,mcp') fail('Toolchain order is incorrect.');
const projectNames = (portfolio.projects ?? []).map((project) => project.name).join(',');
if (projectNames !== 'Matruno,VoiceOps AI,DocIntel AI') fail('Featured project order is incorrect.');
if (!workflow.includes("github.repository == 'MohammadMoradpoor/MohammadMoradpoor'")) {
  fail('Update workflow is not limited to the profile repository.');
}
if (!workflow.includes('refs/heads/master')) fail('Update workflow is not limited to master.');
if (!workflow.includes('github-actions[bot]')) fail('Update workflow does not use the Actions bot identity.');

const denylistPath = process.env.AUDIT_DENYLIST;
if (!denylistPath) {
  const message = 'AUDIT_DENYLIST is not set. The previous-owner scan did not run.';
  if (strict) fail(message);
  else console.error(message);
} else {
  const terms = (await readFile(denylistPath, 'utf8')).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  if (!terms.length) fail('AUDIT_DENYLIST is empty.');
  const files = await walk(rootPath);
  for (const file of files) {
    if (/\.(png|ttf|woff2?)$/i.test(file)) continue;
    const source = (await readFile(file, 'utf8')).toLowerCase();
    for (const term of terms) {
      if (source.includes(term.toLowerCase())) fail(`Denied identifier in ${relative(rootPath, file)}`);
    }
  }
}

if (failures.length) {
  for (const message of failures) console.error(message);
  process.exit(1);
}
console.log('Release audit passed.');
