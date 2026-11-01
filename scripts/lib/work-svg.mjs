import { isPortfolio, portfolioProjectsFor, presentationOf } from './presentation.mjs';
import { toolchainMark } from './toolchain-marks.mjs';
import { date, display, displayAdvance, escapeXml, number, profileLabel, rule, text, wrapText } from './svg.mjs';
import { THEMES } from './theme.mjs';

function languageLegend(languages = []) {
  const visible = languages.slice(0, 3);
  const remainder = Math.max(0, 100 - visible.reduce((total, item) => total + item.percentage, 0));
  if (languages.length > 3 && remainder >= .1) visible.push({ name: 'Other', color: '#999999', percentage: Math.round(remainder * 10) / 10 });
  return visible;
}

function languageBar(languages, x, y, width) {
  let offset = 0;
  return languages.map(language => {
    const segment = Math.max(0, Math.min(width - offset, width * language.percentage / 100));
    const shape = `<rect x="${x + offset}" y="${y}" width="${segment}" height="9" fill="${escapeXml(language.color)}" />`;
    offset += segment;
    return shape;
  }).join('');
}

function projectRow(repository, x, y, width, compact, { ink: INK }) {
  const languages = languageLegend(repository.languages);
  const fontSize = compact ? 18 : 14;
  const legend = languages.map((language, index) => {
    const lx = x + (index % 2) * (width / 2);
    const ly = y + 112 + Math.floor(index / 2) * 26;
    return `<circle cx="${lx + 5}" cy="${ly - 5}" r="5" fill="${escapeXml(language.color)}" />`
      + text(lx + 18, ly, `${language.name} ${language.percentage.toFixed(1)}%`, '', `font-size="${fontSize}"`);
  }).join('');
  return display(x, y + 29, repository.name, compact ? 39 : 33, INK, '', width)
    + text(x, y + 59, `${number(repository.stars)} STARS   /   ${number(repository.forks)} FORKS`, 'stats')
    + languageBar(languages, x, y + 80, width)
    + (languages.length ? legend : text(x, y + 112, 'No language breakdown reported', 'note'))
    + text(x, y + 165, `Pushed ${date(repository.updatedAt)}`, 'note')
    + `<line x1="${x}" x2="${x + width}" y1="${y + 184}" y2="${y + 184}" stroke="${INK}" opacity=".2" />`;
}

function contributionRow(contribution, x, y, width, compact, { ink: INK, blue: BLUE, paper: PAPER, positive, negative }) {
  const point = x + 7;
  const left = x + 30;
  const language = contribution.language?.name ?? 'Mixed';
  const changeWidth = (width - 30) / 2;
  const delta = Number.isFinite(contribution.additions) && Number.isFinite(contribution.deletions)
    ? text(left, y + 86, 'SUM OF MERGED PR DIFFS', 'note')
      + display(left, y + 117, `+${number(contribution.additions)}`, 30, positive, '', changeWidth - 18)
      + display(left + changeWidth, y + 117, `-${number(contribution.deletions)}`, 30, negative, '', changeWidth - 18)
    : '';
  return `<line x1="${point}" y1="${y + 8}" x2="${point}" y2="${y + 178}" stroke="${BLUE}" opacity=".25" />`
    + `<circle cx="${point}" cy="${y + 20}" r="6" fill="${PAPER}" stroke="${BLUE}" stroke-width="2" />`
    + display(left, y + 29, contribution.nameWithOwner, compact ? 37 : 32, INK, '', width - 30)
    + text(left, y + 64, `${number(contribution.mergedPullRequests)} MERGED PR${contribution.mergedPullRequests === 1 ? '' : 's'} / ALL TIME`, 'stats blue')
    + delta
    + text(left, y + 143, `${language} · ${number(contribution.stars)} stars · ${number(contribution.forks)} forks`, 'note')
    + text(left, y + 171, `Latest merge ${date(contribution.lastMergedAt)}`, 'note');
}

function matchingRepository(snapshot, repository) {
  return (snapshot.topRepositories ?? []).find((item) => item.nameWithOwner === repository || item.name === repository.split('/')[1]);
}

