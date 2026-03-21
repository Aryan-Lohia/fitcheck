export const USER_NAV_LINKS = [
  { href: "/dashboard", label: "Check Fit" },
  { href: "/chat", label: "AI Chat" },
  { href: "/book-expert", label: "Book Expert" },
  { href: "/vault", label: "Fitcheck Vault" },
  { href: "/profile", label: "Profile" },

] as const;

export type UserNavLink = (typeof USER_NAV_LINKS)[number];
