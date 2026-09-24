import React from 'react';
import AdminWriterList from './AdminWriterList';
import type { AdminAccess } from './access';

// Directory of every writer account, with search and filters.
export default function AdminWritersTab({ token, access }: { token: string; access: AdminAccess | null }) {
    return <AdminWriterList token={token} access={access} mode="directory" />;
}
