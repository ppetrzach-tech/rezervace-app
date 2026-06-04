/**
 * Oprávnění v rámci tenanta.
 *
 * Role:
 *  - owner   = vlastník účtu. Plná práva včetně API klíčů, loginů, brandingu.
 *  - staff bez providerId = "Manažer" (asistentka). Plná PROVOZNÍ práva
 *    (nemovitosti, termíny, otázky, rezervace, šablony, osoby, doba),
 *    ale NE integrace/API klíče, NE týmové loginy, NE firemní identita.
 *  - staff s providerId  = člen týmu vázaný na poskytovatele. Vidí jen své
 *    rezervace, needituje provozní nastavení.
 */

type SessionUser = {
  tenantId?: string;
  role?: string;
  providerId?: string;
} | undefined;

/** Vlastník účtu — citlivá nastavení (API klíče, loginy, branding). */
export function isOwner(user: SessionUser): boolean {
  return !!user?.tenantId && user.role === "owner";
}

/**
 * Smí spravovat provozní data (nemovitosti, termíny, otázky, rezervace,
 * šablony, osoby, pracovní dobu)? = owner NEBO manažer (staff bez providerId).
 */
export function canManage(user: SessionUser): boolean {
  if (!user?.tenantId) return false;
  if (user.role === "owner") return true;
  // staff bez vazby na providera = manažer/asistentka
  return !user.providerId;
}
