const FILLS: ReadonlyArray<readonly [string, string, string]> = [
  ['#C8451B', '#F2C230', '#2E8B3E'],
  ['#8A5A3B', '#F4F0E6', '#2E8B3E'],
  ['#A33A22', '#5C3B2A', '#4FA03A'],
  ['#6FA83B', '#D9361E', '#F5D76E'],
  ['#7A3B22', '#E8E2D0', '#C23B22']
];

/** Taco dibujado en SVG. Los colores del plato y la tortilla vienen de las variables del tema. */
export function tacoSvg(variant: number): string {
  const [a, b, c] = FILLS[variant % FILLS.length] as readonly [string, string, string];
  return (
    '<svg class="taco" viewBox="0 0 60 42" width="60" height="42" aria-hidden="true" focusable="false">' +
    '<ellipse cx="30" cy="36.5" rx="29" ry="3.5" style="fill:var(--plate);stroke:var(--plate-rim);stroke-width:1"/>' +
    `<ellipse cx="17" cy="15" rx="9" ry="6" fill="${a}"/><ellipse cx="31" cy="11.5" rx="10" ry="7" fill="${a}"/>` +
    `<ellipse cx="44" cy="15" rx="8" ry="5.5" fill="${a}"/>` +
    `<circle cx="22" cy="9" r="3" fill="${b}"/><circle cx="36" cy="7" r="3" fill="${c}"/>` +
    `<circle cx="46" cy="11" r="2.6" fill="${b}"/><circle cx="12" cy="11" r="2.4" fill="${c}"/>` +
    '<path d="M3 15 Q30 50 57 15 Q30 27 3 15Z" style="fill:var(--masa);stroke:var(--masa-edge);stroke-width:1.6;stroke-linejoin:round"/>' +
    '</svg>'
  );
}
