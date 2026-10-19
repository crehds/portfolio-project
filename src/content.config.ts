// Composition root for Astro's content layer: each collection pairs a module's schema
// (the port, under `src/modules/*/schema.ts`) with a loader (the adapter). Domain logic
// lives next to each schema in `src/modules/*/domain/` and never imports from here.
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';

import { experienceSchema } from './modules/experience/schema';
import { profileSchema } from './modules/profile/schema';
import { projectsSchema } from './modules/projects/schema';
import { skillsSchema } from './modules/skills/schema';

const profile = defineCollection({
  loader: file('src/content/profile.yaml'),
  schema: profileSchema,
});

const experience = defineCollection({
  loader: file('src/content/experience.yaml'),
  schema: experienceSchema,
});

const skills = defineCollection({
  loader: file('src/content/skills.yaml'),
  schema: skillsSchema,
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: projectsSchema,
});

export const collections = { profile, experience, skills, projects };
