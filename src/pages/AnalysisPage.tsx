import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileSearch, Globe, Radar, ScrollText } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { EvidenceList } from '@/components/EvidenceList';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import type { AxeImpact, OpportunitySignalCategory, Scan } from '@/types';
import { exportAnalysisToPdf } from '@/utils/export-analysis-pdf';
import { getScan } from '@/utils/api';
import { formatDate } from '@/utils/format';

type AnalysisLocationState = {
  scan?: Scan;
};

function getCategoryLabel(category: OpportunitySignalCategory) {
  switch (category) {
    case 'images_sans_alternative':
      return 'Images sans alternative';
    case 'structure_semantique':
      return 'Structure semantique';
    case 'navigation_clavier':
      return 'Navigation clavier';
    case 'menus_modales_popups':
      return 'Menus, modales, popups';
    case 'composants_interactifs':
      return 'Composants interactifs';
    case 'documents_pdf':
      return 'Documents PDF';
    case 'erreurs_recurrentes_globales':
      return 'Erreurs recurrentes globales';
    default:
      return category.replace(/_/g, ' ');
  }
}

function getImpactLabel(impact: AxeImpact) {
  switch (impact) {
    case 'critical':
      return 'Critique';
    case 'serious':
      return 'Serieux';
    case 'moderate':
      return 'Modere';
    case 'minor':
      return 'Mineur';
    default:
      return 'A qualifier';
  }
}

