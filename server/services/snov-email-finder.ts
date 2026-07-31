const snovEmailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

type SnovEmailResolution = {
  email: string | null;
  emails: string[];
  notes: string[];
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

function getDomainFromWebsite(websiteUrl: string) {
  try {
    const parsed = new URL(websiteUrl);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

function scoreEmail(email: string, domain: string) {
  const [localPart, emailDomain] = normalizeEmail(email).split('@');
  if (!localPart || !emailDomain || emailDomain !== domain) {
    return -100;
  }

  let score = 0;

  if (/^(contact|info|hello|bonjour|commercial|sales|support|serviceclient|service-client)$/.test(localPart)) {
    score += 10;
  }

  if (/^(admin|office|team|communication|marketing)$/.test(localPart)) {
    score += 6;
  }

  if (/^(no-?reply|noreply|do-?not-?reply)$/.test(localPart)) {
    score -= 10;
  }

  if (localPart.length <= 3) {
    score -= 1;
  }

  return score;
}

function pickBestEmail(emails: string[], domain: string) {
  const ranked = uniq(emails)
    .map((email) => ({
      email: normalizeEmail(email),
      score: scoreEmail(email, domain),
    }))
    .filter((entry) => entry.score > -100)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.email ?? null;
}

function extractTaskHash(payload: Record<string, unknown>) {
  const taskHash =
    (typeof payload.task_hash === 'string' ? payload.task_hash : null) ??
    (payload.meta &&
    typeof payload.meta === 'object' &&
    'task_hash' in payload.meta &&
    typeof payload.meta.task_hash === 'string'
      ? payload.meta.task_hash
      : null);

  if (taskHash) {
    return taskHash;
  }

  const resultLink =
    payload.links &&
    typeof payload.links === 'object' &&
    'result' in payload.links &&
    typeof payload.links.result === 'string'
      ? payload.links.result
      : null;

  if (!resultLink) {
    return null;
  }

  const match = resultLink.match(/\/([a-f0-9]{16,})$/i);
  return match?.[1] ?? null;
}

function extractEmailsDeep(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    return (value.match(snovEmailPattern) ?? []).map(normalizeEmail);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractEmailsDeep(entry));
  }

  if (typeof value === 'object') {
    return Object.values(value).flatMap((entry) => extractEmailsDeep(entry));
  }

  return [];
}

async function getAccessToken() {
  const clientId = process.env.SNOV_API_USER_ID;
  const clientSecret = process.env.SNOV_API_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch('https://api.snov.io/v1/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Authentification Snov.io impossible (${response.status})`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return typeof payload.access_token === 'string' ? payload.access_token : null;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDomainTask(
  token: string,
  startUrl: string,
  resultBaseUrl: string,
  domain: string,
) {
  const params = new URLSearchParams({ domain });

  const startResponse = await fetch(startUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!startResponse.ok) {
    throw new Error(`Recherche Snov.io impossible (${startResponse.status})`);
  }

  const startPayload = (await startResponse.json()) as Record<string, unknown>;
  const taskHash = extractTaskHash(startPayload);
  if (!taskHash) {
    throw new Error('Snov.io n a pas renvoye de task_hash');
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const resultResponse = await fetch(`${resultBaseUrl}/${taskHash}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resultResponse.ok) {
      throw new Error(`Lecture du resultat Snov.io impossible (${resultResponse.status})`);
    }

    const resultPayload = (await resultResponse.json()) as Record<string, unknown>;
    const status = typeof resultPayload.status === 'string' ? resultPayload.status : '';
    const emails = uniq(extractEmailsDeep(resultPayload.data));

    if (emails.length > 0) {
      return emails;
    }

    if (status === 'completed') {
      return [];
    }

    await wait(800);
  }

  return [];
}

export async function findCompanyEmailsWithSnov(websiteUrl: string): Promise<SnovEmailResolution> {
  const domain = getDomainFromWebsite(websiteUrl);
  if (!domain) {
    return {
      email: null,
      emails: [],
      notes: ['Domaine Snov.io invalide'],
    };
  }

  if (!process.env.SNOV_API_USER_ID || !process.env.SNOV_API_SECRET) {
    return {
      email: null,
      emails: [],
      notes: ['Snov.io non configure dans les variables d environnement'],
    };
  }

  const notes: string[] = [];

  try {
    const token = await getAccessToken();
    if (!token) {
      return {
        email: null,
        emails: [],
        notes: ['Jeton Snov.io introuvable'],
      };
    }

    const domainEmails = await runDomainTask(
      token,
      'https://api.snov.io/v2/domain-search/domain-emails/start',
      'https://api.snov.io/v2/domain-search/domain-emails/result',
      domain,
    );

    const genericEmails = await runDomainTask(
      token,
      'https://api.snov.io/v2/domain-search/generic-contacts/start',
      'https://api.snov.io/v2/domain-search/generic-contacts/result',
      domain,
    );

    const emails = uniq([...genericEmails, ...domainEmails]).filter((email) =>
      email.endsWith(`@${domain}`),
    );

    return {
      email: pickBestEmail(emails, domain),
      emails,
      notes:
        emails.length > 0
          ? ['Email trouve via Snov.io']
          : ['Snov.io n a retourne aucun email sur ce domaine'],
    };
  } catch (error) {
    notes.push(
      error instanceof Error ? error.message : 'Erreur inconnue Snov.io',
    );

    return {
      email: null,
      emails: [],
      notes,
    };
  }
}
