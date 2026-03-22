/** Default in-app destination after login / when blocking auth-only marketing routes. */
export function postLoginPathForRole(role: string): string {
  if (role === "ADMIN") return "/admin";
  if (role === "FREELANCE_USER") return "/freelancer/dashboard";
  return "/dashboard";
}
