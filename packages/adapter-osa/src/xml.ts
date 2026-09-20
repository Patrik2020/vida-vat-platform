import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { OSA_INVOICE_DATA_NAMESPACE } from './source.js';
import type { OsaAdapterIssue } from './types.js';

export const MAX_OSA_XML_BYTES = 1_048_576;

export type XmlRecord = Record<string, unknown>;

export function asRecord(value: unknown): XmlRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as XmlRecord) : undefined;
}

export function asArray(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

export function parseOsaInvoiceDataXml(xml: string): { root?: XmlRecord; issues: OsaAdapterIssue[] } {
  const issues: OsaAdapterIssue[] = [];
  if (Buffer.byteLength(xml, 'utf8') > MAX_OSA_XML_BYTES) {
    issues.push({ severity: 'error', code: 'XML_TOO_LARGE', message: `OSA XML exceeds ${MAX_OSA_XML_BYTES} bytes.` });
    return { issues };
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    issues.push({ severity: 'error', code: 'UNSAFE_XML_DECLARATION', message: 'DOCTYPE and ENTITY declarations are not accepted.' });
    return { issues };
  }
  const namespacePattern = new RegExp(`xmlns(?::[A-Za-z_][\\w.-]*)?\\s*=\\s*["']${OSA_INVOICE_DATA_NAMESPACE.replaceAll('/', '\\/')}["']`);
  if (!namespacePattern.test(xml)) {
    issues.push({ severity: 'error', code: 'UNSUPPORTED_OSA_NAMESPACE', message: `Expected OSA invoiceData namespace ${OSA_INVOICE_DATA_NAMESPACE}.` });
    return { issues };
  }
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    issues.push({ severity: 'error', code: 'MALFORMED_XML', message: validation.err.msg });
    return { issues };
  }
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: false,
      trimValues: true,
      processEntities: false,
    });
    const parsed = asRecord(parser.parse(xml));
    const root = asRecord(parsed?.InvoiceData);
    if (!root) issues.push({ severity: 'error', code: 'MISSING_INVOICE_DATA_ROOT', message: 'Expected InvoiceData root element.' });
    return root ? { root, issues } : { issues };
  } catch (error) {
    issues.push({ severity: 'error', code: 'XML_PARSE_ERROR', message: error instanceof Error ? error.message : 'Unknown XML parse error.' });
    return { issues };
  }
}
