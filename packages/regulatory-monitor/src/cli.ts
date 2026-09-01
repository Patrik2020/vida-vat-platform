import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runRegulatoryMonitor } from './monitor.js';
import { REGULATORY_SOURCES } from './sources.js';

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const stateDir = resolve(argument('--state-dir') ?? '.regulatory-state');
const reportPath = resolve(argument('--report') ?? 'regulatory-monitor-report.json');
const repository = process.env.GITHUB_REPOSITORY ?? null;
const githubToken = process.env.GITHUB_TOKEN ?? null;

if (process.env.GITHUB_ACTIONS === 'true' && (!repository || !githubToken)) {
  throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required in GitHub Actions.');
}

await mkdir(stateDir, { recursive: true });
const report = await runRegulatoryMonitor({ stateDir, sources: REGULATORY_SOURCES, repository, githubToken });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
