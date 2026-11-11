import t from 'tap';
import { fitWindowBounds, initialWindowBounds, type WindowRect } from '../../electron/helpers/windowGeometry';

const areas: WindowRect[] = [
  { x: 0, y: 0, width: 1536, height: 816 }, // 1920×1080 at 125%, taskbar excluded
  { x: 0, y: 0, width: 1280, height: 680 }, // 150%
  { x: 0, y: 0, width: 960, height: 510 }, // 200%
  { x: 0, y: 0, width: 1366, height: 720 },
  { x: 0, y: 0, width: 3440, height: 1392 },
  { x: -1920, y: -320, width: 1920, height: 1040 },
  { x: 1920, y: 40, width: 1080, height: 1840 }, // portrait, top taskbar
  { x: 64, y: 0, width: 1216, height: 720 }, // left taskbar
];

t.test('launcher and conversation stay inside each monitor work area', t => {
  for (const area of areas) {
    for (const kind of ['launcher', 'overlay'] as const) {
      const bounds = initialWindowBounds(area, kind);
      t.ok(bounds.x >= area.x + 16 && bounds.y >= area.y + 16, `${kind} has top/left clearance in ${area.width}×${area.height}`);
      t.ok(bounds.x + bounds.width <= area.x + area.width - 16 && bounds.y + bounds.height <= area.y + area.height - 16, `${kind} clears right/bottom edge`);
      t.ok(bounds.width <= 1200 && bounds.height <= 800, 'large displays keep a readable window size');
    }
  }
  t.end();
});

t.test('moving to a smaller display or changing scaling clamps size and both coordinates', t => {
  const area = { x: -1280, y: 48, width: 1280, height: 672 };
  const bounds = fitWindowBounds({ x: 100, y: 900, width: 1500, height: 1000 }, area);
  t.same(bounds, { x: -1264, y: 64, width: 1248, height: 640 });
  t.same(fitWindowBounds(bounds, area), bounds, 'repeated resize events do not cause drift');
  t.same(fitWindowBounds({ x: -1200, y: 100, width: 600, height: 400 }, area), { x: -1200, y: 100, width: 600, height: 400 }, 'valid user sizing and position are preserved');
  t.end();
});
