export type CompanySearchResult = {
  siren: string;
  nom: string;
  ville: string | null;
  codePostal: string | null;
  activite: string | null;
  categorieEntreprise: string | null;
  trancheEffectif: string | null;
  adresse: string | null;
  chiffreAffaires: number | null;
  source: 'api_recherche_entreprises' | 'demo';
};

export type EligibilityStatus =
  | 'soumis_probable'
  | 'hors_perimetre_probable'
  | 'incertain';

export type WebsiteResolution = {
  websiteUrl: string | null;
  source: 'google_places' | 'recherche_web' | 'manuel' | 'inconnue';
  confidence: 'haute' | 'moyenne' | 'faible';
  notes: string[];
};

export type CompanyRecord = CompanySearchResult & {
  websiteUrl: string | null;
  websiteSource: WebsiteResolution['source'];
  websiteConfidence: WebsiteResolution['confidence'];
  websiteNotes: string[];
  email: string | null;
  emailSource: 'site' | 'inconnue';
  emailNotes: string[];
  lastSeenAt: string;
};

export type ScanEvidenceKind =
  | 'page_accessibilite'
  | 'declaration'
  | 'mention_accueil'
  | 'contact_accessibilite'
  | 'mot_cle';

export type ScanEvidence = {
  id: string;
  kind: ScanEvidenceKind;
  label: string;
  sourceUrl: string;
  excerpt?: string;
};

export type ScanStatus =
  | 'elements_detectes'
  | 'elements_partiels'
  | 'conformite_non_demontree'
  | 'a_verifier_manuellement';

export type ScanRecord = {
  id: string;
  siren: string;
  companyName: string;
  websiteUrl: string;
  score: number;
  status: ScanStatus;
  eligibility: EligibilityStatus;
  scannedAt: string;
  evidences: ScanEvidence[];
  notes: string[];
};
