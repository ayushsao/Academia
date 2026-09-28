// The three files every writer submission must contain (same rules as the server:
// WRITER_SUBMISSION_KINDS in server/routes/orderWorkflow.js and SUBMISSION_FIELDS in
// server/services/assignmentFiles.js).
export type SubmissionKind = 'FINAL' | 'PLAGIARISM' | 'AI_REPORT';

export const SUBMISSION_KINDS: { kind: SubmissionKind; slug: string; field: string; label: string; short: string; accept: string; formats: string }[] = [
    { kind: 'FINAL', slug: 'final', field: 'final', label: 'Final Assignment', short: 'Final Assignment', accept: '.pdf,.doc,.docx,.ppt,.pptx,.zip', formats: 'PDF, DOC, DOCX, PPT, PPTX, ZIP' },
    { kind: 'PLAGIARISM', slug: 'plagiarism', field: 'plagiarism', label: 'Turnitin Plagiarism Report', short: 'Plagiarism Report', accept: '.pdf,.png,.jpg,.jpeg', formats: 'PDF, PNG, JPG' },
    { kind: 'AI_REPORT', slug: 'ai-report', field: 'ai_report', label: 'Turnitin AI Report', short: 'AI Report', accept: '.pdf,.png,.jpg,.jpeg', formats: 'PDF, PNG, JPG' },
];

export const kindLabel = (kind?: string | null) => SUBMISSION_KINDS.find(k => k.kind === kind)?.label || 'File';

// Orders files for display: Final Assignment, Plagiarism Report, AI Report, then anything else.
export const byKind = <T extends { kind?: string | null }>(files: T[]) =>
    [...files].sort((a, b) => rank(a.kind) - rank(b.kind));
const rank = (kind?: string | null) => { const i = SUBMISSION_KINDS.findIndex(k => k.kind === kind); return i === -1 ? 99 : i; };
