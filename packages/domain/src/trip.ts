import { z } from 'zod';

/**
 * Shared trip classification contracts.
 * Local ordinary drives never become verified_capture without a server run id.
 */
export const TripClassificationSchema = z.enum([
  'ordinary',
  'territory_attempt',
  'verified_capture',
]);

export const TripPrivacySchema = z.literal('private');

export type TripClassification = z.infer<typeof TripClassificationSchema>;
export type TripPrivacy = z.infer<typeof TripPrivacySchema>;

/** Distinguish local device trips from server-verified captures. */
export function isServerVerifiedCapture(classification: TripClassification): boolean {
  return classification === 'verified_capture';
}

export function canLocallyPromoteToVerifiedCapture(): false {
  return false;
}
