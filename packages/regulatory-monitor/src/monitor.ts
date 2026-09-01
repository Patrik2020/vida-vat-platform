import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { buildDiffExcerpt } from './diff.js';
import { buildChangeIssueBody, buildSourceErrorIssueBody, ensureChangeIssue, ensureSourceErrorIssue } from './github.js';
import { normalizeRegulatoryContent, sha256 } from './normalize.js';
import type { MonitorRunReport, MonitorSourceResult, RegulatorySource, SourceObservation } from './types.js';

const execFile = promisify(execFileCallback);
const USER_AGENT = 'ViDA-Regulatory-Monitor/0.1 (+https://github.com/Patrik2020/vida-vat-platform)';

type MonitorOptions = {
  stateDir: string;
  sources: readonly RegulatorySource[];
  repository: string | null;
  githubToken: string | null;
  now?: () => Date;
  fetchImpl?: typeof fetch;
};

type PreviousState = { observation: SourceObservation; content: string };
type FetchedDocument = { body: string; contentType: string; finalUrl: string; status: number };

function statePaths(stateDir: string, sourceId: string) {
  const directory = join(stateDir, sourceId);
  return { directory, content: join(directory, 'content.txt'), metadata: join(directory, 'metadata.json') };
}

async function readPreviousState(stateDir: string, sourceId: string): Promise<PreviousState | null> {
  const paths = statePaths(stateDir, sourceId);
  try {
    const [content, metadata] = await Promise.all([readFile(paths.content, 'utf8'), readFile(paths.metadata, 'utf8')]);
    return { content, observation: JSON.parse(metadata) as SourceObservation };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function writeState(stateDir: string, observation: SourceObservation, content: string): Promise<void> {
  const paths = statePaths(stateDir, observation.sourceId);
  await mkdir(paths.directory, { recursive: true });
  await Promise.all([
    writeFile(paths.content, `${content}\n`, 'utf8'),
    writeFile(paths.metadata, `${JSON.stringify(observation, null, 2)}\n`, 'utf8')
  ]);
}

function validateContent(source: RegulatorySource, normalized: string): void {
  if (normalized.length < source.minimumNormalizedCharacters) {
    throw new Error(`Normalized content is unexpectedly short (${normalized.length} chars; expected at least ${source.minimumNormalizedCharacters}).`);
  }
  const lower = normalized.toLocaleLowerCase('hu-HU');
  for (const required of source.mustContain) {
    if (!lower.includes(required.toLocaleLowerCase('hu-HU'))) {
      throw new Error(`Expected marker not found in fetched content: ${required}`);
    }
  }
}

function requestHeaders(source: RegulatorySource): Record<string, string> {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
    'Accept-Language': source.jurisdiction === 'HU' ? 'hu-HU,hu;q=0.9,en;q=0.7' : 'en,en-US;q=0.9',
    'User-Agent': USER_AGENT
  };
}

async function fetchWithNative(source: RegulatorySource, client: typeof fetch): Promise<FetchedDocument> {
  const response = await client(source.url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
    headers: requestHeaders(source)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return {
    body: await response.text(),
    contentType: response.headers.get('content-type') ?? '',
    finalUrl: response.url || source.url,
    status: response.status
  };
}

async function fetchWithCurl(source: RegulatorySource): Promise<FetchedDocument> {
  const marker = '__VIDA_CURL_META__';
  const headers = requestHeaders(source);
  const { stdout } = await execFile('curl', [
    '--ipv4', '--fail', '--location', '--silent', '--show-error', '--max-time', '25',
    '--user-agent', USER_AGENT,
    '--header', `Accept: ${headers.Accept}`,
    '--header', `Accept-Language: ${headers['Accept-Language']}`,
    '--write-out', `\n${marker}%{http_code}\t%{content_type}\t%{url_effective}`,
    source.url
  ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

  const markerIndex = stdout.lastIndexOf(`\n${marker}`);
  if (markerIndex < 0) throw new Error('curl fallback did not return response metadata');
  const body = stdout.slice(0, markerIndex);
  const metadata = stdout.slice(markerIndex + marker.length + 1).trim().split('\t');
  const status = Number(metadata[0]);
  if (!Number.isInteger(status) || status < 200 || status >= 300) throw new Error(`curl fallback returned HTTP ${metadata[0] ?? 'unknown'}`);
  return {
    body,
    contentType: metadata[1] ?? 'text/html',
    finalUrl: metadata[2] || source.url,
    status
  };
}

async function fetchDocument(source: RegulatorySource, fetchImpl?: typeof fetch): Promise<FetchedDocument> {
  if (fetchImpl) return fetchWithNative(source, fetchImpl);
  try {
    return await fetchWithNative(source, fetch);
  } catch (nativeError) {
    try {
      return await fetchWithCurl(source);
    } catch (curlError) {
      const nativeMessage = nativeError instanceof Error ? nativeError.message : String(nativeError);
      const curlMessage = curlError instanceof Error ? curlError.message : String(curlError);
      throw new Error(`native fetch failed: ${nativeMessage}; curl/IPv4 fallback failed: ${curlMessage}`);
    }
  }
}

export async function fetchObservation(
  source: RegulatorySource,
  fetchedAt: string,
  fetchImpl?: typeof fetch
): Promise<{ observation: SourceObservation; content: string }> {
  const document = await fetchDocument(source, fetchImpl);
  const normalized = normalizeRegulatoryContent(document.body, document.contentType);
  validateContent(source, normalized);
  return {
    content: normalized,
    observation: {
      sourceId: source.id,
      fetchedAt,
      finalUrl: document.finalUrl,
      httpStatus: document.status,
      contentType: document.contentType,
      sha256: sha256(normalized),
      normalizedCharacters: normalized.length
    }
  };
}

async function maybeCreateChangeIssue(
  options: MonitorOptions,
  source: RegulatorySource,
  previous: PreviousState,
  current: SourceObservation,
  content: string
): Promise<boolean> {
  if (!options.repository || !options.githubToken) return false;
  const diff = buildDiffExcerpt(previous.content, content);
  return ensureChangeIssue(
    options.repository,
    options.githubToken,
    source,
    current.sha256,
    buildChangeIssueBody(source, previous.observation, current, diff)
  );
}

async function maybeCreateErrorIssue(options: MonitorOptions, source: RegulatorySource, error: string, detectedAt: string): Promise<boolean> {
  if (!options.repository || !options.githubToken) return false;
  return ensureSourceErrorIssue(options.repository, options.githubToken, source, buildSourceErrorIssueBody(source, error, detectedAt));
}

export async function runRegulatoryMonitor(options: MonitorOptions): Promise<MonitorRunReport> {
  const checkedAt = (options.now ?? (() => new Date()))().toISOString();
  const results: MonitorSourceResult[] = [];

  for (const source of options.sources) {
    const previous = await readPreviousState(options.stateDir, source.id);
    try {
      const current = await fetchObservation(source, checkedAt, options.fetchImpl);
      if (!previous) {
        await writeState(options.stateDir, current.observation, current.content);
        results.push({ sourceId: source.id, status: 'bootstrap', previousSha256: null, currentSha256: current.observation.sha256, issueCreated: false, message: 'Initial observation recorded without opening a change issue.' });
        continue;
      }
      if (previous.observation.sha256 === current.observation.sha256) {
        results.push({ sourceId: source.id, status: 'unchanged', previousSha256: previous.observation.sha256, currentSha256: current.observation.sha256, issueCreated: false, message: 'No normalized content change detected.' });
        continue;
      }
      const issueCreated = await maybeCreateChangeIssue(options, source, previous, current.observation, current.content);
      await writeState(options.stateDir, current.observation, current.content);
      results.push({ sourceId: source.id, status: 'changed', previousSha256: previous.observation.sha256, currentSha256: current.observation.sha256, issueCreated, message: 'Change recorded; production rules were not modified.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const issueCreated = await maybeCreateErrorIssue(options, source, message, checkedAt);
      results.push({ sourceId: source.id, status: 'error', previousSha256: previous?.observation.sha256 ?? null, currentSha256: null, issueCreated, message });
    }
  }

  const totals = {
    sources: results.length,
    bootstrap: results.filter((item) => item.status === 'bootstrap').length,
    unchanged: results.filter((item) => item.status === 'unchanged').length,
    changed: results.filter((item) => item.status === 'changed').length,
    errors: results.filter((item) => item.status === 'error').length
  };
  const report: MonitorRunReport = { checkedAt, repository: options.repository, totals, results };
  await mkdir(options.stateDir, { recursive: true });
  await writeFile(join(options.stateDir, 'last-run.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}
