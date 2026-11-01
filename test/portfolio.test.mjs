import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { finalizeSnapshot } from '../scripts/lib/model.mjs';
import { portfolioProjectsFor, publicCodeFor, validatePortfolioProjects, validatePresentation } from '../scripts/lib/presentation.mjs';
import { renderProfileSvg } from '../scripts/lib/profile-svg.mjs';
import { renderPublicBuilderSvg } from '../scripts/lib/svg.mjs';
import { renderPublicWorkSvg } from '../scripts/lib/work-svg.mjs';

const presentation = JSON.parse(await readFile(new URL('../config/presentation.json', import.meta.url), 'utf8'));
const portfolio = JSON.parse(await readFile(new URL('../config/portfolio-projects.json', import.meta.url), 'utf8'));
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

function snapshot(overrides = {}) {
  return finalizeSnapshot({
    profile: { login: 'MohammadMoradpoor', name: 'Mohammad Moradpoor', followers: 59, originalRepositoryCount: 4 },
    metrics: { ownedStars: 4, commits: 0, pullRequests: 0, issues: 0, reviews: 0, windowDays: 365 },
    ranking: {
      followerWorld: { position: 291127 },
      topProjectWorld: { position: 5161200 },
      gitRanksCreator: { status: 'unavailable' },
      creatorBenchmarks: { status: 'unavailable', positions: {} },
    },
    topRepositories: [
      { name: 'nexus-ai', nameWithOwner: 'MohammadMoradpoor/nexus-ai', stars: 20, forks: 3, updatedAt: '2026-03-11T00:00:00Z' },
      { name: 'ClinMira-AI', nameWithOwner: 'MohammadMoradpoor/ClinMira-AI', stars: 9, forks: 1, updatedAt: '2026-06-08T00:00:00Z' },
      { name: 'medical-ai-analyzer', nameWithOwner: 'MohammadMoradpoor/medical-ai-analyzer', stars: 0, forks: 0 },
    ],
    recentContributions: [],
    ecosystemOrganizations: [],
    techStack: ['Python', 'TypeScript', 'FastAPI', 'SQL', 'Temporal'],
    tagline: 'Building agentic LLM systems and ML backends.',
    roles: ['AI Software Engineer', 'Applied AI', 'LLM Systems', 'ML Engineering'],
    presentation,
    portfolioProjects: portfolio.projects,
    publicCode: portfolio.publicCode,
    ...overrides,
  }, null, new Date('2026-11-01T17:27:35Z'));
}

test('curated private projects stay in editorial order and exclude removed repositories', () => {
  const projects = validatePortfolioProjects(portfolio).projects;
  assert.deepEqual(projects.map((project) => project.name), ['Matruno', 'VoiceOps AI', 'DocIntel AI']);
  assert.equal(projects[0].latest, true);
  assert.equal(projects[0].publicWebsite, 'https://www.matruno.com/');
  assert.deepEqual(projects.map((project) => project.diagram), ['none', 'none', 'none']);
  assert.ok(projects.every((project) => project.visibility === 'private' && project.repository == null));
  assert.deepEqual(portfolioProjectsFor(snapshot({
    portfolioProjects: [
      { ...portfolio.projects[2], priority: 1, name: 'ClinMira-AI', id: 'clinmira' },
      portfolio.projects[0],
      { name: 'nexus-ai', id: 'nexus-ai', summary: 'no', diagram: 'routing', priority: 0 },
    ],
  })).map((project) => project.name), ['Matruno']);
  assert.throws(() => validatePortfolioProjects({
    projects: [{ ...portfolio.projects[0], name: 'ClinMira-AI', id: 'clinmira' }, portfolio.projects[1], portfolio.projects[2]],
  }));
});

