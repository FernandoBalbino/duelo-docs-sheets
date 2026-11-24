// "Digitação" dos alunos-robô: o trabalho em partes, na ordem em que um aluno faria.
// careful = com formatação; senão só o texto. upTo = fração do modelo que o robô consegue fazer (1 = tudo).
import { CHALLENGE_BY_ID } from '../shared/challenges.ts';
import type { Cells } from '../shared/sheet.ts';

export function steps(challengeId: string, careful: boolean, upTo = 1): string[] {
  const ch = CHALLENGE_BY_ID.get(challengeId)!;
  if (ch.kind === 'docs') {
    const blocks = ch.html.match(/<(h\d|p|ul|ol)\b[\s\S]*?<\/\1>/g) ?? [ch.html];
    const plain = (b: string) => b.replace(/<li>/g, '<p>').replace(/<\/li>/g, '</p>').replace(/<(?!\/?p\b)[^>]*>/g, '').replace(/^(?!<p)/, '<p>');
    const parts = (careful ? blocks : blocks.map(plain)).slice(0, Math.max(1, Math.round(blocks.length * upTo)));
    return parts.map((_, i) => parts.slice(0, i + 1).join(''));
  }
  const refs = Object.keys(ch.cells).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)) || a.localeCompare(b));
  const out: string[] = [];
  const cells: Cells = {};
  for (const ref of refs.slice(0, Math.max(1, Math.round(refs.length * upTo)))) {
    const c = ch.cells[ref];
    cells[ref] = careful ? c : c.v ? { v: c.v } : {};
    out.push(JSON.stringify(cells));
  }
  return out;
}
