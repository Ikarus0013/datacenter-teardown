// Renders the real page (dist/datacenter.html?video) frame by frame with Chrome,
// and writes the frames, the fan hum and the shot list that the Remotion video uses.
// Run from video/:  npm run capture   (then: npm run render)
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(path.join(HERE, '..', 'dist', 'datacenter.html')).href + '?video';
const FPS = 30, W = 1920, H = 1080;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ONLY = ['all', undefined, ''].includes(process.argv[2]) ? undefined : process.argv[2]; // optional: one shot by index
const STEP = Number(process.argv[3] || 1); // optional: every nth frame, for a quick preview

// ---- figures for the number animations, calculated from the project's data files ----
const readJSON = async (f) => JSON.parse(await readFile(path.join(HERE, '..', 'data', f), 'utf8'));
const B = await readJSON('baseline.json'), DAL = (await readJSON('thedalles.json')).facts, IDL = (await readJSON('ideal.json')).facts;
const F21 = B.sites['vantage-fra21'].facts, D21 = B.sites['vantage-fra21'].derived, REF = B.references;
const kWh = F21.totalEnergy.value;
const N = {
  gwh: kWh / 1e6,                                                        // 135.5
  homes: kWh / REF.householdElectricity.value,                           // ≈ 40,000
  phonesPerSecond: (kWh * 1000) / (365 * 24 * 3600) / REF.phoneCharge.value, // ≈ 270
  itShare: Math.round(100 / F21.pue.value),                              // 80 of every 100
  utilisation: D21.utilisation.value,                                    // 30.9 %
  heatGwh: F21.wasteHeatReleased.value / 1e6,                            // 118.7
  heatReused: F21.wasteHeatReused.value,                                 // 0
  water21: D21.waterPerDay.value, people21: D21.householdEquivalent.value,
  waterDal: DAL.waterPerDayM3.value, peopleDal: (DAL.waterPerDayM3.value * 1000) / REF.householdWaterPerPerson.value,
  shareFra21: (kWh / REF.germanyElectricity.value) * 100,                // 0.03 %
  shareAllDc: (REF.germanyDatacenters.value / REF.germanyElectricity.value) * 100, // ≈ 4 %
  idealHeatTwh: IDL.heatYear.value / 1000, idealTimesLulea: IDL.heatTimesLulea.value,
};
const Y = B.sources.rzreg.reportingYear;
const SRC = {
  power: `German datacenter register, ${Y} · homes: average German household, ${num(REF.householdElectricity.value)} kWh (Destatis, ${REF.householdElectricity.asOf}) · phone charge ≈ ${REF.phoneCharge.value} Wh, calculated from Öko-Test`,
  it: `Calculated from FRA21’s reported PUE of ${F21.pue.value} and its average load vs. 40 MW built (register, ${Y})`,
  heat: `Reported by the operator to the German datacenter register, ${Y}`,
  water: `FRA21: from its reported water figure (register, ${Y}) · The Dalles: Google, 2025 · per person: German household average, ${REF.householdWaterPerPerson.value} L a day (UBA)`,
  share: `Germany’s electricity: ${num(REF.germanyElectricity.value / 1e9)} TWh (UBA, ${REF.germanyElectricity.asOf}) · all datacenters: ${REF.germanyDatacenters.value / 1e9} TWh, an industry estimate (Bitkom/Borderstep)`,
  ideal: `Fictional campus at full load · Luleå’s district heat: ${num(IDL.luleaHeat.value)} GWh (LuleKraft, ${IDL.luleaHeat.asOf})`,
};
function num(v, d = 0) { return v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); }

