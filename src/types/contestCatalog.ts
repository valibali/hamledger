export interface ContestCatalogEntry {
  id: string;
  name: string;
  section: string;
  rulesUrl: string | null;
  rulesSummary: string;
  sponsor: string;
  description: string;
  suggestedProfileId: string;
  defaultSentExchange: string;
}
