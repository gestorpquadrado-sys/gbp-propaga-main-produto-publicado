import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, Search, RefreshCw, Cloud, Database, Loader2, AlertCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ALL_FACEBOOK_CATEGORIES,
  ALL_GBP_CATEGORIES,
  normalizeCategoryText,
} from '@/data/categoryCatalog';
import {
  fetchGoogleCategorySuggestions,
  getLocalCategorySuggestions,
  type GoogleCategorySuggestion,
} from '@/services/google-categories-service';

interface CategoriesStepProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
}

const MAX_ADDITIONAL_CATEGORIES = 10;

const searchFacebookCategories = (query: string, limit = 30) => {
  const normalized = normalizeCategoryText(query);
  if (!normalized) return ALL_FACEBOOK_CATEGORIES.slice(0, limit);
  return ALL_FACEBOOK_CATEGORIES.filter((category) =>
    normalizeCategoryText(category).includes(normalized)
  ).slice(0, limit);
};

const mergeSuggestions = (...groups: GoogleCategorySuggestion[][]) => {
  const map = new Map<string, GoogleCategorySuggestion>();
  groups.flat().forEach((suggestion) => {
    const key = normalizeCategoryText(suggestion.displayName);
    if (!map.has(key)) map.set(key, suggestion);
  });
  return Array.from(map.values());
};