export default function AnalysisPage() {
  const { scanId = '' } = useParams();
  const location = useLocation();
  const initialScan = (location.state as AnalysisLocationState | null)?.scan ?? null;
  const [scan, setScan] = useState<Scan | null>(initialScan);
  const [loading, setLoading] = useState(!initialScan);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const axeSummary = scan?.axe ?? null;
  const scanUrlHref = (() => {
    const url = axeSummary?.url ?? scan?.websiteUrl ?? '';
    if (!url) {
      return null;
    }

    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  })();
  const highImpactCount = useMemo(() => {
    if (!axeSummary) {
      return 0;
    }

    return axeSummary.violationsByImpact.critical + axeSummary.violationsByImpact.serious;
  }, [axeSummary]);

  useEffect(() => {
    async function loadScan() {
      if (initialScan) {
        setLoading(false);
        return;
      }

      try {
        const response = await getScan(scanId);
        setScan(response.scan);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Impossible de charger l'analyse.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadScan();
  }, [initialScan, scanId]);

  async function handleExportPdf() {
    if (!scan) {
      return;
    }

    setExportingPdf(true);

    try {
      exportAnalysisToPdf(scan);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Impossible d'ouvrir l'export PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <AppShell
      eyebrow="Resultat d'analyse"
      title="Visualise les preuves trouvees et le niveau de risque estime."
      description="Le score ci-dessous reste un indicateur operationnel, pas une qualification juridique. Il sert a faire gagner du temps pour les revues manuelles et les audits plus solides."
    >
      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-ivory-muted">
          Chargement de l'analyse...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[28px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {scan ? (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-3xl text-ivory">{scan.companyName}</h2>
            <StatusBadge status={scan.status} type="scan" />
            <StatusBadge status={scan.eligibility} type="eligibility" />
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exportingPdf ? 'Preparation du PDF...' : 'Exporter en PDF'}
            </button>
          </div>

          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard
              label="Score"
              value={`${scan.score}`}
              hint={
                axeSummary
                  ? 'Indicateur de priorite base sur le scan automatique de cette page'
                  : 'Score cumule des signaux detectes'
              }
              icon={<Radar className="h-4 w-4" />}
            />
            <MetricCard
              label={axeSummary ? 'Violations' : 'Evidences'}
              value={`${axeSummary ? axeSummary.totalViolations : scan.evidences.length}`}
              hint={
                axeSummary
                  ? 'Occurrences remontees automatiquement par axe-core'
                  : 'Liens et mentions publiques reperes'
              }
              icon={axeSummary ? <AlertTriangle className="h-4 w-4" /> : <FileSearch className="h-4 w-4" />}
            />
            <MetricCard
              label={axeSummary ? 'Gravite elevee' : 'URL analysee'}
              value={
                axeSummary
                  ? `${highImpactCount}`
                  : scan.websiteUrl.replace(/^https?:\/\//, '')
              }
              hint={
                axeSummary
                  ? 'Occurrences critiques ou serieuses a confirmer par audit humain'
                  : 'Site scanne pour cette analyse'
              }
              icon={axeSummary ? <AlertTriangle className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
            />
            <MetricCard
              label={axeSummary ? 'Categories' : 'Horodatage'}
              value={axeSummary ? `${axeSummary.categories.length}` : formatDate(scan.scannedAt)}
              hint={axeSummary ? 'Familles de problemes dominantes sur cette page' : 'Derniere execution'}
              icon={axeSummary ? <Globe className="h-4 w-4" /> : <ScrollText className="h-4 w-4" />}
            />
          </section>

          {axeSummary ? (
            <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
              <article className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                  Resume Browserless + axe-core
                </p>
                <p className="mt-4 text-sm leading-7 text-ivory-muted">
                  {axeSummary.nonExpertSummary}
                </p>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-ink-soft p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-moss">
                    Signaux detectes automatiquement
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-ivory-muted">
                    {axeSummary.detectedSignals.map((signal) => (
                      <li key={signal}>{signal}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 rounded-[24px] border border-white/10 bg-ink-soft p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-copper-soft">
                    Points a confirmer par audit humain
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-ivory-muted">
                    {axeSummary.humanAuditPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              </article>

              <aside className="space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                  <p className="text-xs uppercase tracking-[0.28em] text-moss">
                    Vue synthese
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-ivory-muted">
                    <p>
                      URL scannee:{' '}
                      {scanUrlHref ? (
                        <a
                          href={scanUrlHref}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-copper-soft underline underline-offset-2 transition hover:text-copper"
                        >
                          {axeSummary.url}
                        </a>
                      ) : (
                        <span className="text-ivory">{axeSummary.url}</span>
                      )}
                    </p>
                    <p>
                      Date du scan: <span className="text-ivory">{formatDate(axeSummary.scannedAt)}</span>
                    </p>
                    <p>
                      Violations critiques: <span className="text-ivory">{axeSummary.violationsByImpact.critical}</span>
                    </p>
                    <p>
                      Violations serieuses: <span className="text-ivory">{axeSummary.violationsByImpact.serious}</span>
                    </p>
                    <p>
                      Violations moderees: <span className="text-ivory">{axeSummary.violationsByImpact.moderate}</span>
                    </p>
                    <p>
                      Violations mineures: <span className="text-ivory">{axeSummary.violationsByImpact.minor}</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                  <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                    Categories principales
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {axeSummary.categories.length > 0 ? (
                      axeSummary.categories.map((entry) => (
                        <span
                          key={entry.category}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-ivory"
                        >
                          {getCategoryLabel(entry.category)} · {entry.count}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-ivory-muted">
                        Aucune categorie dominante sur cette page.
                      </span>
                    )}
                  </div>
                </div>
              </aside>
            </section>
          ) : null}

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.28em] text-copper-soft">
                {axeSummary ? 'Regles principales detectees' : 'Preuves detectees'}
              </p>
              {axeSummary ? (
                <div className="space-y-4">
                  {axeSummary.topRules.length > 0 ? (
                    axeSummary.topRules.map((rule) => (
                      <article
                        key={rule.ruleId}
                        className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-panel"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ivory">{rule.help}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-ivory-muted">
                              {rule.ruleId}
                            </p>
                          </div>
                          <span className="rounded-full border border-copper/30 bg-copper/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-copper-soft">
                            {getImpactLabel(rule.impact)} · {rule.occurrences}
                          </span>
                        </div>

                        <p className="mt-4 text-sm leading-7 text-ivory-muted">
                          {rule.description}
                        </p>

                        {rule.elements.length > 0 ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-ink-soft p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                              Elements touches
                            </p>
                            <ul className="mt-3 space-y-2 break-all text-sm text-ivory-muted">
                              {rule.elements.map((element) => (
                                <li key={`${rule.ruleId}-${element}`}>{element}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <a
                          href={rule.helpUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex text-sm text-copper-soft transition hover:text-copper"
                        >
                          Voir la regle
                        </a>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-white/15 bg-white/5 p-6 text-sm text-ivory-muted">
                      Aucune violation axe-core n'a ete remontee sur cette page.
                    </div>
                  )}
                </div>
              ) : (
                <EvidenceList evidences={scan.evidences} />
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                <p className="text-xs uppercase tracking-[0.28em] text-moss">
                  Notes de scan
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-ivory-muted">
                  {scan.notes.length > 0 ? (
                    scan.notes.map((note) => <li key={note}>{note}</li>)
                  ) : (
                    <li>Aucune note supplementaire.</li>
                  )}
                </ul>
              </div>

              {axeSummary ? (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                  <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                    Elements touches
                  </p>
                  <div className="mt-4 space-y-3">
                    {axeSummary.highlightedElements.length > 0 ? (
                      axeSummary.highlightedElements.map((element, index) => (
                        <div
                          key={`${element.ruleId}-${element.selector}-${index}`}
                          className="rounded-2xl border border-white/10 bg-ink-soft p-4"
                        >
                          <p className="text-xs uppercase tracking-[0.18em] text-copper-soft">
                            {element.ruleId} · {getImpactLabel(element.impact)}
                          </p>
                          <p className="mt-2 break-all text-sm text-ivory">
                            {element.selector || 'Element sans selecteur exploitable'}
                          </p>
                          <p className="mt-2 text-xs leading-6 text-ivory-muted">
                            {element.htmlSnippet}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-ivory-muted">
                        Aucun extrait d element n'a pu etre remonte.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                  Interpretation
                </p>
                <p className="mt-4 text-sm leading-7 text-ivory-muted">
                  {axeSummary
                    ? "Ce resultat correspond a des signaux detectes automatiquement sur une seule page via Browserless et axe-core. Il aide a prioriser une lecture commerciale, mais ne constitue ni un avis juridique ni une preuve de non-conformite."
                    : "Cette application cherche des indices visibles: page accessibilite, declaration, mention d'etat de conformite, contact et references institutionnelles. L'absence de signal ne prouve pas a elle seule une infraction."}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/historique"
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory transition hover:bg-white/10"
                  >
                    Voir l'historique
                  </Link>
                  <Link
                    to={`/entreprise/${scan.siren}`}
                    className="rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink"
                  >
                    Relancer ce dossier
                  </Link>
                </div>
              </div>
            </aside>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
