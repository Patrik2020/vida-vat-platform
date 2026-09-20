import type { CanonicalInvoice } from '@vida/invoice-model';

export type OsaAdapterIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  sourcePath?: string;
  targetPath?: string;
};

export type OsaMappingEvidence = {
  sourcePath: string;
  targetPath: string;
  transformation: 'direct' | 'code_map' | 'fraction_to_percent' | 'derived' | 'caller_evidence';
  sourceValue?: string;
};

export type OsaAdapterOptions = {
  transformedAt: string;
  /**
   * EN 16931 BT-115. OSA 3.0 does not provide a semantically equivalent
   * amount-due field, so successful mapping requires caller-held evidence.
   */
  amountDue?: string;
  prepaidAmount?: string;
  payableRoundingAmount?: string;
};

export type OsaAdapterResult =
  | {
      status: 'mapped';
      invoice: CanonicalInvoice;
      issues: OsaAdapterIssue[];
      evidence: OsaMappingEvidence[];
    }
  | {
      status: 'manual_review';
      reasonCodes: string[];
      issues: OsaAdapterIssue[];
      evidence: OsaMappingEvidence[];
    };
