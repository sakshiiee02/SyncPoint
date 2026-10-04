import { CONFIG } from '@/constants/config';

const { ALPHABET, LENGTH } = CONFIG.JOIN_CODE;

/** Generates a random short code from the unambiguous alphabet (no 0/O, 1/I). */
export function generateJoinCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET.charAt(Math.floor(random() * ALPHABET.length));
  }
  return code;
}

/** Upper-cases and strips spaces/dashes so "abc-123" and "ABC 123" both work. */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]+/g, '');
}

export function isValidJoinCode(code: string): boolean {
  if (code.length !== LENGTH) return false;
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}
