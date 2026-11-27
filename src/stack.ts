// Jordan's stack, taken from the SKILLS list of jordanperez.dev
// (space-portfolio/src/lib/data.ts). The glyphs are original monograms,
// not vendor logos.

export type Category = {
  id: string
  label: string
  color: string
}

export const CATEGORIES: Category[] = [
  { id: 'frontend', label: 'Frontend', color: '#4cc9f0' },
  { id: 'backend', label: 'Backend', color: '#a78bfa' },
  { id: 'ai', label: 'AI & Automation', color: '#f0abfc' },
  { id: 'cloud', label: 'Cloud & Infra', color: '#fbbf24' },
  { id: 'data', label: 'Payments & Data', color: '#34d399' },
  { id: 'lang', label: 'Languages', color: '#fb7185' },
]

export type Skill = {
  name: string
  glyph: string
  category: string
}

export const SKILLS: Skill[] = [
  { name: 'React', glyph: 'Re', category: 'frontend' },
  { name: 'Next.js', glyph: 'N', category: 'frontend' },
  { name: 'React Native', glyph: 'RN', category: 'frontend' },
  { name: 'Tailwind', glyph: 'Tw', category: 'frontend' },
  { name: 'Node.js', glyph: 'No', category: 'backend' },
  { name: 'Express', glyph: 'Ex', category: 'backend' },
  { name: 'REST APIs', glyph: '{}', category: 'backend' },
  { name: 'Serverless', glyph: 'λ', category: 'backend' },
  { name: 'OpenAI', glyph: 'Oa', category: 'ai' },
  { name: 'Claude', glyph: 'Cl', category: 'ai' },
  { name: 'AI Agents', glyph: 'Ag', category: 'ai' },
  { name: 'Prompt Eng.', glyph: '>_', category: 'ai' },
  { name: 'Firebase', glyph: 'Fb', category: 'cloud' },
  { name: 'GCP', glyph: 'G', category: 'cloud' },
  { name: 'AWS', glyph: 'Aw', category: 'cloud' },
  { name: 'Docker', glyph: 'Dk', category: 'cloud' },
  { name: 'CI/CD', glyph: 'CI', category: 'cloud' },
  { name: 'Stripe', glyph: 'St', category: 'data' },
  { name: 'PCI DSS', glyph: 'PC', category: 'data' },
  { name: 'MongoDB', glyph: 'Mg', category: 'data' },
  { name: 'PostgreSQL', glyph: 'Pg', category: 'data' },
  { name: 'TypeScript', glyph: 'TS', category: 'lang' },
  { name: 'JavaScript', glyph: 'JS', category: 'lang' },
  { name: 'Python', glyph: 'Py', category: 'lang' },
  { name: 'SQL', glyph: 'Sq', category: 'lang' },
  { name: 'PHP', glyph: 'Ph', category: 'lang' },
]

export function colorOf(skill: Skill): string {
  return CATEGORIES.find((c) => c.id === skill.category)?.color ?? '#4cc9f0'
}
