export const SHARED_DEFAULTS = { eta: 0.8, margin: 0.7, discount: 0.01 }

// The subset of the shared settings an engine call uses (Engine 2 has no price sensitivity).
export const pick = (shared, keys) => Object.fromEntries(keys.map((k) => [k, shared[k]]))

// The suggested campaign: Retention's starting values, also quoted in the Index.
export const RETENTION_DEFAULTS = { budget: 30000, hours: 500, cap: 350, acceptance: 0.3, threshold: 0.03, haircut: 1 }
