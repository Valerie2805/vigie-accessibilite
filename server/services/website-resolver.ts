import type { CompanySearchResult, WebsiteResolution } from '../types.js';
import * as cheerio from 'cheerio';

type FindPlaceResponse = {
  candidates?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
  }>;
  status?: string;
};

type PlaceDetailsResponse = {
  result?: {
    website?: string;
    url?: string;
    name?: string;
  };
  status?: string;
};

type SearchCandidate = {
  url: string;
  title: string;
  snippet: string;
};

const ignoredHosts = [
  'annuaire-entreprises.data.gouv.fr',
  'annuaire-entreprises.gouv.fr',
  'www.societe.com',
  'societe.com',
  'www.pappers.fr',
  'pappers.fr',
  'www.pple.fr',
  'pple.fr',
  'www.infonet.fr',
  'infonet.fr',
  'www.manageo.fr',
  'manageo.fr',
  'www.verif.com',
  'verif.com',
  'fr.linkedin.com',
  'linkedin.com',
  'www.linkedin.com',
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'x.com',
  'www.x.com',
  'maps.google.com',
  'www.google.com',
];

const genericTokens = new Set([
  'societe',
  'societes',
  'entreprise',
  'entreprises',
  'groupe',
  'travaux',
  'publics',
  'public',
  'service',
  'services',
  'france',
  'batiment',
  'construction',
  'compagnie',
  'agence',
  'holding',
]);

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenizeCompanyName(companyName: string) {
  return normalizeText(companyName)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3)
    .filter((token) => !genericTokens.has(token));
}

function isIgnoredHost(host: string) {
  return ignoredHosts.some((ignoredHost) => host === ignoredHost || host.endsWith(`.${ignoredHost}`));
}

function parseSearchResultUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, 'https://duckduckgo.com');
    const redirected = parsed.searchParams.get('uddg');
    return redirected ? decodeURIComponent(redirected) : parsed.toString();
  } catch {
    return rawUrl;
  }
}

function toWebsiteRoot(url: string) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function extractSearchCandidates(html: string) {
  const $ = cheerio.load(html);
  const results: SearchCandidate[] = [];

  $('a.result__a, a[data-testid="result-title-a"], .result a[href], .links_main a[href]')
    .slice(0, 12)
    .each((_, element) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();
      const snippet =
        $(element).closest('.result, .web-result').find('.result__snippet, .result__extras').text().trim() ??
        '';

      if (!href || !title) {
        return;
      }

      const parsedUrl = parseSearchResultUrl(href);
      results.push({
        url: parsedUrl,
        title,
        snippet,
      });
    });

  return results;
}

function buildSearchQueries(company: CompanySearchResult) {
  return [
    [company.nom, company.ville, company.codePostal].filter(Boolean).join(' '),
    `"${company.nom}" site officiel`,
    `"${company.nom}" ${company.ville ?? ''}`.trim(),
  ].filter(Boolean);
}

async function searchWebCandidates(company: CompanySearchResult) {
  const candidates: SearchCandidate[] = [];

  for (const query of buildSearchQueries(company)) {
    const url = new URL('https://html.duckduckgo.com/html/');
    url.searchParams.set('q', query);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TraeAccessibilityMvp/0.1',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      candidates.push(...extractSearchCandidates(html));
    } catch {
      continue;
    }

    if (candidates.length >= 5) {
      break;
    }
  }

  return candidates;
}

function scoreCandidate(company: CompanySearchResult, candidate: SearchCandidate) {
  const tokens = tokenizeCompanyName(company.nom);
  const titleAndSnippet = normalizeText(`${candidate.title} ${candidate.snippet}`);
  const url = normalizeWebsite(candidate.url);

  try {
    const host = new URL(url).host.toLowerCase();
    if (isIgnoredHost(host)) {
      return -100;
    }

    let score = 0;
    const root = toWebsiteRoot(url);
    if (root) {
      score += 1;
    }

    for (const token of tokens) {
      if (host.includes(token)) {
        score += 4;
      }
      if (titleAndSnippet.includes(token)) {
        score += 2;
      }
    }

    const normalizedCity = company.ville ? normalizeText(company.ville) : '';
    if (normalizedCity && titleAndSnippet.includes(normalizedCity)) {
      score += 1;
    }

    if (/site officiel|contact|accueil|groupe/.test(titleAndSnippet)) {
      score += 1;
    }

    return score;
  } catch {
    return -100;
  }
}

async function resolveWithWebSearch(company: CompanySearchResult) {
  const candidates = await searchWebCandidates(company);
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(company, candidate),
    }))
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.candidate;
  if (!best) {
    return null;
  }

  return toWebsiteRoot(best.url) ?? normalizeWebsite(best.url);
}

async function resolveWithGooglePlaces(company: CompanySearchResult) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return null;
  }

  const query = [company.nom, company.ville, company.codePostal].filter(Boolean).join(' ');
  const findPlaceUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  findPlaceUrl.searchParams.set('input', query);
  findPlaceUrl.searchParams.set('inputtype', 'textquery');
  findPlaceUrl.searchParams.set('fields', 'place_id,name,formatted_address');
  findPlaceUrl.searchParams.set('key', apiKey);

  const placeResponse = await fetch(findPlaceUrl);
  if (!placeResponse.ok) {
    return null;
  }

  const placePayload = (await placeResponse.json()) as FindPlaceResponse;
  const placeId = placePayload.candidates?.[0]?.place_id;
  if (!placeId) {
    return null;
  }

  const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  detailsUrl.searchParams.set('place_id', placeId);
  detailsUrl.searchParams.set('fields', 'website,url,name');
  detailsUrl.searchParams.set('key', apiKey);

  const detailsResponse = await fetch(detailsUrl);
  if (!detailsResponse.ok) {
    return null;
  }

  const detailsPayload = (await detailsResponse.json()) as PlaceDetailsResponse;
  return detailsPayload.result?.website ?? null;
}

function normalizeWebsite(url: string) {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.hash = '';
    parsedUrl.search = '';
    return parsedUrl.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

export async function resolveWebsite(
  company: CompanySearchResult,
  manualWebsite?: string,
): Promise<WebsiteResolution> {
  if (manualWebsite?.trim()) {
    return {
      websiteUrl: normalizeWebsite(manualWebsite),
      source: 'manuel',
      confidence: 'haute',
      notes: ['URL fournie manuellement par l’utilisateur'],
    };
  }

  try {
    const googleWebsite = await resolveWithGooglePlaces(company);
    if (googleWebsite) {
      return {
        websiteUrl: normalizeWebsite(googleWebsite),
        source: 'google_places',
        confidence: 'moyenne',
        notes: ['Site resolu via Google Places API'],
      };
    }
  } catch {
  }

  try {
    const webSearchWebsite = await resolveWithWebSearch(company);
    if (webSearchWebsite) {
      return {
        websiteUrl: webSearchWebsite,
        source: 'recherche_web',
        confidence: 'moyenne',
        notes: ['Site resolu via recherche web automatique'],
      };
    }
  } catch {
    return {
      websiteUrl: null,
      source: 'inconnue',
      confidence: 'faible',
      notes: ['La resolution automatique du site a echoue'],
    };
  }

  return {
    websiteUrl: null,
    source: 'inconnue',
    confidence: 'faible',
    notes: ['Aucun site officiel n’a ete trouve automatiquement'],
  };
}
