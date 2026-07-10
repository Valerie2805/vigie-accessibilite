import { useEffect, useState } from 'react';
import { FileSearch, Globe, Radar, ScrollText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { EvidenceList } from '@/components/EvidenceList';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import type { Scan } from '@/types';
import { getScan } from '@/utils/api';
import { formatDate } from '@/utils/format';

export default function AnalysisPage() {
  const { scanId = '' } = useParams();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadScan() {
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
  }, [scanId]);

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
          </div>

          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard
              label="Score"
              value={`${scan.score}`}
              hint="Score cumule des signaux detectes"
              icon={<Radar className="h-4 w-4" />}
            />
            <MetricCard
              label="Evidences"
              value={`${scan.evidences.length}`}
              hint="Liens et mentions publiques reperes"
              icon={<FileSearch className="h-4 w-4" />}
            />
            <MetricCard
              label="URL analysee"
              value={scan.websiteUrl.replace(/^https?:\/\//, '')}
              hint="Site scanne pour cette analyse"
              icon={<Globe className="h-4 w-4" />}
            />
            <MetricCard
              label="Horodatage"
              value={formatDate(scan.scannedAt)}
              hint="Derniere execution"
              icon={<ScrollText className="h-4 w-4" />}
            />
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.28em] text-copper-soft">
                Preuves detectees
              </p>
              <EvidenceList evidences={scan.evidences} />
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

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                  Interpretation
                </p>
                <p className="mt-4 text-sm leading-7 text-ivory-muted">
                  Cette application cherche des indices visibles: page accessibilite,
                  declaration, mention d'etat de conformite, contact et references
                  institutionnelles. L'absence de signal ne prouve pas a elle seule
                  une infraction.
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
