import { restoreSettings, type Settings } from './page';
async function store() {
  return (require('expo-sqlite/kv-store') as typeof import('expo-sqlite/kv-store')).default;
}
export async function putDraft(id: string, revision: number, data: Settings) {
  await (await store()).setItem('layout-draft:' + id, JSON.stringify({ revision, data }));
}
export async function getDraft(id: string, revision: number): Promise<Settings | null> {
  const value = await (await store()).getItem('layout-draft:' + id);
  if (!value) return null;
  const saved = JSON.parse(value);
  return saved.revision === revision && saved.data ? restoreSettings(saved.data.displayName, saved.data) : null;
}
export async function clearDraft(id: string) {
  await (await store()).removeItem('layout-draft:' + id);
}
