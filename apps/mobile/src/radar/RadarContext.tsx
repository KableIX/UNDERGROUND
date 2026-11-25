import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import {
  freshRadarFix,
  nearbyRadarReports,
  type ClubRadarReport,
  type RadarConfirmation,
  type RadarFix,
} from '@underground/domain';
import { useSession } from '../session/SessionContext';
import {
  createNativeDetector,
  type DetectorCandidate,
  type NativeDetector,
} from './native-detector';
import {
  confirmClubRadar,
  loadClubRadar,
  loadRadarClubs,
  submitClubRadar,
} from './club-radar-client';
import { RadarShareGate } from './share-gate';
import type { AlertSnapshot } from './uniden-protocol';

type Club = { id: string; name: string };
type RadarState = {
  active: boolean;
  status: string;
  locationStatus: string;
  error: string | null;
  notice: string | null;
  devices: DetectorCandidate[];
  model: DetectorCandidate['model'] | null;
  snapshot: AlertSnapshot | null;
  heartbeatAt: number;
  fix: RadarFix | null;
  clubs: Club[];
  clubId: string | null;
  shareDetector: boolean;
  reports: ClubRadarReport[];
  confirmations: RadarConfirmation[];
  feedStatus: 'off' | 'loading' | 'live' | 'unavailable';
};
const initial = (): RadarState => ({
  active: false,
  status: 'Detector disconnected',
  locationStatus: 'Location off',
  error: null,
  notice: null,
  devices: [],
  model: null,
  snapshot: null,
  heartbeatAt: 0,
  fix: null,
  clubs: [],
  clubId: null,
  shareDetector: false,
  reports: [],
  confirmations: [],
  feedStatus: 'off',
});
type RadarApi = RadarState & {
  healthy: boolean;
  nearby: ClubRadarReport[];
  now: number;
  start: () => Promise<void>;
  stop: () => void;
  scan: () => Promise<void>;
  connect: (device: DetectorCandidate) => Promise<void>;
  selectClub: (clubId: string | null) => void;
  setShareDetector: (enabled: boolean) => void;
  report: (kind: 'radar' | 'police_visual') => Promise<void>;
  confirm: (id: string, vote: 'still_present' | 'gone') => Promise<void>;
};
const Context = createContext<RadarApi | null>(null);

// An idempotency key, not an authentication token or device identifier.
function eventId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

