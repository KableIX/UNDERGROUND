const radians = Math.PI / 180;
const dayMs = 86_400_000;

// NOAA General Solar Position Calculations. Using UTC makes the offset depend
// only on longitude, including when previewing a route in another time zone.
export function solarElevation(latitude: number, longitude: number, timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const yearLength = Date.UTC(year + 1, 0, 1) - yearStart;
  const gamma = 2 * Math.PI * (timestamp - yearStart - dayMs / 2) / yearLength;
  const { sin, cos } = Math;
  const equationMinutes = 229.18 * (0.000075 + 0.001868 * cos(gamma) - 0.032077 * sin(gamma)
    - 0.014615 * cos(2 * gamma) - 0.040849 * sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * cos(gamma) + 0.070257 * sin(gamma)
    - 0.006758 * cos(2 * gamma) + 0.000907 * sin(2 * gamma)
    - 0.002697 * cos(3 * gamma) + 0.00148 * sin(3 * gamma);
  const minutesUTC = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const hourAngle = ((minutesUTC + equationMinutes) / 4 + longitude - 180) * radians;
  const lat = latitude * radians;
  const sineElevation = sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle);
  return Math.asin(Math.max(-1, Math.min(1, sineElevation))) / radians;
}

const stops = [
  { elevation: -9, color: [5, 16, 39], opacity: 0.49 },
  { elevation: -4, color: [47, 40, 78], opacity: 0.33 },
  { elevation:  1, color: [24, 27, 39], opacity: 0.33 },
  { elevation:  6, color: [18, 24, 33], opacity: 0.29 },
  { elevation: 12, color: [10, 17, 26], opacity: 0.25 },
];

export function mapLighting(latitude: number, longitude: number, timestamp: number) {
  const elevation = solarElevation(latitude, longitude, timestamp);
  const upper = stops.findIndex(stop => elevation <= stop.elevation);
  const bright = stops[upper < 0 ? stops.length - 1 : upper];
  const dim = upper > 0 ? stops[upper - 1] : bright;
  const fraction = dim === bright ? 0 : (elevation - dim.elevation) / (bright.elevation - dim.elevation);
  const interpolate = (a: number, b: number) => a + (b - a) * fraction;
  const rgb = dim.color.map((channel, i) => Math.round(interpolate(channel, bright.color[i])));
  const opacity = Number(interpolate(dim.opacity, bright.opacity).toFixed(3));
  const daylight = Math.max(0, Math.min(1, (elevation + 9) / 21));
  return {
    tint: 'rgba(' + rgb.join(',') + ',' + opacity + ')',
    interfaceStyle: elevation < -0.833 ? 'dark' as const : 'light' as const,
    daylight,
  };
}

export type MapLighting = ReturnType<typeof mapLighting>;
