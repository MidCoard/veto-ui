import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import {
  activateModelTierProfile,
  createModelTierProfile,
  deleteModelTierProfile,
  getTierBindings,
  listModelTierProfiles,
  listVaultNotes,
  putTierBinding,
} from '../../api/endpoints';
import type { ModelTier, ModelTierProfile } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import type { Translate } from '../../i18n/I18nContext';
import {
  dirtyFields,
  formsFromBindings,
  PROVIDERS,
  TIERS,
  type TierBindingForm,
  type TierBindingForms,
} from '../../lib/modelTiers';

/**
 * ModelTiersSection — profile list (select / create / activate / two-step
 * delete) plus the selected profile's binding editor: one card per tier
 * (TOP/MID/LOW/LOCAL), sparse backend rows merged onto empty forms, saving
 * PUTs only the dirty fields. Field-level 400 messages render inline.
 */
function errorText(error: unknown, t: Translate): string {
  if (error instanceof ApiError) return error.message;
  return t('error.backendUnreachable');
}

const inputClass =
  'w-full bg-raised border border-rule rounded-md px-2 py-1.5 text-sm font-mono text-paper placeholder-dim/60 focus:outline-none focus:border-accent';
const labelClass = 'block text-[10px] uppercase tracking-wider text-dim/70 mb-1';

