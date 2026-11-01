const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function fail(message) {
  throw new Error(message);
}

function assertPlain(value, field, maxLength) {
  if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) {
    fail(`${field} must be a non-empty trimmed string.`);
  }
  if (/[\u0000-\u001F\u007F]/.test(value)) fail(`${field} must not include control characters.`);
  if (value.length > maxLength) fail(`${field} must be at most ${maxLength} characters.`);
  if (EMAIL.test(value)) fail(`${field} must not include an email address.`);
}

export function validatePresentation(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('Presentation configuration must be an object.');
  if (config.mode !== 'portfolio-first' && config.mode !== 'metrics') {
    fail('presentation.mode must be portfolio-first or metrics.');
  }
  assertPlain(config.heroHeading, 'heroHeading', 28);
  assertPlain(config.heroSupport, 'heroSupport', 90);
  if (config.focusNote != null) assertPlain(config.focusNote, 'focusNote', 80);
  if (config.focusAreas != null) {
    if (!Array.isArray(config.focusAreas) || config.focusAreas.length < 3 || config.focusAreas.length > 5) {
      fail('focusAreas must contain 3 to 5 labels.');
    }
    for (const label of config.focusAreas) assertPlain(label, 'focusAreas', 22);
  }
  if (!Array.isArray(config.capabilities) || config.capabilities.length < 3 || config.capabilities.length > 5) {
    fail('capabilities must contain 3 to 5 items.');
  }
  for (const capability of config.capabilities) {
    if (!capability || typeof capability !== 'object') fail('capabilities must contain objects.');
    assertPlain(capability.label, 'capabilities.label', 32);
    assertPlain(capability.note, 'capabilities.note', 42);
  }
  if (!Number.isInteger(config.maxFeaturedProjects) || config.maxFeaturedProjects < 1 || config.maxFeaturedProjects > 3) {
    fail('maxFeaturedProjects must be an integer from 1 to 3.');
  }
  if (config.mode === 'portfolio-first') {
    validateRadar(config.radar);
    validateHighlights(config.highlights);
    validateToolchain(config.toolchain);
  }
  return config;
}

const TOOLCHAIN_IDS = ['linux', 'aws', 'cloud', 'deployment', 'docker', 'kubernetes', 'mcp'];

function validateToolchain(toolchain) {
  if (!toolchain || !Array.isArray(toolchain.items) || toolchain.items.length !== 7) {
    fail('toolchain must contain exactly seven tools.');
  }
  assertPlain(toolchain.title, 'toolchain.title', 40);
  assertPlain(toolchain.subtitle, 'toolchain.subtitle', 48);
  toolchain.items.forEach((item, index) => {
    if (!item || item.id !== TOOLCHAIN_IDS[index]) fail('toolchain order must stay fixed.');
    assertPlain(item.label, 'toolchain.label', 16);
    assertPlain(item.kind, 'toolchain.kind', 32);
  });
}

function validateHighlights(highlights) {
  if (!Array.isArray(highlights) || highlights.length !== 3) fail('highlights must contain exactly three items.');
  for (const item of highlights) {
    if (!item || typeof item !== 'object') fail('highlights must contain objects.');
    assertPlain(item.title, 'highlights.title', 32);
    assertPlain(item.detail, 'highlights.detail', 48);
    assertPlain(item.summary, 'highlights.summary', 140);
  }
}

function validateRadar(radar) {
  if (!radar || radar.mode !== 'editorial-focus' || !Array.isArray(radar.axes) || radar.axes.length !== 5) {
    fail('radar must be an editorial focus chart with five axes.');
  }
  assertPlain(radar.title, 'radar.title', 32);
  const seen = new Set();
  for (const axis of radar.axes) {
    if (!axis || typeof axis !== 'object') fail('radar axes must be objects.');
    if (axis.score != null || axis.value != null || axis.projects != null) {
      fail('radar axes must use editorial emphasis, not scores or project counts.');
    }
    assertPlain(axis.key, 'radar.key', 16);
    assertPlain(axis.label, 'radar.label', 16);
    if (seen.has(axis.key)) fail('radar axes must be unique.');
    seen.add(axis.key);
    if (typeof axis.emphasis !== 'number' || axis.emphasis <= 0 || axis.emphasis >= 1) {
      fail('radar emphasis must stay between the center and the outer ring.');
    }
  }
}