function deepDive(project, repository, x, y, width, compact, { ink: INK, blue: BLUE }) {
  const summary = wrapText(project.summary, compact ? 58 : 112, 2);
  const languages = languageLegend(repository?.languages);
  const languageLine = languages.slice(0, 3).map((language) => `${language.name} ${language.percentage.toFixed(1)}%`).join('   ·   ');
  const capabilities = (project.capabilities ?? []).join('  ·  ');
  const technologies = (project.technologies ?? []).join('  ·  ');
  const dividerY = languages.length ? (compact ? 292 : 252) : (compact ? 248 : 214);
  return display(x, y + 34, project.repository.split('/')[1], compact ? 34 : 36, INK, '', width)
    + text(x, y + 62, project.headline, 'stats blue')
    + summary.map((line, index) => text(x, y + 90 + index * 22, line, 'note')).join('')
    + text(x, y + 142, capabilities, 'note blue')
    + text(x, y + 166, technologies, 'stats')
    + (languages.length ? languageBar(languages, x, y + 186, width) + text(x, y + 212, languageLine, 'note') : '')
    + (repository?.updatedAt ? text(x, y + (languages.length ? 236 : 196), `Pushed ${date(repository.updatedAt)}`, 'note') : '')
    + `<line x1="${x}" x2="${x + width}" y1="${y + dividerY}" y2="${y + dividerY}" stroke="${INK}" opacity=".25" />`;
}

function chip(name, x, y, chipWidth, compact, paper, blue) {
  const pad = chipWidth < 140 ? 8 : 13;
  return `<rect x="${x}" y="${y}" width="${chipWidth}" height="44" fill="${paper}" stroke="${blue}" stroke-width=".8" />`
    + display(x + pad, y + 31, name, compact ? 24 : 30, blue, '', chipWidth - pad * 2);
}

function portfolioRow(project, x, y, width, compact, { ink: INK }) {
  const title = project.name.toUpperCase();
  const titleSize = compact ? 39 : 33;
  const languages = languageLegend(project.languages ?? []);
  const fontSize = compact ? 18 : 14;
  const legend = languages.map((language, index) => {
    const lx = x + (index % 2) * (width / 2);
    const ly = y + 112 + Math.floor(index / 2) * 26;
    return `<circle cx="${lx + 5}" cy="${ly - 5}" r="5" fill="${escapeXml(language.color)}" />`
      + text(lx + 18, ly, `${language.name} ${language.percentage.toFixed(1)}%`, '', `font-size="${fontSize}"`);
  }).join('');
  const privateX = x + displayAdvance(title, titleSize) + (compact ? 14 : 16);
  const activity = project.activity?.kind === 'commit' && project.activity.at
    ? `Commit ${date(project.activity.at)}`
    : '';
  return `<g data-row="repository" data-x="${x}" data-width="${width}">${display(x, y + 29, title, titleSize, INK, '', Math.max(40, width - 110))
    + text(privateX, y + 26, 'PRIVATE', 'private-mark')
    + text(x, y + 59, project.detail ?? '', 'stats')
    + (languages.length ? languageBar(languages, x, y + 80, width) : '')
    + legend
    + (activity ? text(x, y + 165, activity, 'note') : '')
    + `<line x1="${x}" x2="${x + width}" y1="${y + 184}" y2="${y + 184}" stroke="${INK}" opacity=".2" />`}</g>`;
}

