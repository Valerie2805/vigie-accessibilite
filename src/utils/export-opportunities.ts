import type { Opportunity } from '@/types';

function downloadFile(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number | null | undefined) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function exportOpportunitiesToJson(opportunities: Opportunity[], fileName = 'opportunities.json') {
  downloadFile(JSON.stringify(opportunities, null, 2), fileName, 'application/json;charset=utf-8');
}

export function exportOpportunitiesToCsv(opportunities: Opportunity[], fileName = 'opportunities.csv') {
  const headers = [
    'id',
    'site',
    'domain',
    'country',
    'sector',
    'site_type',
    'lead_score',
    'lead_label',
    'regulatory_urgency',
    'primary_offer',
    'secondary_offer',
    'confidence',
    'status',
  ];

  const lines = opportunities.map((opportunity) =>
    [
      opportunity.id,
      opportunity.site.name,
      opportunity.site.domain,
      opportunity.site.country,
      opportunity.site.sector,
      opportunity.site.siteType,
      opportunity.scores.leadScore,
      opportunity.scores.leadLabel,
      opportunity.scores.regulatoryUrgency,
      opportunity.recommendedOffer.primary,
      opportunity.recommendedOffer.secondary,
      opportunity.scan.confidence,
      opportunity.status,
    ]
      .map(escapeCsv)
      .join(','),
  );

  downloadFile([headers.join(','), ...lines].join('\n'), fileName, 'text/csv;charset=utf-8');
}
