import React from 'react';
import AdminWriterList from './AdminWriterList';
import type { AdminAccess } from './access';

// HR review queue: writer applications grouped by review stage.
export default function AdminApplicationsTab({ token, access }: { token: string; access: AdminAccess | null }) {
    return <AdminWriterList token={token} access={access} mode="queue" />;
}
