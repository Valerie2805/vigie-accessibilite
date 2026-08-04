import type { AxeImpact, OpportunitySignalCategory, Scan } from '@/types';

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateForPdf(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
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

function buildMetric(label: string, value: string, hint?: string) {
  return `
    <div class="metric">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      ${hint ? `<div class="metric-hint">${escapeHtml(hint)}</div>` : ''}
    </div>
  `;
}

function buildList(items: string[]) {
  if (items.length === 0) {
    return '<p class="empty">Aucun element disponible.</p>';
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function buildHtml(scan: Scan) {
  const axe = scan.axe;
  const title = `Zyrelka-analyse-${slugify(scan.companyName || scan.id || 'scan')}`;

  const metrics = axe
    ? [
        buildMetric('Score', String(scan.score), 'Indicateur de priorite du scan automatique'),
        buildMetric('Violations', String(axe.totalViolations), 'Occurrences remontees automatiquement'),
        buildMetric(
          'Gravite elevee',
          String(axe.violationsByImpact.critical + axe.violationsByImpact.serious),
          'Critiques ou serieuses',
        ),
        buildMetric('Date du scan', formatDateForPdf(axe.scannedAt)),
      ].join('')
    : [
        buildMetric('Score', String(scan.score)),
        buildMetric('Evidences', String(scan.evidences.length)),
        buildMetric('URL analysee', scan.websiteUrl),
        buildMetric('Date du scan', formatDateForPdf(scan.scannedAt)),
      ].join('');

  const axeSections = axe
    ? `
      <section class="card">
        <h2>Resume commercial</h2>
        <p>${escapeHtml(axe.nonExpertSummary)}</p>
      </section>

      <section class="grid-two">
        <div class="card">
          <h2>Signaux detectes automatiquement</h2>
          ${buildList(axe.detectedSignals)}
        </div>
        <div class="card">
          <h2>Points a confirmer par audit humain</h2>
          ${buildList(axe.humanAuditPoints)}
        </div>
      </section>

      <section class="grid-two">
        <div class="card">
          <h2>Violations par gravite</h2>
          <ul>
            <li>Critiques: ${escapeHtml(String(axe.violationsByImpact.critical))}</li>
            <li>Serieuses: ${escapeHtml(String(axe.violationsByImpact.serious))}</li>
            <li>Moderees: ${escapeHtml(String(axe.violationsByImpact.moderate))}</li>
            <li>Mineures: ${escapeHtml(String(axe.violationsByImpact.minor))}</li>
          </ul>
        </div>
        <div class="card">
          <h2>Categories principales</h2>
          ${
            axe.categories.length > 0
              ? `<ul>${axe.categories
                  .map(
                    (item) =>
                      `<li>${escapeHtml(getCategoryLabel(item.category))} - ${escapeHtml(String(item.count))}</li>`,
                  )
                  .join('')}</ul>`
              : '<p class="empty">Aucune categorie dominante.</p>'
          }
        </div>
      </section>

      <section class="card">
        <h2>Regles principales detectees</h2>
        ${
          axe.topRules.length > 0
            ? axe.topRules
                .map(
                  (rule) => `
                    <div class="item">
                      <div class="item-head">
                        <strong>${escapeHtml(rule.help)}</strong>
                        <span>${escapeHtml(getImpactLabel(rule.impact))} - ${escapeHtml(String(rule.occurrences))}</span>
                      </div>
                      <p>${escapeHtml(rule.description)}</p>
                      ${
                        rule.elements.length > 0
                          ? `<p class="muted">Elements touches: ${escapeHtml(rule.elements.join(' | '))}</p>`
                          : ''
                      }
                    </div>
                  `,
                )
                .join('')
            : '<p class="empty">Aucune violation axe-core remontee.</p>'
        }
      </section>

      <section class="card">
        <h2>Elements touches</h2>
        ${
          axe.highlightedElements.length > 0
            ? axe.highlightedElements
                .map(
                  (element) => `
                    <div class="item">
                      <div class="item-head">
                        <strong>${escapeHtml(element.ruleId)}</strong>
                        <span>${escapeHtml(getImpactLabel(element.impact))}</span>
                      </div>
                      <p>${escapeHtml(element.selector || 'Element sans selecteur exploitable')}</p>
                      <p class="muted">${escapeHtml(element.htmlSnippet)}</p>
                    </div>
                  `,
                )
                .join('')
            : '<p class="empty">Aucun extrait d element disponible.</p>'
        }
      </section>
    `
    : `
      <section class="card">
        <h2>Preuves detectees</h2>
        ${
          scan.evidences.length > 0
            ? scan.evidences
                .map(
                  (evidence) => `
                    <div class="item">
                      <div class="item-head">
                        <strong>${escapeHtml(evidence.label)}</strong>
                        <span>${escapeHtml(evidence.kind.replace(/_/g, ' '))}</span>
                      </div>
                      <p>${escapeHtml(evidence.sourceUrl)}</p>
                      ${evidence.excerpt ? `<p class="muted">${escapeHtml(evidence.excerpt)}</p>` : ''}
                    </div>
                  `,
                )
                .join('')
            : '<p class="empty">Aucune preuve automatique disponible.</p>'
        }
      </section>
    `;

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root {
            color-scheme: light;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 32px;
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            background: #f8fafc;
          }
          .page {
            max-width: 920px;
            margin: 0 auto;
          }
          .brand {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
          }
          .brand h1 {
            margin: 0;
            font-size: 30px;
            color: #111827;
          }
          .brand p {
            margin: 6px 0 0;
            color: #4b5563;
            line-height: 1.6;
          }
          .meta {
            text-align: right;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.6;
          }
          .grid-metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 20px;
          }
          .grid-two {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 16px;
          }
          .metric, .card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 18px;
          }
          .metric-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
          }
          .metric-value {
            margin-top: 10px;
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            word-break: break-word;
          }
          .metric-hint, .muted, .legal {
            margin-top: 8px;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.6;
          }
          h2 {
            margin: 0 0 12px;
            font-size: 16px;
            color: #111827;
          }
          p, li {
            font-size: 14px;
            line-height: 1.7;
          }
          ul {
            margin: 0;
            padding-left: 18px;
          }
          .item {
            padding: 14px 0;
            border-top: 1px solid #e5e7eb;
          }
          .item:first-child {
            padding-top: 0;
            border-top: 0;
          }
          .item-head {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
            margin-bottom: 8px;
          }
          .item-head span {
            font-size: 12px;
            color: #7c3aed;
            white-space: nowrap;
          }
          .empty {
            color: #6b7280;
          }
          .footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
          }
          @media print {
            body {
              background: #ffffff;
              padding: 0;
            }
            .page {
              max-width: none;
            }
            .card, .metric {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <header class="brand">
            <div>
              <h1>Zyrelka</h1>
              <p>Rapport d'analyse d'accessibilite - signaux detectes automatiquement</p>
            </div>
            <div class="meta">
              <div>Entreprise: ${escapeHtml(scan.companyName)}</div>
              <div>SIREN: ${escapeHtml(scan.siren)}</div>
              <div>URL: ${escapeHtml(axe?.url ?? scan.websiteUrl)}</div>
            </div>
          </header>

          <section class="grid-metrics">
            ${metrics}
          </section>

          ${axeSections}

          <section class="card">
            <h2>Notes de scan</h2>
            ${buildList(scan.notes)}
          </section>

          <footer class="footer">
            <p class="legal">
              Document Zyrelka genere a partir d'un scan automatise. Les resultats presentes correspondent a des signaux detectes automatiquement et a une exposition reglementaire estimee. Ce document ne constitue ni un avis juridique, ni une preuve de non-conformite, ni un audit complet. Les points sensibles doivent etre confirmes par audit humain.
            </p>
          </footer>
        </div>
      </body>
    </html>
  `;
}

export function exportAnalysisToPdf(scan: Scan) {
  const html = buildHtml(scan);
  const title = `Zyrelka-analyse-${slugify(scan.companyName || scan.id || 'scan')}`;
  const printWindow = window.open('', '_blank', 'width=1024,height=768');

  if (!printWindow) {
    throw new Error("La fenetre d'export PDF a ete bloquee par le navigateur");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}