function toolchainSection(presentation, compact, width, inset, { ink: INK, blue: BLUE }) {
  const items = presentation.toolchain?.items ?? [];
  const plate = THEMES.light.paper;
  const size = compact ? 28 : 36;
  const dividerY = 16;
  const titleY = dividerY + (compact ? 30 : 32);
  const subtitleY = titleY + (compact ? 20 : 18);
  const origin = compact ? subtitleY + 22 : dividerY + 18;
  const labelY = origin + size + (compact ? 16 : 18);
  const ruleY = labelY + (compact ? 14 : 16);
  const step = compact ? (width - inset * 2 - size) / Math.max(items.length - 1, 1) : 114;
  const x0 = compact ? inset : 372;
  const tiles = items.map((item, index) => {
    const mark = toolchainMark(item.id);
    const x = x0 + index * step;
    const pad = 5;
    const label = compact && item.id === 'kubernetes' ? 'K8s' : compact && item.id === 'deployment' ? 'Deploy' : item.label;
    const icon = mark.mode === 'stroke'
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${mark.fill}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${mark.paths.map((path) => `<path d="${path}"/>`).join('')}</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${mark.fill}" d="${mark.paths[0]}"/></svg>`;
    const href = `data:image/svg+xml,${encodeURIComponent(icon)}`;
    return `<g data-tool="${item.id}" data-frame-x="${x - 3}" data-frame-y="${origin - 3}" data-frame-size="${size + 6}"><title>${escapeXml(item.label)}</title><rect x="${x - 3}" y="${origin - 3}" width="${size + 6}" height="${size + 6}" fill="${plate}" stroke="${BLUE}" stroke-width=".8" /><image href="${href}" x="${x + pad / 2}" y="${origin + pad / 2}" width="${size - pad}" height="${size - pad}" preserveAspectRatio="xMidYMid meet" />${text(x + size / 2, labelY, label, 'org', 'text-anchor="middle"')}</g>`;
  }).join('');
  return {
    markup: rule(dividerY, width, inset, INK).replace('<line ', '<line data-rule="capabilities-toolchain" ')
      + text(inset, titleY, presentation.toolchain?.title ?? '', 'label blue')
      + text(inset, subtitleY, presentation.toolchain?.subtitle ?? '', 'note')
      + tiles
      + rule(ruleY, width, inset, INK).replace('<line ', '<line data-rule="toolchain-stack" '),
    height: ruleY,
  };
}

function highlightRow(item, x, y, width, compact, { ink: INK, blue: BLUE, paper: PAPER }) {
  const point = x + 7;
  const left = x + 30;
  const summary = wrapText(item.summary, compact ? 52 : 56, 2);
  return `<g data-row="highlight" data-x="${x}" data-width="${width}">`
    + `<line x1="${point}" y1="${y + 8}" x2="${point}" y2="${y + 178}" stroke="${BLUE}" opacity=".25" />`
    + `<circle cx="${point}" cy="${y + 20}" r="6" fill="${PAPER}" stroke="${BLUE}" stroke-width="2" />`
    + display(left, y + 29, String(item.title).toUpperCase(), compact ? 34 : 32, INK, '', width - 40)
    + text(left, y + 64, item.detail, 'stats blue')
    + summary.map((line, index) => text(left, y + 108 + index * 24, line, 'note')).join('')
    + '</g>';
}

