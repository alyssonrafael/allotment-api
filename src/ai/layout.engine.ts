export interface StandGroup {
  width: number;
  height: number;
  count: number;
  label?: string | null;
  pricePerSqm?: number | null;
}

export type StartCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export interface LayoutIntent {
  groups: StandGroup[];
  corridorH: number;
  corridorV: number;
  mainCorridorH?: number | null;
  mainCorridorV?: number | null;
  basePrice?: number | null;
  startCorner?: StartCorner | null;
}

export interface PlacedStand {
  code: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'AVAILABLE';
  price: number;
}

export interface LayoutResult {
  allotments: PlacedStand[];
  summary: {
    total: number;
    placed: number;
    discarded: number;
    groups: Array<{ width: number; height: number; count: number; placed: number }>;
  };
  warnings: string[];
}

function generateCode(index: number): string {
  const letter = String.fromCharCode(65 + Math.floor(index / 26));
  const num = (index % 26) + 1;
  return `${letter}-${String(num).padStart(2, '0')}`;
}

// Dimensões válidas: números inteiros em metros e mínimo 1.
function isValidDimension(value: number | undefined | null): boolean {
  if (typeof value !== 'number') return false;
  return value >= 1 && Number.isInteger(value);
}

function normalizeDimension(value: number | undefined | null): number {
  if (typeof value !== 'number' || isNaN(value)) return 1;
  return Math.max(1, Math.round(value));
}

// Arredonda dimensões inválidas para o inteiro mais próximo (mínimo 1m),
// acrescentando um aviso por grupo ajustado.
function normalizeGroups(
  groups: StandGroup[],
  warnings: string[],
): StandGroup[] {
  return groups.map((group) => {
    let width = group.width;
    let height = group.height;
    const parts: string[] = [];

    // Se não for válido (ex: 2.5), forçamos o arredondamento
    if (!isValidDimension(width)) {
      const adjusted = normalizeDimension(width);
      parts.push(`largura ${width}m ajustada para ${adjusted}m`);
      width = adjusted;
    }
    
    if (!isValidDimension(height)) {
      const adjusted = normalizeDimension(height);
      parts.push(`profundidade ${height}m ajustada para ${adjusted}m`);
      height = adjusted;
    }

    if (parts.length > 0) {
      warnings.push(`Medida fracionada corrigida: ${parts.join(' e ')}. O sistema usa apenas metros inteiros absolutos.`);
    }

    return { ...group, width, height };
  });
}

export function runLayout(intent: LayoutIntent, canvasWidth: number, canvasHeight: number): LayoutResult {
  const { corridorH, corridorV, mainCorridorH, mainCorridorV, basePrice } = intent;

  const allotments: PlacedStand[] = [];
  const warnings: string[] = [];
  const summaryGroups: LayoutResult['summary']['groups'] = [];

  const groups = normalizeGroups(intent.groups, warnings);

  const minArea =
    groups.length > 0 ? Math.min(...groups.map((g) => g.width * g.height)) : 1;

  let standIndex = 0;
  let cursorY = 0;
  let mainCorridorHUsed = false;

  for (const group of groups) {
    const { width, height, count, label } = group;
    const prefix = label ?? 'Stand';

    if (width > canvasWidth || height > canvasHeight) {
      warnings.push(
        `${count} stand(s) ${width}x${height} descartado(s) — maior que o canvas (${canvasWidth}x${canvasHeight})`,
      );
      summaryGroups.push({ width, height, count, placed: 0 });
      continue;
    }

    let cursorX = 0;
    let maxRowHeight = 0;
    let mainCorridorVUsed = false;
    let placedInGroup = 0;
    let discardedInGroup = 0;

    for (let i = 0; i < count; i++) {
      // Wrap to new line if stand doesn't fit horizontally
      if (cursorX + width > canvasWidth) {
        const prevCursorY = cursorY;
        const gap =
          !mainCorridorHUsed &&
          mainCorridorH != null &&
          prevCursorY < canvasHeight / 2 &&
          prevCursorY + maxRowHeight + mainCorridorH >= canvasHeight / 2
            ? mainCorridorH
            : corridorH;

        if (!mainCorridorHUsed && gap === mainCorridorH) {
          mainCorridorHUsed = true;
        }

        cursorY += maxRowHeight + gap;
        cursorX = 0;
        maxRowHeight = 0;
        mainCorridorVUsed = false;
      }

      // Discard if stand doesn't fit vertically
      if (cursorY + height > canvasHeight) {
        discardedInGroup++;
        continue;
      }

      const code = generateCode(standIndex++);
      const area = width * height;
      const price =
        basePrice != null ? Math.round(basePrice * (area / minArea)) : area * 1000;

      allotments.push({
        code,
        name: `${prefix} ${code}`,
        x: cursorX,
        y: cursorY,
        width,
        height,
        status: 'AVAILABLE',
        price,
      });

      placedInGroup++;
      if (height > maxRowHeight) maxRowHeight = height;

      // Advance cursor horizontally
      cursorX += width + corridorV;

      // Add main vertical corridor once per row when crossing midpoint
      if (
        !mainCorridorVUsed &&
        mainCorridorV != null &&
        cursorX - (width + corridorV) < canvasWidth / 2 &&
        cursorX >= canvasWidth / 2
      ) {
        cursorX += mainCorridorV;
        mainCorridorVUsed = true;
      }
    }

    if (discardedInGroup > 0) {
      warnings.push(
        `${discardedInGroup} stand(s) ${width}x${height} descartado(s) por falta de espaço`,
      );
    }

    summaryGroups.push({ width, height, count, placed: placedInGroup });

    // Advance cursor_y between groups
    if (maxRowHeight > 0) {
      cursorY += maxRowHeight + corridorH;
    }
    cursorX = 0;
    maxRowHeight = 0;
  }

  const placed = allotments.length;
  const total = groups.reduce((sum, g) => sum + g.count, 0);

  return {
    allotments: applyStartCorner(allotments, canvasWidth, canvasHeight, intent.startCorner),
    summary: {
      total,
      placed,
      discarded: total - placed,
      groups: summaryGroups,
    },
    warnings,
  };
}

function applyStartCorner(
  allotments: PlacedStand[],
  canvasWidth: number,
  canvasHeight: number,
  corner: StartCorner | null | undefined,
): PlacedStand[] {
  if (!corner || corner === 'top-left' || allotments.length === 0) return allotments;

  if (corner === 'center') {
    const maxX = Math.max(...allotments.map((a) => a.x + a.width));
    const maxY = Math.max(...allotments.map((a) => a.y + a.height));
    const offsetX = Math.max(0, (canvasWidth - maxX) / 2);
    const offsetY = Math.max(0, (canvasHeight - maxY) / 2);
    return allotments.map((a) => ({ ...a, x: a.x + offsetX, y: a.y + offsetY }));
  }

  const flipX = corner === 'top-right' || corner === 'bottom-right';
  const flipY = corner === 'bottom-left' || corner === 'bottom-right';

  return allotments.map((a) => ({
    ...a,
    x: flipX ? canvasWidth - a.x - a.width : a.x,
    y: flipY ? canvasHeight - a.y - a.height : a.y,
  }));
}
