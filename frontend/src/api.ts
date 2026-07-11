import type { ActionEvaluation, Analysis, AppSettings, BuildDoctorResult, BuildFitProfile, BuildImportResult, BuildProfile, CatalogVersion, CharacterDetail, CharacterInput, CharacterSummary, CharacterTotals, CraftComparison, CraftGoal, CraftingCurrencyDef, CraftingHistoryEntry, CraftingItemState, CraftPlan, CustomBuildProfileInput, EquipmentSlotInput, ItemInput, KnowledgeStatus, LevelingSearchResult, MarketHistoryResult, NormalizedItem, PoeOAuthStatus, PoeRemoteCharacter, RaceReview } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}${url}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

export const api = {
  analyze: (body: { league: string; itemText: string; equippedItemText?: string; characterTotals?:CharacterTotals; selectedBuildProfileId?:string; item: Partial<ItemInput>; manualListings: string; divineToExalted: number; characterId?:number }) => request<Analysis>('/api/analyze', { method: 'POST', body: JSON.stringify(body) }),
  buildUrl: (body: unknown) => request<{ url: string }>('/api/trade/build-url', { method: 'POST', body: JSON.stringify(body) }),
  parseUrl: (url: string) => request<Record<string, unknown>>('/api/trade/parse-url', { method: 'POST', body: JSON.stringify({ url }) }),
  checks: () => request<any[]>('/api/checks'),
  check: (id: string) => request<any>(`/api/checks/${id}`),
  deleteCheck: (id: number) => request<void>(`/api/checks/${id}`, { method: 'DELETE' }),
  settings: () => request<AppSettings>('/api/settings'),
  saveSettings: (body: AppSettings) => request<AppSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  buildProfile: () => request<{ profile: BuildProfile | null }>('/api/build-profile'),
  importBuildProfile: (url: string) => request<BuildImportResult>('/api/build-profile/import', { method: 'POST', body: JSON.stringify({ url }) }),
  saveBuildProfile: (body: BuildProfile) => request<{ profile: BuildProfile }>('/api/build-profile', { method: 'PUT', body: JSON.stringify(body) }),
  deleteBuildProfile: () => request<void>('/api/build-profile', { method: 'DELETE' }),
  buildProfiles: () => request<{profiles:BuildFitProfile[]}>('/api/build-profiles'),
  createCustomBuildProfile: (body:CustomBuildProfileInput) => request<{profile:BuildFitProfile}>('/api/build-profiles',{method:'POST',body:JSON.stringify(body)}),
  updateCustomBuildProfile: (id:string,body:CustomBuildProfileInput) => request<{profile:BuildFitProfile}>(`/api/build-profiles/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  deleteCustomBuildProfile: (id:string) => request<void>(`/api/build-profiles/${encodeURIComponent(id)}`,{method:'DELETE'}),
  raceReviews: () => request<{ reviews:RaceReview[] }>('/api/race-reviews'),
  addRaceReview: (body:Omit<RaceReview,'id'|'createdAt'>) => request<{ review:RaceReview }>('/api/race-reviews', { method:'POST', body:JSON.stringify(body) }),
  deleteRaceReview: (id:number) => request<void>(`/api/race-reviews/${id}`, { method:'DELETE' }),
  levelingSearch: (body:{guideUrl:string;level:number;league:string;maxPrice:number;equipment?:EquipmentSlotInput[]}) => request<LevelingSearchResult>('/api/leveling/search', { method:'POST', body:JSON.stringify(body) }),
  normalizeItem: (body:{text:string;league?:string;patch?:string}) => request<{item:NormalizedItem}>('/api/item/normalize',{method:'POST',body:JSON.stringify(body)}),
  craftingPlan: (body:{text:string;league?:string;goal:{description:string;minimumItemLevel?:number}}) => request<CraftPlan>('/api/crafting/plan',{method:'POST',body:JSON.stringify(body)}),
  knowledgeStatus: () => request<KnowledgeStatus>('/api/admin/knowledge-status'),
  buildDoctor: (body:{equipment:EquipmentSlotInput[];selectedBuildProfileId?:string}) => request<BuildDoctorResult>('/api/build-doctor',{method:'POST',body:JSON.stringify(body)}),
  characters: () => request<{characters:CharacterSummary[]}>('/api/characters'),
  character: (id:number) => request<CharacterDetail>(`/api/characters/${id}`),
  createCharacter: (body:CharacterInput) => request<{character:CharacterSummary}>('/api/characters',{method:'POST',body:JSON.stringify(body)}),
  updateCharacter: (id:number,body:CharacterInput) => request<{character:CharacterSummary}>(`/api/characters/${id}`,{method:'PUT',body:JSON.stringify(body)}),
  saveCharacterEquipment: (id:number,equipment:EquipmentSlotInput[]) => request<{equipment:EquipmentSlotInput[]}>(`/api/characters/${id}/equipment`,{method:'PUT',body:JSON.stringify({equipment})}),
  deleteCharacter: (id:number) => request<void>(`/api/characters/${id}`,{method:'DELETE'}),
  craftingState: (body:{text:string;league?:string;patch?:string;goal?:CraftGoal;estimatedValue?:number}) => request<{state:CraftingItemState;legalActions:ActionEvaluation[];currencies:CraftingCurrencyDef[]}>('/api/crafting/state',{method:'POST',body:JSON.stringify(body)}),
  craftingApply: (body:{state:CraftingItemState;currencyId:string}) => request<{state:CraftingItemState;evaluation:ActionEvaluation;legalActions:ActionEvaluation[]}>('/api/crafting/apply',{method:'POST',body:JSON.stringify(body)}),
  craftingCompare: (body:{state:CraftingItemState;sellValue?:number;buyPrice?:number}) => request<CraftComparison>('/api/crafting/compare',{method:'POST',body:JSON.stringify(body)}),
  craftingHistory: (characterId?:number) => request<{history:CraftingHistoryEntry[]}>(`/api/crafting/history${characterId?`?characterId=${characterId}`:''}`),
  confirmCraftingAction: (body:{characterId?:number;action:string;before:CraftingItemState;after:CraftingItemState;valueBefore?:number;valueAfter?:number}) => request<{id:number;gainLoss:number|null}>('/api/crafting/history',{method:'POST',body:JSON.stringify(body)}),
  marketHistory: (baseType:string,league:string) => request<MarketHistoryResult>(`/api/market-history?${new URLSearchParams({baseType,league})}`),
  patchVersions: () => request<{versions:CatalogVersion[]}>('/api/admin/patch/versions'),
  stagePatch: (body:{patch:string;dataVersion:string;source:string;modifiers:unknown[]}) => request<{version:CatalogVersion}>('/api/admin/patch/stage',{method:'POST',body:JSON.stringify(body)}),
  activatePatch: (id:number) => request<{version:CatalogVersion}>(`/api/admin/patch/${id}/activate`,{method:'POST'}),
  rollbackPatch: (id:number) => request<{version:CatalogVersion}>(`/api/admin/patch/${id}/rollback`,{method:'POST'}),
  poeOAuthStatus: () => request<PoeOAuthStatus>('/api/poe/oauth/status'),
  poeOAuthStart: () => request<{url:string}>('/api/poe/oauth/start'),
  poeCharacters: (connectionId:number) => request<{characters:PoeRemoteCharacter[]}>(`/api/poe/characters/${connectionId}`),
  importPoeCharacter: (connectionId:number,name:string) => request<{character:CharacterSummary;importedEquipment:number}>(`/api/poe/characters/${connectionId}/import`,{method:'POST',body:JSON.stringify({name})}),
};
