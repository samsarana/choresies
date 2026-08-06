/**
 * Built-in chore synonym concepts. When a chore is created, any concept whose
 * trigger appears in the name donates its aliases, so "Unstack dishwasher"
 * is findable by typing "unload", "empty", "dishes", …
 */

import { normalize } from './search'

interface Concept {
  triggers: string[]
  aliases: string[]
}

const CONCEPTS: Concept[] = [
  { triggers: ['dishwasher', 'dishes', 'dish'], aliases: ['dishwasher', 'dishes', 'unstack', 'unload', 'empty', 'load', 'stack'] },
  { triggers: ['vacuum', 'hoover', 'vac'], aliases: ['vacuum', 'hoover'] },
  { triggers: ['bin', 'bins', 'rubbish', 'trash', 'garbage', 'recycling'], aliases: ['bins', 'rubbish', 'trash', 'recycling', 'garbage'] },
  { triggers: ['bathroom', 'toilet', 'loo', 'shower'], aliases: ['bathroom', 'toilet', 'loo', 'shower'] },
  { triggers: ['laundry', 'washing'], aliases: ['laundry', 'washing', 'clothes'] },
  { triggers: ['surface', 'surfaces', 'bench', 'benches', 'counter', 'counters', 'wipe'], aliases: ['wipe', 'surfaces', 'bench', 'counters'] },
  { triggers: ['mop', 'mopping'], aliases: ['mop', 'floors'] },
  { triggers: ['sweep', 'sweeping'], aliases: ['sweep', 'floors'] },
  { triggers: ['groceries', 'shopping', 'supermarket', 'shop'], aliases: ['groceries', 'shopping', 'supermarket'] },
  { triggers: ['cook', 'cooking', 'dinner', 'meal', 'tea', 'lunch'], aliases: ['cook', 'dinner', 'meal'] },
  { triggers: ['plant', 'plants', 'watering'], aliases: ['plants', 'watering'] },
  { triggers: ['window', 'windows'], aliases: ['windows'] },
  { triggers: ['tidy', 'tidying', 'declutter'], aliases: ['tidy', 'tidying'] },
  { triggers: ['oven', 'stove', 'hob'], aliases: ['oven', 'stove', 'hob'] },
  { triggers: ['fridge', 'refrigerator', 'freezer'], aliases: ['fridge', 'freezer'] },
  { triggers: ['compost'], aliases: ['compost'] },
  { triggers: ['kitchen'], aliases: ['kitchen'] },
  { triggers: ['lounge', 'living'], aliases: ['lounge', 'living room'] },
]

/** Aliases to attach to a newly created chore, based on its name. */
export function aliasesFor(name: string): string[] {
  const words = normalize(name).split(' ').filter(Boolean)
  const wordSet = new Set(words)
  const out = new Set<string>()
  for (const concept of CONCEPTS) {
    const hit = concept.triggers.some(
      (t) =>
        wordSet.has(t) ||
        // long triggers may sit inside compound words: "dishwashing" ⊃ "dishwasher"? no —
        // match by word *prefix* so "dishwashing".startsWith("dish") hits, "radish" doesn't
        (t.length >= 4 && words.some((w) => w.startsWith(t))),
    )
    if (hit) for (const a of concept.aliases) if (!wordSet.has(a)) out.add(a)
  }
  return [...out].slice(0, 14)
}
