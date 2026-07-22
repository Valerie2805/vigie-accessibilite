export type EligibilityStatus =
  | 'soumis_probable'
  | 'hors_perimetre_probable'
  | 'incertain';

export type ScanStatus =
  | 'elements_detectes'
  | 'elements_partiels'
  | 'conformite_non_demontree'
  | 'a_verifier_manuellement';

export type Company = {
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
  websiteUrl: string | null;
  websiteSource: 'google_places' | 'recherche_web' | 'manuel' | 'inconnue';
  websiteConfidence: 'haute' | 'moyenne' | 'faible';
  email: string | null;
  lastSeenAt?: string;
  eligibility: EligibilityStatus;
  latestScanStatus?: ScanStatus | null;
  latestScannedAt?: string | null;
};

export type WebsiteResolution = {
  websiteUrl: string | null;
  source: 'google_places' | 'recherche_web' | 'manuel' | 'inconnue';
  confidence: 'haute' | 'moyenne' | 'faible';
  notes: string[];
};

export type ScanEvidence = {
  id: string;
  kind:
    | 'page_accessibilite'
    | 'declaration'
    | 'mention_accueil'
    | 'contact_accessibilite'
    | 'mot_cle';
  label: string;
  sourceUrl: string;
  excerpt?: string;
};

export type Scan = {
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
