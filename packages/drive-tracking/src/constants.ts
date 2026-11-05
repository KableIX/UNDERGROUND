/** Soft accuracy threshold (meters) — poor samples kept but skipped for distance. */
export const POOR_ACCURACY_M = 75;

/** Hard reject for distance if accuracy worse than this. */
export const MAX_USABLE_ACCURACY_M = 150;

/** Impossible ground speed between samples (m/s) ≈ 306 km/h. */
export const MAX_SEGMENT_SPEED_MPS = 85;

/** Gap that counts as GPS signal loss (ms). */
export const SIGNAL_LOSS_GAP_MS = 15_000;

/** Abandon interrupted local sessions after this idle window. */
export const INTERRUPT_ABANDON_MS = 6 * 60 * 60 * 1000;

/** Cap samples per session to protect battery + storage. */
export const MAX_SAMPLES_PER_SESSION = 50_000;

/** Foreground watch defaults — battery-conscious. */
export const FOREGROUND_TIME_INTERVAL_MS = 1_500;
export const FOREGROUND_DISTANCE_INTERVAL_M = 5;
