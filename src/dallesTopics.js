// Cards for Google The Dalles, with comparisons to Raunheim (FRA21).
import site from '../data/thedalles.json';
import { data, esc, num, fmtValue, STATUS_LABEL } from './util.js';

const D = site.facts;
const F21 = data.sites['vantage-fra21'].facts;
const W21 = data.sites['vantage-fra21'].derived.waterPerDay.value; // m³/day
const dot = (status) => `<span class="status"><i style="background: var(--s-${status})"></i>${STATUS_LABEL[status] || status}</span>`;
const src = (k) => [].concat(k || []).map((s) => {
  const x = site.sources[s] || data.sources[s];
  return x ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.title)}">${esc(x.publisher)}</a>` : esc(s);
}).join(', ');
const stat = ({ value, unit = '', label, status }) =>
  `<div class="stat"><div class="v">${value}<span class="u">${unit}</span></div><div class="l">${esc(label)}</div>${dot(status)}</div>`;
// rows in the folded details, using this site's sources
const drow = (label, f) => `<div class="row"><div class="rl"><span>${esc(label)}</span><b>${fmtValue(f.value, f.unit)}</b></div>
  <div class="rm">${dot(f.status)}${f.source ? `<span>${src(f.source)}</span>` : ''}${f.asOf ? `<span>as of ${esc(f.asOf)}</span>` : ''}${f.formula ? `<span>= ${esc(f.formula)}</span>` : ''}</div>${f.note ? `<div class="rn">${esc(f.note)}</div>` : ''}</div>`;
const where = '<div class="where">Google, The Dalles, Oregon</div>';
const vs = (text) => `<p class="vs"><b>Raunheim:</b> ${text}</p>`;

