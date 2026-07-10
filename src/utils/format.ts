import type { EligibilityStatus, ScanStatus } from '@/types';

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatCurrency(value: number | null) {
  if (value === null) {
    return 'Non disponible';
  }

  return currencyFormatter.format(value);
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function getEligibilityLabel(status: EligibilityStatus) {
  switch (status) {
    case 'soumis_probable':
      return 'Soumis probable';
    case 'hors_perimetre_probable':
      return 'Hors perimetre probable';
    default:
      return 'Perimetre incertain';
  }
}

export function getScanStatusLabel(status: ScanStatus) {
  switch (status) {
    case 'elements_detectes':
      return 'Elements detectes';
    case 'elements_partiels':
      return 'Elements partiels';
    case 'conformite_non_demontree':
      return 'Conformite non demontree';
    default:
      return 'A verifier manuellement';
  }
}
