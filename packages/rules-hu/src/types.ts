export type HungaryVatRate = 0 | 5 | 18 | 27;

export type RegulatorySource = {
  id: string;
  authority: string;
  title: string;
  url: string;
  publishedAt?: string;
};

export type RateClassificationResult =
  | {
      status: 'classified';
      rate: HungaryVatRate;
      classificationCode: string;
      legalBasis: string;
      sourceIds: string[];
      effectiveDate: string;
    }
  | {
      status: 'manual_review';
      reason: string;
      effectiveDate: string;
      sourceIds: string[];
    };
