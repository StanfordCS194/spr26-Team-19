/** Mastery thresholds shared by lesson progress badges. */
export const PATH_MASTERY_PERCENT = 70;
export const PATH_MIN_ATTEMPTS = 4;
/**
 * Mastery is judged over a rolling window of the most recent attempts, so a
 * rough start doesn't permanently tank accuracy — older results "roll off".
 */
export const PATH_RECENT_WINDOW = 5;

export function slugifyTopic(topic: string): string {
  return topic
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "topic";
}

/**
 * Topics come from a static fallback bank AND free-form LLM output, so the same
 * concept arrives with different casing/wording ("indexing" vs "Indexing",
 * "array shape" vs "shape ops"). Map known variants to one canonical label so
 * weak-topic lists don't show near-duplicates.
 */
const TOPIC_SYNONYMS: Record<string, string> = {
  indexing: "Indexing",
  "array indexing": "Indexing",
  "fancy indexing": "Indexing",
  "boolean indexing": "Indexing",
  "indexing and slicing": "Indexing & slicing",
  slicing: "Slicing",
  "array slicing": "Slicing",
  shape: "Shapes",
  shapes: "Shapes",
  "array shape": "Shapes",
  "array shapes": "Shapes",
  "array shape and size": "Shapes",
  "shape ops": "Shapes",
  "shape and size": "Shapes",
  reshaping: "Shapes",
  reshape: "Shapes",
  "reshaping arrays": "Shapes",
  "new axis": "Shapes",
  "adding a new axis": "Shapes",
  flatten: "Shapes",
  flattening: "Shapes",
  "flattening arrays": "Shapes",
  transpose: "Shapes",
  transposing: "Shapes",
  "transposing a matrix": "Shapes",
  arrays: "Array fundamentals",
  "array fundamentals": "Array fundamentals",
  "array basics": "Array fundamentals",
  "array creation": "Array fundamentals",
  "creating arrays": "Array fundamentals",
  "creating arrays from existing data": "Array fundamentals",
  "array attributes": "Array attributes",
  broadcasting: "Broadcasting",
  aggregation: "Aggregation",
  aggregations: "Aggregation",
  "basic array operations": "Array operations",
  "array operations": "Array operations",
  "numpy functions": "NumPy functions",
  "np functions": "NumPy functions",
  "math formulas": "Math formulas",
  "mathematical formulas": "Math formulas",
  "sorting": "Sorting & editing",
  "adding, removing, and sorting array elements": "Sorting & editing",
  "unique items and counts": "Unique & counts",
  "reversing arrays": "Reversing arrays",
  matrices: "Matrices",
  "creating and indexing 2d matrices": "Matrices",
  "random numbers": "Random numbers",
  "generating random numbers": "Random numbers",
  "saving and loading": "Save & load",
  "reading and writing csv files": "CSV input/output",
  "plotting arrays with matplotlib": "Plotting",
  dtype: "Data types",
  dtypes: "Data types",
  "data types": "Data types",
};

export function canonicalizeTopic(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return "General";
  if (TOPIC_SYNONYMS[key]) return TOPIC_SYNONYMS[key];
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Merge near-duplicate topics into canonical labels, preserving input order. */
export function dedupeTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of topics) {
    if (!t?.trim()) continue;
    const label = canonicalizeTopic(t);
    if (seen.has(label)) continue;
    seen.add(label);
    result.push(label);
  }
  return result;
}
