import * as FS from 'expo-file-system';
import { z } from 'zod';

const record = z.object({
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(100),
  place: z.string().trim().max(120),
  date: z.string().datetime(),
});
export type Sighting = z.infer<typeof record> & { id: string; photo: string };

export function modelKey(make: string, model: string) {
  return JSON.stringify(
    [make, model].map((s) =>
      s
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase(),
    ),
  );
}

function album(member: string) {
  if (!FS.documentDirectory || !/^[a-z0-9_-]+$/i.test(member))
    throw new Error('Storage unavailable');
  return FS.documentDirectory + 'spotted/' + member + '/';
}

export async function readSpots(member: string): Promise<Sighting[]> {
  const root = album(member);
  await FS.makeDirectoryAsync(root, { intermediates: true });
  const ids = (await FS.readDirectoryAsync(root)).filter((id) => /^spot-[a-z0-9-]+$/.test(id));
  const spots = await Promise.all(
    ids.map(async (id) => {
      const folder = root + id + '/';
      const data = record.parse(JSON.parse(await FS.readAsStringAsync(folder + 'card.json')));
      return { ...data, id, photo: folder + 'photo.jpg' };
    }),
  );
  return spots.sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveSpot(
  member: string,
  photo: string,
  make: string,
  model: string,
  place: string,
): Promise<Sighting> {
  const data = record.parse({ make, model, place, date: new Date().toISOString() });
  const root = album(member);
  const id = 'spot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const stage = root + '.' + id;
  const destination = root + id;
  await FS.makeDirectoryAsync(stage, { intermediates: true });
  try {
    await FS.copyAsync({ from: photo, to: stage + '/photo.jpg' });
    await FS.writeAsStringAsync(stage + '/card.json', JSON.stringify(data));
    await FS.moveAsync({ from: stage, to: destination });
  } catch (error) {
    await FS.deleteAsync(stage, { idempotent: true }).catch(() => {});
    throw error;
  }
  return { ...data, id, photo: destination + '/photo.jpg' };
}

export const v10Icons = [
  ['Audi', 'R8 V10'],
  ['Lamborghini', 'Gallardo Superleggera'],
  ['Lamborghini', 'Huracán STO'],
  ['Porsche', 'Carrera GT'],
] as const;
