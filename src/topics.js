// What each part of a datacenter does (general), and what we know about it in Raunheim (data).
import { data, esc, num, stat, row, dot, sourceLinks } from './util.js';

const S = data.sites;
const f21 = S['vantage-fra21'], f22 = S['vantage-fra22'], biere = S['tsystems-biere-2'];
const F = f21.facts, D = f21.derived, G = f22.facts, B = f21.backup;
const PERSON_L = data.references.householdWaterPerPerson.value;
const gwh = (f) => num(f.value / 1e6, 1);

export const SCEN = {
  'closed-loop': { label: 'Sealed loop (as built)', wue: F.wue,
    text: 'What FRA21 reported for 2025. The coolant stays sealed in pipes; nothing is evaporated.' },
  evaporative: { label: 'Evaporative', wue: biere.facts.wue,
    text: `What if FRA21 cooled like T-Systems' Biere site (WUE ${biere.facts.wue.value}, reported 2025)? A what-if, not a forecast.` },
  'liquid-45c': { label: '45 °C liquid', wue: null, claim: data.scenarios.cooling.find((c) => c.id === 'liquid-45c') },
};
export const waterPerDay = (wue) => wue.value * D.itEnergy.value / 1000 / 365;

const where = `<div class="where">Raunheim, Vantage FRA21</div>`;

