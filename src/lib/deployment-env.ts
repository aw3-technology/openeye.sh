/**
 * Deployment environment detection.
 * Single source of truth for cloud vs local mode.
 */

const CLOUD_HOSTNAMES = ["openeye.sh", "www.openeye.sh"];
const CLOUD_HOSTNAME_SUFFIXES = [".lovable.app", ".lovableproject.com"];

/**
 * Returns true when the app is running on a cloud/production host.
 * Override with `VITE_DEPLOY_ENV=cloud` or `VITE_DEPLOY_ENV=local`.
 */
export function isCloudDeployment(): boolean {
  const override = import.meta.env.VITE_DEPLOY_ENV as string | undefined;
  if (override === "cloud") return true;
  if (override === "local") return false;

  const hostname = window.location.hostname;
  if (CLOUD_HOSTNAMES.includes(hostname)) return true;
  if (CLOUD_HOSTNAME_SUFFIXES.some((s) => hostname.endsWith(s))) return true;
  return false;
}

/**
 * Returns true when all three cred.diy env vars are present,
 * meaning the credit system can make API calls.
 */
export function isCredSystemConfigured(): boolean {
  return !!(
    import.meta.env.VITE_CRED_API_URL &&
    import.meta.env.VITE_CRED_API_KEY &&
    import.meta.env.VITE_CRED_PROJECT_ID
  );
}