export const DALLES_TOPICS = [
  {
    id: 'd-cooling', name: 'Cooling',
    general: 'Here heat leaves through cooling towers: warm water trickles through them and part of it evaporates, carrying the heat away. The steam plumes are visible from town.',
    card: () => `${where}<div class="stats">
      ${stat({ value: `${D.pueSecond.value.toFixed(2)}–${D.pueFirst.value.toFixed(2)}`, label: 'PUE of the three campuses', status: D.pueFirst.status })}
      ${stat({ value: num(D.julyMax.value, 1), unit: ' °C', label: 'average July high', status: D.julyMax.status })}</div>
      <p class="plain">Google: these sites need “${esc(D.overheadQuote.value)}”. ${dot(D.overheadQuote.status)} Evaporating water is what makes that possible in a hot, dry summer.</p>
      ${vs(`PUE ${num(F21.pue.value)}, a sealed loop with almost no water, in a climate where July averages 20.5 °C.`)}`,
    details: () => [['pueFirst', '1st campus PUE'], ['pueSecond', '2nd campus PUE'], ['pueThird', '3rd campus PUE'], ['cooling', 'Cooling'], ['julyMax', 'July average high'], ['tempMean', 'Annual mean']],
    footnote: 'Building outlines are real; cooling tower positions and roof units are schematic.',
  },
  {
    id: 'd-water', name: 'Water',
    general: 'This is the trade-off made visible: very little extra electricity for cooling, but a lot of water.',
    card: () => `${where}<div class="stats">
      ${stat({ value: num(D.waterPerDayM3.value, 0), unit: ' m³', label: 'water consumed a day in 2025 (the blue block, to scale)', status: 'derived' })}
      ${stat({ value: num(Math.round(D.waterPerDayM3.value / W21 / 100) * 100, 0), unit: '×', label: 'Raunheim’s daily water', status: 'derived' })}</div>
      <p class="plain">${num(D.waterConsumption.value, 0)} million gallons consumed in 2025, of ${num(D.waterWithdrawal.value, 1)} million taken from the city. ${dot(D.waterConsumption.status)} That was about a third of the town’s water by 2024. ${dot(D.cityShare.status)}</p>
      <h4>How it became public</h4><p class="plain">${esc(D.lawsuit.value)}. ${dot(D.lawsuit.status)}</p>
      <h4>Where it comes from</h4><p class="plain">${esc(D.waterSource.value)}. ${esc(D.mountHood.value)}. ${dot(D.mountHood.status)} Google built a groundwater storage system and gave it to the city, and says its own assessment found no high risk to local water. ${dot(D.asr.status)}</p>`,
    details: () => [['waterWithdrawal', 'Withdrawn, 2025'], ['waterDischarge', 'Discharged, 2025'], ['waterConsumption', 'Consumed, 2025'], ['waterConsumption2024', 'Consumed, 2024'], ['waterConsumptionM3', 'Consumed, in m³'], ['asr', 'Water infrastructure'], ['riskAssessment', 'Google’s risk assessment']],
    footnote: 'Raunheim comparison: FRA21’s 2025 water (≈ 2.97 m³ a day, from its reported WUE).',
    cube: true,
  },
  {
    id: 'd-power', name: 'Power',
    general: 'Power comes from the Bonneville grid, dominated by hydropower on the Columbia. The substations here are real, from the map.',
    card: () => `${where}<div class="stats">
      ${stat({ value: 'not public', label: 'electricity used', status: D.electricity.status })}
      ${stat({ value: D.cfe.value, unit: ' %', label: 'carbon-free electricity, 2025', status: D.cfe.status })}
      ${stat({ value: num(D.gridCO2.value, 0), unit: ' g', label: 'CO₂ per kWh on this grid', status: D.gridCO2.status })}</div>
      <p class="plain">Google publishes no electricity figure for The Dalles. In 2018 the local utility asked to connect ${D.interconnect.value} MW for a new, unnamed data center here. ${dot(D.interconnect.status)}</p>
      ${vs(`${num(F21.totalEnergy.value / 1e6, 1)} GWh in 2025, reported to the German register; German grid about 344 g CO₂ per kWh.`)}`,
    details: () => [['electricity', 'Electricity used'], ['interconnect', 'Grid connection request, 2018'], ['cfe', 'Carbon-free share'], ['gridCO2', 'Grid CO₂ per kWh']],
    footnote: 'Substation outlines and power lines are from OpenStreetMap; transformers inside are schematic.',
  },
  {
    id: 'd-backup', name: 'Backup power',
    general: 'Like every large datacenter, these sites have diesel generators for grid failures.',
    card: () => `${where}<div class="stats">
      ${stat({ value: 'secret', label: 'number of generators', status: D.generators.status })}
      ${stat({ value: D.generatorHours.value, unit: ' h', label: 'a year each, outside emergencies, at most', status: D.generatorHours.status })}</div>
      <p class="plain">${esc(D.generators.note)} ${dot(D.generators.status)}</p>
      ${vs('the permit names all 28 generators, their model and their limits.')}`,
    details: () => [['generators', 'Generators'], ['generatorHours', 'Running hours']],
  },
  {
    id: 'd-jobs', name: 'Jobs and taxes',
    general: 'A large campus employs a few hundred people. In return for building here, Google pays far less property tax than usual.',
    card: () => `${where}<div class="stats">
      ${stat({ value: `≈ ${D.staff.value}`, label: 'employees', status: D.staff.status })}
      ${stat({ value: D.taxDiscount.value, unit: ' %', label: 'property tax discount', status: D.taxDiscount.status })}
      ${stat({ value: `$${D.taxPaid.value}`, unit: ' m', label: 'property tax paid in 2025', status: D.taxPaid.status })}</div>
      ${vs('no staff numbers published; a study suggests 12–32 permanent jobs for a building that size.')}`,
    details: () => [['staff', 'Employees'], ['taxDiscount', 'Tax discount'], ['taxPaid', 'Tax paid']],
  },
  {
    id: 'd-climate', name: 'Climate and CO₂',
    general: 'Dry, hot summers explain the cooling towers; a hydropower grid explains the low CO₂ per kWh.',
    card: () => `${where}<div class="stats">
      ${stat({ value: num(D.rain.value, 0), unit: ' mm', label: 'rain a year', status: D.rain.status })}
      ${stat({ value: num(D.julyMax.value, 1), unit: ' °C', label: 'average July high', status: D.julyMax.status })}
      ${stat({ value: num(D.gridCO2.value, 0), unit: ' g', label: 'CO₂ per kWh on the grid', status: D.gridCO2.status })}</div>
      <p class="plain">Total CO₂ cannot be calculated, because electricity use is not published. ${dot('not-public')}</p>
      ${vs('about 46,600 t CO₂ on the German grid mix in 2025, or ≈ 0 with green-power certificates.')}`,
    details: () => [['rain', 'Rain'], ['tempMean', 'Annual mean'], ['julyMax', 'July high'], ['cfe', 'Carbon-free share'], ['gridCO2', 'Grid CO₂']],
  },
  {
    id: 'd-compare', name: 'Compare', wide: true,
    general: 'Two datacenters, two ways of solving the same problem, and two very different amounts of public information.',
    card: () => {
      const rows = [
        ['Efficiency (PUE)', `${D.pueSecond.value.toFixed(2)}–${D.pueFirst.value.toFixed(2)}`, D.pueFirst.status, num(F21.pue.value), 'reported'],
        ['Water a day', `${num(D.waterPerDayM3.value, 0)} m³`, 'derived', `${num(W21, 1)} m³`, 'derived'],
        ['Cooling', 'cooling towers, evaporation', 'operator', 'sealed loop', 'permitted'],
        ['Electricity a year', 'not public', 'not-public', `${num(F21.totalEnergy.value / 1e6, 1)} GWh`, 'reported'],
        ['Grid CO₂ per kWh', `${num(D.gridCO2.value, 0)} g`, D.gridCO2.status, '344 g', 'study'],
        ['Generators', 'secret', 'not-public', '28', 'permitted'],
        ['Staff', `≈ ${D.staff.value}`, D.staff.status, 'not public (12–32 estimated)', 'not-public'],
        ['July average high', `${num(D.julyMax.value, 1)} °C`, 'reference', '20.5 °C (July mean)', 'reference'],
        ['Main source of figures', 'the company’s own reports', 'operator', 'government register and permits', 'reported'],
      ];
      return `<table class="compare"><tr><th></th><th>The Dalles</th><th>Raunheim</th></tr>${rows.map(([k, a, sa, b, sb]) => `<tr><td>${esc(k)}</td><td>${esc(a)}${dot(sa)}</td><td>${esc(b)}${dot(sb)}</td></tr>`).join('')}</table>
        <p class="plain">The pattern: The Dalles saves electricity by evaporating water in a dry climate; Raunheim saves water and spends a little more electricity. Germany makes operators file their figures; in Oregon most numbers come from Google itself, and some are secret.</p>`;
    },
    details: () => [],
  },
];

