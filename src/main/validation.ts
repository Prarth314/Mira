import { MiraError } from '../types/MiraError';
import type { ProviderName } from '../types/provider';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MiraError('action_invalid', 'Expected an object');
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown, name: string, max = 16_000, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
    throw new MiraError(
      'action_invalid',
      `${name} must be ${allowEmpty ? '' : 'non-empty '}text up to ${max} characters`,
    );
  }
  return value;
}

export function providerName(value: unknown): ProviderName {
  if (value !== 'anthropic' && value !== 'openai') {
    throw new MiraError('action_invalid', 'Unsupported provider');
  }
  return value;
}

export function imageBuffers(value: unknown): Buffer[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 1) {
    throw new MiraError('action_invalid', 'At most one image is permitted');
  }
  return value.map((image: unknown) => {
    if (!(image instanceof ArrayBuffer) || image.byteLength > 4 * 1024 * 1024) {
      throw new MiraError('action_invalid', 'Invalid image or image exceeds 4 MiB');
    }
    return Buffer.from(image);
  });
}
