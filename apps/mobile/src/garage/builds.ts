export const cars = { r8: 'Audi R8 V10', sto: 'Lamborghini Huracán STO' } as const;
export const paints = {
  black: { name: 'Obsidian', rgb: [30, 32, 36] },
  white: { name: 'Pearl white', rgb: [215, 218, 216] },
  red: { name: 'Rosso', rgb: [192, 31, 41] },
  blue: { name: 'Glacier blue', rgb: [30, 134, 195] },
  green: { name: 'Verde', rgb: [105, 181, 34] },
  orange: { name: 'Arancio', rgb: [236, 99, 25] },
} as const;
export const aero = {
  factory: 'Factory',
  splitter: 'Front splitter',
  track: 'Track package',
} as const;
export const carbon = {
  factory: 'Factory finish',
  hood: 'Carbon hood',
  lower: 'Carbon lower trim',
} as const;
export const wheels = {
  factory: 'Factory wheels',
  five: 'Five-spoke',
  split: 'Split-spoke',
} as const;
export type Car = keyof typeof cars;
export type Spec = {
  paint: keyof typeof paints;
  aero: keyof typeof aero;
  carbon: keyof typeof carbon;
  wheels: keyof typeof wheels;
};
export type GarageBuilds = { car: Car; builds: Record<Car, Spec> };
const factory: Spec = { paint: 'black', aero: 'factory', carbon: 'factory', wheels: 'factory' };
export const defaultBuilds: GarageBuilds = {
  car: 'r8',
  builds: { r8: factory, sto: { ...factory, paint: 'blue' } },
};
function choice<T extends string>(input: unknown, choices: Record<T, unknown>, fallback: T): T {
  return typeof input === 'string' && Object.prototype.hasOwnProperty.call(choices, input)
    ? (input as T)
    : fallback;
}
export function readBuilds(raw: string | null): GarageBuilds {
  let val: { car?: unknown; builds?: Partial<Record<Car, Partial<Spec>>> } | null;
  try {
    val = JSON.parse(raw ?? 'null');
  } catch {
    return defaultBuilds;
  }
  function config(car: Car): Spec {
    const v = val?.builds?.[car],
      d = defaultBuilds.builds[car];
    return {
      paint: choice(v?.paint, paints, d.paint),
      aero: choice(v?.aero, aero, d.aero),
      carbon: choice(v?.carbon, carbon, d.carbon),
      wheels: choice(v?.wheels, wheels, d.wheels),
    };
  }
  return { car: choice(val?.car, cars, 'r8'), builds: { r8: config('r8'), sto: config('sto') } };
}