const CategoriesStep = ({ formData, updateFormData }: CategoriesStepProps) => {
  const [categorySearch, setCategorySearch] = useState('');
  const [facebookSearch, setFacebookSearch] = useState('');
  const [officialSuggestions, setOfficialSuggestions] = useState<GoogleCategorySuggestion[]>([]);
  const [officialSource, setOfficialSource] = useState<'google' | 'local'>('local');
  const [officialError, setOfficialError] = useState<string | null>(null);
  const [loadingOfficial, setLoadingOfficial] = useState(false);

  const currentPrimary = formData.categories?.gbpPrimary || '';
  const selectedAdditional = formData.categories?.gbpAdditional || [];

  const localRelated = useMemo(
    () => getLocalCategorySuggestions(currentPrimary, 80),
    [currentPrimary]
  );

  const relatedSuggestions = useMemo(
    () => mergeSuggestions(officialSuggestions, localRelated).slice(0, 100),
    [officialSuggestions, localRelated]
  );

  const searchedCategories = useMemo(() => {
    const local = getLocalCategorySuggestions(categorySearch, 80);
    if (!categorySearch) return mergeSuggestions(officialSuggestions, local).slice(0, 80);
    return local;
  }, [categorySearch, officialSuggestions]);

  const facebookSuggestions = useMemo(
    () => searchFacebookCategories(facebookSearch || formData.categories?.fbCategory || '', 30),
    [facebookSearch, formData.categories?.fbCategory]
  );

  const applySuggestionsAsAdditional = (suggestions: GoogleCategorySuggestion[]) => {
    const additional = suggestions
      .map((suggestion) => suggestion.displayName)
      .filter((category) => normalizeCategoryText(category) !== normalizeCategoryText(currentPrimary))
      .slice(0, MAX_ADDITIONAL_CATEGORIES);

    updateFormData('categories.gbpAdditional', additional);
  };

  const loadOfficialCategories = async (query: string, applyToAdditional = false) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      const fallback = getLocalCategorySuggestions('', 80);
      setOfficialSuggestions(fallback);
      setOfficialSource('local');
      setOfficialError(null);
      if (applyToAdditional) applySuggestionsAsAdditional(fallback);
      return;
    }

    setLoadingOfficial(true);
    const result = await fetchGoogleCategorySuggestions(cleanQuery, {
      regionCode: 'BR',
      languageCode: 'pt-BR',
      limit: 80,
    });
    setOfficialSuggestions(result.suggestions);
    setOfficialSource(result.source);
    setOfficialError(result.error || null);
    setLoadingOfficial(false);

    if (applyToAdditional) {
      applySuggestionsAsAdditional(result.suggestions);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (currentPrimary) loadOfficialCategories(currentPrimary, true);
    }, 450);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrimary]);

  const updatePrimaryCategory = (category: string) => {
    updateFormData('categories.gbpPrimary', category);
    const fallbackSuggestions = getLocalCategorySuggestions(category, MAX_ADDITIONAL_CATEGORIES + 1);
    applySuggestionsAsAdditional(fallbackSuggestions);
  };

  const addCategory = (category: string) => {
    const current = formData.categories?.gbpAdditional || [];
    if (!current.includes(category) && current.length < MAX_ADDITIONAL_CATEGORIES) {
      updateFormData('categories.gbpAdditional', [...current, category]);
    }
  };

  const removeCategory = (category: string) => {
    const current = formData.categories?.gbpAdditional || [];
    updateFormData(
      'categories.gbpAdditional',
      current.filter((c: string) => c !== category)
    );
  };

  const applyRelatedCategories = () => {
    applySuggestionsAsAdditional(relatedSuggestions);
  };

  const clearAdditionalCategories = () => {
    updateFormData('categories.gbpAdditional', []);
  };

  const sourceLabel = officialSource === 'google'
    ? 'Categorias oficiais consultadas via n8n / Google Business Profile'
    : 'Usando catálogo local como fallback';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Categorias</h3>
        <p className="text-muted-foreground">Selecione as categorias que descrevem seu negócio</p>
      </div>

      <Alert className="bg-brand-purple/10 border-brand-purple/20">
        <Cloud className="h-4 w-4" />
        <AlertDescription className="text-sm text-muted-foreground">
          Ao digitar a categoria principal, o sistema consulta o webhook do n8n para buscar categorias oficiais do Google Business Profile. Se a API não responder, o catálogo local ampliado continua funcionando como fallback.
        </AlertDescription>
      </Alert>

      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="gbpPrimary">Categoria Principal (Google)</Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {loadingOfficial ? <Loader2 className="h-3 w-3 animate-spin" /> : officialSource === 'google' ? <Cloud className="h-3 w-3" /> : <Database className="h-3 w-3" />}
              <span>{sourceLabel}</span>
            </div>
          </div>
          <Input
            id="gbpPrimary"
            list="gbp-category-catalog"
            placeholder="ex: Tecnologia, Laboratório, Imobiliária, Restaurante..."
            value={currentPrimary}
            onChange={(e) => updatePrimaryCategory(e.target.value)}
            className="mt-1.5"
          />
          <datalist id="gbp-category-catalog">
            {ALL_GBP_CATEGORIES.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          {officialError && (
            <p className="mt-2 flex items-center gap-1 text-xs text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {officialError}
            </p>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <Label>Categorias Adicionais (Google)</Label>
              <p className="text-xs text-muted-foreground">
                Até {MAX_ADDITIONAL_CATEGORIES} categorias adicionais. Encontramos {relatedSuggestions.length} categorias e subcategorias relacionadas.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadOfficialCategories(currentPrimary, true)}
                disabled={!currentPrimary || loadingOfficial}
              >
                {loadingOfficial ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                Atualizar via n8n
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={applyRelatedCategories}>
                Aplicar melhores relacionadas
              </Button>
              {selectedAdditional.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={clearAdditionalCategories}>
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {selectedAdditional.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/50 border border-border mb-4">
              {selectedAdditional.map((category: string) => (
                <Badge key={category} className="bg-accent text-accent-foreground gap-1">
                  {category}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => removeCategory(category)}
                  />
                </Badge>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Categorias e subcategorias relacionadas à principal
              </p>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-card/40 p-3">
                <div className="flex flex-wrap gap-2">
                  {relatedSuggestions.map((suggestion) => {
                    const category = suggestion.displayName;
                    const selected = selectedAdditional.includes(category);
                    return (
                      <Badge
                        key={`${suggestion.source}-${category}`}
                        variant={selected ? 'default' : 'outline'}
                        className="cursor-pointer hover:bg-brand-purple/20 transition-colors"
                        onClick={() => selected ? removeCategory(category) : addCategory(category)}
                      >
                        {suggestion.source === 'google' ? 'G' : '+'} {selected ? '✓' : ''} {category}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="categorySearch" className="text-xs font-medium text-muted-foreground">
                Pesquisar no catálogo completo
              </Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="categorySearch"
                  placeholder="Digite para localizar categoria ou subcategoria..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {categorySearch && (
                <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-border bg-card/40 p-3">
                  <div className="flex flex-wrap gap-2">
                    {searchedCategories.length > 0 ? (
                      searchedCategories.map((suggestion) => {
                        const category = suggestion.displayName;
                        const selected = selectedAdditional.includes(category);
                        return (
                          <Badge
                            key={`${suggestion.source}-${category}`}
                            variant={selected ? 'default' : 'outline'}
                            className="cursor-pointer hover:bg-brand-purple/20 transition-colors"
                            onClick={() => selected ? removeCategory(category) : addCategory(category)}
                          >
                            {selected ? '✓' : '+'} {category}
                          </Badge>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma categoria encontrada.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="fbCategory">Categoria (Facebook)</Label>
          <Input
            id="fbCategory"
            list="facebook-category-catalog"
            placeholder="ex: Local Business, Service Business"
            value={formData.categories?.fbCategory || ''}
            onChange={(e) => {
              updateFormData('categories.fbCategory', e.target.value);
              setFacebookSearch(e.target.value);
            }}
            className="mt-1.5"
          />
          <datalist id="facebook-category-catalog">
            {ALL_FACEBOOK_CATEGORIES.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          {facebookSuggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {facebookSuggestions.slice(0, 12).map((category) => (
                <Badge
                  key={category}
                  variant="outline"
                  className="cursor-pointer hover:bg-brand-purple/20 transition-colors"
                  onClick={() => updateFormData('categories.fbCategory', category)}
                >
                  + {category}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoriesStep;
