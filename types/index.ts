export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  created_at?: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Expense {
  id: string;
  user_id: string;
  category_id?: string | null;
  date: string;
  store: string;
  status: "Verified" | "Pending";
  amount: number;
  receipt_url?: string | null;
  created_at?: string;
  categories?: Category | null;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  limit_amount: number;
  spent_amount: number;
  month: string;
  created_at?: string;
  categories?: Category | null;
}

export interface GroupMember {
  group_id: string;
  profile_id: string;
  joined_at?: string;
  profiles?: Profile | null;
}

export interface GroupExpense {
  id: string;
  group_id: string;
  payer_id: string;
  category_id?: string | null;
  description: string;
  amount: number;
  date: string;
  created_at?: string;
  profiles?: Profile | null;
  categories?: Category | null;
}

export interface GroupSettlement {
  id: string;
  group_id: string;
  from_profile_id: string;
  to_profile_id: string;
  amount: number;
  date: string;
  note?: string;
  created_at?: string;
  from_profile?: Profile | null;
  to_profile?: Profile | null;
}

export interface Group {
  id: string;
  name: string;
  icon?: string | null;
  icon_bg?: string | null;
  icon_color?: string | null;
  created_by?: string | null;
  created_at?: string;
  members?: number;
  group_members?: GroupMember[];
}

export interface ScanSession {
  id: string;
  createdAt: number;
  image: string | null;
  fileName: string | null;
  fileType: string | null;
}

export interface BugReport {
  id: string;
  user_id?: string | null;
  user_email?: string | null;
  title: string;
  description: string;
  severity: "Low" | "Medium" | "High";
  status?: string;
  created_at: string;
}