export const TOPICS = [
  {
    id: 'it', name: 'Server halls', groups: ['it'], show: { racks: true }, see: 0.1,
    view: { pos: [40, 110, 135], target: [-55, 0, 0] },
    general: 'Rows of server racks do the actual computing. Almost every watt they draw ends up as heat.',
    card: () => `${where}<div class="stats">
      ${stat({ value: num(F.itCapacity.value / 1000, 0), unit: ' MW', label: 'built for', status: F.itCapacity.status })}
      ${stat({ value: num(D.avgItLoad.value, 1), unit: ' MW', label: 'used on average', status: 'derived' })}
      ${stat({ value: num(D.utilisation.value, 0), unit: ' %', label: 'of capacity in use', status: 'derived' })}</div>`,
    details: () => [['itCapacity', 'IT capacity', F], ['avgItLoad', 'Average IT load', D], ['utilisation', 'Share in use', D],
      ['storeys', 'Storeys', F], ['floorAreaOperator', 'Floor area (operator)', F], ['floorArea', 'Floor area (register)', F]],
    footnote: 'The racks shown are schematic; rack counts are not published.',
  },
  {
    id: 'power', name: 'Power', groups: ['power'], fx: ['power'],
    view: { pos: [-20, 40, 125], target: [-66, 3, 60] },
    general: 'Electricity arrives from the grid at high voltage. Transformers step it down; batteries bridge the seconds until backup generators start.',
    card: () => `${where}<div class="stats">
      ${stat({ value: gwh(F.totalEnergy), unit: ' GWh', label: 'used in 2025', status: F.totalEnergy.status })}
      ${stat({ value: num(F.pue.value), unit: '', label: 'PUE: total ÷ computing energy', status: F.pue.status })}
      ${stat({ value: num(F.renewableShare.value, 0), unit: ' %', label: 'renewable, on paper', status: F.renewableShare.status })}</div>
      <p class="plain">A PUE of ${num(F.pue.value)} means for every 1 kWh of computing, another ${num(F.pue.value - 1)} kWh goes to cooling and losses.</p>`,
    details: () => [['totalEnergy', 'Energy use, 2025', F], ['pue', 'PUE', F], ['renewableShare', 'Renewable electricity', F], ['itEnergy', 'IT energy', D], ['avgFacilityLoad', 'Average total load', D]],
    footnote: 'The transformer yard is schematic; its size is not published by the operator.',
  },
  {
    id: 'cooling', name: 'Cooling', groups: ['cooling', 'it'], fx: ['loop'], show: { racks: true }, see: 0.15, cooling: true,
    view: { pos: [-15, 42, -120], target: [-62, 7, -22] },
    general: 'Every watt the servers use becomes heat that has to leave the building. Three generations of cooling do it very differently.',
    card: (_, __, coolMode, coolView) => {
      const C = data.cooling;
      const view = `<div class="seg view-seg" role="radiogroup" aria-label="View">${[['building', 'In the building'], ['apart', 'Taken apart']].map(([k, l]) =>
        `<button role="radio" data-coolview="${k}" aria-checked="${k === coolView}">${l}</button>`).join('')}</div>`;
      const seg = view + `<div class="seg" role="radiogroup" aria-label="Cooling system">${[['legacy', 'Older'], ['today', 'Today (FRA21)'], ['future', 'Future']].map(([k, l]) =>
        `<button role="radio" data-cool="${k}" aria-checked="${k === coolMode}">${l}</button>`).join('')}</div>`;
      if (coolView === 'apart') {
        const STEPS = {
          legacy: ['Chips heat the air inside the server; its fans push the hot air out.', 'The hot air drifts to a room air conditioner.', 'A compressor drives a refrigerant circuit that chills the air. This is where most of the cooling electricity goes.', 'The refrigerant carries the heat up to the roof.', 'Condenser fans blow it into the outside air.'],
          today: ['Chips heat the air; server fans push it into a closed hot aisle.', 'Cooling units blow that air across coils filled with water.', 'Pumps move the warmed water up to the roof.', 'Roof cooler fans pass outside air over it. On hot days a chiller helps (dashed).', 'The cooled water flows back down and starts again.'],
          future: ['Water flows through metal plates sitting directly on the chips.', 'It leaves at about 45 °C, still warm.', 'A heat exchanger hands the heat to the building’s water loop.', 'Roof coolers release it. The water is warm enough that, in a mild climate, no chiller is needed.', 'Small fans still remove the rest of the heat as air.'],
        };
        const power = { legacy: 'compressors, all year round', today: 'fans and pumps; a chiller only on hot days', future: 'pumps and fans; no compressors' };
        return `${seg}<ol class="chain">${STEPS[coolMode].map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
          <p class="plain"><b>Where the cooling electricity goes:</b> ${power[coolMode]}. Red is heat leaving the chip, blue is cooled again.</p>
          <p class="rn">A typical design for each generation, not FRA21’s actual equipment. ${coolMode === 'future' ? `Share of heat leaving by water: ${C.future.liquidShare.value} % (vendor claim).` : ''}</p>`;
      }
      if (coolMode === 'legacy') return `${seg}<p class="plain how">Room air conditioners with compressors chill the air and blow it under a raised floor, up through the racks. Hot air drifts back along the ceiling. Simple, but the compressors run all year.</p>
        <div class="stats">${stat({ value: num(C.legacy.pue2007.value, 1), unit: '', label: 'average PUE worldwide in 2007', status: C.legacy.pue2007.status })}
        ${stat({ value: C.legacy.craShare.value, unit: ' %', label: 'of one site’s energy went to the air conditioners', status: C.legacy.craShare.status })}</div>
        <p class="plain">A PUE of 2.5 means 1.5 kWh of overhead for every 1 kWh of computing. Air-cooled systems use no water, but more electricity. ${dot(C.legacy.water.status)}</p>`;
      if (coolMode === 'future') return `${seg}<p class="plain how">Water at about 45 °C flows straight to plates on the chips. It is still warm when it comes back, so plain roof fans can cool it without compressors, even in summer, in a mild climate.</p>
        <div class="stats">${stat({ value: C.future.liquidShare.value, unit: ' %', label: 'of the heat leaves by water', status: C.future.liquidShare.status })}
        ${stat({ value: C.future.perDegree.value, unit: ' %', label: 'less cooling energy per 1 °C warmer water', status: C.future.perDegree.status })}</div>
        <p class="plain">No measured PUE for such a facility has been published. ${dot('not-public')} The closest real example, a warm-water supercomputer in Munich, is quoted at ${num(C.future.lrzPue.value)} by its chiller supplier. ${dot(C.future.lrzPue.status)} New German datacenters must reach 1.2 by law. ${dot('regulation')}</p>`;
      return `${seg}<p class="plain how">Cooling units in the halls blow warm server air across water coils. The water carries the heat to coolers on the roof. Most of the year outside air is cold enough; machines only help on hot days.</p>
        ${where}<div class="stats">${stat({ value: num(F.pue.value), unit: '', label: 'FRA21’s PUE in 2025', status: F.pue.status })}
        ${stat({ value: num(C.today.germanyPue2026.value), unit: '', label: 'German average, 2026', status: C.today.germanyPue2026.status })}
        ${stat({ value: num(F.coolingEfficiencyRatio.value, 1), unit: '×', label: 'heat moved per unit of cooling power', status: F.coolingEfficiencyRatio.status })}</div>`;
    },
    details: (_, coolMode) => {
      const C = data.cooling;
      if (coolMode === 'legacy') return [['pue2007', 'Global average PUE, 2007', C.legacy], ['craShare', 'Air conditioners’ share, one site', C.legacy], ['water', 'Water', C.legacy]];
      if (coolMode === 'future') return [['coolantTemp', 'Coolant temperature', C.future], ['liquidShare', 'Heat removed by liquid', C.future], ['perDegree', 'Saving per 1 °C', C.future], ['waterClaim', 'Water', C.future], ['lrzPue', 'Example: LRZ Munich', C.future], ['measuredPue', 'Measured PUE', C.future]];
      return [['pue', 'FRA21 PUE', F], ['coolingType', 'FRA21 cooling', F], ['coolingEfficiencyRatio', 'Cooling efficiency ratio', F], ['germanyPue2026', 'German average PUE', C.today], ['germanyWue2025', 'German average WUE', C.today]];
    },
    footnote: 'All three layouts are schematic. FRA21’s real piping and unit positions are not published.',
  },
  {
    id: 'water', name: 'Water', groups: ['cooling'], fx: ['loop'], water: true, see: 0.3,
    view: { pos: [20, 62, 150], target: [-58, 12, 25] },
    general: 'Some datacenters evaporate water because it cools with little electricity. Others keep the coolant sealed and use almost none.',
    card: (scenario) => {
      const sc = SCEN[scenario];
      const seg = `<div class="seg" role="radiogroup" aria-label="Cooling method">${Object.entries(SCEN).map(([k, s]) =>
        `<button role="radio" data-scenario="${k}" aria-checked="${k === scenario}">${esc(s.label)}</button>`).join('')}</div>`;
      if (!sc.wue) {
        const c = sc.claim;
        return `${seg}<p class="plain">${esc(c.claim)}</p><p class="plain">${dot(c.status)} ${sourceLinks(c.source)}. Caveat: ${esc(c.caveats)}</p><p class="plain">No site has reported a figure yet, so there is no water block.</p>`;
      }
      const m3 = waterPerDay(sc.wue);
      return `${seg}${where}<div class="stats">
        ${stat({ value: num(m3, m3 < 10 ? 2 : 0), unit: ' m³', label: 'water a day', status: 'derived' })}
        ${stat({ value: num(Math.round(m3 * 1000 / PERSON_L), 0), unit: '', label: 'people’s household water', status: 'derived' })}</div>
        <p class="plain">${esc(sc.text)} The blue block on the site is one day of water, to scale.</p>`;
    },
    details: (scenario) => {
      const sc = SCEN[scenario];
      return sc.wue ? [['wue', 'Water per kWh of computing (WUE)', { wue: sc.wue }], ['itEnergy', 'FRA21 computing energy, 2025', D], ['householdWaterPerPerson', 'Household water per person', data.references]] : [];
    },
    footnote: 'Water a day = WUE × computing energy ÷ 365.',
  },
  {
    id: 'backup', name: 'Backup power', groups: ['backup'], see: 0.2,
    view: { pos: [-150, 60, -150], target: [-80, 14, -30] },
    general: 'If the grid fails, diesel generators take over within seconds. Otherwise they sit idle apart from short test runs.',
    card: () => `${where}<div class="stats">
      ${stat({ value: B.generatorCount.value, unit: '', label: 'diesel generators, inside the building', status: B.generatorCount.status })}
      ${stat({ value: num(B.stackHeight.value, 1), unit: ' m', label: 'exhaust stacks (7)', status: B.stackHeight.status })}
      ${stat({ value: num(B.emergencyHoursTotal.value, 0), unit: ' h', label: 'emergency running allowed a year, all together', status: B.emergencyHoursTotal.status })}</div>
      <p class="plain">Each generator may also run ${B.testHoursPerGenerator.value} hours a year for tests, one at a time. The permit allows only emergencies and these tests. For scale: the average German electricity customer had ${num(data.references.gridOutageMinutes.value, 1)} minutes without power in 2024. ${dot('reference')}</p>`,
    details: () => [['generatorCount', 'Generators', B], ['generatorLocation', 'Where', B], ['generatorFuelInputTotal', 'Fuel input, all', B],
      ['stackCount', 'Stacks', B], ['stackHeight', 'Stack height', B], ['emergencyHoursTotal', 'Emergency hours, max', B], ['testHoursPerGenerator', 'Test hours, each', B],
      ['generatorCount', 'Next door: FRA22 generators', G], ['stackHeight', 'Next door: FRA22 stacks', G], ['dieselStorage', 'Next door: FRA22 diesel tanks', G]],
    footnote: 'Generator count, floors and stack heights follow the permits; their exact positions are schematic.',
  },
  {
    id: 'heat', name: 'Heat', groups: ['cooling'], fx: ['heat'],
    view: { pos: [110, 120, 190], target: [-15, 18, 0] },
    general: 'All that electricity leaves as lukewarm heat. It could warm homes, but only with heat pumps and a heat network.',
    card: () => `${where}<div class="stats">
      ${stat({ value: gwh(F.wasteHeatReleased), unit: ' GWh', label: 'heat released, 2025', status: F.wasteHeatReleased.status })}
      ${stat({ value: F.wasteHeatTemp.value, unit: ' °C', label: 'average temperature', status: F.wasteHeatTemp.status })}
      ${stat({ value: num(F.wasteHeatReused.value, 0), unit: ' %', label: 'reused', status: F.wasteHeatReused.status })}</div>
      <p class="plain">New datacenters opening from July 2026 must reuse at least ${data.regulation.inForce['new-erf-2026'].value} % of their energy. ${dot('regulation')}</p>`,
    details: () => [['wasteHeatReleased', 'Heat released', F], ['wasteHeatReused', 'Heat reused', F], ['wasteHeatTemp', 'Heat temperature', F], ['new-erf-2026', 'Rule for new sites', data.regulation.inForce]],
    footnote: 'The orange plumes only illustrate where heat leaves; they are not to scale.',
  },
  {
    id: 'noise', name: 'Noise', groups: ['cooling', 'backup'], fx: ['noise'],
    view: { pos: [40, 160, 260], target: [0, 0, 10] },
    general: 'Roof fans run day and night; generators are loud but rare. The law caps how much noise reaches nearby homes.',
    card: () => {
      const n = f21.noiseLimits;
      const res = n.totalCap.points.find((p) => p.zone.startsWith('residential'));
      const share = n.plantShare.points.filter((p) => p.zone.startsWith('residential')).map((p) => p.night);
      return `<div class="where">Raunheim, nearest homes</div><div class="stats">
        ${stat({ value: res.night, unit: ' dB(A)', label: 'night cap, all equipment', status: n.status })}
        ${stat({ value: `${Math.min(...share)}–${Math.max(...share)}`, unit: ' dB(A)', label: 'of which generators, at night', status: n.status })}</div>
        <p class="plain">These are legal limits, not measurements. The roof coolers' own sound levels are in reports that are not public. ${dot('not-public')}</p>
        <h4>Listen from a distance</h4>
        <ol class="steps"><li>Turn your volume up to the maximum.</li><li>Press play. It starts far away and quiet.</li><li>Slide closer and hear how it grows.</li></ol>
        <div class="listen"><button type="button" data-sound="fans">▶ Roof fans at night</button><button type="button" data-sound="generator">▶ A generator test</button></div>
        <div class="distance">
          <div class="track"><div class="homes-band" style="left:${distToSlider(SO.homesNear.value)}%;width:${distToSlider(SO.homesFar.value) - distToSlider(SO.homesNear.value)}%"><span>nearest homes</span></div>
          <input type="range" min="0" max="100" value="${distToSlider(800)}" data-distance aria-label="Distance from FRA21"></div>
          <div class="dist-scale"><span>${SOUND_REF} m</span><span>1 km</span></div>
          <p class="dist-read" id="dist-read"></p>
        </div>
        <p class="rn">Loudness drops about ${SO.distanceRule.value} dB each time the distance doubles, in open air. ${dot(SO.distanceRule.status)} Walls, buildings and the ground make real sound quieter still. How loud the equipment is at the source is not public, ${dot('not-public')} and laptop speakers cannot play the deepest hum, so only the change with distance is meaningful here.</p>`;
    },
    details: () => [],
    extra: () => {
      const n = f21.noiseLimits;
      const t = (pts, addr) => `<table><tr><th>${addr ? 'Address' : 'Area'}</th><th>Day</th><th>Night</th></tr>${pts.map((p) => `<tr><td>${esc(addr ? (p.address || p.zone) : p.zone)}</td><td>${p.day}</td><td>${p.night}</td></tr>`).join('')}</table>`;
      return `<h4>All equipment together</h4>${t(n.totalCap.points)}<h4>Generators' share</h4>${t(n.plantShare.points, true)}
        <p class="rn">${dot(n.status)} ${sourceLinks(n.source)}. Noise report: ${esc(n.noiseReport.value)}. ${esc(n.noiseReport.howToGet)}</p>`;
    },
    footnote: 'Rings illustrate spreading sound; they are not a noise map.',
  },
];

