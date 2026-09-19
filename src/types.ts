export type ServiceType =
  | 'Academic Writing'
  | 'Dissertation & Thesis'
  | 'Editing & Proofreading'
  | 'Data Analysis & SPSS'
  | 'Literature Review'
  | 'Case Study Analysis'
  | 'Essay Editing Service'
  | 'MBA Essay Writing Service'
  | 'Essay Help'
  | 'Research Proposal Writing Service'
  | 'Research Paper Writing'
  | 'Ghost Writer'
  | 'Programming Assignment Help'
  | 'Assessment Help'
  | 'Pay Someone To Do My Homework'
  | 'Take My Online Class'
  | 'Take My Online Exam'
  | 'Dissertation Help'
  | 'Term Paper Help'
  | 'Homework Help'
  | 'Coursework Help'
  | 'Thesis Help'
  | 'Powerpoint Presentation Services';

export type SubjectType =
  | 'Business & Mgt'
  | 'Computer Science'
  | 'Literature & Humanities'
  | 'Finance & Economics'
  | 'Law & Legal Studies'
  | 'Medical & Healthcare'
  | 'Engineering & STEM'
  | 'Psychology & Sociology';

export interface Consultant {
  id: string;
  name: string;
  field: string;
  image: string;
  status: 'Available' | 'Busy';
  degrees: string[];
  bio: string;
  ordersCompleted: number;
  rating: number;
  ratePerPage: number;
  university: string;
  specialties: string[];
}

export interface Discipline {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  image: string;
  topics: string[];
  popularCourses: string[];
}

export interface Review {
  id: string;
  author: string;
  title: string;
  type: string;
  pages: number;
  date: string;
  rating: number;
  text: string;
  platform: 'MY ASSIGNMENT HELP' | 'SITEJABBER' | 'REVIEWS.io';
}

export interface OrderState {
  service: ServiceType;
  subject: SubjectType;
  pages: number;
  deadline: string;
  academicLevel: 'Undergraduate' | 'Master\'s' | 'PhD / Doctoral' | 'Professional';
  urgencyDays: number;
  plagiarismReport: boolean;
  expertConsultation: boolean;
  abstractPage: boolean;
  topicTitle: string;
  instructions: string;
  files: string[];
}
