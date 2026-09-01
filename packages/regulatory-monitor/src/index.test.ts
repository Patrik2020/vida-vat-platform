import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDiffExcerpt, normalizeRegulatoryContent, runRegulatoryMonitor, sha256 } from './index.js';
import type { RegulatorySource } from './types.js';

const source: RegulatorySource = {
  id: 'TEST-SOURCE', jurisdiction: 'HU', authority: 'Test Authority', title: 'Test VAT source',
  url: 'https://example.test/vat', kind: 'legislation', impactAreas: ['rates'], mustContain: ['VAT RULE'], minimumNormalizedCharacters: 8
};

function response(body: string) {
  return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }));
}

describe('regulatory monitor', () => {
  it('normalizes HTML noise before hashing', () => {
    const a = normalizeRegulatoryContent('<html><script>volatile()</script><p> VAT   RULE </p><div>27%</div></html>', 'text/html');
    const b = normalizeRegulatoryContent('<html><script>different()</script><p>VAT RULE</p>\n<div>27%</div></html>', 'text/html');
    expect(a).toBe('VAT RULE\n27%');
    expect(sha256(a)).toBe(sha256(b));
  });

  it('builds capped added/removed line excerpts', () => {
    expect(buildDiffExcerpt('VAT RULE\n27%', 'VAT RULE\n27%\n5%')).toEqual({ added: ['5%'], removed: [] });
  });

  it('bootstraps, detects no-op, then detects a change without altering any ruleset', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'vida-reg-monitor-'));
    const first = await runRegulatoryMonitor({ stateDir, sources: [source], repository: null, githubToken: null, fetchImpl: () => response('<p>VAT RULE</p><p>27%</p>') });
    expect(first.totals.bootstrap).toBe(1);

    const second = await runRegulatoryMonitor({ stateDir, sources: [source], repository: null, githubToken: null, fetchImpl: () => response('<p>VAT RULE</p><p>27%</p>') });
    expect(second.totals.unchanged).toBe(1);

    const third = await runRegulatoryMonitor({ stateDir, sources: [source], repository: null, githubToken: null, fetchImpl: () => response('<p>VAT RULE</p><p>18%</p>') });
    expect(third.totals.changed).toBe(1);
    expect(await readFile(join(stateDir, 'TEST-SOURCE', 'content.txt'), 'utf8')).toContain('18%');
  });

  it('keeps previous observation when a source becomes invalid', async () => {
    const stateDir = await mkdtemp(join(tmpdir(), 'vida-reg-monitor-'));
    await runRegulatoryMonitor({ stateDir, sources: [source], repository: null, githubToken: null, fetchImpl: () => response('<p>VAT RULE</p><p>27%</p>') });
    const failed = await runRegulatoryMonitor({ stateDir, sources: [source], repository: null, githubToken: null, fetchImpl: () => response('<p>unrelated page</p>') });
    expect(failed.totals.errors).toBe(1);
    expect(await readFile(join(stateDir, 'TEST-SOURCE', 'content.txt'), 'utf8')).toContain('27%');
  });
});