function renderPortfolioWorkSvg(snapshot, { compact = false, theme = 'light' } = {}) {
  const palette = THEMES[theme];
  const { ink: INK, blue: BLUE, paper: PAPER } = palette;
  const width = compact ? 600 : 1200;
  const inset = compact ? 28 : 40;
  const column = compact ? 544 : 520;
  const presentation = presentationOf(snapshot);
  const projects = portfolioProjectsFor(snapshot);
  const highlights = (presentation.highlights ?? []).slice(0, 3);
  const technologies = presentation.showTechStack === false ? [] : (snapshot.techStack ?? []).slice(0, 5);
  const subject = profileLabel(snapshot);
  const toolchain = toolchainSection(presentation, compact, width, inset, palette);
  const shift = toolchain.height;
  const projectsY = 196 + shift;
  const highlightsHeading = compact ? projectsY + projects.length * 200 + 62 : 148 + shift;
  const highlightsY = compact ? highlightsHeading + 58 : projectsY;
  const contentBottom = Math.max(
    projectsY + projects.length * 200,
    highlightsY + Math.max(highlights.length, 1) * 200,
  );
  const bottom = contentBottom + 28;
  const height = bottom + (compact ? 86 : 76);
  const chips = technologies.map((name, index) => {
    if (compact) {
      const gap = 8;
      const chipWidth = (width - inset * 2 - gap * (technologies.length - 1)) / Math.max(technologies.length, 1);
      return chip(name, inset + index * (chipWidth + gap), 58 + shift, chipWidth, true, PAPER, BLUE);
    }
    const chipWidth = 208;
    return `<rect x="${inset + index * 228}" y="${58 + shift}" width="${chipWidth}" height="44" fill="${PAPER}" stroke="${BLUE}" stroke-width=".8" />`
      + display(inset + index * 228 + 13, 89 + shift, name, 33, BLUE, '', chipWidth - 26);
  }).join('');
  const right = compact ? inset : 640;
  const names = projects.map((project) => project.name).join(', ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="work-title work-description">
  <title id="work-title">Selected private engineering systems and technology stack</title>
  <desc id="work-description">${escapeXml(`${subject}: ${names || 'no featured projects'}. Architecture summaries from project documentation. Private implementation is not published. Refreshed ${date(snapshot.generatedAt)}.`)}</desc>
  <defs>
    <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="${INK}" opacity=".1" /></pattern>
    <style>
      text { font-family: "SFMono-Regular", "Liberation Mono", Consolas, monospace; fill: ${INK}; }
      .label { font-size: ${compact ? 17 : 14}px; letter-spacing: 1px; font-weight: 600; }
      .note { font-size: ${compact ? 16 : 13}px; }
      .stats { font-size: ${compact ? 19 : 16}px; }
      .private-mark { font-size: ${compact ? 12 : 11}px; letter-spacing: .6px; opacity: .62; }
      .org { font-size: ${compact ? 9 : 10}px; }
      .blue { fill: ${BLUE}; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="${PAPER}" />
  <rect width="${width}" height="${height}" fill="url(#dots)" />
  <g data-row="toolchain">${toolchain.markup}</g>
  ${text(inset, 32 + shift, 'FIG_004 / TECH STACK', 'label blue')}
  <g data-row="tech-stack">${chips}</g>
  ${rule(122 + shift, width, inset, INK).replace('<line ', '<line data-rule="stack-projects" ')}
  ${text(inset, 148 + shift, 'FIG_005 / SELECTED PROJECTS', 'label')}
  ${text(inset, 175 + shift, 'Private systems · languages by tracked source size', 'note')}
  ${projects.map((project, index) => portfolioRow(project, inset, projectsY + index * 200, column, compact, palette)).join('')}
  ${compact
    ? rule(highlightsHeading - 33, width, inset, INK)
    : `<path d="M600 ${144 + shift}V${contentBottom}" stroke="${BLUE}" stroke-dasharray="3 5" opacity=".25" />`}
  ${text(right, highlightsHeading, 'FIG_006 / ENGINEERING HIGHLIGHTS', 'label')}
  ${text(right, highlightsHeading + 27, 'Selected implementation evidence', 'note')}
  ${highlights.map((item, index) => highlightRow(item, right, highlightsY + index * 200, column, compact, palette)).join('')}
  ${rule(bottom, width, inset, INK)}
  ${text(inset, bottom + 28, 'SOURCE / CURATED PROJECT NOTES', 'note')}
  ${text(compact ? inset : width - inset, bottom + (compact ? 52 : 28), `REFRESHED ${date(snapshot.generatedAt)}`, 'note', compact ? '' : 'text-anchor="end"')}
  <rect y="${height - 4}" width="${width}" height="4" fill="${BLUE}" />
</svg>`;
}

export function renderPublicWorkSvg(snapshot, options = {}) {
  const { compact = false, theme = 'light' } = options;
  if (isPortfolio(snapshot, options)) return renderPortfolioWorkSvg(snapshot, { compact, theme });
  const palette = THEMES[theme];
  const { ink: INK, blue: BLUE, paper: PAPER } = palette;
  const width = compact ? 600 : 1200;
  const inset = compact ? 28 : 40;
  const column = compact ? 544 : 520;
  const repositories = (snapshot.topRepositories ?? []).slice(0, 5);
  const contributions = (snapshot.recentContributions ?? []).slice(0, 5);
  const technologies = snapshot.techStack ?? [];
  const subject = profileLabel(snapshot);
  const chipsPerRow = compact ? 3 : 5;
  const extraRows = Math.max(0, Math.ceil(technologies.length / chipsPerRow) - (compact ? 2 : 1));
  const sectionOffset = extraRows * 61;
  const projectsY = (compact ? 276 : 196) + sectionOffset;
  const contributionsHeading = compact ? projectsY + repositories.length * 200 + 62 : 148 + sectionOffset;
  const contributionsY = compact ? contributionsHeading + 58 : projectsY;
  const bottom = Math.max(projectsY + repositories.length * 200, contributionsY + Math.max(1, contributions.length) * 200) + 28;
  const height = bottom + 76;
  const techStack = technologies.map((name, index) => {
    const x = inset + index % chipsPerRow * (compact ? 188 : 228);
    const y = 58 + Math.floor(index / chipsPerRow) * 61;
    const chipWidth = compact ? 168 : 208;
    return `<rect x="${x}" y="${y}" width="${chipWidth}" height="44" fill="${PAPER}" stroke="${BLUE}" stroke-width=".8" />`
      + display(x + 13, y + 31, name, compact ? 30 : 33, BLUE, '', chipWidth - 26);
  }).join('');
  const right = compact ? inset : 640;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="work-title work-description">
  <title id="work-title">Tech stack, top repositories, and selected contributions</title>
  <desc id="work-description">${escapeXml(`${subject}: tech stack ${technologies.join(', ') || 'not listed'}. Top original repositories with language breakdowns. Selected public repositories show all-time merged pull request counts and summed PR diffs. Stars and forks describe each repository. Refreshed ${date(snapshot.generatedAt)}.`)}</desc>
  <defs>
    <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="${INK}" opacity=".1" /></pattern>
    <style>
      text { font-family: "SFMono-Regular", "Liberation Mono", Consolas, monospace; fill: ${INK}; }
      .label { font-size: ${compact ? 17 : 14}px; letter-spacing: 1px; font-weight: 600; }
      .note { font-size: ${compact ? 16 : 13}px; }
      .stats { font-size: ${compact ? 19 : 16}px; }
      .blue { fill: ${BLUE}; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="${PAPER}" />
  <rect width="${width}" height="${height}" fill="url(#dots)" />
  ${text(inset, 32, 'FIG_004 / TECH STACK', 'label blue')}
  ${techStack}
  ${rule((compact ? 184 : 122) + sectionOffset, width, inset, INK)}
  ${text(inset, (compact ? 228 : 148) + sectionOffset, 'FIG_005 / TOP 5 REPOSITORIES', 'label')}
  ${text(inset, (compact ? 255 : 175) + sectionOffset, 'Original public projects · languages by code size', 'note')}
  ${repositories.map((repository, index) => projectRow(repository, inset, projectsY + index * 200, column, compact, palette)).join('')}
  ${compact ? rule(contributionsHeading - 33, width, inset, INK) : `<path d="M600 ${144 + sectionOffset}V${bottom - 28}" stroke="${BLUE}" stroke-dasharray="3 5" opacity=".25" />`}
  ${text(right, contributionsHeading, 'FIG_006 / SELECTED CONTRIBUTIONS', 'label')}
  ${text(right, contributionsHeading + 27, 'Merged PRs to other public repositories', 'note')}
  ${contributions.length ? contributions.map((contribution, index) => contributionRow(contribution, right, contributionsY + index * 200, column, compact, palette)).join('') : text(right, contributionsY + 40, 'No public merged contributions found.', 'note')}
  ${rule(bottom, width, inset, INK)}
  ${text(inset, bottom + 28, 'SOURCE / PUBLIC GITHUB DATA', 'note')}
  ${text(compact ? inset : width - inset, bottom + (compact ? 53 : 28), `REFRESHED ${date(snapshot.generatedAt)}`, 'note', compact ? '' : 'text-anchor="end"')}
  <rect y="${height - 4}" width="${width}" height="4" fill="${BLUE}" />
</svg>`;
}
