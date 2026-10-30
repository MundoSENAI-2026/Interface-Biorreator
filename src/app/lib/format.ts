// Formatação pt-BR centralizada: vírgula decimal, casas fixas por grandeza,
// unidade sempre visível.

const numberFormatters = new Map<number, Intl.NumberFormat>();

function numberFormatter(decimals: number) {
  let fmt = numberFormatters.get(decimals);
  if (!fmt) {
    fmt = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormatters.set(decimals, fmt);
  }
  return fmt;
}

export function formatNumber(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '—';
  // Evita "-0,0" quando o valor é praticamente zero
  const rounded = Number(value.toFixed(decimals));
  return numberFormatter(decimals).format(rounded === 0 ? 0 : rounded);
}

/** Valor + unidade, ex.: "121,3 °C", "0,85 kgf/cm²", "6,80 pH". */
export function formatWithUnit(value: number, decimals: number, unit: string): string {
  return `${formatNumber(value, decimals)} ${unit}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)} %`;
}

export function formatTime(date: Date | number): string {
  return new Date(date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(date: Date | number): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateLong(date: Date | number): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(date: Date | number): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/** Duração em segundos → "1 h 05 min", "12 min", "45 s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

/** Diferença em dias de calendário (data local), positiva se `target` está no futuro. */
export function daysUntil(target: Date, today: Date = new Date()): number {
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Converte "AAAA-MM-DD" em Date local (sem deslocamento de fuso). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${Math.abs(n) === 1 ? singular : plural}`;
}

/** Duração curta para espaços estreitos: "45 min", "1h09". */
export function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

/** Par decorrido/total curto e sem quebra: "23/50 min", "1h09/8h00". */
export function formatProgressShort(elapsedS: number, totalS: number): string {
  if (totalS < 3600) return `${Math.floor(Math.max(0, elapsedS) / 60)}/${Math.round(totalS / 60)} min`;
  return `${formatDurationShort(elapsedS)}/${formatDurationShort(totalS)}`;
}
