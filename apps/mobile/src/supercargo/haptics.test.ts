import { describe, expect, it, vi } from 'vitest';
import { hapticPlan, playHaptics, type HapticsModule } from './haptics';

function fake(): HapticsModule & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    impactAsync: async (s: never) => void calls.push('impact:' + String(s)),
    notificationAsync: async (t: never) => void calls.push('notify:' + String(t)),
    selectionAsync: async () => void calls.push('select'),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  };
}

describe('hapticPlan', () => {
  it('lock is one crisp tap, shutter one medium tap', () => {
    expect(hapticPlan('lock')).toEqual([{ kind: 'impact', weight: 'rigid' }]);
    expect(hapticPlan('shutter')).toEqual([{ kind: 'impact', weight: 'medium' }]);
  });
  it('reveal grows with rarity: matte light, sheen medium, holo heavy double', () => {
    const weights = (t: Parameters<typeof hapticPlan>[1]) => hapticPlan('reveal', t).filter((s) => s.kind === 'impact').map((s) => (s as { weight: string }).weight);
    expect(weights('open')).toEqual(['light']);
    expect(weights('limited')).toEqual(['light']);
    expect(weights('numbered')).toEqual(['medium']);
    expect(weights('allocated')).toEqual(['medium']);
    expect(weights('atelier')).toEqual(['heavy', 'heavy']);
    expect(weights('singular')).toEqual(['heavy', 'heavy']);
  });
  it('card lands with a success; foil cards add a soft second beat', () => {
    expect(hapticPlan('card', 'open')).toEqual([{ kind: 'notify', type: 'success' }]);
    expect(hapticPlan('card', 'atelier').at(-1)).toEqual({ kind: 'impact', weight: 'soft' });
  });
});

describe('playHaptics', () => {
  it('does nothing without the module', async () => {
    await expect(playHaptics(hapticPlan('reveal', 'atelier'), null)).resolves.toBeUndefined();
  });
  it('plays steps in order and waits between them', async () => {
    const h = fake();
    const wait = vi.fn(async () => undefined);
    await playHaptics(hapticPlan('reveal', 'singular'), h, wait);
    expect(h.calls).toEqual(['impact:heavy', 'impact:heavy', 'notify:success']);
    expect(wait).toHaveBeenCalledTimes(2);
  });
  it('swallows a failing haptic engine', async () => {
    const h = fake();
    h.impactAsync = async () => {
      throw new Error('no taptic engine');
    };
    await expect(playHaptics(hapticPlan('lock'), h)).resolves.toBeUndefined();
  });
});
