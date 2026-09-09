import { en } from '../i18n/en';
import type { Translate } from '../i18n/I18nContext';

function lookup(t: Translate, key: string, fallback: string) {
  return Object.prototype.hasOwnProperty.call(en, key) ? t(key as keyof typeof en) : fallback;
}
export const toolFieldLabel = (t: Translate, field: string) => lookup(t, `tool.field.${field}`, field);
export const toolValueLabel = (t: Translate, field: string, value: string) => lookup(t, `tool.enum.${field}.${value}`, value);