export function validateFeaturedProjects(file, username) {
  const projects = file?.projects;
  if (!Array.isArray(projects) || projects.length < 1 || projects.length > 3) {
    fail('featured projects must contain 1 to 3 records.');
  }
  const seen = new Set();
  for (const project of projects) {
    if (!project || typeof project !== 'object') fail('Each featured project must be an object.');
    assertPlain(project.repository, 'repository', 120);
    if (!REPOSITORY.test(project.repository)) fail('repository must use owner/name form.');
    const [owner, name] = project.repository.split('/');
    if (owner.toLowerCase() !== String(username).toLowerCase()) {
      fail(`repository ${project.repository} is not owned by ${username}.`);
    }
    if (name.toLowerCase() === String(username).toLowerCase()) {
      fail('The profile README repository cannot be featured.');
    }
    if (seen.has(project.repository.toLowerCase())) fail('featured projects contains a duplicate repository.');
    seen.add(project.repository.toLowerCase());
    if (!Number.isInteger(project.priority)) fail('priority must be an integer.');
    assertPlain(project.headline, 'headline', 80);
    assertPlain(project.summary, 'summary', 220);
    if (!Array.isArray(project.capabilities) || project.capabilities.length < 1 || project.capabilities.length > 4) {
      fail('project capabilities must contain 1 to 4 labels.');
    }
    for (const label of project.capabilities) assertPlain(label, 'project.capabilities', 32);
    if (!Array.isArray(project.technologies) || project.technologies.length < 1 || project.technologies.length > 4) {
      fail('project technologies must contain 1 to 4 names.');
    }
    for (const label of project.technologies) assertPlain(label, 'project.technologies', 24);
    if (!Array.isArray(project.evidence) || project.evidence.length < 1) fail('project evidence must name source files.');
    for (const item of project.evidence) assertPlain(item, 'project.evidence', 120);
  }
  return file;
}

const BLOCKED_PROJECT = /clinmira|nexus-ai/i;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function validateProjectLanguages(languages, name) {
  if (!Array.isArray(languages) || languages.length < 1 || languages.length > 12) {
    fail(`${name} must include measured language shares.`);
  }
  let total = 0;
  for (const language of languages) {
    if (!language || typeof language !== 'object') fail(`${name} language entries must be objects.`);
    assertPlain(language.name, `${name}.languages.name`, 24);
    if (!HEX_COLOR.test(language.color ?? '')) fail(`${name} language color must be a hex value.`);
    if (typeof language.percentage !== 'number' || language.percentage < 0 || language.percentage > 100) {
      fail(`${name} language percentage must be a number from 0 to 100.`);
    }
    total += language.percentage;
  }
  if (Math.abs(total - 100) > 0.2) fail(`${name} language percentages must sum to 100.`);
}

function validateProjectActivity(activity, name) {
  if (!activity || activity.kind !== 'commit' || typeof activity.at !== 'string') {
    fail(`${name} must record a verified commit date.`);
  }
  if (Number.isNaN(Date.parse(activity.at))) fail(`${name} commit date must be parseable.`);
}

