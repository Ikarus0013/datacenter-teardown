// Cards for the fictional ideal datacenter. Every figure comes from data/ideal.json,
// each tagged proven (done somewhere today), promised, research, or a choice made for this model.
import site from '../data/ideal.json';
import dalles from '../data/thedalles.json';
import { data, esc, num, fmtValue, STATUS_LABEL } from './util.js';

const F = site.facts;
const F21 = data.sites['vantage-fra21'].facts;
const W21 = data.sites['vantage-fra21'].derived.waterPerDay.value;
const CO2_21 = data.environment.climate.co2LocationBased.value;
const DAL = dalles.facts;
const TIER = { proven: 'proven today', promised: 'promised', research: 'research', choice: 'model choice', calculated: 'calculated' };

const dot = (status) => `<span class="status"><i style="background: var(--s-${status})"></i>${STATUS_LABEL[status] || status}</span>`;
const tier = (t) => `<span class="tier tier-${t}">${TIER[t]}</span>`;
const src = (k) => [].concat(k || []).map((s) => {
  const x = site.sources[s];
  return x ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.title)}">${esc(x.publisher)}</a>` : esc(s);
}).join(', ');
const stat = (value, unit, label, f) =>
  `<div class="stat"><div class="v">${value}<span class="u">${unit}</span></div><div class="l">${esc(label)}</div>${tier(f.tier)}</div>`;
const where = '<div class="where">The ideal datacenter · a fictional campus near Luleå, Sweden</div>';
const today = (text) => `<p class="vs"><b>Today:</b> ${text}</p>`;
const drow = (label, f) => `<div class="row"><div class="rl"><span>${esc(label)}</span><b>${fmtValue(f.value, f.unit)}</b></div>
  <div class="rm">${tier(f.tier)}${dot(f.status)}${f.source ? `<span>${src(f.source)}</span>` : ''}${f.asOf ? `<span>as of ${esc(f.asOf)}</span>` : ''}${f.formula ? `<span>= ${esc(f.formula)}</span>` : ''}</div>${f.note ? `<div class="rn">${esc(f.note)}</div>` : ''}</div>`;
const gwh = (v) => num(v, 0);
const ratioFRA21 = Math.round(F.energyYear.value / (F21.totalEnergy.value / 1e6));

