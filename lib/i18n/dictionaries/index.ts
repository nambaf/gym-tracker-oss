import { it, type Dictionary } from './it'
import { en } from './en'
import type { Lang } from '..'

export type { Dictionary } from './it'

export const dictionaries: Record<Lang, Dictionary> = { it, en }

export function getDictionary(lang: Lang): Dictionary {
  return dictionaries[lang] ?? dictionaries.it
}
