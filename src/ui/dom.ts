type Attrs = Record<string, string | number | boolean | null | undefined>;
type Child = Node | string | null | false | undefined;

function apply(el: Element, attrs: Attrs | null | undefined, children: Child[]): void {
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === false || c === undefined) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}

/** Crea un elemento HTML. El texto se inserta como texto, nunca como HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs, children);
  return el;
}

/** Crea un elemento SVG. */
export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  apply(el, attrs, children);
  return el;
}

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
