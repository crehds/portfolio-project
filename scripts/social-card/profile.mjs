// Reads the owner's name and role per locale from src/content/profile.yaml. The file has one
// fixed shape (see src/modules/profile/schema.ts), so a few anchored patterns are enough and
// no YAML dependency is needed.
import fs from 'node:fs';
import path from 'node:path';

export function readCardText(repoRoot) {
  const yaml = fs.readFileSync(
    path.join(repoRoot, 'src', 'content', 'profile.yaml'),
    'utf8',
  );
  const name = /^ {2}name: (.+)$/m.exec(yaml)?.[1];
  const role = /^ {2}role:\r?\n {4}en: (.+)\r?\n {4}es: (.+)$/m.exec(yaml);
  if (!name || !role) {
    throw new Error('profile.yaml: could not read "name" and "role".');
  }
  return {
    name: name.trim(),
    role: { en: role[1].trim(), es: role[2].trim() },
  };
}