export function RadarProvider({ children }: { children: ReactNode }) {
  const { state: session, liveAuthConfigured } = useSession();
  const memberId = session.status === 'authenticated' ? session.member.memberId : null;
  const live =
    memberId !== null &&
    liveAuthConfigured &&
    session.status === 'authenticated' &&
    session.via !== 'dev_bypass';
  const [state, setState] = useState<RadarState>(initial);
  const current = useRef(state);
  const [now, setNow] = useState(Date.now());
  const epoch = useRef(0);
  const detector = useRef<NativeDetector | null>(null);
  const location = useRef<{ remove: () => void } | null>(null);
  const gate = useRef(new RadarShareGate());
  const sharing = useRef(false);
  const patch = useCallback((change: Partial<RadarState>) => {
    current.current = { ...current.current, ...change };
    setState(current.current);
  }, []);

  const stop = useCallback(() => {
    epoch.current += 1;
    location.current?.remove();
    location.current = null;
    detector.current?.destroy();
    detector.current = null;
    gate.current = new RadarShareGate();
    sharing.current = false;
    current.current = initial();
    setState(current.current);
  }, []);

  useEffect(() => {
    stop();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') stop();
    });
    return () => {
      sub.remove();
      stop();
    };
  }, [memberId, live, stop]);

  useEffect(() => {
    if (!state.active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.active]);

  const start = useCallback(async () => {
    if (current.current.active || !memberId || AppState.currentState !== 'active') return;
    const generation = ++epoch.current;
    patch({ active: true, error: null, locationStatus: 'Requesting location…' });
    if (live)
      void loadRadarClubs(memberId)
        .then((clubs) => {
          if (generation === epoch.current) patch({ clubs });
        })
        .catch(() => {
          if (generation === epoch.current)
            patch({
              error: 'Could not load club memberships. Local detector alerts remain available.',
            });
        });
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (generation !== epoch.current) return;
      if (permission.status !== 'granted') {
        patch({ locationStatus: 'Location denied · report sharing unavailable' });
        return;
      }
      patch({ locationStatus: 'Waiting for a fresh GPS fix…' });
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (fix) => {
          if (generation !== epoch.current) return;
          const value = freshRadarFix(
            {
              latitude: fix.coords.latitude,
              longitude: fix.coords.longitude,
              accuracyM: fix.coords.accuracy,
              timestamp: fix.timestamp,
            },
            Date.now(),
          );
          patch({
            fix: value,
            locationStatus: value
              ? `GPS accuracy ±${Math.round(value.accuracyM)} m`
              : 'GPS accuracy insufficient · sharing paused',
          });
        },
      );
      if (generation !== epoch.current) sub.remove();
      else location.current = sub;
    } catch {
      if (generation === epoch.current)
        patch({ locationStatus: 'Location unavailable · report sharing paused' });
    }
  }, [memberId, live, patch]);

  const autoShare = useCallback(() => {
    const s = current.current;
    const time = Date.now();
    if (!s.active || !live || sharing.current || AppState.currentState !== 'active') return;
    const alert = gate.current.take({
      enabled: s.shareDetector,
      clubId: s.clubId,
      source: s.model,
      recognized: s.snapshot?.recognized ?? false,
      healthy: time - s.heartbeatAt < 6000,
      alerts: s.snapshot?.alerts ?? [],
      fix: s.fix,
      now: time,
    });
    if (!alert || !s.clubId || !s.fix || !s.model) return;
    const generation = epoch.current;
    sharing.current = true;
    void submitClubRadar({
      clubId: s.clubId,
      eventId: eventId(),
      kind: 'radar',
      source: s.model,
      fix: s.fix,
      alert,
    })
      .catch((error) => {
        if (generation === epoch.current)
          patch({ error: error instanceof Error ? error.message : 'Report was not shared.' });
      })
      .finally(() => {
        if (generation === epoch.current) sharing.current = false;
      });
  }, [live, patch]);

  const getDetector = useCallback(() => {
    if (!detector.current)
      detector.current = createNativeDetector({
        status: (status) => patch({ status }),
        snapshot: (snapshot) => {
          patch({ snapshot });
          autoShare();
        },
        heartbeat: () => {
          patch({ heartbeatAt: Date.now() });
          autoShare();
        },
        disconnected: () => patch({ model: null, snapshot: null, heartbeatAt: 0 }),
      });
    return detector.current;
  }, [patch, autoShare]);

  const scan = useCallback(async () => {
    await start();
    if (!current.current.active) return;
    patch({ devices: [], error: null });
    try {
      await getDetector().scan((device) => {
        const devices = current.current.devices.filter((d) => d.id !== device.id);
        patch({ devices: [...devices, device].slice(0, 20) });
      });
    } catch (error) {
      patch({ status: error instanceof Error ? error.message : 'Bluetooth unavailable.' });
    }
  }, [getDetector, patch, start]);

  const connect = useCallback(
    async (device: DetectorCandidate) => {
      if (!current.current.active) return;
      try {
        if (await getDetector().connect(device)) {
          patch({ model: device.model, devices: [] });
          autoShare();
        }
      } catch (error) {
        patch({ status: error instanceof Error ? error.message : 'Connection failed.' });
      }
    },
    [autoShare, getDetector, patch],
  );

  useEffect(() => {
    if (!state.active || !state.clubId || !live) return;
    const clubId = state.clubId;
    const generation = epoch.current;
    let cancelled = false;
    let running = false;
    patch({ feedStatus: 'loading' });
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const result = await loadClubRadar(clubId);
        if (!cancelled && generation === epoch.current && current.current.clubId === clubId)
          patch({ ...result, feedStatus: 'live' });
      } catch {
        if (!cancelled && generation === epoch.current && current.current.clubId === clubId)
          patch({ reports: [], confirmations: [], feedStatus: 'unavailable' });
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state.active, state.clubId, live, patch]);

  const selectClub = useCallback(
    (clubId: string | null) => {
      if (clubId && !current.current.clubs.some((c) => c.id === clubId)) return;
      patch({
        clubId,
        shareDetector: false,
        reports: [],
        confirmations: [],
        error: null,
        notice: null,
        feedStatus: clubId ? 'loading' : 'off',
      });
    },
    [patch],
  );

  const setShareDetector = useCallback(
    (enabled: boolean) => {
      patch({
        shareDetector: enabled && live && current.current.active && Boolean(current.current.clubId),
        error: null,
      });
      // Only subsequent observations can be shared; toggling does not replay history.
    },
    [live, patch],
  );

  const report = useCallback(
    async (kind: 'radar' | 'police_visual') => {
      const s = current.current;
      const fix = freshRadarFix(s.fix, Date.now());
      if (!s.active || !live || !s.clubId || !fix || AppState.currentState !== 'active') {
        patch({ error: 'Choose a club and wait for a fresh GPS fix before reporting.' });
        return;
      }
      const generation = epoch.current;
      try {
        await submitClubRadar({
          clubId: s.clubId,
          eventId: eventId(),
          kind,
          source: 'manual',
          fix,
        });
        if (generation === epoch.current && current.current.clubId === s.clubId)
          patch({ error: null, notice: 'Report shared with your selected club.' });
      } catch (error) {
        if (generation === epoch.current)
          patch({ error: error instanceof Error ? error.message : 'Report was not shared.' });
      }
    },
    [live, patch],
  );

  const confirm = useCallback(
    async (id: string, vote: 'still_present' | 'gone') => {
      const s = current.current;
      if (
        !s.active ||
        !live ||
        !s.reports.some(
          (r) => r.id === id && r.club_id === s.clubId && Date.parse(r.expires_at) > Date.now(),
        )
      )
        return;
      const generation = epoch.current;
      try {
        await confirmClubRadar(id, vote);
        if (generation === epoch.current && current.current.clubId === s.clubId)
          patch({
            error: null,
            confirmations: [
              ...current.current.confirmations.filter(
                (c) => c.report_id !== id || c.member_id !== memberId,
              ),
              { report_id: id, member_id: memberId!, vote },
            ],
          });
      } catch (error) {
        if (generation === epoch.current)
          patch({ error: error instanceof Error ? error.message : 'Confirmation failed.' });
      }
    },
    [live, memberId, patch],
  );

  return (
    <Context.Provider
      value={{
        ...state,
        now,
        healthy: Boolean(state.model) && now - state.heartbeatAt < 6000,
        nearby: nearbyRadarReports(state.reports, state.fix, now),
        start,
        stop,
        scan,
        connect,
        selectClub,
        setShareDetector,
        report,
        confirm,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useRadar(): RadarApi {
  const value = useContext(Context);
  if (!value) throw new Error('useRadar requires RadarProvider');
  return value;
}
