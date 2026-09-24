import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/min';

// Option lists mirrored from server/writerConstants.js — keep both in sync.
export const PREDEFINED_SKILLS = [
    'Academic Writing', 'Research', 'Editing', 'Proofreading', 'Technical Writing',
    'Computer Science', 'Engineering', 'Business', 'Finance', 'Economics',
    'Mathematics', 'Law', 'Marketing', 'Psychology', 'Other',
];
export const ACADEMIC_LEVELS = ['High School', 'Undergraduate', "Master's", 'PhD', 'Professional'];
export const EDUCATION_LEVELS = ['Diploma', "Bachelor's", "Master's", 'PhD', 'Professional Certification', 'Other'];
export const MAX_SKILLS = 30;

export const SUGGESTED_SUBJECTS = [
    'Accounting', 'Anthropology', 'Architecture', 'Biology', 'Business Studies', 'Chemistry', 'Computer Science',
    'Criminology', 'Data Science', 'Economics', 'Education', 'Engineering', 'English Literature', 'Environmental Science',
    'Finance', 'History', 'Human Resources', 'Information Technology', 'International Relations', 'Law', 'Linguistics',
    'Management', 'Marketing', 'Mathematics', 'Media Studies', 'Medicine', 'Nursing', 'Philosophy', 'Physics',
    'Political Science', 'Psychology', 'Public Health', 'Sociology', 'Statistics',
];

export const SUGGESTED_LANGUAGES = ['English', 'Arabic', 'Chinese', 'French', 'German', 'Hindi', 'Portuguese', 'Russian', 'Spanish', 'Urdu'];

export const DOCUMENT_TYPES = [
    { value: 'RESUME', label: 'Resume / CV', hint: 'PDF or Word · max 10 MB', accept: '.pdf,.doc,.docx', required: true },
    { value: 'CERTIFICATE', label: 'Certificates', hint: 'Degree or professional certificates · PDF or image · max 10 MB', accept: '.pdf,.jpg,.jpeg,.png,.webp', required: false },
    { value: 'WRITING_SAMPLE', label: 'Writing samples', hint: 'Your own original work · PDF or Word · max 15 MB', accept: '.pdf,.doc,.docx', required: false },
    { value: 'PORTFOLIO', label: 'Portfolio', hint: 'PDF, Word or image · max 15 MB', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp', required: false },
] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number]['value'];

export type WriterStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'INACTIVE';

export const WRITER_STATUS_META: Record<WriterStatus, { label: string; className: string }> = {
    PENDING: { label: 'Pending Review', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
    UNDER_REVIEW: { label: 'Under Review', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
    APPROVED: { label: 'Approved', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
    ACTIVE: { label: 'Active', className: 'bg-emerald-600 text-white ring-emerald-600' },
    SUSPENDED: { label: 'Suspended', className: 'bg-red-50 text-red-700 ring-red-200' },
    REJECTED: { label: 'Rejected', className: 'bg-gray-100 text-gray-700 ring-gray-300' },
    INACTIVE: { label: 'Inactive', className: 'bg-gray-50 text-gray-500 ring-gray-200' },
};

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
    DRAFT: 'Not submitted', SUBMITTED: 'Awaiting review', UNDER_REVIEW: 'In review',
    INFO_REQUESTED: 'Info requested', APPROVED: 'Approved', REJECTED: 'Rejected',
};

// Every country libphonenumber knows, with a localised display name and dial code.
const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames([navigator.language || 'en', 'en'], { type: 'region' })
    : null;

export type CountryOption = { code: CountryCode; name: string; dialCode: string; flag: string };

const flagEmoji = (code: string) => String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));

export const COUNTRIES: CountryOption[] = getCountries()
    .map(code => ({ code, name: regionNames?.of(code) || code, dialCode: `+${getCountryCallingCode(code)}`, flag: flagEmoji(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));

export const countryName = (code?: string | null) => (code && COUNTRIES.find(c => c.code === code)?.name) || code || '';

// Best guess at the visitor's country from their browser locale, for defaults.
export function guessCountry(): CountryCode {
    const region = (navigator.language || '').split('-')[1]?.toUpperCase();
    return (COUNTRIES.some(c => c.code === region) ? region : 'US') as CountryCode;
}
