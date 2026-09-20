import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  UBL_COMMON_AGGREGATE_NAMESPACE,
  UBL_COMMON_BASIC_NAMESPACE,
  UBL_CREDIT_NOTE_NAMESPACE,
  UBL_INVOICE_NAMESPACE,
} from './manifest.js';
import type { PintEuDocumentType, PintEuFinding } from './types.js';

export const MAX_PINT_EU_XML_BYTES = 2_097_152;
export type XmlRecord = Record<string, unknown>;

export function asRecord(value: unknown): XmlRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as XmlRecord) : undefined;
}

export function asArray(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function valueOf(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  const record = asRecord(value);
  const text = record?.['#text'];
  return typeof text === 'string' || typeof text === 'number' || typeof text === 'boolean' ? String(text) : undefined;
}

export function attribute(value: unknown, name: string): string | undefined {
  return valueOf(asRecord(value)?.[`@_${name}`]);
}

export type ParsedPintEuXml = { documentType?: PintEuDocumentType; root?: XmlRecord; findings: PintEuFinding[] };

export function parsePintEuXml(xml: string): ParsedPintEuXml {
  const findings: PintEuFinding[] = [];
  if (Buffer.byteLength(xml, 'utf8') > MAX_PINT_EU_XML_BYTES) {
    return { findings: [{ severity: 'fatal', ruleId: 'XML-SIZE-01', layer: 'xml', message: `XML exceeds ${MAX_PINT_EU_XML_BYTES} bytes.` }] };
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    return { findings: [{ severity: 'fatal', ruleId: 'XML-SEC-01', layer: 'xml', message: 'DOCTYPE and ENTITY declarations are not accepted.' }] };
  }
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    return { findings: [{ severity: 'fatal', ruleId: 'XML-WELLFORMED-01', layer: 'xml', message: validation.err.msg }] };
  }

  const rootMatch = xml.match(/<\s*(?:[A-Za-z_][\w.-]*:)?(Invoice|CreditNote)\b([^>]*)>/);
  const documentType = rootMatch?.[1] as PintEuDocumentType | undefined;
  if (!documentType) {
    return { findings: [{ severity: 'fatal', ruleId: 'UBL-ROOT-01', layer: 'ubl-2.1', message: 'Expected a UBL Invoice or CreditNote root.' }] };
  }
  const rootAttributes = rootMatch?.[2] ?? '';
  const expectedNamespace = documentType === 'Invoice' ? UBL_INVOICE_NAMESPACE : UBL_CREDIT_NOTE_NAMESPACE;
  if (!new RegExp(`xmlns(?::[A-Za-z_][\\w.-]*)?\\s*=\\s*["']${expectedNamespace}["']`).test(rootAttributes)) {
    findings.push({ severity: 'fatal', ruleId: 'UBL-NS-01', layer: 'ubl-2.1', message: `Expected ${documentType} namespace ${expectedNamespace}.`, path: `/${documentType}` });
  }
  for (const [prefix, namespace] of [['cbc', UBL_COMMON_BASIC_NAMESPACE], ['cac', UBL_COMMON_AGGREGATE_NAMESPACE]] as const) {
    if (!new RegExp(`xmlns:${prefix}\\s*=\\s*["']${namespace}["']`).test(xml)) {
      findings.push({ severity: 'fatal', ruleId: `UBL-NS-${prefix.toUpperCase()}`, layer: 'ubl-2.1', message: `Expected ${prefix} namespace ${namespace}.` });
    }
  }

  try {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: true, processEntities: false });
    const parsed = asRecord(parser.parse(xml));
    const root = asRecord(parsed?.[documentType]);
    if (!root) findings.push({ severity: 'fatal', ruleId: 'UBL-ROOT-02', layer: 'ubl-2.1', message: `Could not parse ${documentType} root.` });
    return root ? { documentType, root, findings } : { documentType, findings };
  } catch (error) {
    findings.push({ severity: 'fatal', ruleId: 'XML-PARSE-01', layer: 'xml', message: error instanceof Error ? error.message : 'Unknown XML parse error.' });
    return { documentType, findings };
  }
}