export const IDEAL_TOPICS = [
  {
    id: 'i-scale', name: 'Size',
    general: 'Bigger than any datacenter running today. Every other number on this site is scaled to this size.',
    card: () => `${where}<div class="stats">
      ${stat(num(F.itCapacity.value, 0), ' MW', 'computing power of this campus', F.itCapacity)}
      ${stat(`≈ ${num(F.largestRunning.value, 0)}`, ' MW', 'largest running today (estimate)', F.largestRunning)}
      ${stat(num(F.largestPlanned.value, 0), ' MW', 'largest announced', F.largestPlanned)}</div>
      <p class="plain">At full load all year it would use ${gwh(F.energyYear.value)} GWh of electricity, about ${ratioFRA21} times what Raunheim’s FRA21 used in 2025. ${dot('derived')}</p>
      <p class="plain">The six halls, their layout and the landscape are drawn for this model, not taken from a real plan.</p>`,
    details: () => [['itCapacity', 'Size of this campus'], ['largestRunning', 'Largest running'], ['largestPlanned', 'Largest announced'], ['facilityPower', 'Power incl. cooling'], ['energyYear', 'Electricity a year']],
  },
  {
    id: 'i-cooling', name: 'Cooling',
    general: 'Liquid flows straight to the chips, warm enough that plain outside air can cool it. Dry coolers on the roof, no cooling towers, no water sprayed.',
    card: (vision) => `${where}<div class="stats">
      ${stat(F.coolant.value, ' °C', 'liquid sent to the chips', F.coolant)}
      ${vision ? stat(F.pueResearch.value, '', 'PUE in immersion studies', F.pueResearch) : stat(F.pue.value.toFixed(2), '', 'PUE: best large campus found', F.pue)}
      ${stat(num(F.julyMax.value, 1), ' °C', 'average July high in Luleå', F.julyMax)}</div>
      <p class="plain">PUE ${F.pue.value.toFixed(2)} means only ${Math.round((F.pue.value - 1) * 100)} % extra electricity for cooling and power losses, ${gwh(F.overheadYear.value)} GWh a year at this size. In Luleå, 30 °C is reached on ${num(F.hotDays.value, 1)} days a year on average. ${dot(F.hotDays.status)}</p>
      ${today(`Raunheim PUE ${num(F21.pue.value)}; The Dalles ${DAL.pueSecond.value.toFixed(2)}–${DAL.pueFirst.value.toFixed(2)}, using cooling towers.`)}`,
    details: () => [['coolant', 'Liquid temperature'], ['pue', 'PUE'], ['pueResearch', 'PUE in research'], ['overheadYear', 'Overhead a year'], ['julyMax', 'July average high'], ['hotDays', 'Days at 30 °C'], ['annualMean', 'Annual mean']],
  },
  {
    id: 'i-chips', name: 'Chips',
    general: 'The biggest saving is not in the building but in the chips: more work for every watt. Here one hall is opened up: rows of racks, each fed by a liquid line.',
    card: () => `${where}<div class="stats">
      ${stat('up to 50', '×', 'more AI output per watt than the previous chip generation', F.chips)}</div>
      <p class="plain">This is the chip maker’s own claim, for specific AI models and settings; later tests show up to 25×. ${dot(F.chips.status)} No independent figure across workloads is published.</p>`,
    details: () => [['chips', 'AI output per watt']],
  },
  {
    id: 'i-water', name: 'Water',
    cube: true,
    general: 'Proven today: the best fleets still evaporate a little water per kWh. Promised: sealed loops that evaporate none. At this size, that difference is enormous.',
    card: (vision) => vision
      ? `${where}<div class="stats">
      ${stat('≈ 0', ' m³', 'water evaporated for cooling', F.zeroWater)}</div>
      <p class="plain">${esc(F.zeroWater.note)} ${dot(F.zeroWater.status)}</p>
      <p class="plain">Already done at small scale: ${esc(F.zeroWaterProven.value)} at NREL’s research centre. ${dot(F.zeroWaterProven.status)}</p>`
      : `${where}<div class="stats">
      ${stat(num(F.waterProvenDay.value, 0), ' m³', 'water a day at the best fleet average (the blue block, to scale)', F.waterProvenDay)}
      ${stat(num(F.wueProven.value, 2), ' L', 'per kWh: Meta’s fleet, 2023', F.wueProven)}</div>
      <p class="plain">That is ${num(F.waterProvenDay.value / DAL.waterPerDayM3.value, 1)} times The Dalles’ daily water, only because this campus is so big. Switch to “With promises” to see the zero-water design.</p>`,
    details: () => [['wueProven', 'Best fleet water use'], ['waterProvenM3', 'At this size, a year'], ['waterProvenDay', 'At this size, a day'], ['zeroWater', 'Zero-water design'], ['zeroWaterProven', 'Proven at small scale']],
    cubeM3: (vision) => (vision ? 0 : F.waterProvenDay.value),
    footnote: `Raunheim used ≈ ${num(W21, 1)} m³ a day in 2025; The Dalles ≈ ${num(DAL.waterPerDayM3.value, 0)} m³.`,
  },
  {
    id: 'i-heat', name: 'Heat',
    general: 'The warm water goes to heat pumps, which lift it to the temperature a town’s heating network needs, and an insulated pipe carries it to the homes.',
    card: () => `${where}<div class="stats">
      ${stat(num(F.heatYear.value / 1000, 1), ' TWh', 'heat a year at full load', F.heatYear)}
      ${stat(F.heatTimesLulea.value, '×', 'all the district heat Luleå uses', F.heatTimesLulea)}
      ${stat(num(F.erfMax.value, 1), ' %', 'of its energy reused, even heating all of Luleå', F.erfMax)}</div>
      <p class="plain">The honest catch: a campus this big makes far more heat than a town can use, and towns need little heat in summer. Luleå needs a new heat source: ${esc(F.luleaGas.value)}. ${dot(F.luleaGas.status)}</p>
      <h4>Where it already works</h4><p class="plain">Meta in Odense, Denmark: ${esc(F.odense.value)}. ${tier('proven')} Microsoft and Fortum near Helsinki aim for ${esc(F.espoo.value)}. ${tier('promised')}</p>
      ${today('Raunheim reused none of its heat in 2025.')}`,
    details: () => [['heatYear', 'Heat a year'], ['luleaHeat', 'Luleå district heat'], ['heatTimesLulea', 'Heat vs. Luleå'], ['erfMax', 'Highest possible reuse'], ['luleaGas', 'Luleå’s heat source'], ['odense', 'Proven: Odense'], ['espoo', 'Promised: Espoo']],
  },
  {
    id: 'i-power', name: 'Power',
    general: 'Electricity from the Swedish grid, which emits little CO₂. In its Stockholm region, Google already matches every hour with carbon-free power.',
    card: (vision) => `${where}<div class="stats">
      ${stat(num(F.gridCO2.value, 1), ' g', 'CO₂ per kWh, Swedish grid 2025', F.gridCO2)}
      ${stat(num(F.cfeStockholm.value, 0), ' %', 'carbon-free every hour (Google, Stockholm)', F.cfeStockholm)}
      ${stat(num(F.co2Year.value, 0), ' t', 'CO₂ a year at full load', F.co2Year)}</div>
      ${vision ? `<p class="plain"><b>Promised:</b> ${esc(F.nuclearPromise.value)}. ${dot(F.nuclearPromise.status)} ${esc(F.nuclearPromise.note)}</p>` : '<p class="plain">Switch to “With promises” to see the small nuclear reactor that tech companies have ordered.</p>'}
      ${today(`FRA21 ≈ ${num(CO2_21, 0)} t CO₂ on the German grid (344 g/kWh) in 2025, using ${ratioFRA21} times less electricity.`)}`,
    details: () => [['gridCO2', 'Grid CO₂'], ['co2Year', 'CO₂ a year'], ['cfeStockholm', 'Hourly carbon-free share'], ['nuclearPromise', 'Small reactors']],
  },
  {
    id: 'i-backup', name: 'Backup',
    general: 'No diesel generators. Rows of batteries carry the campus through a grid failure.',
    card: (vision) => `${where}<div class="stats">
      ${stat('80', ' min', 'on batteries alone, done in Sweden', F.battery)}
      ${stat(num(F.batteryScaled.value, 0), ' MWh', 'batteries needed for 80 minutes at this size', F.batteryScaled)}</div>
      <p class="plain">${esc(F.battery.note)} ${dot(F.battery.status)} The battery yard in the model is smaller than that; it is schematic.</p>
      ${vision ? `<p class="plain"><b>Research:</b> ${esc(F.hydrogen.value)}. ${dot(F.hydrogen.status)}</p>` : ''}
      ${today('FRA21 has 28 diesel generators; The Dalles’ number is a trade secret.')}`,
    details: () => [['battery', 'Proven'], ['batteryScaled', 'At this size'], ['hydrogen', 'Hydrogen research']],
  },
  {
    id: 'i-building', name: 'Building',
    general: 'Timber instead of steel and concrete where possible, green roofs, and low-noise fans.',
    card: () => `${where}<div class="stats">
      ${stat('≈ 95', ' %', 'of the frame in timber (Falun, Sweden)', F.timber)}
      ${stat(F.noiseNight.value, ' dB(A)', 'night limit at the nearest home', F.noiseNight)}</div>
      <p class="plain">EcoDataCenter claims up to 60 % lower embodied carbon. ${dot(F.timber.status)} Microsoft estimates 35 % less than steel for its hybrid timber halls. ${tier('promised')}</p>
      <p class="plain">Noise: at one US campus, the home next door never measured above ${F.noiseMeasured.value} dB(A). ${dot(F.noiseMeasured.status)}</p>
      ${today('Raunheim’s permit allows 40 dB(A) at night at the nearest homes, for all equipment together.')}`,
    details: () => [['timber', 'Timber frame'], ['timberMs', 'Hybrid timber'], ['noiseMeasured', 'Measured next door'], ['noiseNight', 'Night limit'], ['neighbour', 'Real neighbour in Luleå']],
  },
  {
    id: 'i-flex', name: 'Flexibility',
    general: 'On the few hours the grid is short of power, the campus slows down work that can wait.',
    card: () => `${where}<div class="stats">
      ${stat(F.flex.value, ' %', 'less power for 3 hours, in a real test', F.flex)}</div>
      <p class="plain">${esc(F.flex.note)} ${dot(F.flex.status)}</p>
      <p class="plain"><b>Promised:</b> ${esc(F.flexDeals.value)}. ${dot(F.flexDeals.status)}</p>`,
    details: () => [['flex', 'Tested'], ['flexDeals', 'Agreements']],
  },
  {
    id: 'i-compare', name: 'Compare', wide: true,
    general: 'Three datacenters side by side: two real ones and the ideal.',
    card: () => {
      const rows = [
        ['Size (computing power)', `${num(F.itCapacity.value, 0)} MW`, 'chosen', 'not public', 'not-public', `${num(F21.itCapacity.value / 1000, 0)} MW`, 'operator'],
        ['PUE', F.pue.value.toFixed(2), F.pue.status, `${DAL.pueSecond.value.toFixed(2)}–${DAL.pueFirst.value.toFixed(2)}`, 'operator', num(F21.pue.value), 'reported'],
        ['Water evaporated a day', '≈ 0 (promised)', 'operator', `${num(DAL.waterPerDayM3.value, 0)} m³`, 'derived', `${num(W21, 1)} m³`, 'derived'],
        ['Cooling', '45 °C liquid, dry coolers', 'vendor-claim', 'cooling towers', 'operator', 'sealed loop, roof coolers', 'permitted'],
        ['Heat reused', 'to the town', 'chosen', 'not public', 'not-public', 'none (2025)', 'reported'],
        ['Backup', 'batteries', 'press', 'diesel (number secret)', 'not-public', '28 diesel generators', 'permitted'],
        ['Grid CO₂ per kWh', `${num(F.gridCO2.value, 1)} g`, 'reference', `${num(DAL.gridCO2.value, 0)} g`, 'operator', '344 g', 'study'],
      ];
      return `<table class="compare"><tr><th></th><th>Ideal</th><th>The Dalles</th><th>Raunheim</th></tr>${rows.map(([k, a, sa, b, sb, c, sc]) => `<tr><td>${esc(k)}</td><td>${esc(a)}${dot(sa)}</td><td>${esc(b)}${dot(sb)}</td><td>${esc(c)}${dot(sc)}</td></tr>`).join('')}</table>
        <p class="plain">Each part of the ideal exists somewhere, or is promised. Nobody has built them all in one place, and at this size some of them, like heat reuse, only solve part of the problem.</p>`;
    },
    details: () => [],
  },
];

