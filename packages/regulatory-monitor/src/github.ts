import type { DiffExcerpt, RegulatorySource, SourceObservation } from './types.js';

function apiHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

async function githubRequest<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...apiHeaders(token), ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return await response.json() as T;
}

function safeDiffLines(lines: readonly string[]): string {
  if (lines.length === 0) return '(none in capped excerpt)';
  return lines.map((line) => line.replace(/```/g, "''' ")).join('\n');
}

export function changeMarker(sourceId: string, hash: string): string {
  return `<!-- vida-regulatory-change:${sourceId}:${hash} -->`;
}

export function sourceErrorMarker(sourceId: string): string {
  return `<!-- vida-regulatory-source-error:${sourceId} -->`;
}

export function buildChangeIssueBody(
  source: RegulatorySource,
  previous: SourceObservation,
  current: SourceObservation,
  diff: DiffExcerpt
): string {
  return `${changeMarker(source.id, current.sha256)}\n## Regulatory source change detected\n\n` +
    `**Source:** ${source.title}\n\n` +
    `**Authority:** ${source.authority}\n\n` +
    `**Jurisdiction:** ${source.jurisdiction}\n\n` +
    `**URL:** ${source.url}\n\n` +
    `**Impact areas:** ${source.impactAreas.join(', ')}\n\n` +
    `**Previous SHA-256:** \`${previous.sha256}\`\n\n` +
    `**Observed SHA-256:** \`${current.sha256}\`\n\n` +
    `**Detected at:** ${current.fetchedAt}\n\n` +
    `### Added lines (capped)\n\n\`\`\`text\n${safeDiffLines(diff.added)}\n\`\`\`\n\n` +
    `### Removed lines (capped)\n\n\`\`\`text\n${safeDiffLines(diff.removed)}\n\`\`\`\n\n` +
    `### Required review\n\n- [ ] Read the authoritative source, not only this diff\n- [ ] Determine whether an existing ruleset is affected\n- [ ] Identify effective/transitional dates\n- [ ] Add or update legal-source metadata\n- [ ] Add regression tests\n- [ ] Create a separate reviewed PR if rules must change\n\n` +
    `**Production rules were not modified automatically.** The monitor only records observations and opens this review item.`;
}

export function buildSourceErrorIssueBody(source: RegulatorySource, error: string, detectedAt: string): string {
  return `${sourceErrorMarker(source.id)}\n## Regulatory source could not be verified\n\n` +
    `**Source:** ${source.title}\n\n**Authority:** ${source.authority}\n\n**URL:** ${source.url}\n\n` +
    `**Detected at:** ${detectedAt}\n\n**Error:**\n\n\`\`\`text\n${error.replace(/```/g, "''' ")}\n\`\`\`\n\n` +
    `The previous observation remains in force. No production VAT rule was changed.`;
}

type GitHubIssue = { number: number; body: string | null; html_url: string };

async function listOpenIssues(repository: string, token: string): Promise<GitHubIssue[]> {
  return githubRequest<GitHubIssue[]>(`https://api.github.com/repos/${repository}/issues?state=open&per_page=100`, token);
}

async function createIssue(repository: string, token: string, title: string, body: string, labels: string[]): Promise<void> {
  const url = `https://api.github.com/repos/${repository}/issues`;
  try {
    await githubRequest(url, token, { method: 'POST', body: JSON.stringify({ title, body, labels }) });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('422')) throw error;
    await githubRequest(url, token, { method: 'POST', body: JSON.stringify({ title, body }) });
  }
}

export async function ensureChangeIssue(
  repository: string,
  token: string,
  source: RegulatorySource,
  currentHash: string,
  body: string
): Promise<boolean> {
  const marker = changeMarker(source.id, currentHash);
  const existing = await listOpenIssues(repository, token);
  if (existing.some((issue) => issue.body?.includes(marker))) return false;
  await createIssue(repository, token, `[Regulatory change] ${source.id} – ${source.title}`, body, ['regulatory-change', 'regulatory-review']);
  return true;
}

export async function ensureSourceErrorIssue(
  repository: string,
  token: string,
  source: RegulatorySource,
  body: string
): Promise<boolean> {
  const marker = sourceErrorMarker(source.id);
  const existing = await listOpenIssues(repository, token);
  if (existing.some((issue) => issue.body?.includes(marker))) return false;
  await createIssue(repository, token, `[Regulatory monitor] source unavailable – ${source.id}`, body, ['regulatory-monitor']);
  return true;
}
