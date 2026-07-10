import { useState } from 'react';
import { ArrowRight, Globe, Mail, Radar, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Spinner } from '@/components/Spinner';
import { StatusBadge } from '@/components/StatusBadge';
import { resolveWebsite, searchCompanies } from '@/utils/api';
import { formatCurrency } from '@/utils/format';
import type { Company } from '@/types';

export default function Home() {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [metier, setMetier] = useState('');
  const [minRevenue, setMinRevenue] = useState('');
  const [maxRevenue, setMaxRevenue] = useState('');
  const [results, setResults] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await searchCompanies(
        query,
        city,
        metier,
        minRevenue ? Number(minRevenue) : undefined,
        maxRevenue ? Number(maxRevenue) : undefined,
      );
      setResults(response.results);
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
    const targets = results.filter((company) => !company.websiteUrl || !company.email);
    if (targets.length === 0) {
      return;
    }

    setEnriching(true);
    setError(null);

    try {
      for (const company of targets) {
        const response = await resolveWebsite(company.siren, company.websiteUrl ?? undefined);
        setResults((current) =>
          current.map((item) =>
            item.siren === company.siren
              ? {
                  ...item,
                  websiteUrl: response.company.websiteUrl,
                  websiteSource: response.company.websiteSource,
                  websiteConfidence: response.company.websiteConfidence,
                  email: response.company.email,
                }
              : item,
          ),
        );
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
                onChange={(event) => setQuery(event.target.value)}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="Ex. La Poste, LVMH, 356000000"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Ville optionnelle
              </span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="Paris"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Metier ou activite
              </span>
              <input
                value={metier}
                onChange={(event) => setMetier(event.target.value)}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="Ex. fleuriste, boulangerie, coiffure"
              />
            </label>

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
              Recherche textuelle sur l'API publique, puis filtrage local par ville,
              metier et chiffre d'affaires quand ces donnees existent.
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
              {results.length} resultat{results.length > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={handleEnrichWebsites}
              disabled={
                enriching ||
                results.length === 0 ||
                results.every((company) => company.websiteUrl && company.email)
              }
              className="inline-flex h-10 items-center gap-2 rounded-full border border-moss/40 bg-moss/10 px-4 text-sm text-moss transition hover:border-moss hover:bg-moss hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enriching ? <Spinner className="text-moss" /> : <Globe className="h-4 w-4" />}
              Completer les sites
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {results.map((company) => (
            <article
              key={company.siren}
              className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-panel"
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

          {!loading && results.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-ivory-muted">
              Aucun resultat avec ces filtres. Essaie un metier plus large, une autre
              ville, ou retire les bornes de chiffre d'affaires.
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
