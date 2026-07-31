import { Router } from 'express';
import { z } from 'zod';
import { resolveCompanyEmail } from '../services/company-email-resolver.js';
import { getCompanyBySiren, searchCompanies } from '../services/company-search.js';
import { estimateEligibility } from '../services/scoring.js';
import {
  getCompanyFromStorage,
  listCompanies,
  listScans,
  setCompanyEmail,
  setCompanyWebsite,
  upsertCompaniesFromSearch,
} from '../services/storage.js';
import { resolveWebsite } from '../services/website-resolver.js';

const router = Router();

function getLatestScanIndex() {
  const bySiren = new Map<string, { status: string; scannedAt: string }>();

  for (const scan of listScans()) {
    const existing = bySiren.get(scan.siren);
    if (!existing || existing.scannedAt < scan.scannedAt) {
      bySiren.set(scan.siren, {
        status: scan.status,
        scannedAt: scan.scannedAt,
      });
    }
  }

  return bySiren;
}

router.get('/search', async (req, res, next) => {
  const schema = z.object({
    q: z.string().optional().default(''),
    city: z.string().optional(),
    metier: z.string().optional(),
    minRevenue: z.coerce.number().nonnegative().optional(),
    maxRevenue: z.coerce.number().nonnegative().optional(),
  });

  try {
    const params = schema.parse(req.query);
    if (params.q.trim().length < 2 && (params.metier?.trim().length ?? 0) < 2) {
      res.status(400).json({
        success: false,
        error: 'Renseigne au moins un nom ou un metier sur 2 caracteres minimum',
      });
      return;
    }

    const results = await searchCompanies(
      params.q,
      params.city,
      params.metier,
      params.minRevenue,
      params.maxRevenue,
    );

    const storedCompanies = upsertCompaniesFromSearch(results);
    const storedIndex = new Map(storedCompanies.map((company) => [company.siren, company]));
    const latestScanIndex = getLatestScanIndex();

    res.json({
      success: true,
      results: results.map((company) => ({
        ...company,
        websiteUrl: storedIndex.get(company.siren)?.websiteUrl ?? null,
        websiteSource: storedIndex.get(company.siren)?.websiteSource ?? 'inconnue',
        websiteConfidence: storedIndex.get(company.siren)?.websiteConfidence ?? 'faible',
        email: storedIndex.get(company.siren)?.email ?? null,
        eligibility: estimateEligibility(company),
        latestScanStatus: latestScanIndex.get(company.siren)?.status ?? null,
        latestScannedAt: latestScanIndex.get(company.siren)?.scannedAt ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/recent', (req, res, next) => {
  const schema = z.object({
    limit: z.coerce.number().int().positive().max(200).optional(),
  });

  try {
    const params = schema.parse(req.query);
    const companies = listCompanies(params.limit ?? 50);
    const latestScanIndex = getLatestScanIndex();
    res.json({
      success: true,
      companies: companies.map((company) => ({
        ...company,
        eligibility: estimateEligibility(company),
        latestScanStatus: latestScanIndex.get(company.siren)?.status ?? null,
        latestScannedAt: latestScanIndex.get(company.siren)?.scannedAt ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:siren', async (req, res, next) => {
  try {
    const company = await getCompanyBySiren(req.params.siren);
    if (!company) {
      res.status(404).json({
        success: false,
        error: 'Entreprise introuvable',
      });
      return;
    }

    upsertCompaniesFromSearch([company]);
    const stored = getCompanyFromStorage(company.siren);
    const latestScanIndex = getLatestScanIndex();

    res.json({
      success: true,
      company: {
        ...company,
        websiteUrl: stored?.websiteUrl ?? null,
        websiteSource: stored?.websiteSource ?? 'inconnue',
        websiteConfidence: stored?.websiteConfidence ?? 'faible',
        email: stored?.email ?? null,
        eligibility: estimateEligibility(company),
        latestScanStatus: latestScanIndex.get(company.siren)?.status ?? null,
        latestScannedAt: latestScanIndex.get(company.siren)?.scannedAt ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/resolve-website', async (req, res, next) => {
  const schema = z.object({
    siren: z.string().length(9),
    manualWebsite: z.string().url().optional().or(z.literal('')),
  });

  try {
    const body = schema.parse(req.body);
    const company = await getCompanyBySiren(body.siren);
    if (!company) {
      res.status(404).json({
        success: false,
        error: 'Entreprise introuvable',
      });
      return;
    }

    const resolution = await resolveWebsite(company, body.manualWebsite || undefined);
    upsertCompaniesFromSearch([company]);
    setCompanyWebsite(company.siren, resolution);
    const stored = getCompanyFromStorage(company.siren);

    if (resolution.websiteUrl) {
      const contacts = await resolveCompanyEmail(resolution.websiteUrl);
      const existingEmail = stored?.email ?? null;
      if (contacts.email && contacts.email !== existingEmail) {
        setCompanyEmail(company.siren, contacts.email, contacts.source, contacts.notes);
      } else if (!existingEmail && contacts.email) {
        setCompanyEmail(company.siren, contacts.email, contacts.source, contacts.notes);
      }
    }

    const storedAfter = getCompanyFromStorage(company.siren);
    const latestScanIndex = getLatestScanIndex();

    res.json({
      success: true,
      company: {
        ...company,
        websiteUrl: resolution.websiteUrl,
        websiteSource: resolution.source,
        websiteConfidence: resolution.confidence,
        email: storedAfter?.email ?? null,
        eligibility: estimateEligibility(company),
        latestScanStatus: latestScanIndex.get(company.siren)?.status ?? null,
        latestScannedAt: latestScanIndex.get(company.siren)?.scannedAt ?? null,
      },
      resolution,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
