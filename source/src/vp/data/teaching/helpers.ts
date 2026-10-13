import type { TeachingFinding } from '../../model/types.ts';
import type { LocalizedList, LocalizedText } from '../../model/i18n.ts';

/* Short constructors so the cards read as text, not as nested objects. */
export const t = (en: string, de: string): LocalizedText => ({ en, de });
export const l = (en: string[], de: string[]): LocalizedList => ({ en, de });
export const f = (sign: LocalizedText, means: LocalizedText, properties?: string[], conditions?: string[]): TeachingFinding =>
  ({ sign, means, ...(properties ? { properties } : {}), ...(conditions ? { conditions } : {}) });
