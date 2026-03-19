/**
 * Application version — single source of truth from package.json.
 */

import packageJson from "../package.json";

export const VERSION = packageJson.version;
