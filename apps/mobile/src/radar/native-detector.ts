import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';
import {
  isUnidenHeartbeat,
  parseUnidenAlerts,
  unidenModel,
  UNIDEN_ALERTS,
  UNIDEN_DATA_SERVICE,
  UNIDEN_TELEMETRY,
  type AlertSnapshot,
} from './uniden-protocol';

export type DetectorCandidate = { id: string; name: string; model: 'uniden_r8' | 'uniden_r8w' };
export type DetectorCallbacks = {
  status: (message: string) => void;
  snapshot: (snapshot: AlertSnapshot) => void;
  heartbeat: () => void;
  disconnected: () => void;
};

function textValue(value: string | null): string {
  if (!value || value.length > 4096) return '';
  try {
    return String.fromCharCode(...new Uint8Array(decode(value))).replace(/\0+$/, '');
  } catch {
    return '';
  }
}

async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'Detector did not respond. Reconnect and accept the Bluetooth pairing prompt.',
              ),
            ),
          10_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function permissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const required =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const granted = await PermissionsAndroid.requestMultiple(required);
  if (required.some((p) => granted[p] !== PermissionsAndroid.RESULTS.GRANTED))
    throw new Error('Bluetooth permission is required to connect a detector.');
}

/** Only data-service reads and notifications. No settings, mute, or firmware writes. */
export class NativeDetector {
  private generation = 0;
  private device: Device | null = null;
  private subscriptions: Subscription[] = [];
  private scanTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private manager: BleManager,
    private callbacks: DetectorCallbacks,
  ) {}

  async scan(onDevice: (device: DetectorCandidate) => void): Promise<void> {
    this.disconnect();
    const generation = this.generation;
    await permissions();
    const state = await this.manager.state();
    if (generation !== this.generation) return;
    if (state !== 'PoweredOn')
      throw new Error('Turn on Bluetooth and allow UNDERGROUND access, then scan again.');
    this.callbacks.status('Scanning for R8 / R8w…');
    // Uniden advertisements do not always contain service UUIDs: filter names here,
    // then verify the data service and characteristics after connection.
    this.manager.startDeviceScan(null, null, (error, device) => {
      if (generation !== this.generation) return;
      if (error) {
        this.stopScan();
        this.callbacks.status('Bluetooth scan failed. Check permissions and retry.');
        return;
      }
      const name = device?.name ?? device?.localName ?? null;
      const model = unidenModel(name);
      if (device && name && model) onDevice({ id: device.id, name, model });
    });
    this.scanTimer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.stopScan();
      this.callbacks.status(
        'Scan finished. Select a detector, or enable its BT Pairing mode and scan again.',
      );
    }, 12_000);
  }

  private stopScan() {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = null;
    this.manager.stopDeviceScan();
  }

  async connect(candidate: DetectorCandidate): Promise<boolean> {
    this.disconnect();
    const generation = this.generation;
    this.callbacks.status(`Connecting to ${candidate.name}…`);
    let connected: Device | null = null;
    try {
      connected = await this.manager.connectToDevice(candidate.id, {
        timeout: 12_000,
        requestMTU: 185,
      });
      if (generation !== this.generation) {
        await connected.cancelConnection();
        return false;
      }
      this.device = connected;
      await bounded(connected.discoverAllServicesAndCharacteristics());
      const characteristics = await bounded(
        connected.characteristicsForService(UNIDEN_DATA_SERVICE),
      );
      if (
        ![UNIDEN_ALERTS, UNIDEN_TELEMETRY].every((uuid) =>
          characteristics.some(
            (c) => c.uuid.toLowerCase() === uuid && c.isReadable && c.isNotifiable,
          ),
        )
      ) {
        throw new Error('This detector firmware does not expose the supported alert feed.');
      }
      if (generation !== this.generation) return false;
      this.subscriptions.push(
        connected.onDisconnected(() => {
          if (generation !== this.generation) return;
          this.disconnect();
          this.callbacks.status('Detector disconnected. Reconnect to resume.');
        }),
      );
      let alertsReceived = 0;
      let heartbeatReceived = 0;
      const accept = (kind: 'alerts' | 'heartbeat', value: string | null) => {
        if (generation !== this.generation) return;
        const packet = textValue(value);
        if (kind === 'alerts') this.callbacks.snapshot(parseUnidenAlerts(packet));
        else if (isUnidenHeartbeat(packet)) this.callbacks.heartbeat();
      };
      for (const [uuid, kind] of [
        [UNIDEN_ALERTS, 'alerts'],
        [UNIDEN_TELEMETRY, 'heartbeat'],
      ] as const) {
        this.subscriptions.push(
          connected.monitorCharacteristicForService(UNIDEN_DATA_SERVICE, uuid, (error, c) => {
            if (generation !== this.generation) return;
            if (error) {
              this.disconnect();
              this.callbacks.status('Detector feed interrupted. Reconnect to resume.');
              return;
            }
            if (kind === 'alerts') alertsReceived += 1;
            else heartbeatReceived += 1;
            accept(kind, c?.value ?? null);
          }),
        );
      }
      // Get initial state, without allowing an older read to overwrite a newer notification.
      const a = alertsReceived;
      const h = heartbeatReceived;
      const initial = await bounded(
        Promise.all([
          connected.readCharacteristicForService(UNIDEN_DATA_SERVICE, UNIDEN_ALERTS),
          connected.readCharacteristicForService(UNIDEN_DATA_SERVICE, UNIDEN_TELEMETRY),
        ]),
      );
      if (generation !== this.generation) return false;
      if (a === alertsReceived) accept('alerts', initial[0]!.value);
      if (h === heartbeatReceived) accept('heartbeat', initial[1]!.value);
      this.callbacks.status(`${candidate.name} connected`);
      return true;
    } catch (error) {
      if (generation === this.generation) {
        this.disconnect();
        throw new Error(error instanceof Error ? error.message : 'Detector connection failed.');
      }
      return false;
    }
  }

  disconnect() {
    this.generation += 1;
    this.stopScan();
    for (const sub of this.subscriptions) sub.remove();
    this.subscriptions = [];
    const device = this.device;
    this.device = null;
    if (device) void device.cancelConnection().catch(() => undefined);
    this.callbacks.disconnected();
  }

  destroy() {
    this.disconnect();
    void this.manager.destroy().catch(() => undefined);
  }
}

export function createNativeDetector(callbacks: DetectorCallbacks): NativeDetector {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android')
    throw new Error('Bluetooth detector connections require the iPhone or Android app.');
  if (!NativeModules.BlePlx)
    throw new Error('Install the new UNDERGROUND development build to enable Bluetooth.');
  try {
    // Keep older development binaries usable; do not import a missing native module at startup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ble = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    return new NativeDetector(new ble.BleManager(), callbacks);
  } catch {
    throw new Error('Bluetooth is unavailable in this app build.');
  }
}
