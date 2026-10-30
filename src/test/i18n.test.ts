import { describe, expect, it } from 'vitest';
import { en } from '../data/locales/en';
import { ko } from '../data/locales/ko';
import type { Messages } from '../data/locales/types';
import { detectLang, getLang, msg, onLangChange, setLang } from '../utils/i18n';

const HANGUL = /[\uAC00-\uD7A3\u3130-\u318F]/;

/** Every string in a locale, calling formatter functions with sample arguments. */
function allStrings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (typeof node === 'function') {
    const fn = node as (...args: unknown[]) => unknown;
    const out: [string, string][] = [];
    for (const sample of [1, 2, true, false]) {
      const value = fn(sample, sample, sample, sample);
      if (typeof value === 'string') out.push([`${path}(${String(sample)})`, value]);
    }
    return out;
  }
  if (Array.isArray(node)) return node.flatMap((v, i) => allStrings(v, `${path}[${i}]`));
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node).flatMap(([k, v]) => allStrings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

function keyPaths(node: unknown, path = ''): string[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return [path];
  return Object.entries(node).flatMap(([k, v]) => keyPaths(v, path ? `${path}.${k}` : k));
}

describe('localization', () => {
  it('ships an English translation with no Korean left in it', () => {
    const leftovers = allStrings(en).filter(([, text]) => HANGUL.test(text));
    expect(leftovers).toEqual([]);
  });

  it('has no empty strings in either language', () => {
    for (const locale of [en, ko] as Messages[]) {
      const empty = allStrings(locale).filter(([, text]) => text.trim() === '');
      expect(empty).toEqual([]);
    }
  });

  it('has exactly the same keys in English and Korean', () => {
    expect(keyPaths(ko).sort()).toEqual(keyPaths(en).sort());
  });

  it('really translates the Korean locale (names are in Hangul)', () => {
    expect(HANGUL.test(ko.items.iron_plate)).toBe(true);
    expect(HANGUL.test(ko.buildings.conveyor.name)).toBe(true);
    expect(en.items.iron_plate).toBe('Iron Plate');
  });

  it('formats plurals and numbers in English', () => {
    expect(en.hud.enemies(1)).toBe('1 alien');
    expect(en.hud.enemies(3)).toBe('3 aliens');
    expect(en.common.perMin('12')).toBe('12/min');
    expect(ko.common.perMin('12')).toBe('12개/분');
  });

  it('detects the browser language and falls back to English', () => {
    expect(detectLang(['ko-KR', 'en-US'])).toBe('ko');
    expect(detectLang(['en-GB'])).toBe('en');
    expect(detectLang(['fr-FR', 'ko'])).toBe('ko');
    expect(detectLang(['ja-JP'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });

  it('switches language at runtime and notifies listeners', () => {
    const before = getLang();
    let calls = 0;
    const off = onLangChange(() => calls++);
    setLang('ko');
    expect(msg().items.gear).toBe('기어');
    setLang('ko');
    setLang('en');
    expect(msg().items.gear).toBe('Gear');
    expect(calls).toBe(2);
    off();
    setLang(before);
  });
});
