// The tour video: real frames from the page, captions, and number animations that put each
// figure into perspective. Every figure comes from shots.json, which capture.mjs calculates
// from the project's data files.
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import meta from './shots.json';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const INK = '#1f262b', INK2 = '#5b656c', SKY = '#e9ece7';
const POWER = '#d18f12', HEAT = '#d2553a', WATER = '#1876b8', IT = '#3d5566';
const FADE = 18; // frames of crossfade between shots
const END = 180; // end card, 6 s
const FPS = meta.fps;

const starts = [];
meta.shots.reduce((at, s) => { starts.push(at); return at + s.frames - FADE; }, 0);
const lastEnd = starts.at(-1) + meta.shots.at(-1).frames;
export const totalFrames = lastEnd - FADE + END;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const easeOut = (k) => 1 - (1 - k) ** 3;
const fmt = (v, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const useSec = () => useCurrentFrame() / FPS;
// 0→1 between two moments (seconds) of the current shot
const useK = (a, b) => easeOut(interpolate(useSec(), [a, b], [0, 1], clamp));

const Count = ({ to, at, dur = 1.4, d = 0 }) => {
  const k = useK(at, at + dur);
  return <>{fmt(to * k, d)}</>;
};
const Reveal = ({ at, children, style }) => {
  const k = useK(at, at + 0.5);
  return <div style={{ opacity: k, transform: `translateY(${(1 - k) * 10}px)`, ...style }}>{children}</div>;
};

// ---- icons (simple shapes, 24×24) ----
const House = ({ c }) => <path d="M2 11 12 3l10 8v11H2z" fill={c} />;
const Person = ({ c }) => <g fill={c}><circle cx="12" cy="6" r="4" /><path d="M4 23c0-7 3.5-11 8-11s8 4 8 11z" /></g>;
const Town = ({ c }) => <g fill={c}><path d="M1 14l5-4 5 4v9H1z" /><path d="M8 10l6-5 6 5v13H8z" /><path d="M15 15l4-3 4 3v8h-8z" /></g>;
// a row of icons that pop in one by one; "fraction" draws the last one partly
function Icons({ n, at, per = 0.05, size = 34, Icon, color, cols = 10, gap = 6 }) {
  const sec = useSec();
  const full = Math.floor(n), part = n - full;
  const count = Math.ceil(n);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap }}>
      {Array.from({ length: count }, (_, i) => {
        const k = easeOut(interpolate(sec, [at + i * per, at + i * per + 0.25], [0, 1], clamp));
        const w = i < full ? 1 : part;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ opacity: k, transform: `scale(${0.6 + 0.4 * k})` }}>
            <defs><clipPath id={`c${i}-${n}`}><rect width={24 * w} height="24" /></clipPath></defs>
            <g opacity="0.18"><Icon c={color} /></g>
            <g clipPath={`url(#c${i}-${n})`}><Icon c={color} /></g>
          </svg>
        );
      })}
    </div>
  );
}

// ---- the panel (top right) ----
const Panel = ({ children, source }) => (
  <div style={{
    position: 'absolute', right: 64, top: 56, width: 660, background: 'rgba(255,255,255,0.96)', borderRadius: 28,
    padding: '30px 36px 24px', fontFamily: FONT, color: INK, boxShadow: '0 16px 44px rgba(31,38,43,0.18)',
  }}>
    {children}
    {source && <div style={{ marginTop: 22, fontSize: 17, lineHeight: 1.4, color: INK2 }}>Source: {source}</div>}
  </div>
);
const Label = ({ children }) => <div style={{ fontSize: 26, color: INK2, marginBottom: 4 }}>{children}</div>;
const Big = ({ children, color = INK }) => <div style={{ fontSize: 84, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.05, color }}>{children}</div>;
const Unit = ({ children }) => <span style={{ fontSize: 40, fontWeight: 600, marginLeft: 8 }}>{children}</span>;
const Line = ({ children, style }) => <div style={{ fontSize: 30, lineHeight: 1.35, ...style }}>{children}</div>;

