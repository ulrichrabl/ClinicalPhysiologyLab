/* ---------------------------------------------------------------------------
   Languages.

   Every learner-facing string in case data, the ontology and the vocabulary is
   a LocalizedText. English is the required fallback; every other locale is
   optional per string, and the validator reports gaps against the locales a
   case declares. Adding a language means adding data, never code.
--------------------------------------------------------------------------- */

/** BCP-47 language tag. 'en' and 'de' are supported now; others are data. */
export type Locale = 'en' | 'de' | (string & {});

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'de'];

/** A string in several languages; `en` is the fallback and always present. */
export type LocalizedText = { en: string } & { [locale: string]: string };

/** A list of phrasings per language (vocabulary, synonyms, intents). */
export type LocalizedList = { en: string[] } & { [locale: string]: string[] };

export function tr(text: LocalizedText | undefined, locale: Locale): string {
  if (!text) return '';
  return text[locale] ?? text.en;
}

export function list(l: LocalizedList | undefined, locale: Locale): string[] {
  if (!l) return [];
  return l[locale] ?? l.en;
}

/** Locales from `required` that this text does not provide. */
export function missingLocales(text: LocalizedText | LocalizedList | undefined, required: readonly Locale[]): Locale[] {
  if (!text) return [...required];
  return required.filter((l) => !(l in text) || (Array.isArray(text[l]) ? text[l].length === 0 : !text[l]));
}

/** Locale-aware number formatting (German uses a decimal comma). */
export function num(value: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}