test('portfolio render uses the radar and compact rows without architecture diagrams', () => {
  const data = snapshot();
  assert.deepEqual(presentation.radar.axes.map((axis) => axis.label), [
    'AGENT SYSTEMS', 'WORKFLOWS', 'BACKEND', 'VOICE AI', 'IDP',
  ]);
  assert.ok(presentation.radar.axes.every((axis) => axis.emphasis > 0.7 && axis.emphasis < 1));
  assert.throws(() => validatePresentation({
    ...presentation,
    radar: { ...presentation.radar, axes: presentation.radar.axes.map((axis, index) => (index === 0 ? { ...axis, emphasis: 1 } : axis)) },
  }));
  for (const compact of [false, true]) {
    const svg = renderProfileSvg(data, [], { compact, theme: compact ? 'dark' : 'light' });
    assert.match(svg, new RegExp(`width="${compact ? 600 : 1200}"`));
    assert.match(svg, /data-chart="radar" data-axes="5" data-mode="editorial-focus" data-quantitative="false" data-emphasis="0\.8600,0\.8400,0\.7800,0\.8200,0\.8300"/);
    assert.match(svg, /data-wave-samples="80"/);
    assert.match(svg, new RegExp(`data-wave-scale="${compact ? 0.36 : 0.95}"`));
    assert.match(svg, /FIG_002 \/ ENGINEERING FOCUS/);
    assert.match(svg, />AGENT SYSTEMS</);
    assert.match(svg, />VOICE AI</);
    assert.match(svg, />IDP</);
    assert.doesNotMatch(svg, /DOCUMENTED PROJECT COVERAGE|REALTIME/);
    assert.equal((svg.match(new RegExp('>AGENTS<', 'g')) ?? []).length, 0);
    assert.equal((svg.match(/data-row="repository"/g) ?? []).length, 3);
    assert.equal((svg.match(/data-row="highlight"/g) ?? []).length, 3);
    assert.equal((svg.match(/data-row="tech-stack"/g) ?? []).length, 1);
    assert.equal((svg.match(/height="44"/g) ?? []).length, 5);
    assert.match(svg, /FIG_004 \/ TECH STACK/);
    assert.ok(svg.indexOf('FIG_004 / TECH STACK') < svg.indexOf('FIG_005 / SELECTED PROJECTS'));
    assert.ok(svg.indexOf('FIG_005 / SELECTED PROJECTS') < svg.indexOf('FIG_006 / ENGINEERING HIGHLIGHTS') || !compact);
    const names = [...svg.matchAll(/aria-label="(MATRUNO|VOICEOPS AI|DOCINTEL AI|Python|TypeScript|FastAPI|SQL|Temporal)"/g)].map((match) => match[1]);
    assert.deepEqual(names.slice(0, 5), ['Python', 'TypeScript', 'FastAPI', 'SQL', 'Temporal']);
    assert.match(svg, /MULTI-AGENT SYSTEMS/);
    assert.match(svg, /SOFTWARE ARCHITECTURE/);
    assert.match(svg, /LLM INTEGRATION/);
    assert.match(svg, /REAL-TIME SYSTEMS/);
    assert.match(svg, /DURABLE WORKFLOW EXECUTION/);
    assert.match(svg, /VOICE AGENT HANDOFF/);
    assert.match(svg, /ORCHESTRATED IDP/);
    assert.doesNotMatch(svg, /DIRECTOR-ACTOR|DESIGN SYSTEMS|LLM APPLICATION ENGINEERING|BACKEND SYSTEM DESIGN/);
    assert.match(svg, /data-rule="hero-capabilities"/);
    assert.match(svg, /data-rule="capabilities-toolchain"/);
    assert.match(svg, /data-rule="toolchain-stack"/);
    assert.match(svg, /data-rule="stack-projects"/);
    assert.deepEqual([...svg.matchAll(/data-tool="([^"]+)"/g)].map((match) => match[1]), [
      'linux', 'aws', 'cloud', 'deployment', 'docker', 'kubernetes', 'mcp',
    ]);
    assert.ok(svg.indexOf('data-row="toolchain"') < svg.indexOf('FIG_004 / TECH STACK'));
    assert.deepEqual(names.slice(5, 8), ['MATRUNO', 'VOICEOPS AI', 'DOCINTEL AI']);
    assert.match(svg, /LATEST · GOVERNED AI WORKFLOWS/);
    assert.match(svg, /DURABLE WORKFLOW EXECUTION/);
    assert.doesNotMatch(svg, /SELECTED CONTRIBUTIONS|MERGED PR|PRIVATE CODEBASE/);
    if (!compact) {
      assert.match(svg, /y="252" class="label"[^>]*>FIG_005 \/ SELECTED PROJECTS/);
      assert.match(svg, /y="252" class="label"[^>]*>FIG_006 \/ ENGINEERING HIGHLIGHTS/);
      assert.match(svg, /d="M600 248V900"/);
      const frames = [...svg.matchAll(/data-frame-y="([\d.]+)" data-frame-size="([\d.]+)"/g)];
      assert.equal(frames.length, 7);
      assert.ok(frames.every((frame) => frame[1] === '31' && frame[2] === '42'));
      assert.ok(Number(svg.match(/data-rule="capabilities-toolchain"[^>]*y1="([\d.]+)"|y1="([\d.]+)"[^>]*data-rule="capabilities-toolchain"/).find((value, index) => index > 0 && value) ) < 31);
      assert.equal((svg.match(/data-x="40" data-width="520"/g) ?? []).length, 3);
      assert.equal((svg.match(/data-x="640" data-width="520"/g) ?? []).length, 3);
    } else {
      assert.doesNotMatch(svg, /M600 /);
    }
    assert.match(svg, /Python 60\.6%/);
    assert.match(svg, /TypeScript 37\.6%/);
    assert.match(svg, /Python 99\.1%/);
    assert.match(svg, /Python 99\.6%/);
    assert.match(svg, /Commit 25 Oct 2026/);
    assert.doesNotMatch(svg, /Pushed /);
    assert.equal((svg.match(/class="private-mark"/g) ?? []).length, 3);
    const privateX = [...svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" class="private-mark"/g)].map((match) => Number(match[1]));
    assert.equal(privateX.length, 3);
    assert.ok(privateX[0] < privateX[1] && privateX[1] === privateX[2]);
    assert.equal((svg.match(/height="9"/g) ?? []).length, compact ? 8 : 8);
    assert.doesNotMatch(svg, /PRIVATE CODEBASE|>DOCUMENTS</);
    assert.doesNotMatch(svg, /data-diagram|ENGINEERING SYSTEMS|ENGINEERING STACK|LANGUAGES|BUILDER INDEX|GITRANKS|WORLD FOLLOWER RANK|CREATION|SHIPPING|\/100/);
    assert.doesNotMatch(svg, /ClinMira|nexus-ai|aria-label="#291,127"|STARS|FORKS|Pushed /);
    assert.ok(svg.indexOf('MATRUNO') < svg.indexOf('VOICEOPS AI') && svg.indexOf('VOICEOPS AI') < svg.indexOf('DOCINTEL AI'));
    const chipYs = [...svg.matchAll(/data-row="tech-stack">([\s\S]*?)<\/g>/g)][0][1].match(/<rect[^>]*y="([\d.]+)"/g);
    assert.equal(new Set(chipYs).size, 1);
  }
});

test('GitHub repository order cannot promote excluded projects', () => {
  const svg = renderPublicWorkSvg(snapshot(), []);
  assert.doesNotMatch(svg, /ClinMira|nexus-ai/);
  assert.doesNotMatch(svg, /ClinMira|nexus-ai/);
  assert.equal(publicCodeFor(snapshot({ publicCode: [{ name: 'nexus-ai', url: 'https://github.com/MohammadMoradpoor/nexus-ai', note: 'no' }] })).length, 0);
});

test('README links Matruno and does not link removed projects', () => {
  assert.match(readme, /https:\/\/www\.matruno\.com\//);
  assert.doesNotMatch(readme, /medical-ai-analyzer/);
  assert.doesNotMatch(readme, /ClinMira-AI|nexus-ai|example\.com/);
  assert.equal(validatePresentation(presentation).heroHeading, 'AI ENGINEERING');
});

test('rendering does not alter stored public metrics', () => {
  const data = snapshot();
  const before = data.metrics.ownedStars;
  renderPublicBuilderSvg(data, []);
  assert.equal(data.metrics.ownedStars, before);
  assert.equal(data.ranking.followerWorld.position, 291127);
});
