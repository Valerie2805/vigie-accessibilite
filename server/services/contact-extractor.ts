import * as cheerio from 'cheerio';

export type ContactExtraction = {
  email: string | null;
  emails: string[];
  notes: string[];
};

const candidatePaths = [
  '',
  '/contact',
  '/contactez-nous',
  '/nous-contacter',
  '/mentions-legales',
  '/mentions-legales/',
  '/support',
  '/sav',
];

const contactLinkPattern =
  /(contact|contactez|nous-contacter|mentions-legales|support|sav|service-client)/i;

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const ignoredEmails = new Set([
  'example@example.com',
  'contact@example.com',
  'support@example.com',
  'admin@example.com',
  'hello@example.com',
  'test@test.com',
  'test@example.com',
]);

function normalizeEmail(raw: string) {
  const cleaned = raw.trim().replace(/[)\].,;:!?]+$/g, '');
  return cleaned.toLowerCase();
}

function uniq(items: string[]) {
  return Array.from(new Set(items));
}

function isProbablyValidEmail(email: string) {
  if (email.length > 254) return false;
  if (ignoredEmails.has(email)) return false;
  if (!email.includes('@')) return false;
  const [local, domain] = email.split('@');
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (!domain.includes('.')) return false;
  return true;
}

function extractEmailsFromHtml(html: string) {
  const $ = cheerio.load(html);
  const mailtos = $('a[href^="mailto:"]')
    .map((_, element) => $(element).attr('href') ?? '')
    .get()
    .map((href) => href.replace(/^mailto:/i, '').split('?')[0] ?? '')
    .map(normalizeEmail)
    .filter(Boolean)
    .filter(isProbablyValidEmail);

  const text = $('body').text();
  const htmlMatches = (html.match(emailPattern) ?? []).map(normalizeEmail);
  const textMatches = (text.match(emailPattern) ?? []).map(normalizeEmail);

  const combined = uniq([...mailtos, ...htmlMatches, ...textMatches]).filter(isProbablyValidEmail);
  return {
    emails: combined,
    primaryEmail: combined[0] ?? null,
  };
}

async function fetchHtml(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TraeAccessibilityMvp/0.1',
      },
      signal: AbortSignal.timeout(6500),
    });

    if (!response.ok) {
      return {
        url,
        html: null as string | null,
        status: response.status,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return {
        url,
        html: null as string | null,
        status: response.status,
      };
    }

    return {
      url,
      html: await response.text(),
      status: response.status,
    };
  } catch {
    return {
      url,
      html: null as string | null,
      status: null as number | null,
    };
  }
}

function resolveUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractContactLinks(baseUrl: string, html: string) {
  const $ = cheerio.load(html);
  const links = $('a')
    .map((_, element) => ({
      href: $(element).attr('href'),
      label: $(element).text().trim(),
    }))
    .get()
    .map((link) => ({
      href: link.href?.trim() ?? '',
      label: link.label,
    }))
    .filter((link) => link.href.length > 0)
    .filter((link) => contactLinkPattern.test(`${link.label} ${link.href}`))
    .map((link) => resolveUrl(baseUrl, link.href))
    .filter((value): value is string => Boolean(value));

  return uniq(links);
}

export async function extractContacts(websiteUrl: string): Promise<ContactExtraction> {
  const base = websiteUrl.replace(/\/$/, '');
  const baseHost = (() => {
    try {
      return new URL(base).host;
    } catch {
      return null;
    }
  })();
  const notes: string[] = [];
  const visited = new Set<string>();
  const toVisit: string[] = [];

  for (const path of candidatePaths) {
    if (!path) {
      toVisit.push(base);
      continue;
    }

    const resolved = resolveUrl(base, path);
    if (resolved) {
      toVisit.push(resolved);
    }
  }

  let emails: string[] = [];

  for (const url of toVisit) {
    if (visited.has(url)) {
      continue;
    }

    visited.add(url);
    const result = await fetchHtml(url);
    if (!result.html) {
      notes.push(
        result.status ? `Page ignoree (${result.status}) : ${url}` : `Impossible de charger : ${url}`,
      );
      continue;
    }

    const extraction = extractEmailsFromHtml(result.html);
    if (extraction.emails.length > 0) {
      emails = uniq([...emails, ...extraction.emails]);
    }

    if (visited.size === 1) {
      const discoveredLinks = extractContactLinks(url, result.html).filter((link) => {
        if (!baseHost) return false;
        try {
          return new URL(link).host === baseHost;
        } catch {
          return false;
        }
      });
      for (const link of discoveredLinks.slice(0, 3)) {
        if (!visited.has(link)) {
          toVisit.push(link);
        }
      }
    }

    if (emails.length > 0 && visited.size >= 2) {
      break;
    }
  }

  return {
    email: emails[0] ?? null,
    emails,
    notes,
  };
}
