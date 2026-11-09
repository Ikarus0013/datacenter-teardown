import { Composition } from 'remotion';
import { Tour, totalFrames } from './Tour.jsx';
import meta from './shots.json';

export const Root = () => (
  <Composition id="Tour" component={Tour} durationInFrames={totalFrames} fps={meta.fps} width={meta.width} height={meta.height} />
);
