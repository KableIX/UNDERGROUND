import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BleManager } from 'react-native-ble-plx';
import { NativeDetector } from './native-detector';
import { UNIDEN_ALERTS, UNIDEN_DATA_SERVICE, UNIDEN_TELEMETRY } from './uniden-protocol';

vi.mock('react-native', () => ({
  NativeModules: { BlePlx: {} },
  PermissionsAndroid: {},
  Platform: { OS: 'ios' },
}));
const encode = (text: string) => Buffer.from(text).toString('base64');
function fixture() {
  const notifications = new Map<string, (error: unknown, c?: { value: string }) => void>();
  const removed = vi.fn();
  const device = {
    cancelConnection: vi.fn(async () => undefined),
    discoverAllServicesAndCharacteristics: vi.fn(async () => undefined),
    characteristicsForService: vi.fn(async () =>
      [UNIDEN_ALERTS, UNIDEN_TELEMETRY].map((uuid) => ({
        uuid,
        isReadable: true,
        isNotifiable: true,
      })),
    ),
    onDisconnected: vi.fn(() => ({ remove: removed })),
    monitorCharacteristicForService: vi.fn((_service, uuid, callback) => {
      notifications.set(uuid, callback);
      return { remove: removed };
    }),
    readCharacteristicForService: vi.fn(async (_service, uuid) => ({
      value: encode(uuid === UNIDEN_ALERTS ? '0&0&0&0' : '12.1&0&W,0,193,C&0&12&D&D'),
    })),
  };
  const manager = {
    connectToDevice: vi.fn(async () => device),
    stopDeviceScan: vi.fn(),
    destroy: vi.fn(async () => undefined),
  };
  const callbacks = {
    status: vi.fn(),
    snapshot: vi.fn(),
    heartbeat: vi.fn(),
    disconnected: vi.fn(),
  };
  return {
    device,
    manager,
    callbacks,
    notifications,
    removed,
    detector: new NativeDetector(manager as unknown as BleManager, callbacks),
  };
}
const candidate = { id: 'test-device', name: 'R8W@TEST', model: 'uniden_r8w' as const };
afterEach(() => vi.useRealTimers());
describe('detector lifecycle', () => {
  it('reads and subscribes only to the two data characteristics', async () => {
    const f = fixture();
    expect(await f.detector.connect(candidate)).toBe(true);
    expect(f.device.readCharacteristicForService.mock.calls).toEqual([
      [UNIDEN_DATA_SERVICE, UNIDEN_ALERTS],
      [UNIDEN_DATA_SERVICE, UNIDEN_TELEMETRY],
    ]);
    expect(f.callbacks.snapshot).toHaveBeenLastCalledWith({ recognized: true, alerts: [] });
    f.notifications.get(UNIDEN_ALERTS)!(null, { value: encode('bad') });
    expect(f.callbacks.snapshot).toHaveBeenLastCalledWith({ recognized: false, alerts: [] });
    f.detector.destroy();
    expect(f.removed).toHaveBeenCalledTimes(3);
  });
  it('rejects incompatible services before reading', async () => {
    const f = fixture();
    f.device.characteristicsForService.mockResolvedValue([]);
    await expect(f.detector.connect(candidate)).rejects.toThrow('supported alert feed');
    expect(f.device.readCharacteristicForService).not.toHaveBeenCalled();
    expect(f.device.cancelConnection).toHaveBeenCalled();
  });
  it('cancels a late connection after session stop and ignores late notifications', async () => {
    const f = fixture();
    let resolve!: (value: typeof f.device) => void;
    f.manager.connectToDevice.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const connection = f.detector.connect(candidate);
    f.detector.disconnect();
    resolve(f.device);
    expect(await connection).toBe(false);
    expect(f.device.cancelConnection).toHaveBeenCalled();
    expect(f.device.readCharacteristicForService).not.toHaveBeenCalled();
  });
  it('tears down an interrupted feed and rejects callbacks from the old connection', async () => {
    const f = fixture();
    await f.detector.connect(candidate);
    f.callbacks.snapshot.mockClear();
    f.notifications.get(UNIDEN_ALERTS)!(new Error('lost'));
    f.notifications.get(UNIDEN_ALERTS)!(null, { value: encode('0&0&0&0') });
    expect(f.callbacks.snapshot).not.toHaveBeenCalled();
    expect(f.callbacks.status).toHaveBeenLastCalledWith(
      'Detector feed interrupted. Reconnect to resume.',
    );
  });
  it('times out a hung GATT discovery and releases the device', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.device.discoverAllServicesAndCharacteristics.mockImplementation(
      () => new Promise(() => undefined),
    );
    const connection = expect(f.detector.connect(candidate)).rejects.toThrow('did not respond');
    await vi.advanceTimersByTimeAsync(10_001);
    await connection;
    expect(f.device.cancelConnection).toHaveBeenCalled();
  });
});