export function detailsHTML(topic, scenario, coolMode) {
  const rows = topic.details(scenario, coolMode).map(([k, label, obj]) => row(label, obj[k])).join('');
  return rows + (topic.extra ? topic.extra() : '') + (topic.footnote ? `<p class="rn">${esc(topic.footnote)}</p>` : '');
}

export function aboutHTML() {
  const reg = data.sources.rzreg;
  return `<h2 id="card-h">About this model</h2>
    <p class="plain">It explains how datacenters work in general, using one real site as evidence: Vantage's FRA21 in Raunheim near Frankfurt, which reported more energy use for ${reg.reportingYear} than any other site in Germany's datacenter register.</p>
    <p class="plain">To scale: the stacks (38.2 m at FRA21, 42 m next door), the 100 m³ diesel tanks, the number of generators, four storeys and the water block. Schematic: building shapes, positions inside the buildings, roof coolers, racks, pipes, the transformer yard and the campus outline. Windows sit on the office and stair towers; data halls themselves are usually windowless.</p>
    <p class="plain">Every number carries a label saying where it comes from:</p>
    <div class="legend">${['reported', 'permitted', 'operator', 'study', 'derived', 'reference', 'regulation', 'draft-law', 'vendor-claim', 'press', 'not-public'].map(dot).join('')}</div>
    <h4>The Dalles, Oregon</h4><p class="plain">The second site uses Google’s own environmental report and efficiency page, Oregon permits, a federal grid filing, NOAA climate normals and press reporting. Building outlines, substations, roads and water come from OpenStreetMap (© OpenStreetMap contributors, ODbL); building heights and cooling-tower positions are estimated. The globe uses Natural Earth (public domain).</p>
    <h4>The ideal datacenter</h4><p class="plain">A fictional campus near Luleå, Sweden. It is not a plan and not a prediction. Each part is either the best value achieved at a real site (marked “proven today”), a company’s promise, or research, and each says so. Its size (1,500 MW) is a choice made for the model: larger than the largest datacenter estimated to be running today. Layout, buildings and landscape are drawn for the model. Climate: SMHI; grid: Electricity Maps; heat: LuleKraft, SVT, Ramboll, Fortum.</p>
    <h4>Still not public</h4>${data.openItems.map((o) => `<p class="rn"><b>${esc(o.what)}.</b> ${esc(o.detail)}</p>`).join('')}
    <p class="rn">Register data retrieved ${esc(reg.retrieved)}. Compiled ${esc(data.meta.compiled)}.</p>`;
}

