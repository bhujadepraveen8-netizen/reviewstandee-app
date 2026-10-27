export type UserRole = 'founder' | 'restaurant_owner';

export type BusinessCategory =
  | 'Restaurant'
  | 'Temple/Religious Place'
  | 'Salon'
  | 'Gym'
  | 'Clinic'
  | 'Retail Shop'
  | 'Hotel'
  | 'School'
  | 'Custom';

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  category?: BusinessCategory | string;
  address?: string;
  phone?: string;
  logo_url?: string;
  description?: string;
  google_review_url: string;
  place_id?: string;
  google_place_id?: string;
  accent_color?: string;
  is_active: boolean;
  created_at: string;
}

export interface GoogleReviewItem {
  id: string;
  authorName: string;
  authorPhotoUrl?: string | null;
  authorUri?: string | null;
  rating: number;
  text: string;
  publishTime?: string | null;
  relativePublishTimeDescription?: string;
}

export interface GooglePlaceDetails {
  placeId: string;
  displayName?: string;
  rating?: number | null;
  userRatingCount?: number;
  reviews: GoogleReviewItem[];
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  business_id?: string;
  created_at: string;
}

export interface QREvent {
  id: string;
  business_id: string;
  event_type: 'scan' | 'view';
  table_number?: string;
  user_agent?: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  business_id: string;
  rating: number; // 1 to 5
  comment?: string;
  customer_name?: string;
  customer_contact?: string;
  table_number?: string;
  is_positive: boolean; // rating >= 4
  created_at: string;
}

export interface Complaint {
  id: string;
  business_id: string;
  category: 'Food Quality' | 'Wait Time' | 'Service' | 'Cleanliness' | 'Billing' | 'Staff Behavior' | 'Other';
  message: string;
  issue?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  table_number?: string;
  status: 'new' | 'investigating' | 'resolved';
  manager_notes?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'trial' | 'canceled';
  period_start?: string;
  period_end?: string;
  monthly_price?: number;
  created_at: string;
}

export interface ReviewFeedbackRecord {
  id: string;
  created_at: string;
  restaurant_name: string;
  customer_name?: string | null;
  mobile_number?: string | null;
  action_type?: string | null;
  rating?: number | null;
  feedback_text?: string | null;
  business_id?: string | null;
}

export interface DashboardStats {
  totalScans: number;
  totalRatings: number;
  totalSubmissions?: number;
  averageRating: number;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
  interceptRate: number;
  ratingsBreakdown: { [key: number]: number };
}
