export function isFounderR8(founder: boolean, label: string) {
  return founder && /^2010\s+Audi\s+R8\b/i.test(label.trim());
}