// ---------- lenses: ways of looking at the whole site ----------
const R = data.references, J = data.jobs, U = data.uses, EN = data.environment, SO = data.sound;
export const SOUND_REF = 20;
export const distToSlider = (d) => Math.round((Math.log(d / SOUND_REF) / Math.log(1000 / SOUND_REF)) * 100);
export const sliderToDist = (v) => SOUND_REF * Math.pow(1000 / SOUND_REF, v / 100);
const MW = F.itCapacity.value / 1000; // 40
export const kwhPerSecond = F.totalEnergy.value / (365 * 24 * 3600);

function energyLabel(wh) {
  const u = [['TWh', 1e12], ['GWh', 1e9], ['MWh', 1e6], ['kWh', 1e3], ['Wh', 1]].find(([, f]) => wh >= f) || ['Wh', 1];
  const v = wh / u[1];
  return `${num(v, v < 10 ? 2 : v < 100 ? 1 : 0)} ${u[0]}`;
}
const RUNGS = () => [
  ['A Google search (2009 figure)', R.webSearch.value, R.webSearch],
  ['One AI prompt, Google Gemini', R.aiPromptGoogle.value, R.aiPromptGoogle],
  ['One AI prompt, ChatGPT', R.aiPromptOpenAI.value, R.aiPromptOpenAI],
  ['Charging a phone once', R.phoneCharge.value, R.phoneCharge],
  ['One hour of video streaming, whole chain', R.streamingHour.value, R.streamingHour],
  ['A German household, one day', R.householdElectricity.value * 1000 / 365, { status: 'derived' }],
  ['A German household, one year', R.householdElectricity.value * 1000, R.householdElectricity],
  ['FRA21, one day', F.totalEnergy.value * 1000 / 365, { status: 'derived' }],
  ['FRA21, one year', F.totalEnergy.value * 1000, F.totalEnergy],
  ['All German datacenters, one year', R.germanyDatacenters.value * 1000, R.germanyDatacenters],
  ['All of Germany, one year', R.germanyElectricity.value * 1000, R.germanyElectricity],
];
const VERDICT = { supported: 'Supported', depends: 'Depends', 'not-supported': 'Not supported', 'no-data': 'No good data' };

