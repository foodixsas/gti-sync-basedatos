// otter-adaptive.ts — Capa adaptive de selectores (Scrapling-inspired).
// Cuando un cascade de selectores tiene éxito, guarda el "fingerprint" del elemento
// (tag, atributos, text, path, parent). Si todo el cascade falla en un run futuro,
// scanea TODOS los elementos del rol esperado, los puntúa contra el fingerprint
// guardado y elige el de mayor similitud si supera un threshold.
//
// Esto sobrevive a:
// - Cambios de class names (btn-primary → btn-v2)
// - Cambios de tag (<button> → <div role="button">)
// - Cambios de jerarquía (padre distinto pero hijo similar)
// - Adición/eliminación de atributos

import type { Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FINGERPRINTS_PATH = path.join(PROJECT_ROOT, '.otter-fingerprints.json');

export interface ElementFingerprint {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  path: string;          // CSS path desde root (best-effort)
  parentTag: string;
  parentAttrs: Record<string, string>;
  savedAt: number;
}

interface FingerprintStore { [role: string]: ElementFingerprint }

function loadFingerprints(): FingerprintStore {
  try {
    if (!fs.existsSync(FINGERPRINTS_PATH)) return {};
    return JSON.parse(fs.readFileSync(FINGERPRINTS_PATH, 'utf-8'));
  } catch { return {}; }
}

function saveFingerprints(store: FingerprintStore): void {
  try { fs.writeFileSync(FINGERPRINTS_PATH, JSON.stringify(store, null, 2)); } catch {}
}

// ─── Extracción de fingerprint para un selector exitoso ─────────────────────

export async function captureFingerprint(page: Page, selector: string, role: string): Promise<void> {
  try {
    const fp = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const attrs: Record<string, string> = {};
      for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
      const parent = el.parentElement;
      const parentAttrs: Record<string, string> = {};
      if (parent) for (const a of Array.from(parent.attributes)) parentAttrs[a.name] = a.value;
      // Path: tag + nth-of-type desde root (limitado a 6 niveles)
      let p: HTMLElement | null = el;
      const segs: string[] = [];
      let depth = 0;
      while (p && depth < 6 && p.parentElement) {
        const siblings = Array.from(p.parentElement.children).filter(c => c.tagName === p!.tagName);
        const idx = siblings.indexOf(p) + 1;
        segs.unshift(`${p.tagName.toLowerCase()}:nth-of-type(${idx})`);
        p = p.parentElement;
        depth++;
      }
      return {
        tag: el.tagName.toLowerCase(),
        attrs,
        text: (el.textContent || '').trim().slice(0, 200),
        path: segs.join(' > '),
        parentTag: parent?.tagName.toLowerCase() || '',
        parentAttrs,
      };
    }, selector);

    if (!fp) return;
    const store = loadFingerprints();
    store[role] = { ...fp, savedAt: Date.now() };
    saveFingerprints(store);
  } catch {}
}

// ─── Scoring de similitud (puerto simplificado de Scrapling) ────────────────

function similarityScore(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Levenshtein normalizado por longitud (ratio simple, no exacto pero suficiente)
  const maxLen = Math.max(a.length, b.length);
  let diffs = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) if (a[i] !== b[i]) diffs++;
  diffs += maxLen - minLen;
  return Math.max(0, 1 - diffs / maxLen);
}

function attrsDiff(a: Record<string, string>, b: Record<string, string>): number {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  if (keys.length === 0) return 1;
  let total = 0;
  for (const k of keys) total += similarityScore(a[k] || '', b[k] || '');
  return total / keys.length;
}

function scoreCandidate(fp: ElementFingerprint, candidate: Omit<ElementFingerprint, 'savedAt'>): number {
  let score = 0;
  let weight = 0;

  // Tag (peso 1)
  score += fp.tag === candidate.tag ? 1 : 0; weight += 1;

  // Atributos (peso 2)
  score += attrsDiff(fp.attrs, candidate.attrs) * 2; weight += 2;

  // Atributos críticos individuales (peso 1.5 c/u)
  for (const a of ['class', 'id', 'name', 'type', 'role', 'placeholder', 'autocomplete']) {
    if (fp.attrs[a]) {
      score += similarityScore(fp.attrs[a], candidate.attrs[a] || '') * 1.5;
      weight += 1.5;
    }
  }

  // Text (peso 1)
  if (fp.text) { score += similarityScore(fp.text, candidate.text) * 1; weight += 1; }

  // Path (peso 1)
  score += similarityScore(fp.path, candidate.path) * 1; weight += 1;

  // Parent tag (peso 0.5)
  score += (fp.parentTag === candidate.parentTag ? 1 : 0) * 0.5; weight += 0.5;

  // Parent attrs (peso 0.5)
  score += attrsDiff(fp.parentAttrs, candidate.parentAttrs) * 0.5; weight += 0.5;

  return score / weight;
}

// ─── Adaptive fallback: scanea elementos por tag y elige el más similar ─────

const TAG_BY_ROLE: Record<string, string[]> = {
  email: ['input'],
  password: ['input'],
  submit: ['button', 'input'],
};

export async function findAdaptive(page: Page, role: string, threshold: number = 0.5): Promise<string | null> {
  const store = loadFingerprints();
  const fp = store[role];
  if (!fp) return null;

  const tags = TAG_BY_ROLE[role] || [fp.tag];
  const selector = tags.join(', ');

  try {
    const candidates = await page.evaluate((sel: string) => {
      const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      return els.map((el, idx) => {
        const attrs: Record<string, string> = {};
        for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
        const parent = el.parentElement;
        const parentAttrs: Record<string, string> = {};
        if (parent) for (const a of Array.from(parent.attributes)) parentAttrs[a.name] = a.value;
        let p: HTMLElement | null = el;
        const segs: string[] = [];
        let depth = 0;
        while (p && depth < 6 && p.parentElement) {
          const siblings = Array.from(p.parentElement.children).filter(c => c.tagName === p!.tagName);
          const idx2 = siblings.indexOf(p) + 1;
          segs.unshift(`${p.tagName.toLowerCase()}:nth-of-type(${idx2})`);
          p = p.parentElement;
          depth++;
        }
        const rect = el.getBoundingClientRect();
        return {
          idx,
          tag: el.tagName.toLowerCase(),
          attrs,
          text: (el.textContent || '').trim().slice(0, 200),
          path: segs.join(' > '),
          parentTag: parent?.tagName.toLowerCase() || '',
          parentAttrs,
          visible: rect.width > 0 && rect.height > 0,
        };
      }).filter(c => c.visible);
    }, selector);

    if (!candidates || candidates.length === 0) return null;

    let bestIdx = -1;
    let bestScore = 0;
    for (const c of candidates) {
      const s = scoreCandidate(fp, c);
      if (s > bestScore) { bestScore = s; bestIdx = c.idx; }
    }

    if (bestIdx < 0 || bestScore < threshold) return null;

    // Devolvemos un selector único basado en path del candidato ganador
    const winner = candidates.find(c => c.idx === bestIdx);
    if (!winner) return null;
    // Path es nuestra mejor heurística de selector único en este momento
    return winner.path || `${winner.tag}[adaptive-match]`;
  } catch {
    return null;
  }
}