export function validatePortfolioProjects(file) {
  const projects = file?.projects;
  if (!Array.isArray(projects) || projects.length !== 3) fail('The portfolio must contain exactly three projects.');
  const expected = [
    ['matruno', 'Matruno', 'none', true, 'https://www.matruno.com/'],
    ['voiceops-ai', 'VoiceOps AI', 'none', false, null],
    ['docintel-ai', 'DocIntel AI', 'none', false, null],
  ];
  projects.forEach((project, index) => {
    const [id, name, diagram, latest, website] = expected[index];
    if (!project || project.id !== id || project.name !== name || project.priority !== index + 1) {
      fail('Project order must be Matruno, VoiceOps AI, then DocIntel AI.');
    }
    if (project.visibility !== 'private' || project.latest !== latest || project.diagram !== diagram) {
      fail(`${name} visibility, latest flag, or diagram type is incorrect.`);
    }
    if (project.publicWebsite !== website) fail(`${name} has an unexpected public link.`);
    if (website && !String(website).startsWith('https://www.matruno.com')) fail('Matruno must use its public website.');
    assertPlain(project.headline, `${id}.headline`, 90);
    assertPlain(project.summary, `${id}.summary`, 240);
    assertPlain(project.architecture, `${id}.architecture`, 120);
    assertPlain(project.detail, `${id}.detail`, 64);
    validateProjectLanguages(project.languages, name);
    validateProjectActivity(project.activity, name);
    if (!Array.isArray(project.technologies) || project.technologies.length < 2 || project.technologies.length > 5) {
      fail(`${name} must list 2 to 5 technologies.`);
    }
    for (const item of project.technologies) assertPlain(item, `${id}.technologies`, 24);
    if (project.stars != null || project.forks != null || project.pushedAt != null || project.repository) {
      fail(`${name} must not carry fabricated GitHub statistics or a repository link.`);
    }
  });
  for (const entry of file.publicCode ?? []) {
    assertPlain(entry.name, 'publicCode.name', 80);
    assertPlain(entry.url, 'publicCode.url', 200);
    assertPlain(entry.note, 'publicCode.note', 120);
    if (BLOCKED_PROJECT.test(entry.name) || !entry.url.startsWith('https://github.com/')) {
      fail('Public code entries must be allowed GitHub URLs.');
    }
  }
  return file;
}

export function portfolioProjectsFor(snapshot, options = {}) {
  const records = options.portfolioProjects ?? snapshot?.portfolioProjects ?? [];
  return [...records]
    .filter((project) => project?.name && project.summary && project.diagram)
    .filter((project) => !BLOCKED_PROJECT.test(project.name) && !BLOCKED_PROJECT.test(project.id ?? ''))
    .sort((left, right) => (left.priority ?? 99) - (right.priority ?? 99));
}

export function publicCodeFor(snapshot, options = {}) {
  const records = options.publicCode ?? snapshot?.publicCode ?? [];
  return records.filter((entry) => entry?.name && entry.url && !BLOCKED_PROJECT.test(entry.name));
}

export function isPortfolio(snapshot, options = {}) {
  if (options.mode === 'metrics') return false;
  if (options.mode === 'portfolio-first') return true;
  const mode = options.presentation?.mode ?? snapshot?.presentation?.mode ?? 'portfolio-first';
  return mode !== 'metrics';
}

export function presentationOf(snapshot, options = {}) {
  return {
    ...(snapshot?.presentation ?? {}),
    ...(options.presentation ?? {}),
  };
}

export function featuredProjectsFor(snapshot, options = {}) {
  const presentation = presentationOf(snapshot, options);
  if (presentation.showFeaturedProjects === false) return [];
  const login = snapshot?.profile?.login?.toLowerCase() ?? '';
  const records = options.featuredProjects ?? snapshot?.featuredProjects ?? [];
  return records
    .filter((project) => project && typeof project.repository === 'string' && project.headline && project.summary)
    .filter((project) => {
      const [owner, name] = project.repository.split('/');
      if (!owner || !name) return false;
      if (login && owner.toLowerCase() !== login) return false;
      if (presentation.excludeProfileRepository !== false && login && name.toLowerCase() === login) return false;
      return true;
    })
    .sort((left, right) => (left.priority ?? 99) - (right.priority ?? 99))
    .slice(0, presentation.maxFeaturedProjects ?? 3);
}
