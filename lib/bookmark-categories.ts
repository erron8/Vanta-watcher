export const categoryOptions = {
  deposits: ['Quote only', 'Double sided', 'Meme only'],
  timezone: ['NYC', 'London', 'Asia'],
  hold: ['Degen', 'Multi'],
  range: ['Tight', 'Normal', 'Wide'],
} as const;

export type BookmarkCategories = {
  [K in keyof typeof categoryOptions]: (typeof categoryOptions)[K][number] | null;
};

export const emptyCategories: BookmarkCategories = {
  deposits: null, timezone: null, hold: null, range: null,
};

export function parseCategories(value: unknown): BookmarkCategories | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !(key in categoryOptions))) return null;
  const result = { ...emptyCategories };
  for (const key of Object.keys(categoryOptions) as (keyof BookmarkCategories)[]) {
    const choice = record[key];
    if (choice !== undefined && choice !== null && !(categoryOptions[key] as readonly unknown[]).includes(choice)) return null;
    (result as Record<string, unknown>)[key] = choice ?? null;
  }
  return result;
}

export function readCategories(json: string): BookmarkCategories {
  try { return parseCategories(JSON.parse(json)) ?? { ...emptyCategories }; }
  catch { return { ...emptyCategories }; }
}
