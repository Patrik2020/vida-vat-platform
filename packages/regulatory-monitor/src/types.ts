export type RegulatorySourceKind = 'legislation' | 'tax_authority' | 'implementation' | 'discovery_feed';

export type RegulatorySource = {
  id: string;
  jurisdiction: 'HU' | 'EU';
  authority: string;
  title: string;
  url: string;
  kind: RegulatorySourceKind;
  impactAreas: readonly string[];
  mustContain: readonly string[];
  minimumNormalizedCharacters: number;
};

export type SourceObservation = {
  sourceId: string;
  fetchedAt: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  sha256: string;
  normalizedCharacters: number;
};

export type DiffExcerpt = {
  added: string[];
  removed: string[];
};

export type MonitorSourceResult = {
  sourceId: string;
  status: 'bootstrap' | 'unchanged' | 'changed' | 'error';
  previousSha256: string | null;
  currentSha256: string | null;
  issueCreated: boolean;
  message: string;
};

export type MonitorRunReport = {
  checkedAt: string;
  repository: string | null;
  totals: {
    sources: number;
    bootstrap: number;
    unchanged: number;
    changed: number;
    errors: number;
  };
  results: MonitorSourceResult[];
};
