/**
 * Firebase ships `getReactNativePersistence` only in its React Native bundle, which Metro
 * resolves at runtime, but TypeScript resolves the web typings. Declare the one function we use.
 */
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
