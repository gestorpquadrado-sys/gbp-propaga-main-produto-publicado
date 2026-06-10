import { normalizeCategoryText } from '@/data/categoryCatalog';

export type ChannelBusinessType =
  | 'general'
  | 'restaurants'
  | 'healthcare'
  | 'real_estate'
  | 'services'
  | 'hotels'
  | 'technology'
  | 'finance'
  | 'automotive'
  | 'beauty'
  | 'education'
  | 'construction'
  | 'retail'
  | 'pet';

export const businessTypeOptions = [
  { value: 'general', label: 'Geral (qualquer negócio)', icon: '🏢' },
  { value: 'technology', label: 'Tecnologia / Marketing', icon: '💻' },
  { value: 'services', label: 'Serviços', icon: '🔧' },
  { value: 'healthcare', label: 'Saúde', icon: '⚕️' },
  { value: 'restaurants', label: 'Restaurante/Food', icon: '🍔' },
  { value: 'real_estate', label: 'Imóveis', icon: '🏠' },
  { value: 'construction', label: 'Construção / Engenharia', icon: '🏗️' },
  { value: 'automotive', label: 'Automotivo', icon: '🚗' },
  { value: 'beauty', label: 'Beleza / Estética', icon: '✨' },
  { value: 'education', label: 'Educação / Cursos', icon: '🎓' },
  { value: 'finance', label: 'Financeiro / Seguros', icon: '💳' },
  { value: 'hotels', label: 'Hospedagem', icon: '🏨' },
  { value: 'retail', label: 'Varejo / Loja', icon: '🛍️' },
  { value: 'pet', label: 'Pet / Veterinária', icon: '🐾' },
] as const;

const TYPE_KEYWORDS: Record<ChannelBusinessType, string[]> = {
  general: [],
  technology: ['tecnologia', 'technology', 'software', 'marketing', 'advertising', 'seo', 'internet', 'website', 'digital', 'consultant', 'informática', 'informatica'],
  services: ['serviço', 'servicos', 'service', 'professional', 'consultant', 'cleaning', 'pest', 'dedet', 'maintenance', 'locksmith'],
  healthcare: ['saúde', 'saude', 'health', 'medical', 'clinic', 'doctor', 'diagnostic', 'laboratory', 'dentist', 'dental', 'orthodontist', 'veterinarian', 'pharmacy'],
  restaurants: ['restaurant', 'restaurante', 'food', 'cafe', 'bar', 'pizza', 'sushi', 'bakery', 'lanchonete', 'delivery', 'meal', 'hamburger'],
  real_estate: ['imobili', 'real estate', 'property', 'rental', 'condominium', 'apartment', 'housing', 'mortgage'],
  construction: ['construction', 'construt', 'builder', 'contractor', 'engineering', 'engineer', 'arquitet', 'architect', 'drywall', 'gesso', 'roofing', 'painter', 'electrician', 'plumber'],
  automotive: ['auto', 'automot', 'car', 'vehicle', 'mechanic', 'tire', 'battery', 'wash', 'detailing', 'motorcycle'],
  beauty: ['beauty', 'estet', 'salon', 'spa', 'hair', 'nail', 'skin', 'laser', 'barber'],
  education: ['school', 'education', 'curso', 'training', 'academy', 'gym', 'fitness', 'language', 'music', 'tutoring'],
  finance: ['finance', 'financial', 'loan', 'credit', 'insurance', 'bank', 'accounting', 'tax', 'investment', 'seguro'],
  hotels: ['hotel', 'inn', 'motel', 'hostel', 'resort', 'lodging', 'guest', 'vacation'],
  retail: ['store', 'shop', 'retail', 'clothing', 'fashion', 'supermarket', 'grocery', 'market', 'pharmacy', 'furniture', 'gift'],
  pet: ['pet', 'veterinarian', 'animal', 'dog', 'groomer', 'boarding'],
};