export const IDEAL_TOUR = [
  { id: null, text: 'A datacenter that does not exist: every part is the best done somewhere today, or a labelled promise. It stands near Luleå, in northern Sweden.' },
  { id: 'i-scale', text: `It is big: ${num(F.itCapacity.value, 0)} MW of computing, more than the largest running today, about ${num(F.largestRunning.value, 0)} MW.` },
  { id: 'i-cooling', text: `Liquid at ${F.coolant.value} °C flows straight to the chips. Outside air cools it on the roof, for a PUE of ${F.pue.value.toFixed(2)}, the best of any large campus.` },
  { id: 'i-chips', text: 'Inside, rows of racks, each fed by a liquid line. Chip makers promise much more work per watt with every generation.' },
  { id: 'i-water', text: `No water evaporates in a sealed loop. Even so, at the best fleet average a campus this size would use ${num(F.waterProvenDay.value, 0)} m³ a day: size matters.` },
  { id: 'i-heat', text: `Heat pumps send the warmth to the town. But the campus makes ${F.heatTimesLulea.value} times more heat than all of Luleå uses.` },
  { id: 'i-power', text: `Swedish power: about ${num(F.gridCO2.value, 0)} g CO₂ per kWh, a sixteenth of Germany’s.` },
  { id: 'i-backup', text: 'Batteries instead of diesel generators, as already done at a Microsoft site in Sweden.' },
  { id: 'i-building', text: 'Timber frames, green roofs and quiet fans.' },
  { id: 'i-flex', text: 'When the grid is short, it slows down work that can wait.' },
  { id: 'i-compare', text: 'Side by side with the two real sites. Switch on “With promises” to see what is still to come.' },
];

export function idealDetails(t) {
  return t.details().map(([k, label]) => drow(label, F[k])).join('') + (t.footnote ? `<p class="rn">${esc(t.footnote)}</p>` : '');
}
export const IDEAL = site;