export const LENSES = [
  {
    id: 'teardown', name: 'Take it apart', lens: true, teardown: true,
    view: { pos: [125, 85, 205], target: [-55, 34, 0] },
    general: 'FRA21 pulled apart, floor by floor. Drag the slider to put it back together.',
    card: () => `<label class="spread"><span>Together</span><input type="range" min="0" max="100" value="100" data-spread aria-label="How far apart"><span>Apart</span></label>
      <ul class="layers">
        <li><b>Roof</b> Coolers push the heat into the outside air.</li>
        <li><b>3rd to ground floor</b> Server halls in rows, with cooling units along the walls.</li>
        <li><b>1st and 2nd floor</b> 28 diesel generators along the north-west wall, 14 per floor. ${dot('permitted')}</li>
        <li><b>Below ground</b> 6 diesel tanks for the generators. ${dot('permitted')}</li></ul>
      <p class="plain">Four storeys and the generators’ floors come from the operator and the permit. Which floors hold server halls, and where racks, cooling units and tanks sit, is not published, so those parts are schematic. ${dot('not-public')}</p>`,
    details: () => [['storeys', 'Storeys', F], ['generatorCount', 'Generators', B], ['generatorLocation', 'Where the generators are', B], ['dieselTanksFra21', 'Diesel tanks', data.environment.water]],
  },
  {
    id: 'perspective', name: 'In perspective', lens: true, wide: true,
    general: 'Big energy numbers are hard to feel. Here is FRA21’s electricity against things you know.',
    card: () => {
      const perSecondWh = kwhPerSecond * 1000;
      const lo = Math.log10(0.1), hi = Math.log10(1e15);
      return `<div class="live"><div class="v"><span id="live-kwh">0</span><span class="u"> kWh</span></div>
        <div class="l">used by FRA21 since you opened this card. That is what an average German household uses in <b id="live-days">0</b> days.</div>${dot('derived')}</div>
        <div class="stats">${stat({ value: num(Math.round(perSecondWh / R.phoneCharge.value), 0), unit: '', label: 'phone charges’ worth of electricity, every second', status: 'derived' })}
        ${stat({ value: num(F.totalEnergy.value / R.householdElectricity.value / 1000, 0), unit: 'k', label: 'German households’ yearly use', status: 'derived' })}</div>
        <h4>From one click to a whole country</h4><p class="rn">Drawn on a scale where each step to the right is 10 times more.</p>
        <ol class="ladder">${RUNGS().sort((a, b) => a[1] - b[1]).map(([label, wh, f]) => `<li class="${label.startsWith('FRA21') ? 'here' : ''}">
          <div class="bar" style="width:${(((Math.log10(wh) - lo) / (hi - lo)) * 100).toFixed(1)}%"></div>
          <div class="txt"><span>${esc(label)}</span><b>${energyLabel(wh)}</b></div>${f.status ? `<div class="rm">${dot(f.status)}${f.source ? `<span>${sourceLinks(f.source)}</span>` : ''}</div>` : ''}</li>`).join('')}</ol>
        <p class="plain">What FRA21 actually computes is not published, so we do not translate its electricity into prompts or streams. The AI and search figures are the companies’ own claims.</p>`;
    },
    tick(elapsed) {
      const kwh = kwhPerSecond * elapsed;
      const a = document.getElementById('live-kwh'), b = document.getElementById('live-days');
      if (a) a.textContent = num(kwh, 0);
      if (b) b.textContent = num(kwh / (R.householdElectricity.value / 365), 0);
    },
    details: () => [['householdElectricity', 'Household electricity, average', R], ['phoneCharge', 'One phone charge', R], ['phoneBattery', 'Phone battery used', R], ['totalEnergy', 'FRA21 electricity, 2025', F]],
    footnote: 'Live counter = FRA21’s 2025 electricity ÷ seconds in a year × seconds since you opened this card.',
  },
  {
    id: 'jobs', name: 'Jobs', lens: true, jobs: true,
    view: { pos: [120, 190, 380], target: [-55, 0, 120] },
    general: 'Building a datacenter takes hundreds of people for a few years. Running it takes a few dozen.',
    card: (_, jobsMode) => {
      const build = Math.round(J.constructionPerMW.value * MW);
      const lo = Math.round(J.operationPerMWLow.value * MW), hi = Math.round(J.operationPerMWHigh.value * MW);
      const seg = `<div class="seg" role="radiogroup" aria-label="Phase">${[['build', 'While building'], ['run', 'Once running']].map(([k, l]) =>
        `<button role="radio" data-jobs="${k}" aria-checked="${k === jobsMode}">${l}</button>`).join('')}</div>`;
      const body = jobsMode === 'build'
        ? `<div class="stats">${stat({ value: num(build, 0), unit: '', label: 'workers on site, on average', status: 'derived' })}</div>
           <p class="plain">Based on the ministry study’s average of ${J.constructionPerMW.value} construction workers per MW for large buildings, times FRA21’s ${MW} MW. They are employed for 3 to 10 years, depending on how the build is phased.</p>`
        : `<div class="stats">${stat({ value: `${lo}–${hi}`, unit: '', label: 'permanent jobs on site', status: 'derived' })}
           ${stat({ value: num(J.regionDirect.value, 0), unit: '', label: 'datacenter jobs in all of Rhine-Main: 0.1 % of jobs', status: J.regionDirect.status })}</div>
           <p class="plain">Mostly security and maintenance. The study gives ${J.operationPerMWLow.value}–${J.operationPerMWHigh.value} jobs per MW for buildings this size. More jobs exist at the companies using the computing (${J.itServicesPerMWLow.value}–${J.itServicesPerMWHigh.value} per MW for IT services), but those can be anywhere in the world.</p>`;
      return `${seg}${where}${body}<p class="plain">One parking space is one job. Vantage has not published staff numbers for FRA21, so these are estimates from the study. ${dot('not-public')}</p>`;
    },
    details: () => [['constructionPerMW', 'Construction workers per MW', J], ['operationPerMWLow', 'Permanent jobs per MW, low', J], ['operationPerMWHigh', 'Permanent jobs per MW, high', J],
      ['itServicesPerMWLow', 'IT service jobs per MW, low', J], ['itServicesPerMWHigh', 'IT service jobs per MW, high', J], ['regionDirect', 'Rhine-Main datacenter jobs', J], ['itCapacity', 'FRA21 IT capacity', F]],
    footnote: 'Not everyone drives, and the lot is not real: it shows the number of people, at the scale of the site.',
  },
  {
    id: 'users', name: 'Who uses it', lens: true,
    view: { pos: [10, 110, 250], target: [-155, 58, -55] },
    general: 'Vantage builds the shell, power and cooling and rents it out. Its customers bring their own servers and run their services on them. Who they are is not public.',
    card: () => {
      const r = (lo, hi) => `${num(lo * MW, 0)}–${num(hi * MW, 0)}`;
      return `<div class="where">Jobs that depend on FRA21’s ${MW} MW</div>
      <ul class="bands">
        <li><i style="background:#2f7550"></i><div><b>${r(J.operationPerMWLow.value, J.operationPerMWHigh.value)}</b> run the building <span>on site: the parking lot</span></div></li>
        <li><i style="background:#5b88a8"></i><div><b>${r(J.itInfraPerMWLow.value, J.itInfraPerMWHigh.value)}</b> run the servers inside <span>at the customers, often elsewhere</span></div></li>
        <li><i style="background:#c98a4b"></i><div><b>${r(J.itServicesPerMWLow.value, J.itServicesPerMWHigh.value)}</b> build services on that computing <span>anywhere in the world</span></div></li>
      </ul>${dot('derived')} <span class="rn">from the ministry study’s jobs per MW × ${MW} MW</span>
      <p class="plain">The tower is not real and not in Raunheim: one floor stands for 200 people. Solid floors are the low estimate, see-through floors go up to the high one. Across Frankfurt-Rhine-Main, datacenters add about €${num(J.regionGDP.value / 1e9, 1)} bn a year to the economy and €${num(J.regionTax.value / 1e6, 0)} m in taxes. ${dot(J.regionGDP.status)}</p>
      <h4>What runs in buildings like this</h4>
      <p class="plain">Vantage says its customers are ${esc(U.operatorCustomers.value)}. ${dot(U.operatorCustomers.status)} Which ones use FRA21 is not public. ${dot('not-public')}</p>
      <div class="stats">${stat({ value: U.germanyCloudShare.value, unit: ' %', label: 'of German datacenter capacity runs cloud services', status: U.germanyCloudShare.status })}
      ${stat({ value: `${U.germanyAIShareNow.value}→${U.germanyAIShare2030.value}`, unit: ' %', label: 'share of AI datacenters, now and forecast for 2030', status: U.germanyAIShareNow.status })}</div>
      <h4>Why here</h4>
      <ul class="why-list">
        <li>Frankfurt’s internet exchange DE-CIX connects almost ${num(U.decixNetworks.value, 0)} networks and peaked at ${num(U.decixPeak.value, 2)} Tbit/s. ${dot(U.decixPeak.status)}</li>
        <li>${U.cloudRegions.value.length} big cloud providers run a cloud region in Frankfurt: ${U.cloudRegions.value.map((r) => esc(r.provider)).join(', ')}. ${dot(U.cloudRegions.status)}</li>
        <li>The region has over ${num(U.frankfurtCapacity.value, 0)} MW of datacenters, more than a third of Germany’s. ${dot(U.frankfurtCapacity.status)}</li>
        <li>Yet only ${num(U.proximityMatters.value, 1)} % of firms in the region say being near a datacenter matters to them. ${dot(U.proximityMatters.status)}</li>
      </ul>`;
    },
    details: () => [['itInfraPerMWLow', 'Server operators per MW, low', J], ['itInfraPerMWHigh', 'Server operators per MW, high', J], ['itServicesPerMWLow', 'IT service jobs per MW, low', J],
      ['itServicesPerMWHigh', 'IT service jobs per MW, high', J], ['regionGDP', 'Rhine-Main datacenter output', J], ['regionTax', 'Rhine-Main datacenter taxes', J],
      ['germanyCloudShare', 'Cloud share of capacity', U], ['germanyAIShareNow', 'AI datacenter share now', U], ['frankfurtCapacity', 'Frankfurt region capacity', U], ['decixVolume', 'DE-CIX Frankfurt traffic', U], ['proximityMatters', 'Firms valuing proximity', U]],
    footnote: 'Industry figures (Bitkom/Borderstep) are industry-funded; cloud regions are listed from each provider’s own documentation.',
  },
  {
    id: 'environment', name: 'Environment', lens: true, env: true,
    view: { pos: [230, 330, 330], target: [-150, -5, -230] },
    general: 'A datacenter touches the environment through its electricity, the water and ground around it, the air, and the land it covers.',
    card: () => {
      const W = EN.water, A = EN.air, N = EN.nature, CL = EN.climate;
      return `${where}<div class="stats">
        ${stat({ value: num(Math.round(CL.co2LocationBased.value / 100) * 100, 0), unit: ' t', label: 'CO₂ in 2025, counted on the grid mix', status: 'derived' })}
        ${stat({ value: '≈ 0', unit: ' t', label: 'CO₂ counted with its renewable certificates', status: 'derived' })}
        ${stat({ value: num(W.mainDistance.value, 1), unit: ' km', label: 'to the river Main', status: 'derived' })}</div>
        <p class="plain">Both CO₂ figures are standard ways of counting: one uses the real grid, the other the green-power contracts the operator buys. ${dot(CL.accounting.status)} ${sourceLinks(CL.accounting.source)}</p>
        <details class="sec"><summary>Water and groundwater</summary><ul class="why-list">
          <li>No wastewater from operations; rain from the roofs drains, slowed down, into the town’s rainwater sewer. ${dot(W.noProcessWastewater.status)}</li>
          <li>Where that rainwater ends up is not published. Raunheim’s combined sewers overflow into the Main at ${W.townOverflows.value} points in heavy rain. ${dot(W.townOverflows.status)}</li>
          <li>Diesel (water hazard class ${W.dieselWgk.value} of 3) sits in tanks that by law must not leak, with leak alarms and drain-less drip trays. ${dot(W.awsvRule.status)}</li>
          <li>Groundwater under FRA22 must be tested every ${W.groundwaterMonitoring.value} years. ${dot(W.groundwaterMonitoring.status)}</li>
          <li>The site lies outside water protection zones; the nearest is about ${num(W.nearestZone.value, 1)} km away, across the Main. ${dot(W.protectionZone.status)}</li>
          <li>Evaporative sites (not FRA21) drain off water treated with ${esc(W.evapChemicals.value)}. The law limits what may leave. ${dot(W.evapLimits.status)}</li>
          <li>Summer 2026: taking water from streams and lakes was banned in the district (Rhine and Main exempt). ${dot(W.withdrawalBan2026.status)}</li></ul></details>
        <details class="sec"><summary>Air</summary><ul class="why-list">
          <li>FRA21’s generators may emit up to ${num(A.noxFra21.value, 0)} mg/m³ of nitrogen oxides; next door, with a catalyst, the limit is ${num(A.noxFra22.value, 0)}. ${dot(A.noxFra21.status)}</li>
          <li>Because their running hours are capped, the added fine dust and NO₂ nearby stay under the official ${num(A.irrelevance.value, 1)} µg/m³ “irrelevance” threshold. ${dot(A.irrelevance.status)}</li></ul></details>
        <details class="sec"><summary>Nature and land</summary><ul class="why-list">
          <li>FRA21 sits near the protected forest “Wald bei Groß-Gerau”; an assessment found its nitrogen and acid fallout not relevant. ${dot(N.ffh.status)}</li>
          <li>At FRA32, up to ${num(N.fra32Sealing.value * 100, 0)} % of the plot may be built over. The plan requires ${esc(N.fra32Measures.value)}. ${dot(N.fra32Measures.status)}</li>
          <li>The same plan names less groundwater recharge from sealed ground as a concern. ${dot(N.groundwaterGoal.status)}</li></ul></details>`;
    },
    details: () => [['gridFactor2025', 'Grid CO₂ per kWh', EN.climate], ['co2LocationBased', 'FRA21 CO₂, grid mix', EN.climate], ['co2MarketBased', 'FRA21 CO₂, certificates', EN.climate],
      ['mainDistance', 'Distance to the Main', EN.water], ['nearestZone', 'Nearest water protection zone', EN.water], ['siteRainRoute', 'Where the rainwater goes', EN.water], ['groundwaterDepth', 'Groundwater depth', EN.water],
      ['glycol', 'Coolant in FRA22’s chillers', EN.water], ['fillingTray', 'Diesel filling area', EN.water], ['rainFillingArea', 'Rain on the filling area', EN.water]],
    footnote: 'The river’s distance and direction are real; its width, the groundwater layer, the tank positions and the sewer are schematic.',
  },
  {
    id: 'arguments', name: 'Arguments', lens: true, wide: true,
    general: 'What people say about datacenters, and what the evidence shows. Open a claim to see the sources.',
    card: () => `<ul class="claims">${data.claims.map((c) => `<li><details><summary><span class="verdict v-${c.verdict}">${VERDICT[c.verdict]}</span><span class="claim">${esc(c.claim)}</span></summary>
      <p class="why">${esc(c.why)}</p>
      ${c.said ? `<p class="said">“${esc(c.said.text)}” ${dot(c.said.status)} ${sourceLinks(c.said.source)}</p>` : ''}
      ${c.evidence.length ? `<ul class="ev">${c.evidence.map((e) => `<li>${esc(e.text)}<div class="rm">${dot(e.status)}<span>${sourceLinks(e.source)}</span></div></li>`).join('')}</ul>` : '<p class="rn">No German study found.</p>'}
      </details></li>`).join('')}</ul>
      <p class="rn">Verdicts: ${Object.entries(data.meta.verdicts).map(([k, v]) => `<b>${VERDICT[k]}</b>: ${esc(v)}`).join(' ')} Compiled ${esc(data.meta.compiled)}.</p>`,
    details: () => [],
  },
];


