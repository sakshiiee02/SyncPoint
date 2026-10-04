/**
 * A traveler's mascot: a friendly animal on a coloured background, chosen in the profile and shown
 * on the map, the roster and the lobby so friends recognise each other at a glance.
 * Only these two small values are stored/shared; the drawing is done on each phone.
 */
export const MASCOT_ANIMALS = [
  'BEAR',
  'CAT',
  'DOG',
  'FOX',
  'RABBIT',
  'PANDA',
  'FROG',
  'LION',
  'OWL',
  'KOALA',
] as const;

export type MascotAnimal = (typeof MASCOT_ANIMALS)[number];

export const MASCOT_COLORS = [
  '#fecaca',
  '#fed7aa',
  '#fde68a',
  '#bbf7d0',
  '#99f6e4',
  '#bae6fd',
  '#c7d2fe',
  '#e9d5ff',
  '#fbcfe8',
  '#e2e8f0',
] as const;

export interface Mascot {
  animal: MascotAnimal;
  /** Background colour, `#rrggbb`. */
  color: string;
}

export const MASCOT_LABELS: Record<MascotAnimal, string> = {
  BEAR: 'Bear',
  CAT: 'Cat',
  DOG: 'Dog',
  FOX: 'Fox',
  RABBIT: 'Rabbit',
  PANDA: 'Panda',
  FROG: 'Frog',
  LION: 'Lion',
  OWL: 'Owl',
  KOALA: 'Koala',
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isMascotAnimal(value: unknown): value is MascotAnimal {
  return typeof value === 'string' && (MASCOT_ANIMALS as readonly string[]).includes(value);
}

function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A stable mascot for anyone who hasn't made one: the same person always gets the same one. */
export function defaultMascot(seed: string): Mascot {
  const h = hash(seed || 'traveler');
  return {
    animal: MASCOT_ANIMALS[h % MASCOT_ANIMALS.length],
    color: MASCOT_COLORS[Math.floor(h / MASCOT_ANIMALS.length) % MASCOT_COLORS.length],
  };
}

/** Accepts anything read from storage/the network and returns a valid mascot (never throws). */
export function normalizeMascot(raw: unknown, seed: string): Mascot {
  const candidate = raw as Partial<Mascot> | null | undefined;
  if (candidate && isMascotAnimal(candidate.animal) && HEX_COLOR.test(String(candidate.color))) {
    return { animal: candidate.animal, color: String(candidate.color) };
  }
  return defaultMascot(seed);
}