function PowerPanel({ o }) {
  const sec = useSec();
  const ticking = Math.max(0, (sec - 7.4) * o.phones);
  return (
    <Panel source={o.source}>
      <Label>Electricity used in one year</Label>
      <Big color={POWER}><Count to={o.gwh} at={0.6} d={1} /><Unit>GWh</Unit></Big>
      <Reveal at={2.8} style={{ marginTop: 22 }}>
        <Line>That is as much as <b>≈ <Count to={Math.round(o.homes / 1000) * 1000} at={2.9} /> German homes</b> use.</Line>
        <div style={{ fontSize: 19, color: INK2, margin: '6px 0 10px' }}>1 house = 1,000 homes</div>
        <Icons n={o.homes / 1000} at={3.2} per={0.04} Icon={House} color={POWER} size={36} />
      </Reveal>
      <Reveal at={7} style={{ marginTop: 22 }}>
        <Line>Every second, the electricity for <b>≈ {fmt(Math.round(o.phones / 10) * 10)} phone charges</b>.</Line>
        <div style={{ fontSize: 22, color: INK2, marginTop: 4 }}>{fmt(ticking)} since you started reading this line</div>
      </Reveal>
    </Panel>
  );
}

function ItPanel({ o }) {
  const split = useK(1.6, 2.6);
  const g = useK(5, 6.6);
  return (
    <Panel source={o.source}>
      <Label>Of every 100 kWh coming in</Label>
      <div style={{ display: 'flex', height: 64, borderRadius: 14, overflow: 'hidden', margin: '10px 0 8px', width: `${useK(0.4, 1.4) * 100}%` }}>
        <div style={{ flex: o.itShare, background: IT }} />
        <div style={{ width: 6 * split, background: '#fff' }} />
        <div style={{ flex: (100 - o.itShare) * split + 0.0001, background: HEAT }} />
      </div>
      <Reveal at={2.4} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28 }}>
        <span><b style={{ color: IT }}>{o.itShare}</b> run the computers</span>
        <span><b style={{ color: HEAT }}>{100 - o.itShare}</b> cooling and losses</span>
      </Reveal>
      <Reveal at={4.6} style={{ marginTop: 34 }}>
        <Line>On average it used only <b>about a third</b> of the computing power it was built for.</Line>
        <div style={{ height: 30, borderRadius: 15, background: '#e3e7ea', marginTop: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${o.utilisation * g}%`, background: IT }} />
        </div>
        <div style={{ fontSize: 22, color: INK2, marginTop: 6 }}>{fmt(o.utilisation * g, 0)} % average load</div>
      </Reveal>
    </Panel>
  );
}

function HeatPanel({ o }) {
  return (
    <Panel source={o.source}>
      <Label>Heat released into the air, one year</Label>
      <Big color={HEAT}><Count to={o.heatGwh} at={0.6} d={1} /><Unit>GWh</Unit></Big>
      <Reveal at={3.4} style={{ marginTop: 26 }}>
        <Label>Of that, reused to heat buildings</Label>
        <Big>{fmt(o.reused)}<Unit>GWh</Unit></Big>
      </Reveal>
    </Panel>
  );
}

function Water1Panel({ o }) {
  return (
    <Panel source={o.source}>
      <Label>Water used a day</Label>
      <Big color={WATER}><Count to={o.m3} at={0.6} d={1} /><Unit>m³</Unit></Big>
      <Reveal at={2.6} style={{ marginTop: 20 }}>
        <Line>About the household water of <b>{o.people} people</b>.</Line>
        <div style={{ marginTop: 12 }}><Icons n={o.people} at={2.9} per={0.05} Icon={Person} color={WATER} size={34} cols={12} /></div>
      </Reveal>
    </Panel>
  );
}

function Water2Panel({ o }) {
  return (
    <Panel source={o.source}>
      <Label>Water used a day, as people’s household water</Label>
      <div style={{ fontSize: 19, color: INK2, marginBottom: 14 }}>1 figure = 1,000 people</div>
      <Reveal at={0.5}>
        <Line><b>Raunheim</b> · {fmt(o.m3a, 0)} m³ · {o.peopleA} people <span style={{ color: INK2, fontSize: 24 }}>(a sliver of one figure)</span></Line>
        <div style={{ margin: '8px 0 18px' }}><Icons n={o.peopleA / 1000 + 0.0001} at={0.7} Icon={Person} color={WATER} size={34} cols={13} /></div>
      </Reveal>
      <Reveal at={2.2}>
        <Line><b>The Dalles</b> · <Count to={o.m3b} at={2.3} /> m³ · ≈ <Count to={Math.round(o.peopleB / 100) * 100} at={2.3} /> people</Line>
        <div style={{ marginTop: 8 }}><Icons n={o.peopleB / 1000} at={2.6} per={0.06} Icon={Person} color={WATER} size={34} cols={13} /></div>
      </Reveal>
    </Panel>
  );
}

function SharePanel({ o }) {
  const sec = useSec();
  const all = o.all; // squares coloured for all datacenters
  const lit = useK(2.6, 3.2), dot = useK(4.4, 4.8);
  return (
    <Panel source={o.source}>
      <Label>Germany’s electricity: 100 squares</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 40px)', gap: 6, margin: '10px 0 16px' }}>
        {Array.from({ length: 100 }, (_, i) => {
          const k = easeOut(interpolate(sec, [0.3 + i * 0.008, 0.6 + i * 0.008], [0, 1], clamp));
          const on = i < Math.floor(all) ? 1 : i === Math.floor(all) ? all - Math.floor(all) : 0;
          return (
            <div key={i} style={{ width: 40, height: 40, borderRadius: 7, background: '#e3e7ea', opacity: k, overflow: 'hidden', position: 'relative',
              boxShadow: i === Math.ceil(all) ? `0 0 0 ${3 * dot}px ${INK}` : 'none' }}>
              {on > 0 && <div style={{ position: 'absolute', inset: 0, width: `${on * 100 * lit}%`, background: POWER }} />}
              {i === Math.ceil(all) && <>
                <div style={{ position: 'absolute', left: 17, top: 17, width: 6, height: 6, background: INK, opacity: dot }} />
              </>}
            </div>
          );
        })}
      </div>
      <Reveal at={2.8}><Line><b style={{ color: POWER }}>≈ {fmt(all, 0)} squares:</b> all of Germany’s datacenters</Line></Reveal>
      <Reveal at={4.4}><Line style={{ marginTop: 8 }}><b>The tiny dot:</b> the campus near Frankfurt, {fmt(o.fra21, 2)} %</Line></Reveal>
    </Panel>
  );
}

function IdealHeatPanel({ o }) {
  return (
    <Panel source={o.source}>
      <Label>Heat a year from the ideal campus</Label>
      <Big color={HEAT}><Count to={o.twh} at={0.6} d={1} /><Unit>TWh</Unit></Big>
      <Reveal at={3} style={{ marginTop: 22 }}>
        <Line><b>{o.times} times</b> all the district heat the nearby town of Luleå uses in a year.</Line>
        <div style={{ fontSize: 19, color: INK2, margin: '6px 0 10px' }}>1 town = Luleå’s yearly heat</div>
        <Icons n={o.times} at={3.4} per={0.12} Icon={Town} color={HEAT} size={58} cols={8} gap={10} />
      </Reveal>
    </Panel>
  );
}

const Legend = () => (
  <div style={{ position: 'absolute', right: 64, top: 56, background: 'rgba(255,255,255,0.96)', borderRadius: 24, padding: '22px 30px', fontFamily: FONT, fontSize: 28, color: INK, boxShadow: '0 16px 44px rgba(31,38,43,0.18)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ width: 30, height: 30, borderRadius: 6, background: '#f4f3ef', border: '2px solid #b9bfc3' }} />Solid: done somewhere today</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}><span style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(127,168,216,0.4)', border: '2px dashed #3f73b0' }} />Blue glass: only promised</div>
  </div>
);

// ---- the chain: where we are in "how a datacenter works" ----
const STEPS = [['Electricity', POWER], ['Computers', IT], ['Heat', HEAT], ['Cooling', WATER]];
function Chain({ active, big }) {
  const sec = useSec();
  return (
    <div style={{
      position: 'absolute', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: big ? 18 : 10,
      ...(big ? { left: '50%', top: 330, transform: 'translateX(-50%)' } : { left: 64, top: 56 }),
    }}>
      {STEPS.map(([name, c], i) => {
        const k = big ? easeOut(interpolate(sec, [3 + i * 0.9, 3.5 + i * 0.9], [0, 1], clamp)) : 1;
        const on = big || i + 1 === active;
        return (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: big ? 18 : 10, opacity: k }}>
            {i > 0 && <span style={{ fontSize: big ? 44 : 26, color: big ? INK : '#fff', textShadow: big ? 'none' : '0 1px 6px rgba(0,0,0,0.35)' }}>→</span>}
            <div style={{
              padding: big ? '18px 30px' : '9px 18px', borderRadius: 999, fontSize: big ? 40 : 24, fontWeight: 650,
              background: on ? (big ? '#fff' : INK) : 'rgba(255,255,255,0.88)', color: on && !big ? '#fff' : INK,
              boxShadow: '0 8px 24px rgba(31,38,43,0.16)', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ width: big ? 20 : 14, height: big ? 20 : 14, borderRadius: '50%', background: c }} />
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const Title = () => {
  const o = useK(0, 0.6) * (1 - useK(2.6, 3.1));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', fontFamily: FONT, color: INK, opacity: o }}>
      <div style={{ fontSize: 92, fontWeight: 750, letterSpacing: '-0.02em', textShadow: `0 0 24px ${SKY}, 0 0 50px ${SKY}` }}>How a datacenter works</div>
      <div style={{ fontSize: 38, marginTop: 10, color: '#3f484e', textShadow: `0 0 16px ${SKY}, 0 0 30px ${SKY}` }}>A tour built on real, sourced figures</div>
    </div>
  );
};

const OVERLAY = { power: PowerPanel, it: ItPanel, heat: HeatPanel, water1: Water1Panel, water2: Water2Panel, share: SharePanel, idealHeat: IdealHeatPanel };

const Shot = ({ shot }) => {
  const f = useCurrentFrame();
  const n = shot.frames;
  const k = Math.min(n - 1, Math.floor(f / meta.step) * meta.step);
  const opacity = interpolate(f, [0, FADE], [0, 1], clamp);
  const ui = interpolate(f, [FADE, FADE + 14, n - FADE - 10, n - FADE], [0, 1, 1, 0], clamp);
  const kind = shot.overlay?.kind;
  const P = OVERLAY[kind];
  const capAt = kind === 'intro' ? 6.2 * FPS : FADE;
  const cap = interpolate(f, [capAt, capAt + 14, n - FADE - 10, n - FADE], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: shot.i === 0 ? 1 : opacity }}>
      <Img src={staticFile(`frames/${shot.i}/${String(k).padStart(4, '0')}.jpg`)} style={{ width: '100%', height: '100%' }} />
      <AbsoluteFill style={{ opacity: ui }}>
        {kind === 'intro' && <><Title /><Sequence from={0}><Chain big /></Sequence></>}
        {shot.step > 0 && <Chain active={shot.step} />}
        {P && <P o={shot.overlay} />}
        {(kind === 'idealIntro' || kind === 'none') && <Legend />}
      </AbsoluteFill>
      <div style={{
        position: 'absolute', left: '50%', bottom: 70, width: 1080, transform: `translateX(-50%) translateY(${(1 - cap) * 12}px)`,
        opacity: cap, background: INK, color: '#fff', borderRadius: 26, padding: '24px 32px',
        fontFamily: FONT, fontSize: 34, lineHeight: 1.4, boxShadow: '0 14px 40px rgba(31,38,43,0.3)',
      }}>{shot.caption}</div>
    </AbsoluteFill>
  );
};

const EndCard = () => {
  const o = useK(0, 0.8);
  const o2 = useK(1.2, 2);
  return (
    <AbsoluteFill style={{ background: SKY, alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: INK, opacity: o }}>
      <div style={{ fontSize: 70, fontWeight: 750, letterSpacing: '-0.02em' }}>This is an interactive 3D model.</div>
      <div style={{ fontSize: 36, marginTop: 20, color: '#3f484e', maxWidth: 1250, textAlign: 'center', lineHeight: 1.45, opacity: o2 }}>
        Explore every part yourself, and see where every number comes from: who reported it, when, and whether it was measured, calculated or only promised.
      </div>
    </AbsoluteFill>
  );
};

export const Tour = () => {
  const { fps } = useVideoConfig();
  const volume = (f) => interpolate(f, [0, 2 * fps, totalFrames - 2 * fps, totalFrames], [0, 0.6, 0.6, 0], clamp);
  return (
    <AbsoluteFill style={{ background: SKY }}>
      {meta.shots.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={s.frames}><Shot shot={s} /></Sequence>
      ))}
      <Sequence from={lastEnd - FADE} durationInFrames={END}><EndCard /></Sequence>
      <Audio src={staticFile('hum.wav')} volume={volume} />
    </AbsoluteFill>
  );
};
