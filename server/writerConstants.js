// Option lists for writer onboarding. Mirrored in src/lib/writerOptions.ts —
// keep both in sync.

export const PREDEFINED_SKILLS = [
    'Academic Writing', 'Research', 'Editing', 'Proofreading', 'Technical Writing',
    'Computer Science', 'Engineering', 'Business', 'Finance', 'Economics',
    'Mathematics', 'Law', 'Marketing', 'Psychology', 'Other',
];

export const ACADEMIC_LEVELS = ['High School', 'Undergraduate', "Master's", 'PhD', 'Professional'];

export const EDUCATION_LEVELS = ['Diploma', "Bachelor's", "Master's", 'PhD', 'Professional Certification', 'Other'];

export const MAX_SKILLS = 30;
export const MAX_DOCUMENTS_PER_WRITER = 20;

export const slugify = (value) =>
    value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
