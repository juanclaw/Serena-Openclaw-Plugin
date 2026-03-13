import fs from "node:fs";
import path from "node:path";

export function normalizeExistingPath(input: string): string {
  return fs.realpathSync.native(path.resolve(input));
}

export function isWithinAllowedRoots(target: string, allowedRoots: string[]): boolean {
  if (allowedRoots.length === 0) {
    return true;
  }
  return allowedRoots.some((root) => {
    const normalizedRoot = normalizeMaybe(root);
    return target === normalizedRoot || target.startsWith(`${normalizedRoot}${path.sep}`);
  });
}

export function findProjectRoot(startPath: string, markers: string[]): string {
  let current = normalizeExistingPath(startPath);
  const stat = fs.statSync(current);
  if (!stat.isDirectory()) {
    current = path.dirname(current);
  }

  while (true) {
    if (markers.some((marker) => fs.existsSync(path.join(current, marker)))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
}

function normalizeMaybe(input: string): string {
  try {
    return normalizeExistingPath(input);
  } catch {
    return path.resolve(input);
  }
}
