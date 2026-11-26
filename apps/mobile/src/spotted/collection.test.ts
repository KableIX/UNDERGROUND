import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rename,
  copyFile,
  readdir,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

let folder: string;
vi.mock('expo-file-system', () => ({
  get documentDirectory() {
    return folder + '/';
  },
  makeDirectoryAsync: (path: string) => mkdir(path, { recursive: true }),
  readDirectoryAsync: readdir,
  readAsStringAsync: (path: string) => readFile(path, 'utf8'),
  writeAsStringAsync: writeFile,
  moveAsync: ({ from, to }: { from: string; to: string }) => rename(from, to),
  copyAsync: ({ from, to }: { from: string; to: string }) => copyFile(from, to),
  deleteAsync: (path: string) => rm(path, { force: true, recursive: true }),
}));
import { modelKey, readSpots, saveSpot } from './collection';
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'ug-album-'));
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});
it('reopens both sightings under one model even after the original photo is removed', async () => {
  const source = join(folder, 'image.jpg');
  await writeFile(source, 'test-photo');
  await saveSpot('member-1', source, 'Audi', 'R8 V10', 'Carmel');
  await saveSpot('member-1', source, 'AUDI', 'r8  V10', 'Santa Clara');
  await rm(source);
  const loaded = await readSpots('member-1');
  expect(loaded).toHaveLength(2);
  expect(new Set(loaded.map((s) => modelKey(s.make, s.model))).size).toBe(1);
  expect(await readFile(loaded[0].photo, 'utf8')).toBe('test-photo');
  expect(await readSpots('member-2')).toEqual([]);
  await expect(saveSpot('member-1', source, 'Audi', 'R8 V10', '')).rejects.toThrow();
  expect(await readSpots('member-1')).toHaveLength(2);
});
