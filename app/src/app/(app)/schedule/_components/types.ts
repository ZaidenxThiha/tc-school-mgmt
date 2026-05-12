export const SLOTS = ['7:45-9:45', '10-12', '1-3', '3:15-5:15'] as const;
export const DAYS = ['Sat', 'Sun'] as const;

export type Slot = (typeof SLOTS)[number];
export type Day = (typeof DAYS)[number];

export type TeacherRef = { id: number; short_name: string };

export type Cell = {
  id: number;
  class_label: string | null;
  subject: string | null;
  mt: TeacherRef | null;
  ct: TeacherRef | null;
};

export type Employee = { id: number; short_name: string; category: string };

export type TeacherSlot = {
  day: string;
  slot: string;
  class: string | null;
  role: 'MT' | 'CT';
};

export type ByTeacher = Map<number, TeacherSlot[]>;
