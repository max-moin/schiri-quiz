// Gleiche Grenze wie der vorhandene Anzeigename in push_abos.
export function pruefeGeraetename(wert) {
  if (typeof wert !== 'string') return null;
  const name = wert.trim();
  return [...name].length >= 1 && [...name].length <= 60 && !/[\u0000-\u001f\u007f-\u009f]/u.test(name) ? name : null;
}

export function pushGeraetebeschreibung({userAgent = '', maxTouchPoints = 0} = {}, app = false) {
  const ipad = /iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const art = ipad ? 'iPad' : /iPhone|iPod/.test(userAgent) ? 'iPhone'
    : /Android/.test(userAgent) ? 'Android' : /Macintosh/.test(userAgent) ? 'Mac'
      : /Windows/.test(userAgent) ? 'Windows' : 'Gerät';
  return `${art}${app ? ' (App)' : ''}`;
}
