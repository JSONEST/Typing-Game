import { modes } from '../modes/registry.ts';
import { h } from '../ui/dom.ts';

/**
 * Aplicación: un menú de modos y una ruta por modo, con la parte de la dirección después de «#».
 * Ejemplo: `#taquero`. Sin hash se muestra el menú.
 */
export function mountApp(root: HTMLElement): void {
  const content = h('main', { id: 'contenido', tabindex: '-1' });
  const nav = h('nav', { class: 'crumbs', 'aria-label': 'Navegación' });
  root.replaceChildren(
    h(
      'header',
      { class: 'rotulo' },
      h('a', { class: 'logo', href: '#' }, h('h1', null, 'Tecleo')),
      h('p', null, 'Practica tu mecanografía en español, un juego a la vez.')
    ),
    nav,
    content
  );

  let unmount: (() => void) | null = null;

  function route(): void {
    unmount?.();
    unmount = null;
    const id = location.hash.replace(/^#/, '');
    const mode = modes.find((m) => m.id === id && m.status === 'ready');
    if (mode?.mount) {
      document.title = `${mode.title} · Tecleo`;
      nav.replaceChildren(h('a', { href: '#' }, '← Todos los juegos'), h('span', null, mode.title));
      unmount = mode.mount(content);
    } else {
      document.title = 'Tecleo';
      nav.replaceChildren();
      content.replaceChildren(menu());
    }
  }

  window.addEventListener('hashchange', route);
  route();
}

function menu(): HTMLElement {
  const list = h('ul', { class: 'menu' });
  for (const m of modes) {
    const ready = m.status === 'ready';
    list.append(
      h(
        'li',
        { class: ready ? 'modo' : 'modo pronto' },
        h('h2', null, m.title),
        h('p', null, m.blurb),
        ready ? h('a', { class: 'btn', href: `#${m.id}` }, 'Jugar') : h('span', { class: 'etiqueta' }, 'Próximamente')
      )
    );
  }
  return h('section', { 'aria-label': 'Juegos' }, list);
}