// ---- the shots ----
const SHOTS = [
  { site: 'raunheim', topic: null, seconds: 10, orbit: 0.22, dolly: 0.86, step: 0,
    caption: 'A datacenter is a building full of computers. They run the apps, websites and AI we use every day.', overlay: { kind: 'intro' } },
  { site: 'raunheim', topic: 'power', seconds: 12, orbit: 0.16, dolly: 0.9, step: 1,
    caption: `Electricity comes in from the grid. This campus near Frankfurt used more than any other site in Germany’s register in ${Y}.`,
    overlay: { kind: 'power', gwh: N.gwh, homes: N.homes, phones: N.phonesPerSecond, source: SRC.power } },
  { site: 'raunheim', topic: 'it', seconds: 10, orbit: -0.16, dolly: 0.9, step: 2,
    caption: 'Inside, rows of servers do the computing.',
    overlay: { kind: 'it', itShare: N.itShare, utilisation: N.utilisation, source: SRC.it } },
  { site: 'raunheim', topic: 'heat', seconds: 9, orbit: 0.2, dolly: 0.9, step: 3,
    caption: 'Almost all of that electricity ends up as heat, and the heat has to leave the building.',
    overlay: { kind: 'heat', heatGwh: N.heatGwh, reused: N.heatReused, source: SRC.heat } },
  { site: 'raunheim', topic: 'cooling', seconds: 8, orbit: -0.14, dolly: 0.9, step: 4,
    caption: 'Coolers on the roof carry the heat away. Here the water stays sealed in the pipes.',
    overlay: { kind: 'water1', m3: N.water21, people: N.people21, source: SRC.water } },
  { site: 'thedalles', topic: 'd-water', seconds: 9, orbit: 0.14, dolly: 0.9, step: 4,
    caption: 'Other sites evaporate water to cool, like Google’s campus in Oregon. The blue block is one day of it, to scale.',
    overlay: { kind: 'water2', m3a: N.water21, peopleA: N.people21, m3b: N.waterDal, peopleB: N.peopleDal, source: SRC.water } },
  { globe: [[45.6, -121.2, 240], [50, 32, 320]], seconds: 9,
    caption: 'How big is that, compared with a whole country?',
    overlay: { kind: 'share', fra21: N.shareFra21, all: N.shareAllDc, source: SRC.share } },
  { site: 'ideal', topic: null, seconds: 10, orbit: 0.2, dolly: 0.82,
    caption: 'Now imagine a datacenter built from the best ideas that already exist somewhere, and some that are only promised. It is fictional, placed in northern Sweden.',
    overlay: { kind: 'idealIntro' } },
  { site: 'ideal', topic: 'i-heat', seconds: 10, orbit: -0.12, dolly: 0.88,
    caption: 'Its heat is piped into the town’s heating network. But it makes far more heat than a whole town can use.',
    overlay: { kind: 'idealHeat', twh: N.idealHeatTwh, times: N.idealTimesLulea, source: SRC.ideal } },
  { site: 'ideal', topic: 'i-power', vision: true, seconds: 9, orbit: 0.25, dolly: 0.72,
    caption: 'In blue glass: technology that is only promised, like small nuclear reactors. None powers a datacenter yet.',
    overlay: { kind: 'none' } },
];
// sanity checks: the animations must match the figures the page shows
const near = (a, b, tol) => Math.abs(a - b) <= tol;
if (!near(N.homes, 40046, 50) || !near(N.phonesPerSecond, 267, 2) || !near(N.shareAllDc, 4.05, 0.05) || N.itShare !== 80) {
  throw new Error('perspective figures changed: ' + JSON.stringify(N));
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', `--window-size=${W},${H}`],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(PAGE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__video);

const out = [];
let time = 0;
for (const [i, s] of SHOTS.entries()) {
  const frames = Math.round(s.seconds * FPS);
  out.push({ i, frames, caption: s.caption, overlay: s.overlay, step: s.step ?? null, site: s.globe ? 'globe' : s.site });
  if (ONLY !== undefined && Number(ONLY) !== i) { time += s.seconds; continue; }
  const dir = path.join(HERE, 'public', 'frames', String(i));
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await page.evaluate((shot) => window.__video.prepare(shot), s);
  const t0 = Date.now();
  for (let f = 0; f < frames; f += STEP) {
    await page.evaluate((k, tm) => window.__video.render(k, tm), f / (frames - 1), time + f / FPS);
    await page.screenshot({ path: path.join(dir, `${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
  }
  console.log(`shot ${i}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  time += s.seconds;
}

// the fan hum, rendered offline with the page's own sound code
const total = SHOTS.reduce((a, s) => a + s.seconds, 0) + 6;
const wav = await page.evaluate((sec) => window.__video.hum(sec), total);
await writeFile(path.join(HERE, 'public', 'hum.wav'), Buffer.from(wav, 'base64'));
await writeFile(path.join(HERE, 'src', 'shots.json'), JSON.stringify({ fps: FPS, width: W, height: H, step: STEP, shots: out }, null, 1));
await browser.close();
console.log(existsSync(path.join(HERE, 'public', 'hum.wav')) ? 'done: frames, hum.wav, shots.json' : 'hum missing');