const ModelTiersSection: React.FC = () => {
  const { t } = useI18n();

  const [profiles, setProfiles] = useState<ModelTierProfile[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const [initial, setInitial] = useState<TierBindingForms | null>(null);
  const [forms, setForms] = useState<TierBindingForms | null>(null);
  const [bindingsError, setBindingsError] = useState<string | null>(null);
  const [savingTier, setSavingTier] = useState<ModelTier | null>(null);
  const [savedTier, setSavedTier] = useState<ModelTier | null>(null);
  const [tierErrors, setTierErrors] = useState<Partial<Record<ModelTier, string>>>({});

  const [credTitles, setCredTitles] = useState<string[]>([]);

  const loadProfiles = useCallback(async (): Promise<void> => {
    try {
      setListError(null);
      const list = await listModelTierProfiles();
      setProfiles(list);
      setSelected((current) => {
        if (current !== null && list.some((profile) => profile.name === current)) return current;
        return (list.find((profile) => profile.active) ?? list[0])?.name ?? null;
      });
    } catch (error) {
      setListError(errorText(error, t));
      setProfiles([]);
    }
  }, [t]);

  useEffect(() => {
    void loadProfiles();
    void listVaultNotes()
      .then(setCredTitles)
      .catch(() => undefined);
  }, [loadProfiles]);

  const loadBindings = useCallback(
    async (profile: string): Promise<void> => {
      try {
        setBindingsError(null);
        const merged = formsFromBindings(await getTierBindings(profile));
        setInitial(merged);
        setForms(merged);
        setTierErrors({});
        setSavedTier(null);
      } catch (error) {
        setBindingsError(errorText(error, t));
        setInitial(null);
        setForms(null);
      }
    },
    [t],
  );

  useEffect(() => {
    if (selected !== null) void loadBindings(selected);
  }, [selected, loadBindings]);

  const handleCreate = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (trimmed === '' || creating) return;
    setCreating(true);
    setFormError(null);
    try {
      await createModelTierProfile(trimmed);
      setNewName('');
      setFormOpen(false);
      setSelected(trimmed);
      await loadProfiles();
    } catch (error) {
      setFormError(errorText(error, t));
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (name: string): Promise<void> => {
    if (activating) return;
    setActivating(true);
    setProfileActionError(null);
    try {
      await activateModelTierProfile(name);
      await loadProfiles();
    } catch (error) {
      setProfileActionError(errorText(error, t));
    } finally {
      setActivating(false);
    }
  };

  const handleDelete = async (name: string): Promise<void> => {
    setProfileActionError(null);
    try {
      await deleteModelTierProfile(name);
      setConfirmingDelete(null);
      if (selected === name) setSelected(null);
      await loadProfiles();
    } catch (error) {
      setProfileActionError(errorText(error, t));
      setConfirmingDelete(null);
    }
  };

  const setField = (tier: ModelTier, field: keyof TierBindingForm, value: string): void => {
    setForms((prev) =>
      prev === null ? prev : { ...prev, [tier]: { ...prev[tier], [field]: value } },
    );
    setSavedTier((prev) => (prev === tier ? null : prev));
  };

  const handleSaveTier = async (tier: ModelTier): Promise<void> => {
    if (selected === null || initial === null || forms === null || savingTier !== null) return;
    const body = dirtyFields(initial[tier], forms[tier]);
    if (Object.keys(body).length === 0) return;
    setSavingTier(tier);
    setTierErrors((prev) => ({ ...prev, [tier]: undefined }));
    try {
      await putTierBinding(selected, tier, body);
      await loadBindings(selected);
      setSavedTier(tier);
    } catch (error) {
      // 400s carry "field: reason" — render inline on the tier card.
      setTierErrors((prev) => ({ ...prev, [tier]: errorText(error, t) }));
    } finally {
      setSavingTier(null);
    }
  };

  const selectedProfile = profiles?.find((profile) => profile.name === selected);

  return (
    <div className="space-y-4">
      {/* Profile list */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setFormOpen((open) => !open)}
          className="text-xs text-accent hover:bg-accent/10 border border-rule rounded-md px-2 py-1.5"
        >
          {formOpen ? t('tiers.closeForm') : t('tiers.new')}
        </button>

        {formOpen && (
          <form
            onSubmit={(event) => void handleCreate(event)}
            className="flex gap-2 bg-raised/40 border border-rule rounded-lg p-2.5"
          >
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t('tiers.namePlaceholder')}
              aria-label={t('tiers.namePlaceholder')}
              className={`${inputClass} flex-1 min-w-0`}
            />
            <button
              type="submit"
              disabled={creating || newName.trim() === ''}
              className="bg-accent text-onaccent text-sm font-medium rounded-md px-3 py-1.5 hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {creating ? t('tiers.creating') : t('tiers.create')}
            </button>
          </form>
        )}
        {formError !== null && (
          <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
            {formError}
          </p>
        )}
        {listError !== null && (
          <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
            {listError}
          </p>
        )}
        {profileActionError !== null && (
          <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
            {profileActionError}
          </p>
        )}

        {profiles === null ? (
          <p className="text-sm text-dim">{t('tiers.loading')}</p>
        ) : profiles.length === 0 && listError === null ? (
          <p className="text-sm text-dim">{t('tiers.empty')}</p>
        ) : (
          <ul className="divide-y divide-rule/60 border border-rule rounded-lg">
            {profiles.map((profile) => {
              const isSelected = profile.name === selected;
              return (
                <li key={profile.name} className="px-2.5 py-2">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(profile.name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelected(profile.name);
                      }
                    }}
                    className={`flex items-center justify-between gap-2 cursor-pointer rounded px-1.5 py-1 -mx-1.5 ${
                      isSelected ? 'bg-raised' : 'hover:bg-raised/60'
                    }`}
                  >
                    <span className={`text-sm truncate ${isSelected ? 'text-paper' : 'text-paper/80'}`}>
                      {profile.name}
                    </span>
                    {profile.active && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-pass border border-pass/40 rounded px-1.5 py-0.5 shrink-0">
                        {t('tiers.active')}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <div className="mt-1.5 flex items-center gap-2">
                      {!profile.active && (
                        <button
                          type="button"
                          disabled={activating}
                          onClick={() => void handleActivate(profile.name)}
                          className="text-xs text-accent hover:bg-accent/10 border border-accent/40 rounded-md px-2 py-0.5 disabled:opacity-50"
                        >
                          {t('tiers.activate')}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={t('tiers.deleteAria', { name: profile.name })}
                        onClick={() => setConfirmingDelete(profile.name)}
                        className="text-xs text-dim/70 hover:text-verdict border border-rule rounded-md px-2 py-0.5"
                      >
                        {t('tiers.delete')}
                      </button>
                      {confirmingDelete === profile.name && (
                        <>
                          <span className="text-xs text-dim flex-1">{t('tiers.deleteConfirm')}</span>
                          <button
                            type="button"
                            onClick={() => void handleDelete(profile.name)}
                            className="text-xs text-verdict border border-verdict/50 rounded-md px-2 py-0.5 hover:bg-verdict/10"
                          >
                            {t('tiers.delete')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(null)}
                            className="text-xs text-dim hover:text-paper hover:bg-raised rounded-md px-2 py-0.5"
                          >
                            {t('tiers.keep')}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Binding editor for the selected profile */}
      {selected !== null && selectedProfile !== undefined && (
        <div className="space-y-2">
          {bindingsError !== null && (
            <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
              {bindingsError}
            </p>
          )}
          {forms === null || initial === null ? (
            bindingsError === null && <p className="text-sm text-dim">{t('tiers.loadingBindings')}</p>
          ) : (
            TIERS.map((tier) => {
              const form = forms[tier];
              const dirty = Object.keys(dirtyFields(initial[tier], form)).length > 0;
              const providerOptions =
                form.provider !== '' && !PROVIDERS.includes(form.provider as (typeof PROVIDERS)[number])
                  ? [...PROVIDERS, form.provider]
                  : [...PROVIDERS];
              return (
                <div key={tier} className="bg-panel border border-rule rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-accent">{tier}</span>
                    {savedTier === tier && !dirty && (
                      <span className="text-[11px] text-pass">{t('tiers.saved')}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass} htmlFor={`tier-${tier}-provider`}>
                        {t('tiers.field.provider')}
                      </label>
                      <select
                        id={`tier-${tier}-provider`}
                        value={form.provider}
                        onChange={(event) => setField(tier, 'provider', event.target.value)}
                        className={`${inputClass} font-sans`}
                      >
                        <option value="">{t('tiers.unset')}</option>
                        {providerOptions.map((provider) => (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor={`tier-${tier}-model`}>
                        {t('tiers.field.model')}
                      </label>
                      <input
                        id={`tier-${tier}-model`}
                        type="text"
                        value={form.model}
                        onChange={(event) => setField(tier, 'model', event.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`tier-${tier}-baseUrl`}>
                      {t('tiers.field.baseUrl')}
                    </label>
                    <input
                      id={`tier-${tier}-baseUrl`}
                      type="text"
                      value={form.baseUrl}
                      onChange={(event) => setField(tier, 'baseUrl', event.target.value)}
                      className={inputClass}
                    />
                    <p className="mt-1 text-[11px] text-dim/70">{t('tiers.baseUrlHint')}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 sm:col-span-1">
                      <label className={labelClass} htmlFor={`tier-${tier}-credKey`}>
                        {t('tiers.field.credKey')}
                      </label>
                      <input
                        id={`tier-${tier}-credKey`}
                        type="text"
                        value={form.credKey}
                        onChange={(event) => setField(tier, 'credKey', event.target.value)}
                        list="vault-note-titles"
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 col-span-2 sm:col-span-1">
                      <div>
                        <label className={labelClass} htmlFor={`tier-${tier}-temp`}>
                          {t('tiers.field.temp')}
                        </label>
                        <input
                          id={`tier-${tier}-temp`}
                          type="text"
                          inputMode="decimal"
                          value={form.temp}
                          onChange={(event) => setField(tier, 'temp', event.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor={`tier-${tier}-max`}>
                          {t('tiers.field.max')}
                        </label>
                        <input
                          id={`tier-${tier}-max`}
                          type="text"
                          inputMode="numeric"
                          value={form.max}
                          onChange={(event) => setField(tier, 'max', event.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                  {tierErrors[tier] !== undefined && (
                    <p role="alert" className="text-xs text-verdict border border-verdict/40 rounded-md px-2 py-1.5 break-words">
                      {tierErrors[tier]}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!dirty || savingTier !== null}
                      onClick={() => void handleSaveTier(tier)}
                      className="bg-accent text-onaccent text-xs font-medium rounded-md px-3 py-1 hover:bg-accent/85 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingTier === tier ? t('tiers.saving') : t('tiers.save')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {/* Vault note titles for the credKey inputs (free text still allowed). */}
          <datalist id="vault-note-titles">
            {credTitles.map((noteTitle) => (
              <option key={noteTitle} value={noteTitle} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
};

export default ModelTiersSection;
