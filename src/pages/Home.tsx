import { useMemo, useState } from 'react';
import { ArrowRight, Globe, Mail, Radar, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Spinner } from '@/components/Spinner';
import { StatusBadge } from '@/components/StatusBadge';
import {
  exportCompaniesToCsv,
  exportCompaniesToExcel,
} from '@/utils/export-companies';
import { saveRecentCompaniesToBrowser } from '@/utils/local-company-history';
import { resolveWebsite, searchCompanies } from '@/utils/api';
import { formatCurrency, getEligibilityLabel, getScanStatusLabel } from '@/utils/format';
import type { Company, EligibilityStatus, ScanStatus } from '@/types';

type EligibilityFilter = 'tous' | EligibilityStatus;
type AccessibilityFilter = 'tous' | 'sans_analyse' | ScanStatus;

const clientSearchOptions = [
  {
    label: 'Agences web',
    keywords: [
      'agence web',
      'creation site internet',
      'refonte site internet',
    ],
  },
  {
    label: 'Studios / freelances structures',
    keywords: ['studio digital', 'studio web', 'WordPress', 'site vitrine'],
  },
  {
    label: 'Communication digitale',
    keywords: [
      'communication digitale',
      'marketing digital',
      'strategie digitale',
    ],
  },
] as const;

const activityOptions = [
  { value: '', label: 'Choisir une activite' },
  { value: 'banque', label: 'Banque' },
  { value: 'assurance', label: 'Assurance' },
  { value: 'mutuelle', label: 'Mutuelle' },
  { value: 'e-commerce', label: 'E-commerce' },
  { value: 'transport', label: 'Transport de voyageurs' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'service public', label: 'Service public' },
  { value: 'mission de service public', label: 'Mission de service public' },
  { value: 'sante privee', label: 'Sante privee' },
  { value: 'energie', label: 'Energie' },
  { value: 'eau services essentiels', label: 'Eau et services essentiels' },
  { value: 'grande distribution', label: 'Grande distribution' },
  { value: 'tourisme hotellerie', label: 'Tourisme et hotellerie' },
  { value: 'immobilier', label: 'Immobilier' },
  { value: 'education formation', label: 'Education et formation' },
  { value: 'medias audiovisuel', label: 'Medias et audiovisuel' },
  { value: 'livres numeriques', label: 'Livres numeriques' },
  { value: 'autre', label: 'Autre activite' },
] as const;

