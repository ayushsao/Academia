// The signed-in admin's role and permissions, as reported by GET /api/admin/me.
// The UI uses this only to hide what the server would refuse anyway.
export type AdminAccess = { id: string; username: string; role: string; roleLabel: string; permissions: string[] };

export const hasPermission = (access: AdminAccess | null, ...perms: string[]) =>
    Boolean(access && perms.some(p => access.permissions.includes(p)));
