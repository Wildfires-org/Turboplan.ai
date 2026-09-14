// Convenience re-export; the builder lives in a plain module so server
// components can import it from the package root as well.
export {
  ENTITY_ACTIONS_KEY_PREFIX,
  getEntityActionsKey,
} from "../utils/entity-actions-key";
export type { EntityActionsResponse } from "./use-entity-permission";
export {
  useEntityPermission,
  useInvalidateEntityActions,
} from "./use-entity-permission";