export default function Home() {
  const [query, setQuery] = useState('');
  const [selectedClientSearch, setSelectedClientSearch] = useState('');
  const [city, setCity] = useState('');
  const [searchScope, setSearchScope] = useState<'france' | 'city'>('france');
  const [selectedActivity, setSelectedActivity] = useState('');
  const [customActivity, setCustomActivity] = useState('');
  const [minRevenue, setMinRevenue] = useState('');
  const [maxRevenue, setMaxRevenue] = useState('');
  const [eligibilityFilter, setEligibilityFilter] = useState<EligibilityFilter>('tous');
  const [accessibilityFilter, setAccessibilityFilter] =
    useState<AccessibilityFilter>('tous');
  const [results, setResults] = useState<Company[]>([]);
  const [selectedSirens, setSelectedSirens] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metier = selectedActivity === 'autre' ? customActivity : selectedActivity;

  const filteredResults = useMemo(() => {
    return results.filter((company) => {
      const matchesEligibility =
        eligibilityFilter === 'tous' || company.eligibility === eligibilityFilter;

      const matchesAccessibility =
        accessibilityFilter === 'tous' ||
        (accessibilityFilter === 'sans_analyse'
          ? !company.latestScanStatus
          : company.latestScanStatus === accessibilityFilter);

      return matchesEligibility && matchesAccessibility;
    });
  }, [accessibilityFilter, eligibilityFilter, results]);

  const selectedResults = useMemo(
    () => filteredResults.filter((company) => selectedSirens.includes(company.siren)),
    [filteredResults, selectedSirens],
  );

  async function enrichCompanies(targetCompanies: Company[]) {
    const targets = targetCompanies.filter((company) => !company.websiteUrl || !company.email);
    if (targets.length === 0) {
      return;
    }

    setEnriching(true);
    setError(null);

    try {
      for (const company of targets) {
        const response = await resolveWebsite(company.siren, company.websiteUrl ?? undefined);
        const updatedCompany = {
          ...company,
          websiteUrl: response.company.websiteUrl,
          websiteSource: response.company.websiteSource,
          websiteConfidence: response.company.websiteConfidence,
          email: response.company.email,
          latestScanStatus: response.company.latestScanStatus ?? company.latestScanStatus ?? null,
          latestScannedAt: response.company.latestScannedAt ?? company.latestScannedAt ?? null,
        };

        setResults((current) =>
          current.map((item) =>
            item.siren === company.siren ? updatedCompany : item,
          ),
        );
        saveRecentCompaniesToBrowser([updatedCompany]);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossible de completer les sites.",
      );
    } finally {
      setEnriching(false);
    }
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await searchCompanies(
        query,
        searchScope === 'city' ? city : undefined,
        metier,
        minRevenue ? Number(minRevenue) : undefined,
        maxRevenue ? Number(maxRevenue) : undefined,
      );
      setResults(response.results);
      setSelectedSirens([]);
      saveRecentCompaniesToBrowser(response.results);
      void enrichCompanies(response.results);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'La recherche a echoue.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrichWebsites() {
    await enrichCompanies(results);
  }

  async function handleExportCsv() {
    if (selectedResults.length === 0 || exporting) return;
    setExporting(true);
    setError(null);

    try {
      exportCompaniesToCsv(selectedResults);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Impossible d'exporter.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleExportExcel() {
    if (selectedResults.length === 0 || exporting) return;
    setExporting(true);
    setError(null);

    try {
      exportCompaniesToExcel(selectedResults);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Impossible d'exporter.",
      );
    } finally {
      setExporting(false);
    }
  }

  function toggleCompanySelection(siren: string) {
    setSelectedSirens((current) =>
      current.includes(siren)
        ? current.filter((item) => item !== siren)
        : [...current, siren],
    );
  }

  function handleSelectAllFiltered() {
    const filteredSirens = filteredResults.map((company) => company.siren);
    const allFilteredSelected =
      filteredSirens.length > 0 &&
      filteredSirens.every((siren) => selectedSirens.includes(siren));

    setSelectedSirens((current) => {
      if (allFilteredSelected) {
        return current.filter((siren) => !filteredSirens.includes(siren));
      }

      return Array.from(new Set([...current, ...filteredSirens]));
    });
  }

  return (
    <AppShell
      eyebrow="MVP de veille accessibilite"
      title="Repere les entreprises a surveiller et les sites qui n'exposent pas leurs preuves publiques."
      description="Recherche une entreprise francaise, estime son exposition au cadre accessibilite et lance un scan cible de son site pour trouver declaration, page accessibilite, mention d'etat de conformite et mecanisme de contact."
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <form
          onSubmit={handleSearch}
          className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                Recherche guidee
              </p>
              <h2 className="mt-2 font-display text-3xl text-ivory">
                Trouver une entreprise
              </h2>
            </div>
            <div className="rounded-full border border-copper/30 bg-copper/10 p-3 text-copper-soft">
              <Search className="h-5 w-5" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Nom, raison sociale ou SIREN
              </span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (event.target.value !== selectedClientSearch) {
                    setSelectedClientSearch('');
                  }
                }}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="Ex. La Poste, LVMH, 356000000"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Recherche client
              </span>
              <select
                value={selectedClientSearch}
                onChange={(event) => {
                  setSelectedClientSearch(event.target.value);
                  setQuery(event.target.value);
                }}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
              >
                <option value="" className="bg-ink text-ivory">
                  Choisir une recherche client
                </option>
                {clientSearchOptions.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.keywords.map((keyword) => (
                      <option key={keyword} value={keyword} className="bg-ink text-ivory">
                        {keyword}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Zone de recherche
              </span>
              <div className="flex items-center rounded-2xl border border-white/10 bg-ink-soft p-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setSearchScope('france');
                    setCity('');
                  }}
                  className={
                    searchScope === 'france'
                      ? 'flex-1 rounded-xl bg-copper px-4 py-3 font-medium text-ink'
                      : 'flex-1 rounded-xl px-4 py-3 text-ivory-muted transition hover:text-ivory'
                  }
                >
                  Toute la France
                </button>
                <button
                  type="button"
                  onClick={() => setSearchScope('city')}
                  className={
                    searchScope === 'city'
                      ? 'flex-1 rounded-xl bg-white/10 px-4 py-3 font-medium text-ivory'
                      : 'flex-1 rounded-xl px-4 py-3 text-ivory-muted transition hover:text-ivory'
                  }
                >
                  Une ville
                </button>
              </div>
            </div>

            {searchScope === 'city' ? (
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                  Ville
                </span>
                <input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                  placeholder="Paris"
                />
              </label>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-ink-soft px-4 py-4 text-sm text-ivory-muted">
                La recherche se fera sur toute la France.
              </div>
            )}

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Activite
              </span>
              <select
                value={selectedActivity}
                onChange={(event) => {
                  setSelectedActivity(event.target.value);
                  if (event.target.value !== 'autre') {
                    setCustomActivity('');
                  }
                }}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
              >
                {activityOptions.map((option) => (
                  <option
                    key={option.value || 'placeholder'}
                    value={option.value}
                    className="bg-ink text-ivory"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {selectedActivity === 'autre' ? (
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                  Autre activite
                </span>
                <input
                  value={customActivity}
                  onChange={(event) => setCustomActivity(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                  placeholder="Ex. fleuriste, boulangerie, coiffure"
                />
              </label>
            ) : null}

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                CA minimum
              </span>
              <input
                value={minRevenue}
                onChange={(event) => setMinRevenue(event.target.value)}
                type="number"
                min="0"
                step="1000"
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="1000000"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                CA maximum
              </span>
              <input
                value={maxRevenue}
                onChange={(event) => setMaxRevenue(event.target.value)}
                type="number"
                min="0"
                step="1000"
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="5000000"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={
                loading ||
                (query.trim().length < 2 && metier.trim().length < 2)
              }
              className="inline-flex h-12 items-center gap-2 rounded-full bg-copper px-5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Spinner />
              ) : (
                <Radar className="h-4 w-4" />
              )}
              Lancer la recherche
            </button>
            <p className="text-sm text-ivory-muted">
              Recherche sur toute la France par defaut, puis filtrage optionnel par
              ville, activite et chiffre d'affaires quand ces donnees existent.
            </p>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </form>

        <aside className="rounded-[28px] border border-white/10 bg-gradient-to-br from-moss/10 via-white/5 to-transparent p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.28em] text-moss">
            Ce que fait ce scan
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-ivory-muted">
            <li>Recherche l'entreprise et recupere ses informations ouvertes.</li>
            <li>Estime si elle semble dans le radar legal ou dans une zone incertaine.</li>
            <li>Recherche un site officiel automatiquement ou accepte une URL manuelle.</li>
            <li>Scanne la page d'accueil et les routes probables comme `accessibilite`.</li>
          </ul>
        </aside>
      </section>

      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-ivory-muted">
              Resultats
            </p>
            <h2 className="mt-2 font-display text-3xl text-ivory">
              Entreprises correspondantes
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory-muted">
              {filteredResults.length} resultat{filteredResults.length > 1 ? 's' : ''}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory-muted">
              {selectedResults.length} selectionne{selectedResults.length > 1 ? 's' : ''}
            </span>
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory-muted">
              <span>Statut</span>
              <select
                value={eligibilityFilter}
                onChange={(event) => setEligibilityFilter(event.target.value as EligibilityFilter)}
                className="bg-transparent text-sm text-ivory outline-none"
              >
                <option value="tous" className="bg-ink text-ivory">
                  Tous
                </option>
                <option value="soumis_probable" className="bg-ink text-ivory">
                  {getEligibilityLabel('soumis_probable')}
                </option>
                <option value="hors_perimetre_probable" className="bg-ink text-ivory">
                  {getEligibilityLabel('hors_perimetre_probable')}
                </option>
                <option value="incertain" className="bg-ink text-ivory">
                  {getEligibilityLabel('incertain')}
                </option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory-muted">
              <span>Accessibilite</span>
              <select
                value={accessibilityFilter}
                onChange={(event) =>
                  setAccessibilityFilter(event.target.value as AccessibilityFilter)
                }
                className="bg-transparent text-sm text-ivory outline-none"
              >
                <option value="tous" className="bg-ink text-ivory">
                  Tous
                </option>
                <option value="elements_detectes" className="bg-ink text-ivory">
                  {getScanStatusLabel('elements_detectes')}
                </option>
                <option value="elements_partiels" className="bg-ink text-ivory">
                  {getScanStatusLabel('elements_partiels')}
                </option>
                <option
                  value="conformite_non_demontree"
                  className="bg-ink text-ivory"
                >
                  {getScanStatusLabel('conformite_non_demontree')}
                </option>
                <option
                  value="a_verifier_manuellement"
                  className="bg-ink text-ivory"
                >
                  {getScanStatusLabel('a_verifier_manuellement')}
                </option>
                <option value="sans_analyse" className="bg-ink text-ivory">
                  Sans analyse
                </option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              disabled={filteredResults.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-ivory transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Tout selectionner
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={selectedResults.length === 0 || exporting}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={selectedResults.length === 0 || exporting}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exporter Excel
            </button>
            <button
              type="button"
              onClick={handleEnrichWebsites}
              disabled={
                enriching ||
                results.length === 0 ||
                results.every((company) => company.websiteUrl && company.email)
                || exporting
              }
              className="inline-flex h-10 items-center gap-2 rounded-full border border-moss/40 bg-moss/10 px-4 text-sm text-moss transition hover:border-moss hover:bg-moss hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enriching ? <Spinner className="text-moss" /> : <Globe className="h-4 w-4" />}
              Completer les sites
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredResults.map((company) => (
            <article
              key={company.siren}
              className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-panel"
            >
              <label className="mb-4 inline-flex items-center gap-3 text-sm text-ivory-muted">
                <input
                  type="checkbox"
                  checked={selectedSirens.includes(company.siren)}
                  onChange={() => toggleCompanySelection(company.siren)}
                  className="h-4 w-4 rounded border border-white/20 bg-ink-soft accent-copper"
                />
                Selectionner pour export
              </label>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-2xl text-ivory">{company.nom}</h3>
                    <StatusBadge status={company.eligibility} type="eligibility" />
                    {company.latestScanStatus ? (
                      <StatusBadge status={company.latestScanStatus} type="scan" />
                    ) : null}
                  </div>
                  <p className="text-sm text-ivory-muted">
                    {company.adresse ?? 'Adresse non disponible'}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-ivory-muted">
                    <span>SIREN {company.siren}</span>
                    <span>{company.activite ?? 'NAF inconnu'}</span>
                    <span>{company.categorieEntreprise ?? 'Categorie inconnue'}</span>
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

                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
                  <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                      Chiffre d'affaires
                    </p>
                    <p className="mt-2 text-lg text-ivory">
                      {formatCurrency(company.chiffreAffaires)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                      Ville
                    </p>
                    <p className="mt-2 text-lg text-ivory">
                      {company.ville ?? 'Non disponible'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <Link
                  to={`/entreprise/${company.siren}`}
                  className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink"
                >
                  Ouvrir la fiche
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}

          {!loading && filteredResults.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-ivory-muted">
              {results.length === 0
                ? "Aucun resultat avec ces filtres. Essaie un metier plus large, une autre ville, ou retire les bornes de chiffre d'affaires."
                : "Aucun resultat ne correspond aux filtres selectionnes. Essaie un autre statut ou un autre filtre accessibilite."}
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
