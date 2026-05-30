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
  user_id: string;
  time: number;
  subject: string;
  level: string;
  goal: string | null;
  recommendation: StudyRecommendation;
  created_at?: string | null;
  next_review_at?: string | null;
  review_count: number;
  interval_days: number;
}

export interface PreviewResponse {
  subject: string;
  time: number;
  level: string;
  goal?: string | null;
  recommendation: StudyRecommendation;
}

export interface ReviewResponse {
  id: number;
  next_review_at: string;
  review_count: number;
  interval_days: number;
  ease_factor: number;
}

export interface StudyFormData {
  subject: string;
  time: number;
  level: string;
  goal: string;
}
