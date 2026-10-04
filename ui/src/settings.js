export const SHARED_DEFAULTS = { eta: 0.8, margin: 0.7, discount: 0.01 }

// The subset of the shared settings an engine call uses (Engine 2 has no price sensitivity).
export const pick = (shared, keys) => Object.fromEntries(keys.map((k) => [k, shared[k]]))
