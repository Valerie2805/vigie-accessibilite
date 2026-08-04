import { Router } from 'express';
import { z } from 'zod';
import { scanWebsite } from '../services/accessibility-scanner.js';
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
  const schema = z.object({
    siren: z.string().length(9),
    websiteUrl: z.string().url().optional().or(z.literal('')),
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

export default router;
