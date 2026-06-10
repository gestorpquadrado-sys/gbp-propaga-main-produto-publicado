import { appEnv } from '@/lib/env';
import { ALL_GBP_CATEGORIES, normalizeCategoryText } from '@/data/categoryCatalog';

export interface GoogleCategorySuggestion {
  id?: string;
  categoryId?: string;
  displayName: string;
  source: 'google' | 'local';
  raw?: unknown;
}

const scoreLocalCategory = (category: string, query: string) => {
  const normalizedCategory = normalizeCategoryText(category);
  const normalizedQuery = normalizeCategoryText(query);
  if (!normalizedQuery) return 1;

  let score = 0;
  if (normalizedCategory === normalizedQuery) score += 100;
  if (normalizedCategory.startsWith(normalizedQuery)) score += 70;
  if (normalizedCategory.includes(normalizedQuery)) score += 40;

  const tokens = normalizedQuery.split(' ').filter((token) => token.length > 2);
  tokens.forEach((token) => {
    if (normalizedCategory.split(' ').includes(token)) score += 18;
    else if (normalizedCategory.includes(token)) score += 8;
  });

  return score;
};

export const getLocalCategorySuggestions = (query: string, limit = 80): GoogleCategorySuggestion[] => {
  const normalized = normalizeCategoryText(query);
  const base = normalized
    ? ALL_GBP_CATEGORIES
        .map((category) => ({ category, score: scoreLocalCategory(category, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.category.localeCompare(b.category))
        .map((item) => item.category)
    : ALL_GBP_CATEGORIES;

  return base.slice(0, limit).map((displayName) => ({ displayName, source: 'local' }));
};

const normalizeRemoteCategory = (item: any): GoogleCategorySuggestion | null => {
  const displayName =
    item?.displayName ||
    item?.display_name ||
    item?.name ||
    item?.category ||
    item?.title;

  if (!displayName || typeof displayName !== 'string') return null;

  return {
    id: item?.name || item?.categoryId || item?.category_id,
    categoryId: item?.categoryId || item?.category_id || item?.name,
    displayName,
    source: 'google',
    raw: item,
  };
};

export async function fetchGoogleCategorySuggestions(
  query: string,
  options: { regionCode?: string; languageCode?: string; limit?: number } = {}
): Promise<{ suggestions: GoogleCategorySuggestion[]; source: 'google' | 'local'; error?: string }> {
  const limit = options.limit ?? 80;
  const localSuggestions = getLocalCategorySuggestions(query, limit);

  if (!appEnv.gbpCategoriesEndpoint) {
    return { suggestions: localSuggestions, source: 'local', error: 'Endpoint de categorias não configurado.' };
  }

  try {
    const url = new URL(appEnv.gbpCategoriesEndpoint);
    url.searchParams.set('query', query || '');
    url.searchParams.set('regionCode', options.regionCode || 'BR');
    url.searchParams.set('languageCode', options.languageCode || 'pt-BR');
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString(), { method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const remoteItems = Array.isArray(payload?.categories)
      ? payload.categories
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    const remoteSuggestions = remoteItems
      .map(normalizeRemoteCategory)
      .filter(Boolean) as GoogleCategorySuggestion[];

    const merged = new Map<string, GoogleCategorySuggestion>();
    [...remoteSuggestions, ...localSuggestions].forEach((suggestion) => {
      const key = normalizeCategoryText(suggestion.displayName);
      if (!merged.has(key)) merged.set(key, suggestion);
    });

    const suggestions = Array.from(merged.values()).slice(0, limit);
    return {
      suggestions: suggestions.length > 0 ? suggestions : localSuggestions,
      source: remoteSuggestions.length > 0 ? 'google' : 'local',
      ...(remoteSuggestions.length === 0 ? { error: 'A API não retornou categorias oficiais para este termo.' } : {}),
    };
  } catch (error) {
    console.warn('Falha ao consultar categorias oficiais. Usando catálogo local.', error);
    return {
      suggestions: localSuggestions,
      source: 'local',
      error: error instanceof Error ? error.message : 'Erro desconhecido ao consultar categorias oficiais.',
    };
  }
}
