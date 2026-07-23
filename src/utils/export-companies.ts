import { getEligibilityLabel, getScanStatusLabel } from '@/utils/format';
import type { Company } from '@/types';

type ExportRow = Record<string, string>;

function sanitizeCell(value: string | number | null | undefined) {
  return String(value ?? '').replace(/\r?\n|\r/g, ' ').trim();
}

function getRows(companies: Company[]): ExportRow[] {
  return companies.map((company) => ({
    SIREN: company.siren,
    Nom: company.nom,
    Ville: sanitizeCell(company.ville),
    Adresse: sanitizeCell(company.adresse),
    Activite: sanitizeCell(company.activite),
    'Categorie entreprise': sanitizeCell(company.categorieEntreprise),
    'Chiffre affaires': company.chiffreAffaires === null ? '' : String(company.chiffreAffaires),
    Statut: getEligibilityLabel(company.eligibility),
    Accessibilite: company.latestScanStatus ? getScanStatusLabel(company.latestScanStatus) : '',
    'Date dernier scan': sanitizeCell(company.latestScannedAt),
    Site: sanitizeCell(company.websiteUrl),
    Email: sanitizeCell(company.email),
  }));
}

function downloadFile(content: BlobPart, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportCompaniesToCsv(companies: Company[]) {
  const rows = getRows(companies);
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(';'),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`)
        .join(';'),
    ),
  ].join('\n');

  downloadFile(`\uFEFF${csv}`, 'entreprises-export.csv', 'text/csv;charset=utf-8;');
}

export function exportCompaniesToExcel(companies: Company[]) {
  const rows = getRows(companies);
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const table = `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${headers
                .map((header) => `<td>${String(row[header] ?? '')}</td>`)
                .join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>${table}</body>
    </html>
  `;

  downloadFile(html, 'entreprises-export.xls', 'application/vnd.ms-excel;charset=utf-8;');
}
