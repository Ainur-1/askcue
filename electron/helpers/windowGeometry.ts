export interface WindowRect { x: number; y: number; width: number; height: number }
export type WorkspaceWindow = 'launcher' | 'overlay';

// Electron's bounds and workArea are already in logical pixels (DIP).
// Multiplying by scaleFactor here would apply Windows scaling twice.
export function fitWindowBounds(bounds: WindowRect, workArea: WindowRect, margin = 16): WindowRect {
  const inset = Math.max(0, Math.min(margin, Math.floor((Math.min(workArea.width, workArea.height) - 1) / 2)));
  const left = workArea.x + inset;
  const top = workArea.y + inset;
  const width = Math.max(1, Math.min(Math.round(bounds.width), workArea.width - inset * 2));
  const height = Math.max(1, Math.min(Math.round(bounds.height), workArea.height - inset * 2));
  return {
    x: Math.round(Math.min(Math.max(bounds.x, left), workArea.x + workArea.width - inset - width)),
    y: Math.round(Math.min(Math.max(bounds.y, top), workArea.y + workArea.height - inset - height)),
    width, height,
  };
}

export function initialWindowBounds(workArea: WindowRect, kind: WorkspaceWindow): WindowRect {
  const width = Math.floor(Math.min(kind === 'launcher' ? 1200 : 1100, workArea.width * .9));
  const height = Math.floor(Math.min(800, workArea.height * .88));
  return fitWindowBounds({
    x: workArea.x + (workArea.width - width) / 2,
    y: workArea.y + (workArea.height - height) / 2,
    width, height,
  }, workArea);
}
