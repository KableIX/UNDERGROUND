import type {
  DriveSession,
  GpsSample,
  SessionEngineState,
  SignalEvent,
  TripStore,
  TripSummary,
} from '@underground/drive-tracking';
import { toTripSummary } from '@underground/drive-tracking';

type SqliteDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  closeAsync?: () => Promise<void>;
};

type ExpoSqliteModule = {
  openDatabaseAsync(name: string): Promise<SqliteDatabase>;
};

/**
 * Local SQLite trip store (Expo 52 `expo-sqlite`).
 * Private by default — no network. Survives offline.
 * Lazily loads the native module so Jest/Vitest Node tests can use MemoryTripStore.
 */
export class SqliteTripStore implements TripStore {
  private db: SqliteDatabase | null = null;
  private readonly dbName: string;

  constructor(dbName = 'underground_trips.db') {
    this.dbName = dbName;
  }

  private async database(): Promise<SqliteDatabase> {
    if (this.db) return this.db;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SQLite = require('expo-sqlite') as ExpoSqliteModule;
    const db = await SQLite.openDatabaseAsync(this.dbName);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS drive_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        started_at_ms INTEGER,
        updated_at_ms INTEGER NOT NULL,
        ended_at_ms INTEGER
      );
      CREATE TABLE IF NOT EXISTS gps_samples (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        timestamp_ms INTEGER NOT NULL,
        payload TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES drive_sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_gps_session_time
        ON gps_samples(session_id, timestamp_ms);
      CREATE TABLE IF NOT EXISTS signal_events (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        at_ms INTEGER NOT NULL,
        payload TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES drive_sessions(id) ON DELETE CASCADE
      );
    `);
    this.db = db;
    return db;
  }

  async saveSession(state: SessionEngineState): Promise<void> {
    const db = await this.database();
    const { session, samples, events, segmentStartedAtMs, privateSpeedMps } = state;
    // Speed stays on device in the session blob only — never logged.
    const payload = JSON.stringify({
      session,
      segmentStartedAtMs,
      privateSpeedMps,
    });
    await db.runAsync(
      `INSERT INTO drive_sessions (id, status, payload, started_at_ms, updated_at_ms, ended_at_ms)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         payload = excluded.payload,
         started_at_ms = excluded.started_at_ms,
         updated_at_ms = excluded.updated_at_ms,
         ended_at_ms = excluded.ended_at_ms`,
      session.id,
      session.status,
      payload,
      session.startedAtMs,
      session.updatedAtMs,
      session.endedAtMs,
    );
    await db.runAsync(`DELETE FROM gps_samples WHERE session_id = ?`, session.id);
    for (const sample of samples) {
      await db.runAsync(
        `INSERT INTO gps_samples (id, session_id, timestamp_ms, payload) VALUES (?, ?, ?, ?)`,
        sample.id,
        session.id,
        sample.timestampMs,
        JSON.stringify(sample),
      );
    }
    await db.runAsync(`DELETE FROM signal_events WHERE session_id = ?`, session.id);
    for (const event of events) {
      await db.runAsync(
        `INSERT INTO signal_events (id, session_id, at_ms, payload) VALUES (?, ?, ?, ?)`,
        event.id,
        session.id,
        event.atMs,
        JSON.stringify(event),
      );
    }
  }

  async getSession(sessionId: string): Promise<SessionEngineState | null> {
    const db = await this.database();
    const row = await db.getFirstAsync<{ payload: string }>(
      `SELECT payload FROM drive_sessions WHERE id = ?`,
      sessionId,
    );
    if (!row) return null;
    const meta = JSON.parse(row.payload) as {
      session: DriveSession;
      segmentStartedAtMs: number | null;
      privateSpeedMps: number | null;
    };
    const sampleRows = await db.getAllAsync<{ payload: string }>(
      `SELECT payload FROM gps_samples WHERE session_id = ? ORDER BY timestamp_ms ASC`,
      sessionId,
    );
    const eventRows = await db.getAllAsync<{ payload: string }>(
      `SELECT payload FROM signal_events WHERE session_id = ? ORDER BY at_ms ASC`,
      sessionId,
    );
    return {
      session: meta.session,
      segmentStartedAtMs: meta.segmentStartedAtMs,
      privateSpeedMps: meta.privateSpeedMps,
      samples: sampleRows.map(r => JSON.parse(r.payload) as GpsSample),
      events: eventRows.map(r => JSON.parse(r.payload) as SignalEvent),
    };
  }

  async listTripSummaries(): Promise<TripSummary[]> {
    const db = await this.database();
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM drive_sessions WHERE started_at_ms IS NOT NULL ORDER BY started_at_ms DESC`,
    );
    const out: TripSummary[] = [];
    for (const row of rows) {
      const state = await this.getSession(row.id);
      if (!state) continue;
      const summary = toTripSummary(state);
      if (summary) out.push(summary);
    }
    return out;
  }

  async deleteTrip(sessionId: string): Promise<void> {
    const db = await this.database();
    await db.runAsync(`DELETE FROM gps_samples WHERE session_id = ?`, sessionId);
    await db.runAsync(`DELETE FROM signal_events WHERE session_id = ?`, sessionId);
    await db.runAsync(`DELETE FROM drive_sessions WHERE id = ?`, sessionId);
  }

  async findRecoverableSession(): Promise<SessionEngineState | null> {
    const db = await this.database();
    const row = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM drive_sessions
       WHERE status IN ('interrupted', 'paused', 'recording')
       ORDER BY updated_at_ms DESC LIMIT 1`,
    );
    if (!row) return null;
    return this.getSession(row.id);
  }

  async appendSamples(sessionId: string, samples: readonly GpsSample[]): Promise<void> {
    const db = await this.database();
    for (const sample of samples) {
      await db.runAsync(
        `INSERT OR REPLACE INTO gps_samples (id, session_id, timestamp_ms, payload) VALUES (?, ?, ?, ?)`,
        sample.id,
        sessionId,
        sample.timestampMs,
        JSON.stringify(sample),
      );
    }
  }

  async appendEvents(sessionId: string, events: readonly SignalEvent[]): Promise<void> {
    const db = await this.database();
    for (const event of events) {
      await db.runAsync(
        `INSERT OR REPLACE INTO signal_events (id, session_id, at_ms, payload) VALUES (?, ?, ?, ?)`,
        event.id,
        sessionId,
        event.atMs,
        JSON.stringify(event),
      );
    }
  }

  async updateSessionMeta(session: DriveSession): Promise<void> {
    const existing = await this.getSession(session.id);
    if (!existing) return;
    await this.saveSession({ ...existing, session });
  }
}

let singleton: SqliteTripStore | null = null;

export function getSqliteTripStore(): SqliteTripStore {
  if (!singleton) singleton = new SqliteTripStore();
  return singleton;
}
