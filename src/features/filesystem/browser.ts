import { runtimeHosts } from '../runtime/hosts';
// Compatibility alias: composition is centralized in the runtime factory.
export const browserFileHost = runtimeHosts().filesystem;
