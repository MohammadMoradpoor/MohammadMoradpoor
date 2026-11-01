import { readFileSync } from 'node:fs';

const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
const FILES = {
  linux: 'linux.svg',
  aws: 'aws.svg',
  cloud: 'cloud.svg',
  deployment: 'deployment.svg',
  docker: 'docker.svg',
  kubernetes: 'kubernetes.svg',
  mcp: 'mcp.svg',
};

const cache = new Map();

export function toolchainMark(id) {
  if (cache.has(id)) return cache.get(id);
  const file = FILES[id];
  if (!file) throw new Error(`Unknown toolchain mark: ${id}`);
  const svg = readFileSync(new URL(`../../assets/toolchain/${file}`, import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
  const filled = svg.match(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24"><path fill="(#[0-9A-Fa-f]{6})" d="([^"]+)"\/><\/svg>$/);
  if (filled && PATH.test(filled[2])) {
    const mark = { mode: 'fill', fill: filled[1], paths: [filled[2]] };
    cache.set(id, mark);
    return mark;
  }
  const stroked = svg.match(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24" fill="none" stroke="(#[0-9A-Fa-f]{6})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">([\s\S]+)<\/svg>$/);
  const paths = stroked ? [...stroked[2].matchAll(/<path d="([^"]+)"\/>/g)].map((item) => item[1]) : [];
  if (!stroked || !paths.length || paths.some((path) => !PATH.test(path)) || /<text[\s>]/.test(svg)) {
    throw new Error(`Toolchain mark ${id} is not a sanitized icon.`);
  }
  const mark = { mode: 'stroke', fill: stroked[1], paths };
  cache.set(id, mark);
  return mark;
}
