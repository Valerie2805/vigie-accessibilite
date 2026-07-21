import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Globe, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import type { Company, Scan } from '@/types';
import { listRecentCompanies, listScans } from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/format';

export default function HistoryPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanFilter, setScanFilter] = useState<'tous' | 'elements_partiels'>(
    'tous',
  );

  const filteredScans = useMemo(() => {
    if (scanFilter === 'tous') return scans;
    return scans.filter((scan) => scan.status === 'elements_partiels');
  }, [scanFilter, scans]);

  useEffect(() => {
    async function loadHistory() {
      try {
        const [scansResponse, companiesResponse] = await Promise.all([
          listScans(),
          listRecentCompanies(40),
        ]);
        setScans(scansResponse.scans);
        setCompanies(companiesResponse.companies);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  return (
    <AppShell
      eyebrow="Historique local"
      title="Retrouve les derniers scans executes et compare leur niveau de preuve."
      description="L'historique conserve les analyses recentes dans le workspace local. Il te permet de revenir sur un dossier, de comparer les scores et de relancer un scan si besoin."
    >
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
              Dernieres executions
            </p>
            <h2 className="mt-2 font-display text-3xl text-ivory">
              Historique des analyses
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory-muted">
              {filteredScans.length} analyse{filteredScans.length > 1 ? 's' : ''}
            </span>
            <div className="flex items-center rounded-full border border-white/10 bg-ink-soft p-1 text-sm">
              <button
                type="button"
                onClick={() => setScanFilter('tous')}
                className={
                  scanFilter === 'tous'
                    ? 'rounded-full bg-white/10 px-4 py-2 text-ivory'
                    : 'rounded-full px-4 py-2 text-ivory-muted transition hover:text-ivory'
                }
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setScanFilter('elements_partiels')}
                className={
                  scanFilter === 'elements_partiels'
                    ? 'rounded-full bg-copper px-4 py-2 text-ink'
                    : 'rounded-full px-4 py-2 text-ivory-muted transition hover:text-ivory'
                }
              >
                Partiellement conformes
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredScans.map((scan) => (
            <article
              key={scan.id}
              className="rounded-[24px] border border-white/10 bg-ink-soft p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-2xl text-ivory">{scan.companyName}</h3>
                    <StatusBadge status={scan.status} type="scan" />
                    <StatusBadge status={scan.eligibility} type="eligibility" />
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-ivory-muted">
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4" />
                      {formatDate(scan.scannedAt)}
                    </span>
                    <span>Score {scan.score}</span>
                    <span>{scan.evidences.length} preuve(s)</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link
                    to={`/analyse/${scan.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink"
                  >
                    Ouvrir l'analyse
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/entreprise/${scan.siren}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory transition hover:bg-white/10"
                  >
                    Reouvrir la fiche
                  </Link>
                </div>
              </div>
            </article>
          ))}

          {!loading && filteredScans.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/15 bg-ink-soft p-8 text-center text-sm text-ivory-muted">
              {scans.length === 0
                ? "Aucune analyse n'a encore ete enregistree dans ce workspace."
                : "Aucune analyse ne correspond au filtre selectionne."}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-moss">
              Memoire des recherches
            </p>
            <h2 className="mt-2 font-display text-3xl text-ivory">
              Entreprises recemment vues
            </h2>
          </div>
          <div className="rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory-muted">
            {companies.length} entreprise{companies.length > 1 ? 's' : ''}
          </div>
        </div>

        <div className="space-y-4">
          {companies.map((company) => (
            <article
              key={company.siren}
              className="rounded-[24px] border border-white/10 bg-ink-soft p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-2xl text-ivory">{company.nom}</h3>
                    <StatusBadge status={company.eligibility} type="eligibility" />
                  </div>
                  <p className="text-sm text-ivory-muted">
                    {company.adresse ?? 'Adresse non disponible'}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-ivory-muted">
                    <span>SIREN {company.siren}</span>
                    <span>{company.activite ?? 'NAF inconnu'}</span>
                    <span>{formatCurrency(company.chiffreAffaires)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-ivory-muted">
                    <span className="inline-flex items-center gap-2">
                      <Globe className="h-4 w-4 text-copper-soft" />
                      {company.websiteUrl ? (
                        <a
                          href={company.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-copper-soft transition hover:text-copper"
                        >
                          {company.websiteUrl.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        <span>Site non trouve</span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4 text-copper-soft" />
                      {company.email ? (
                        <a
                          href={`mailto:${company.email}`}
                          className="break-all text-copper-soft transition hover:text-copper"
                        >
                          {company.email}
                        </a>
                      ) : (
                        <span>Email non trouve</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link
                    to={`/entreprise/${company.siren}`}
                    className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink"
                  >
                    Ouvrir la fiche
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}

          {!loading && companies.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/15 bg-ink-soft p-8 text-center text-sm text-ivory-muted">
              Aucune entreprise n'a encore ete memorisee via la recherche.
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
