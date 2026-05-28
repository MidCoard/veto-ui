import { UserPreference } from './types';

/**
 * C2: Vectorized Long-Term User Preferences
 * Manages user preferences as a searchable vector space.
 * Supports adding, querying, and prioritizing preferences
 * such as formatting constraints and coding conventions.
 */
export class PreferencesVector {
  private preferences: Map<string, UserPreference> = new Map();

  constructor() {
    // Load default preferences
    this.applyDefaults();
  }

  private applyDefaults() {
    this.addPreference({
      key: 'theme.dark',
      category: 'display',
      value: true,
      priority: 1,
      source: 'default',
      lastUpdated: new Date(),
    });
    this.addPreference({
      key: 'code.formatOnSend',
      category: 'formatting',
      value: true,
      priority: 5,
      source: 'default',
      lastUpdated: new Date(),
    });
    this.addPreference({
      key: 'security.vetoEnabled',
      category: 'security',
      value: true,
      priority: 10,
      source: 'default',
      lastUpdated: new Date(),
    });
  }

  /**
   * Add or update a preference.
   */
  addPreference(pref: UserPreference): void {
    const existing = this.preferences.get(pref.key);
    if (existing && existing.priority > pref.priority) {
      return; // Don't overwrite higher-priority preferences
    }
    this.preferences.set(pref.key, pref);
  }

  /**
   * Get a preference by key.
   */
  get(key: string): UserPreference | undefined {
    return this.preferences.get(key);
  }

  /**
   * Get preferences by category.
   */
  getByCategory(category: UserPreference['category']): UserPreference[] {
    return Array.from(this.preferences.values())
      .filter((p) => p.category === category)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get all formatting preferences (e.g., code conventions).
   */
  getFormattingPreferences(): UserPreference[] {
    return this.getByCategory('formatting');
  }

  /**
   * Get all security preferences.
   */
  getSecurityPreferences(): UserPreference[] {
    return this.getByCategory('security');
  }

  /**
   * Query preferences by text search.
   */
  query(search: string): UserPreference[] {
    const q = search.toLowerCase();
    return Array.from(this.preferences.values())
      .filter(
        (p) =>
          p.key.toLowerCase().includes(q) ||
          String(p.value).toLowerCase().includes(q)
      )
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a preference.
   */
  remove(key: string): boolean {
    return this.preferences.delete(key);
  }

  /**
   * Get all preferences as a serializable object.
   */
  getAll(): Record<string, UserPreference> {
    return Object.fromEntries(this.preferences);
  }

  /**
   * Get preference count.
   */
  getCount(): number {
    return this.preferences.size;
  }

  /**
   * Serialize to JSON.
   */
  toJSON(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /**
   * Load preferences from JSON.
   */
  static fromJSON(json: string): PreferencesVector {
    const pv = new PreferencesVector();
    const data = JSON.parse(json);
    // Clear defaults before loading
    pv.preferences.clear();
    for (const [key, value] of Object.entries(data)) {
      pv.preferences.set(key, value as UserPreference);
    }
    return pv;
  }
}
