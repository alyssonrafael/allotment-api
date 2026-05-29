// Fonte única de verdade para a regra de medidas inteiras.
// width/height de stands e pavilhões DEVEM ser inteiros >= 1 (metros).
// count de um grupo de stands DEVE ser inteiro >= 1.

// Dimensão válida: número inteiro em metros, mínimo 1.
export function isValidDimension(value: number | undefined | null): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return value >= 1 && Number.isInteger(value);
}

// Arredonda para o inteiro mais próximo, com mínimo 1 (2.4→2, 2.5→3, 0.5→1).
export function normalizeDimension(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

// Quantidade de stands de um grupo: inteiro mais próximo, mínimo 1.
export function normalizeCount(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

// Espaçamento/corredor entre stands: inteiro mais próximo, mínimo 0
// (0 = stands encostados). Mantém o grid de coordenadas inteiro.
export function normalizeSpacing(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}
