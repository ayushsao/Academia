import React, { lazy } from 'react';

// Pages and modals are separate files loaded on demand. After a new deploy the
// old files are gone, so a tab opened before it can't load them ("Failed to
// fetch dynamically imported module") and the page would go blank. In that case
// the page reloads once to pick up the new version; a guard stops reload loops.

const RELOAD_KEY = 'app-reloaded-for-update-at';
const STALE_FILE = /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch|ChunkLoadError|Unable to preload CSS/i;

export const isStaleFileError = (err: unknown) => STALE_FILE.test(String((err as Error)?.message || err));

/** Reloads the page to get the latest version. False if it just did (or can't tell), so it never loops. */
export function reloadForNewVersion(): boolean {
    try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last < 30000) return false;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch { return false; }
    window.location.reload();
    return true;
}

/** Like React.lazy, but reloads to the new version when the file is gone after a deploy. */
export function lazyPage<T extends React.ComponentType<any>>(load: () => Promise<{ default: T }>) {
    return lazy(() => load().catch(err => {
        if (isStaleFileError(err) && reloadForNewVersion()) return new Promise<{ default: T }>(() => { /* page is reloading */ });
        throw err;
    }));
}

/** Instead of a blank white page, a crash shows a short message and a reload button. */
export class PageErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    declare readonly props: Readonly<{ children: React.ReactNode }>;
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(err: unknown) {
        if (isStaleFileError(err) && reloadForNewVersion()) return;
        console.error('[App]', err);
    }
    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center font-sans">
                <p className="text-lg font-semibold text-[#1d1d1f]">This page didn’t load properly.</p>
                <p className="max-w-sm text-sm text-[#6e6e73]">The website may have just been updated. Reloading usually fixes it.</p>
                <button onClick={() => window.location.reload()} className="rounded-xl bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002147]">Reload page</button>
            </div>
        );
    }
}
