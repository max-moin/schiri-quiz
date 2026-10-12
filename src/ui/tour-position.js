/** Sichtbarer Ausschnitt eines Tour-Ziels, auch oberhalb des Viewports. */
export function tourRahmen(rect, { width, height, offsetLeft = 0, offsetTop = 0 }) {
  const left = Math.max(offsetLeft + 6, rect.left - 5);
  const top = Math.max(offsetTop + 6, rect.top - 5);
  const right = Math.min(offsetLeft + width - 6, rect.right + 5);
  const bottom = Math.min(offsetTop + height - 6, rect.bottom + 5);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
