/**
 * Optional filesystem confinement for the built-in file tools
 * (read, edit, search, convert_to_file, extract_from_file).
 *
 * Set MATIMO_FILE_ROOTS to a path-delimiter separated list of directories
 * (":" on POSIX, ";" on Windows) and those tools refuse any path whose real
 * location, after resolving symlinks, falls outside every root. Unset (the
 * default) keeps the previous behaviour: no confinement.
 *
 * Mirrors: python/packages/core/src/matimo/policy/file_roots.py
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { MatimoError, ErrorCode } from '../errors/matimo-error.js';

export const FILE_ROOTS_ENV = 'MATIMO_FILE_ROOTS';

/** Resolve symlinks for the longest existing ancestor, then re-append the missing tail. */
function realpathLenient(target: string): string {
  let current = path.resolve(target);
  const tail: string[] = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(current), ...tail.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      tail.push(path.basename(current));
      current = parent;
    }
  }
}

function isWithin(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/** The configured roots, or null when confinement is off. */
export function getFileRoots(): string[] | null {
  const raw = process.env[FILE_ROOTS_ENV];
  if (!raw || !raw.trim()) return null;
  const roots = raw
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => realpathLenient(entry));
  return roots.length > 0 ? roots : null;
}

/**
 * Resolve a user-supplied path the way the file tools always have (leading ~ is the
 * home directory, relative paths are against the working directory) and, when
 * MATIMO_FILE_ROOTS is set, refuse it if it lands outside the allowed roots.
 */
export function resolveToolPath(input: string): string {
  const resolved = input.startsWith('~')
    ? path.join(process.env.HOME || os.homedir(), input.slice(1))
    : path.isAbsolute(input)
      ? input
      : path.resolve(process.cwd(), input);

  const roots = getFileRoots();
  if (roots === null) return resolved;

  const real = realpathLenient(resolved);
  if (!roots.some((root) => isWithin(root, real))) {
    throw new MatimoError(
      `Path is outside the allowed file roots (${FILE_ROOTS_ENV})`,
      ErrorCode.POLICY_DENIED,
      { path: resolved }
    );
  }
  return resolved;
}
