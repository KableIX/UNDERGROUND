export type Camera = { yaw: number; pitch: number; zoom: number };
export const homeCamera: Camera = { yaw: 0.91, pitch: 0.17, zoom: 1 };
export const limit = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
