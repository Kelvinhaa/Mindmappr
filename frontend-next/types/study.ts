export interface Technique {
  title: string;
  description: string;
  duration_minutes: number;
}

export interface StudyRecommendation {
  summary: string;
  techniques: Technique[];
  tips: string[];
}

export interface StudyResponse {
  id: number;
  time: number;
  subject: string;
  level: string;
  goal: string | null;
  recommendation: StudyRecommendation;
}

export interface StudyFormData {
  subject: string;
  time: number;
  level: string;
  goal: string;
}
