// O documento vem do Chromebook de um aluno e é mostrado na TV: só passam tags de texto e estilos de formatação.
// Reconstrói o HTML do zero (DOMParser não executa scripts nem baixa imagens).
const TAGS = new Set(['P', 'DIV', 'BR', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'FONT']);
const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'NOSCRIPT', 'TEXTAREA', 'SELECT', 'TITLE', 'HEAD', 'LINK', 'META', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS']);
const STYLES = [
  'font-size', 'font-weight', 'font-style', 'font-family', 'text-decoration-line', 'text-decoration', 'color', 'background-color',
  'text-align', 'margin-left', 'padding-left',
];

export function sanitizeDoc(html: string): string {
  const src = new DOMParser().parseFromString(html, 'text/html').body;
  const out = document.createElement('div');
  const copy = (from: Node, to: Node, depth: number) => {
    if (depth > 40) return;
    for (const n of from.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        to.appendChild(document.createTextNode(n.textContent ?? ''));
        continue;
      }
      if (!(n instanceof HTMLElement) || DROP.has(n.tagName)) continue;
      if (!TAGS.has(n.tagName)) {
        copy(n, to, depth + 1); // tag desconhecida (link, tabela colada...): fica só o texto
        continue;
      }
      const el = document.createElement(n.tagName === 'FONT' ? 'span' : n.tagName.toLowerCase());
      for (const p of STYLES) {
        const v = n.style.getPropertyValue(p);
        if (!v || /url\(|var\(|expression/i.test(v)) continue;
        if (p === 'font-size' && parseFloat(v) * (v.endsWith('px') ? 0.75 : 1) > 120) continue; // letra gigante para tapar a TV: fica no padrão
        el.style.setProperty(p, v);
      }
      if (n.tagName === 'FONT') {
        if (n.getAttribute('color')) el.style.color = n.getAttribute('color')!;
        if (n.getAttribute('face')) el.style.fontFamily = n.getAttribute('face')!;
      }
      copy(n, el, depth + 1);
      to.appendChild(el);
    }
  };
  copy(src, out, 0);
  return out.innerHTML;
}
