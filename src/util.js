import data from '../data/baseline.json';

export { data };
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const num = (v, d = 2) => v.toLocaleString('en-GB', { maximumFractionDigits: d });

export const STATUS_LABEL = {
  reported: 'reported by operator', permitted: 'set in permit', operator: 'operator statement', derived: 'calculated',
  press: 'press', study: 'study', regulation: 'law in force', 'draft-law': 'draft law', reference: 'official statistic',
  'vendor-claim': 'vendor claim', 'not-public': 'not public', chosen: 'model choice',
};

export function fmtValue(v, unit = '') {
  if (v === null || v === undefined) return 'not published';
  if (typeof v !== 'number') return esc(v);
  if (unit === 'kWh/yr' && v >= 1e6) return `${num(v / 1e6, 1)} GWh/yr`;
  if (unit === 'kW' && v >= 1000) return `${num(v / 1000, 1)} MW`;
  return `${num(v)}${unit ? ' ' + esc(unit) : ''}`;
}

export const dot = (status) =>
  `<span class="status"><i style="background: var(--s-${status})"></i>${STATUS_LABEL[status] || status}</span>`;

export function sourceLinks(src) {
  return [].concat(src || []).map((k) => {
    const s = data.sources[k];
    return s ? `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}">${esc(s.publisher)}</a>` : esc(k);
  }).join(', ');
}

// A big number in the card: { value (already formatted), unit, label, status }
export const stat = ({ value, unit = '', label, status }) =>
  `<div class="stat"><div class="v">${value}<span class="u">${unit}</span></div><div class="l">${esc(label)}</div>${dot(status)}</div>`;

// A row in the folded details list
export function row(label, f) {
  if (!f) return '';
  const meta = [dot(f.status)];
  if (f.source) meta.push(sourceLinks(f.source));
  if (f.asOf) meta.push(`as of ${esc(f.asOf)}`);
  if (f.formula) meta.push(`= ${esc(f.formula)}`);
  return `<div class="row"><div class="rl"><span>${esc(label)}</span><b>${fmtValue(f.value, f.unit)}</b></div>
    <div class="rm">${meta.map((m) => `<span>${m}</span>`).join('')}</div>${f.note ? `<div class="rn">${esc(f.note)}</div>` : ''}</div>`;
}
