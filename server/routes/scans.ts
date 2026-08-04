import { Router } from 'express';
import { z } from 'zod';
import { scanWebsite } from '../services/accessibility-scanner.js';
import { scanWebsiteWithAxe } from '../services/axe-browserless-scanner.js';
import { resolveCompanyEmail } from '../services/company-email-resolver.js';
import { getCompanyBySiren } from '../services/company-search.js';
import { buildOpportunity } from '../services/opportunity-engine.js';
import { computeScore, estimateEligibility } from '../services/scoring.js';
import {
  getCompanyFromStorage,
  getScanById,
  listScans,
  saveOpportunity,
  saveScan,
  setCompanyEmail,
  setCompanyWebsite,
  upsertCompaniesFromSearch,
} from '../services/storage.js';
import { resolveWebsite } from '../services/website-resolver.js';

const router = Router();
const createScanSchema = z.object({
  siren: z.string().length(9),
  websiteUrl: z.string().url().optional().or(z.literal('')),
});

function computeAxeScore(totalViolations: number, criticalCount: number, seriousCount: number) {
  const weightedScore = totalViolations * 3 + seriousCount * 4 + criticalCount * 6;
  return Math.max(0, Math.min(100, weightedScore));
}

function computeAxeStatus(totalViolations: number) {
  if (totalViolations === 0) {
    return 'elements_partiels' as const;
  }

  return 'a_verifier_manuellement' as const;
}

router.get('/', async (_req, res) => {
  res.json({
    success: true,
    scans: await listScans(),
  });
});

router.get('/:scanId', async (req, res) => {
  const scan = await getScanById(req.params.scanId);
  if (!scan) {
    res.status(404).json({
      success: false,
      error: 'Analyse introuvable',
    });
    return;
  }

  res.json({
    success: true,
    scan,
  });
});

router.post('/', async (req, res, next) => {
  try {
    const body = createScanSchema.parse(req.body);
    const company = await getCompanyBySiren(body.siren);
    if (!company) {
      res.status(404).json({
        success: false,
        error: 'Entreprise introuvable',
      });
      return;
    }

    const eligibility = estimateEligibility(company);
    const resolution = await resolveWebsite(company, body.websiteUrl || undefined);
    await upsertCompaniesFromSearch([company]);
    await setCompanyWebsite(company.siren, resolution);

    if (!resolution.websiteUrl) {
      res.status(400).json({
        success: false,
        error: "Aucun site officiel n'a pu etre determine",
        resolution,
      });
      return;
    }

    const contacts = await resolveCompanyEmail(resolution.websiteUrl);
    if (contacts.email) {
      await setCompanyEmail(company.siren, contacts.email, contacts.source, contacts.notes);
    }

    const scanResult = await scanWebsite(resolution.websiteUrl);
    const { score, status } = computeScore(
      eligibility,
      scanResult.evidences,
      Boolean(resolution.websiteUrl),
    );

    const scan = await saveScan({
      id: crypto.randomUUID(),
      siren: company.siren,
      companyName: company.nom,
      websiteUrl: resolution.websiteUrl,
      score,
      status,
      eligibility,
      scannedAt: new Date().toISOString(),
      evidences: scanResult.evidences,
      notes: [...resolution.notes, ...scanResult.notes],
    });

    const storedCompany = await getCompanyFromStorage(company.siren);
    const opportunity = storedCompany
      ? await saveOpportunity(buildOpportunity(storedCompany, scan))
      : null;

    res.status(201).json({
      success: true,
      scan,
      opportunity,
      resolution,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/axe', async (req, res, next) => {
  try {
    const body = createScanSchema.parse(req.body);
    const company = await getCompanyBySiren(body.siren);
    if (!company) {
      res.status(404).json({
        success: false,
        error: 'Entreprise introuvable',
      });
      return;
    }

    const eligibility = estimateEligibility(company);
    const resolution = await resolveWebsite(company, body.websiteUrl || undefined);
    await upsertCompaniesFromSearch([company]);
    await setCompanyWebsite(company.siren, resolution);

    if (!resolution.websiteUrl) {
      res.status(400).json({
        success: false,
        error: "Aucun site officiel n'a pu etre determine",
        resolution,
      });
      return;
    }

    const axeSummary = await scanWebsiteWithAxe(resolution.websiteUrl);
    const score = computeAxeScore(
      axeSummary.totalViolations,
      axeSummary.violationsByImpact.critical,
      axeSummary.violationsByImpact.serious,
    );
    const status = computeAxeStatus(axeSummary.totalViolations);

    const scan = await saveScan({
      id: crypto.randomUUID(),
      siren: company.siren,
      companyName: company.nom,
      websiteUrl: resolution.websiteUrl,
      score,
      status,
      eligibility,
      scannedAt: axeSummary.scannedAt,
      evidences: [],
      notes: [
        ...resolution.notes,
        'Scan axe-core execute via Browserless sur une seule page.',
        'Les resultats affiches correspondent a des signaux detectes automatiquement.',
        'Les points critiques doivent etre confirmes par un audit humain cible.',
      ],
      axe: axeSummary,
    });

    res.status(201).json({
      success: true,
      scan,
      resolution,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
