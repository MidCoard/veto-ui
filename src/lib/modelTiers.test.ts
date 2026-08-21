import { describe, expect, it } from 'vitest';
import type { TierBinding } from '../api/types';
import { dirtyFields, EMPTY_BINDING_FORM, formsFromBindings } from './modelTiers';

function binding(tier: string, fields: Partial<Omit<TierBinding, 'tier'>>): TierBinding {
  return {
    tier: tier as TierBinding['tier'],
    provider: null,
    baseUrl: null,
    model: null,
    credKey: null,
    temp: null,
    max: null,
    ...fields,
  };
}

describe('formsFromBindings', () => {
  it('fills all four tiers even when the backend returns nothing', () => {
    const forms = formsFromBindings([]);
    expect(Object.keys(forms)).toEqual(['TOP', 'MID', 'LOW', 'LOCAL']);
    expect(forms.TOP).toEqual(EMPTY_BINDING_FORM);
  });

  it('maps present rows and leaves missing tiers empty', () => {
    const forms = formsFromBindings([
      binding('TOP', { provider: 'DEEPSEEK', model: 'deepseek-chat', temp: 0.7, max: 8192 }),
    ]);
    expect(forms.TOP).toEqual({
      provider: 'DEEPSEEK',
      baseUrl: '',
      model: 'deepseek-chat',
      credKey: '',
      temp: '0.7',
      max: '8192',
    });
    expect(forms.MID).toEqual(EMPTY_BINDING_FORM);
  });

  it('stringifies numeric temp/max and maps nulls to empty strings', () => {
    const forms = formsFromBindings([binding('LOW', { temp: 0, max: 0 })]);
    expect(forms.LOW.temp).toBe('0');
    expect(forms.LOW.max).toBe('0');
    expect(forms.LOW.baseUrl).toBe('');
  });

  it('ignores rows with unknown tier names', () => {
    const forms = formsFromBindings([binding('ULTRA', { model: 'x' })]);
    expect(forms.TOP).toEqual(EMPTY_BINDING_FORM);
  });
});

describe('dirtyFields', () => {
  it('returns only changed fields', () => {
    const initial = { ...EMPTY_BINDING_FORM, model: 'old' };
    const current = { ...initial, model: 'new', temp: '0.7' };
    expect(dirtyFields(initial, current)).toEqual({ model: 'new', temp: '0.7' });
  });

  it('returns an empty body when nothing changed', () => {
    const form = { ...EMPTY_BINDING_FORM, provider: 'OPENAI' };
    expect(dirtyFields(form, { ...form })).toEqual({});
  });

  it('keeps empty-string clears as changes', () => {
    const initial = { ...EMPTY_BINDING_FORM, baseUrl: 'https://api.example.com' };
    expect(dirtyFields(initial, EMPTY_BINDING_FORM)).toEqual({ baseUrl: '' });
  });
});