// ---------- guided tour: one sentence per stop ----------
export const TOUR = [
  { id: null, text: 'This is a real datacenter campus near Frankfurt: Vantage FRA21 and its neighbour. Let’s follow the electricity through it.' },
  { id: 'power', text: 'Electricity comes in from the grid. In 2025 FRA21 used 135.5 GWh, the most of any site in Germany’s register.' },
  { id: 'it', text: 'Inside, rows of servers do the computing. On average they used about a third of the capacity the building was built for.' },
  { id: 'heat', text: 'Nearly all that electricity becomes lukewarm heat. FRA21 reused none of it in 2025.' },
  { id: 'cooling', text: 'Water carries the heat from the halls to coolers on the roof. Older designs needed far more energy for this.' },
  { id: 'water', text: 'Because the water stays sealed in pipes, FRA21 used about 3 m³ a day. An evaporative site of the same size would use about 100 times more.' },
  { id: 'backup', text: 'If the grid fails, 28 diesel generators take over. By law they may only run in emergencies and short tests.' },
  { id: 'noise', text: 'The fans on the roof run day and night. At the nearest homes, the law caps all equipment together at 40 dB(A) at night.' },
  { id: 'teardown', text: 'Taken apart: roof coolers, four floors of halls and generators, and diesel tanks below ground.' },
  { id: 'perspective', text: 'Every two seconds FRA21 uses about as much electricity as a German household uses in a day.' },
  { id: 'jobs', text: 'Building it takes hundreds of workers. Running it takes a few dozen.' },
  { id: 'users', text: 'More jobs exist at the companies using the computing, but they can be anywhere in the world.' },
  { id: 'environment', text: 'Its footprint: CO₂ depends on how you count, and the site sits 0.9 km from the river Main.' },
  { id: 'arguments', text: 'Finally: what people claim about datacenters, and what the evidence says. Open any card to see the sources.' },
];
