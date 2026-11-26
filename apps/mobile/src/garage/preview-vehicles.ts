import Storage from 'expo-sqlite/kv-store';
import type { GarageCar } from '../components/CarDetails';

export async function previewVehicles(owner: string): Promise<GarageCar[]> {
  const rows = JSON.parse((await Storage.getItem('garage-cars.v1.' + owner)) ?? '[]');
  if (!Array.isArray(rows)) throw new Error('Unable to load your saved garage.');
  return rows;
}
