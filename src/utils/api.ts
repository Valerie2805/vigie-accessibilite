import type { Company, Scan, WebsiteResolution } from '@/types';

async function request<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  const raw = await response.text();
  let payload: Record<string, unknown> = {};

  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    if (!response.ok) {
      throw new Error(`Erreur serveur (${response.status})`);
    }
  }

  if (!response.ok || payload.success === false) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : `Une erreur est survenue (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function searchCompanies(
  query?: string,
  city?: string,
  metier?: string,
  minRevenue?: number,
  maxRevenue?: number,
) {
  const url = new URL('/api/companies/search', window.location.origin);
  if (query?.trim()) {
    url.searchParams.set('q', query.trim());
  }
  if (city?.trim()) {
    url.searchParams.set('city', city.trim());
  }
  if (metier?.trim()) {
    url.searchParams.set('metier', metier.trim());
  }
  if (typeof minRevenue === 'number' && !Number.isNaN(minRevenue)) {
    url.searchParams.set('minRevenue', String(minRevenue));
  }
  if (typeof maxRevenue === 'number' && !Number.isNaN(maxRevenue)) {
    url.searchParams.set('maxRevenue', String(maxRevenue));
  }

  return request<{ results: Company[] }>(url.toString());
}

export async function getCompany(siren: string) {
  return request<{ company: Company }>(`/api/companies/${siren}`);
}

export async function resolveWebsite(siren: string, manualWebsite?: string) {
  return request<{ company: Company; resolution: WebsiteResolution }>(
    '/api/companies/resolve-website',
    {
      method: 'POST',
      body: JSON.stringify({
        siren,
        manualWebsite: manualWebsite?.trim() || '',
      }),
    },
  );
}

export async function createScan(siren: string, websiteUrl?: string) {
  return request<{ scan: Scan; resolution: WebsiteResolution }>('/api/scans', {
    method: 'POST',
    body: JSON.stringify({
      siren,
      websiteUrl: websiteUrl?.trim() || '',
    }),
  });
}

export async function getScan(scanId: string) {
  return request<{ scan: Scan }>(`/api/scans/${scanId}`);
}

export async function listScans() {
  return request<{ scans: Scan[] }>('/api/scans');
}

export async function listRecentCompanies(limit?: number) {
  const url = new URL('/api/companies/recent', window.location.origin);
  if (typeof limit === 'number' && !Number.isNaN(limit)) {
    url.searchParams.set('limit', String(limit));
  }

  return request<{ companies: Company[] }>(url.toString());
}
