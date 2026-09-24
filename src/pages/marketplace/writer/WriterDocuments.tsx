import React from 'react';
import { useWriter } from '../onboarding/WriterContext';
import DocumentsManager from '../onboarding/DocumentsManager';

export default function WriterDocuments() {
    const { writer, setWriter } = useWriter();
    if (!writer) return null;
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">My documents</h1>
                <p className="mt-1 text-slate-600">Your CV, certificates, writing samples and portfolio.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
                <DocumentsManager writer={writer} onUpdate={setWriter} />
            </div>
        </div>
    );
}