export const RECOMMENDED_CHANNELS_BY_TYPE: Record<ChannelBusinessType, string[]> = {
  general: ['apontador', 'bing', 'apple', 'waze', 'here', 'tomtom', 'yelp', 'foursquare', 'acheiaqui', 'encontrabrasil', 'telelistas', 'guiamais', 'solutudo', 'guiafacil'],
  technology: ['apontador', 'bing', 'apple', 'waze', 'here', 'yelp', 'foursquare', 'acheiaqui', 'encontrabrasil', 'guiasp', 'solutudo', 'cylex', 'kompass'],
  services: ['apontador', 'bing', 'apple', 'waze', 'here', 'yelp', 'foursquare', 'acheiaqui', 'encontrabrasil', 'getninjas', 'habitissimo', 'guiasp', 'solutudo', 'guiafacil', 'tuugo'],
  healthcare: ['apontador', 'bing', 'apple', 'waze', 'acheiaqui', 'encontrabrasil', 'doctoralia', 'boaconsulta', 'catalogosaude', 'yelp', 'telelistas', 'solutudo'],
  restaurants: ['apontador', 'bing', 'apple', 'waze', 'yelp', 'ifood', 'rappi', 'aiqfome', 'deliverymuch', 'tripadvisor', 'opentable', 'thefork', 'foursquare', 'guiadasemana'],
  real_estate: ['apontador', 'bing', 'apple', 'waze', 'vivareal', 'zapimoveis', 'imovelweb', 'chavesnamao', 'olximoveis', 'quintoandar', 'acheiaqui', 'encontrabrasil', 'yelp'],
  construction: ['apontador', 'bing', 'apple', 'waze', 'yelp', 'habitissimo', 'getninjas', 'homeadvisor', 'houzz', 'angieslist', 'thumbtack', 'acheiaqui'],
  automotive: ['apontador', 'bing', 'apple', 'waze', 'yelp', 'acheiaqui', 'encontrabrasil', 'telelistas', 'webmotors', 'icarros', 'olx', 'chavesnamao'],
  beauty: ['apontador', 'bing', 'apple', 'waze', 'yelp', 'acheiaqui', 'encontrabrasil', 'foursquare', 'trinks', 'solutudo'],
  education: ['apontador', 'bing', 'apple', 'waze', 'yelp', 'acheiaqui', 'encontrabrasil', 'guiasp', 'educamaisbrasil', 'querobolsa'],
  finance: ['apontador', 'bing', 'apple', 'waze', 'yelp', 'acheiaqui', 'encontrabrasil', 'telelistas', 'serasa'],
  hotels: ['apontador', 'bing', 'apple', 'waze', 'yelp', 'booking', 'airbnb', 'expedia', 'hotelscom', 'trivago', 'tripadvisor', 'mapquest', 'foursquare', 'hostelworld'],
  retail: ['apontador', 'bing', 'apple', 'waze', 'yelp', 'acheiaqui', 'encontrabrasil', 'foursquare', 'telelistas', 'mercadolivre', 'shopee', 'olx', 'solutudo'],
  pet: ['apontador', 'bing', 'apple', 'waze', 'yelp', 'acheiaqui', 'encontrabrasil', 'foursquare', 'petlove', 'solutudo'],
};

// Google e Facebook são fontes de dados/identificação. Não entram na propagação.
export const SPECIAL_CHANNELS: string[] = [];

export function detectBusinessTypeFromCategories(categories: string[] = []): ChannelBusinessType {
  const normalized = categories.map(normalizeCategoryText).join(' ');
  if (!normalized) return 'general';

  const scores = Object.entries(TYPE_KEYWORDS).map(([type, keywords]) => {
    const score = keywords.reduce((acc, keyword) => normalized.includes(normalizeCategoryText(keyword)) ? acc + 1 : acc, 0);
    return { type: type as ChannelBusinessType, score };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.score > 0 ? scores[0].type : 'general';
}

export function getRecommendedChannelCodes(type: ChannelBusinessType, includeSpecial = false): string[] {
  const base = RECOMMENDED_CHANNELS_BY_TYPE[type] || RECOMMENDED_CHANNELS_BY_TYPE.general;
  return includeSpecial ? [...base, ...SPECIAL_CHANNELS] : base.filter((code) => !SPECIAL_CHANNELS.includes(code));
}
