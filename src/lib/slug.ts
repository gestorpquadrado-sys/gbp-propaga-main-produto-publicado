export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80) || 'empresa';
}

export function uniqueSlug(base: string, suffix?: string): string {
  const slug = slugify(base);
  if (!suffix) return slug;
  return `${slug}-${slugify(suffix).slice(0, 12)}`;
}
