import Storage from 'expo-sqlite/kv-store';
import { readBuilds, type GarageBuilds } from './builds';
const key = (member: string) => 'garage-design.v1.' + member;
export const loadBuilds = async (member: string) => readBuilds(await Storage.getItem(key(member)));
export const saveBuilds = (member: string, value: GarageBuilds) =>
  Storage.setItem(key(member), JSON.stringify(value));
