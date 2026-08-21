import type { ModelTier, TierBinding } from '../api/types';

/**
 * Model-tier binding form helpers. The backend only returns binding rows that
 * exist; the editor always shows all four tiers, so forms are merged onto
 * TIERS with empty fields for missing rows. Field values are edited as
 * strings (temp/max are strings of numbers on the wire; empty string clears).
 */

export const TIERS: ModelTier[] = ['TOP', 'MID', 'LOW', 'LOCAL'];

/** Backend ProviderType enum names (llm/core/ProviderType.java). */
export const PROVIDERS = ['OPENAI', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK'] as const;

export type TierBindingForm = Record<'provider' | 'baseUrl' | 'model' | 'credKey' | 'temp' | 'max', string>;

export const EMPTY_BINDING_FORM: TierBindingForm = {
  provider: '',
  baseUrl: '',
  model: '',
  credKey: '',
  temp: '',
  max: '',
};

export type TierBindingForms = Record<ModelTier, TierBindingForm>;

/** Merge sparse backend rows onto the four tiers; missing rows start empty. */
export function formsFromBindings(bindings: TierBinding[]): TierBindingForms {
  const forms: TierBindingForms = {
    TOP: { ...EMPTY_BINDING_FORM },
    MID: { ...EMPTY_BINDING_FORM },
    LOW: { ...EMPTY_BINDING_FORM },
    LOCAL: { ...EMPTY_BINDING_FORM },
  };
  for (const binding of bindings) {
    if (!(binding.tier in forms)) continue;
    forms[binding.tier] = {
      provider: binding.provider ?? '',
      baseUrl: binding.baseUrl ?? '',
      model: binding.model ?? '',
      credKey: binding.credKey ?? '',
      temp: binding.temp === null ? '' : String(binding.temp),
      max: binding.max === null ? '' : String(binding.max),
    };
  }
  return forms;
}

/** Partial PUT body for one tier: only fields that differ from the initial form. */
export function dirtyFields(
  initial: TierBindingForm,
  current: TierBindingForm,
): Record<string, string> {
  const body: Record<string, string> = {};
  for (const key of Object.keys(current) as (keyof TierBindingForm)[]) {
    if (current[key] !== initial[key]) body[key] = current[key];
  }
  return body;
}
