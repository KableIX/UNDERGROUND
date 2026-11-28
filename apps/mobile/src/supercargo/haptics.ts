import type { SupercargoTier } from '@underground/domain';
import { finishFor } from './scan';

/*
 * What the phone does in the hand. Pure: the plan is data, so it can be tested and
 * so a build without expo-haptics simply has nothing to play. Rare tiers feel
 * heavier on reveal; a common find stays light.
 */

export type HapticEvent = 'shutter' | 'lock' | 'reveal' | 'card' | 'select';
export type HapticStep =
  | { kind: 'impact'; weight: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' }
  | { kind: 'notify'; type: 'success' | 'warning' | 'error' }
  | { kind: 'select' }
  | { kind: 'wait'; ms: number };

export function hapticPlan(event: HapticEvent, tier: SupercargoTier = 'open'): HapticStep[] {
  const finish = finishFor(tier);
  switch (event) {
    case 'shutter':
      return [{ kind: 'impact', weight: 'medium' }];
    case 'lock':
      // The brackets snap shut on the car.
      return [{ kind: 'impact', weight: 'rigid' }];
    case 'select':
      return [{ kind: 'select' }];
    case 'reveal':
      if (finish === 'holo')
        return [
          { kind: 'impact', weight: 'heavy' },
          { kind: 'wait', ms: 90 },
          { kind: 'impact', weight: 'heavy' },
          { kind: 'wait', ms: 120 },
          { kind: 'notify', type: 'success' },
        ];
      if (finish === 'sheen')
        return [
          { kind: 'impact', weight: 'medium' },
          { kind: 'wait', ms: 80 },
          { kind: 'notify', type: 'success' },
        ];
      return [{ kind: 'impact', weight: 'light' }];
    case 'card':
      // The card lands. Foil cards get a second, softer beat as the foil catches the light.
      if (finish === 'holo')
        return [
          { kind: 'notify', type: 'success' },
          { kind: 'wait', ms: 160 },
          { kind: 'impact', weight: 'soft' },
        ];
      return [{ kind: 'notify', type: 'success' }];
  }
}

/** The subset of expo-haptics used here. */
export type HapticsModule = {
  impactAsync: (style: never) => Promise<void>;
  notificationAsync: (type: never) => Promise<void>;
  selectionAsync: () => Promise<void>;
  ImpactFeedbackStyle: Record<'Light' | 'Medium' | 'Heavy' | 'Rigid' | 'Soft', unknown>;
  NotificationFeedbackType: Record<'Success' | 'Warning' | 'Error', unknown>;
};

const weightKey = { light: 'Light', medium: 'Medium', heavy: 'Heavy', rigid: 'Rigid', soft: 'Soft' } as const;
const typeKey = { success: 'Success', warning: 'Warning', error: 'Error' } as const;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Plays a plan. Never throws: a haptic is never worth failing a scan. */
export async function playHaptics(plan: HapticStep[], h: HapticsModule | null, wait: (ms: number) => Promise<void> = sleep): Promise<void> {
  if (!h) return;
  for (const step of plan) {
    try {
      if (step.kind === 'wait') await wait(step.ms);
      else if (step.kind === 'select') await h.selectionAsync();
      else if (step.kind === 'impact') await h.impactAsync(h.ImpactFeedbackStyle[weightKey[step.weight]] as never);
      else await h.notificationAsync(h.NotificationFeedbackType[typeKey[step.type]] as never);
    } catch {
      return;
    }
  }
}
