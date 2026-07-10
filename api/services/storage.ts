import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { CompanyRecord, CompanySearchResult, ScanRecord, WebsiteResolution } from '../types.js';

type StorageShape = {
  scans: ScanRecord[];
  companies: CompanyRecord[];
};

const dataDirectory = path.resolve(process.cwd(), 'data');
const dataFilePath = path.join(dataDirectory, 'scans.json');

function ensureStorageFile() {
  if (!existsSync(dataDirectory)) {
    mkdirSync(dataDirectory, { recursive: true });
  }

  if (!existsSync(dataFilePath)) {
    writeFileSync(dataFilePath, JSON.stringify({ scans: [], companies: [] }, null, 2));
  }
}

function readStorage(): StorageShape {
  ensureStorageFile();
  const raw = readFileSync(dataFilePath, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<StorageShape>;
  return {
    scans: parsed.scans ?? [],
    companies: (parsed.companies ?? []).map((company) => ({
      ...company,
      websiteUrl: company.websiteUrl ?? null,
      websiteSource: company.websiteSource ?? 'inconnue',
      websiteConfidence: company.websiteConfidence ?? 'faible',
      websiteNotes: company.websiteNotes ?? [],
      email: company.email ?? null,
      emailSource: company.emailSource ?? 'inconnue',
      emailNotes: company.emailNotes ?? [],
      lastSeenAt: company.lastSeenAt ?? new Date().toISOString(),
    })),
  };
}

function writeStorage(payload: StorageShape) {
  ensureStorageFile();
  writeFileSync(dataFilePath, JSON.stringify(payload, null, 2));
}

function toCompanyRecord(company: CompanySearchResult): CompanyRecord {
  return {
    ...company,
    websiteUrl: null,
    websiteSource: 'inconnue',
    websiteConfidence: 'faible',
    websiteNotes: [],
    email: null,
    emailSource: 'inconnue',
    emailNotes: [],
    lastSeenAt: new Date().toISOString(),
  };
}

export function upsertCompaniesFromSearch(companies: CompanySearchResult[]) {
  const storage = readStorage();
  const now = new Date().toISOString();

  const bySiren = new Map(storage.companies.map((company) => [company.siren, company]));

  for (const company of companies) {
    const existing = bySiren.get(company.siren);
    if (existing) {
      bySiren.set(company.siren, {
        ...existing,
        ...company,
        lastSeenAt: now,
      });
    } else {
      bySiren.set(company.siren, {
        ...toCompanyRecord(company),
        lastSeenAt: now,
      });
    }
  }

  storage.companies = Array.from(bySiren.values())
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, 200);

  writeStorage(storage);
  return storage.companies;
}

export function setCompanyWebsite(siren: string, resolution: WebsiteResolution) {
  const storage = readStorage();
  const now = new Date().toISOString();

  const updatedCompanies = storage.companies.map((company) => {
    if (company.siren !== siren) {
      return company;
    }

    return {
      ...company,
      websiteUrl: resolution.websiteUrl,
      websiteSource: resolution.source,
      websiteConfidence: resolution.confidence,
      websiteNotes: resolution.notes,
      lastSeenAt: now,
    };
  });

  storage.companies = updatedCompanies
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, 200);

  writeStorage(storage);
  return storage.companies.find((company) => company.siren === siren) ?? null;
}

export function setCompanyEmail(
  siren: string,
  email: string | null,
  source: CompanyRecord['emailSource'],
  notes: string[],
) {
  const storage = readStorage();
  const now = new Date().toISOString();

  const updatedCompanies = storage.companies.map((company) => {
    if (company.siren !== siren) {
      return company;
    }

    if (email === company.email && source === company.emailSource) {
      return {
        ...company,
        lastSeenAt: now,
      };
    }

    return {
      ...company,
      email,
      emailSource: source,
      emailNotes: notes,
      lastSeenAt: now,
    };
  });

  storage.companies = updatedCompanies
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, 200);

  writeStorage(storage);
  return storage.companies.find((company) => company.siren === siren) ?? null;
}

export function getCompanyFromStorage(siren: string) {
  return readStorage().companies.find((company) => company.siren === siren) ?? null;
}

export function listCompanies(limit = 50) {
  return readStorage().companies
    .slice()
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, limit);
}

export function saveScan(scan: ScanRecord) {
  const storage = readStorage();
  storage.scans = [scan, ...storage.scans.filter((item) => item.id !== scan.id)].slice(0, 40);
  writeStorage(storage);
  return scan;
}

export function getScanById(scanId: string) {
  return readStorage().scans.find((scan) => scan.id === scanId) ?? null;
}

export function listScans() {
  return readStorage().scans;
}
