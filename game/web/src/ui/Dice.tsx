// A real-looking d6: a CSS 3D cube that tumbles onto the rolled face.
import { useRef } from 'react';
import { reducedMotion } from './hooks.ts';

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};
// face shown to the viewer for each value: [rotateX, rotateY]
const FACE: Record<number, [number, number]> = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
const SIDES: Array<[number, string]> = [[1, 'front'], [2, 'right'], [3, 'top'], [4, 'bottom'], [5, 'left'], [6, 'back']];

export function Dice({ value, rollId, size = 56 }: { value: number; rollId: number; size?: number }) {
  const spins = useRef({ id: rollId, k: 0 });
  if (spins.current.id !== rollId) spins.current = { id: rollId, k: spins.current.k + 1 };
  const v = value >= 1 && value <= 6 ? value : 1;
  const [x, y] = FACE[v];
  const k = reducedMotion() ? 0 : spins.current.k;
  const transform = `rotateX(${x + k * 360}deg) rotateY(${y + k * 720}deg) rotateZ(${k * 360}deg)`;
  return (
    <div className={`dice3d ${value ? '' : 'idle'}`} style={{ width: size, height: size, ['--d' as string]: `${size}px` }} aria-label={value ? `Кубик: ${value}` : 'Кубик'} role="img">
      <div key={rollId} className="dice-hop">
        <div className="dice-cube" style={{ transform }}>
          {SIDES.map(([n, side]) => (
            <div key={side} className={`dice-face ${side}`}>
              <svg viewBox="0 0 100 100">
                {PIPS[n].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={9} />)}
              </svg>
            </div>
          ))}
        </div>
      </div>
      <div className="dice-shadow" />
    </div>
  );
}