// guided tour for The Dalles; every sentence uses the figures in data/thedalles.json
export const DALLES_TOUR = [
  { id: null, text: `Google’s datacenter campuses in The Dalles, Oregon, on the Columbia River. The first building opened in 2006. Building outlines are real, from the map.` },
  { id: 'd-cooling', text: `Heat leaves through cooling towers: water evaporates and carries it away. That keeps the overhead low: PUE ${D.pueSecond.value.toFixed(2)}–${D.pueFirst.value.toFixed(2)} across the three campuses.` },
  { id: 'd-water', text: `The price is water: about ${num(D.waterPerDayM3.value, 0)} m³ evaporated a day in 2025, the blue block, roughly ${num(Math.round(D.waterPerDayM3.value / W21 / 100) * 100, 0)} times Raunheim’s daily water.` },
  { id: 'd-water', text: `It is city drinking water, about a third of the town’s supply by 2024. The figures became public only after a court fight over keeping them secret.` },
  { id: 'd-power', text: `Power comes from a grid dominated by Columbia River hydropower: ${D.cfe.value} % carbon-free in 2025. How much electricity the site uses is not public.` },
  { id: 'd-backup', text: `Diesel generators stand by for grid failures. How many is a trade secret; each may run at most ${D.generatorHours.value} hours a year outside emergencies.` },
  { id: 'd-jobs', text: `About ${D.staff.value} people work here. In return, Google pays far less property tax than usual: a ${D.taxDiscount.value} % discount.` },
  { id: 'd-climate', text: `Hot, dry summers (July highs average ${num(D.julyMax.value, 1)} °C, ${num(D.rain.value, 0)} mm of rain a year) explain the cooling towers.` },
  { id: 'd-compare', text: 'Side by side with Raunheim: one saves electricity by evaporating water, the other saves water. Open any card for the sources.' },
];

export function dallesDetails(t) {
  return t.details().map(([k, label]) => drow(label, D[k])).join('') + (t.footnote ? `<p class="rn">${esc(t.footnote)}</p>` : '');
}
export const DALLES = site;
