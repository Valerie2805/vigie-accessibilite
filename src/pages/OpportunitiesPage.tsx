import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import {
  OpportunityFilters,
  type OpportunityFiltersValue,
} from '@/components/OpportunityFilters';
import { OpportunityTable } from '@/components/OpportunityTable';
import { MetricCard } from '@/components/MetricCard';
import type { Opportunity, OpportunityStatus } from '@/types';
import { exportOpportunitiesToCsv, exportOpportunitiesToJson } from '@/utils/export-opportunities';
import { listOpportunities, recomputeOpportunity, updateOpportunityStatus } from '@/utils/api';

const defaultFilters: OpportunityFiltersValue = {
  query: '',
  minimumScore: '',
  urgency: 'tous',
  status: 'tous',
  offer: 'tous',
  country: '',
  sector: '',
};

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [filters, setFilters] = useState<OpportunityFiltersValue>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function loadOpportunities() {
      try {
        const response = await listOpportunities();
        setOpportunities(response.opportunities);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Impossible de charger les opportunites.',
        );
      } finally {
        setLoading(false);
      }
    }

    loadOpportunities();
  }, []);

  const filteredOpportunities = useMemo(() => {
    const minimumScore = Number(filters.minimumScore || '0');
    const normalizedQuery = normalizeText(filters.query);

    return opportunities.filter((opportunity) => {
      const haystack = normalizeText(
        [
          opportunity.site.name,
          opportunity.site.domain,
          opportunity.site.sector,
          opportunity.whyNow,
          opportunity.recommendedOffer.primary,
        ].join(' '),
      );

      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesScore =
        !filters.minimumScore || opportunity.scores.leadScore >= minimumScore;
      const matchesUrgency =
        filters.urgency === 'tous' || opportunity.scores.regulatoryUrgency === filters.urgency;
      const matchesStatus =
        filters.status === 'tous' || opportunity.status === filters.status;
      const matchesOffer =
        filters.offer === 'tous' || opportunity.recommendedOffer.primary === filters.offer;
      const matchesCountry = !filters.country || opportunity.site.country === filters.country;
      const matchesSector = !filters.sector || opportunity.site.sector === filters.sector;

      return (
        matchesQuery &&
        matchesScore &&
        matchesUrgency &&
        matchesStatus &&
        matchesOffer &&
        matchesCountry &&
        matchesSector
      );
    });
  }, [filters, opportunities]);

  const sectors = useMemo(
    () =>
      Array.from(
        new Set(
          opportunities
            .map((opportunity) => opportunity.site.sector)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [opportunities],
  );

  const countries = useMemo(
    () =>
      Array.from(new Set(opportunities.map((opportunity) => opportunity.site.country))).sort(),
    [opportunities],
  );

  const hotCount = filteredOpportunities.filter((item) => item.scores.leadLabel === 'chaud').length;
  const averageScore =
    filteredOpportunities.length > 0
      ? Math.round(
          filteredOpportunities.reduce((sum, item) => sum + item.scores.leadScore, 0) /
            filteredOpportunities.length,
        )
      : 0;

  async function handleCopyMessage(opportunity: Opportunity) {
    await navigator.clipboard.writeText(opportunity.outreach.emailBody);
    setInfo('Message copie dans le presse-papiers.');
  }

  function handleExportOne(opportunity: Opportunity) {
    exportOpportunitiesToJson([opportunity], `${opportunity.id}.json`);
    setInfo('Export JSON genere.');
  }

  async function handleRecompute(opportunity: Opportunity) {
    setBusyId(opportunity.id);
    setError(null);
    try {
      const response = await recomputeOpportunity(opportunity.id);
      setOpportunities((current) =>
        current.map((item) => (item.id === opportunity.id ? response.opportunity : item)),
      );
      setInfo('Opportunite recalculee.');
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Impossible de recalculer.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(opportunity: Opportunity, status: OpportunityStatus) {
    setBusyId(opportunity.id);
    setError(null);
    try {
      const response = await updateOpportunityStatus(opportunity.id, status);
      setOpportunities((current) =>
        current.map((item) => (item.id === opportunity.id ? response.opportunity : item)),
      );
      setInfo('Statut mis a jour.');
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Impossible de changer le statut.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      eyebrow="Pipeline opportunites"
      title="Priorise les leads accessibilite et passe a l action plus vite."
      description="Chaque opportunite combine des signaux techniques detectes, une exposition reglementaire estimee, une offre recommandee et un message sobre pret a copier."
    >
      {error ? (
        <div className="mb-6 rounded-[28px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {info ? (
        <div className="mb-6 rounded-[28px] border border-moss/20 bg-moss/10 p-4 text-sm text-moss">
          {info}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Opportunites"
          value={`${filteredOpportunities.length}`}
          hint="Leads affiches apres filtres"
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          label="Leads chauds"
          value={`${hotCount}`}
          hint="Opportunites prioritaires"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <MetricCard
          label="Score moyen"
          value={`${averageScore}`}
          hint="Moyenne des leads affiches"
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between text-ivory-muted">
            <span className="text-xs uppercase tracking-[0.24em]">Export</span>
            <Download className="h-4 w-4" />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => exportOpportunitiesToJson(filteredOpportunities)}
              className="rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory transition hover:bg-white/10"
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => exportOpportunitiesToCsv(filteredOpportunities)}
              className="rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory transition hover:bg-white/10"
            >
              CSV
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">Filtres</p>
          <h2 className="mt-2 font-display text-3xl text-ivory">Dashboard opportunites</h2>
        </div>

        <OpportunityFilters
          value={filters}
          onChange={setFilters}
          sectors={sectors}
          countries={countries}
        />
      </section>

      <section className="mt-8">
        {loading ? (
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-ivory-muted">
            Chargement des opportunites...
          </div>
        ) : filteredOpportunities.length > 0 ? (
          <OpportunityTable
            opportunities={filteredOpportunities}
            onCopyMessage={handleCopyMessage}
            onExport={handleExportOne}
            onRecompute={handleRecompute}
            onStatusChange={handleStatusChange}
            busyId={busyId}
          />
        ) : (
          <div className="rounded-[28px] border border-dashed border-white/15 bg-ink-soft p-8 text-center text-sm text-ivory-muted">
            Aucune opportunite ne correspond aux filtres actuels.
          </div>
        )}
      </section>
    </AppShell>
  );
}
