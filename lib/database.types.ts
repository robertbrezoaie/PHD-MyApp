export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          xp: number;
          level: number;
          points: number;
          coins: number;
          energy: number;
          streak_days: number;
          last_active_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      quests: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          tier: "bronze" | "silver" | "gold" | "diamond";
          xp_required: number;
          xp_reward: number;
          coin_reward: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["quests"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["quests"]["Insert"]>;
      };
      user_quests: {
        Row: {
          id: string;
          user_id: string;
          quest_id: string;
          xp_progress: number;
          completed: boolean;
          started_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["user_quests"]["Row"], "id" | "started_at">;
        Update: Partial<Database["public"]["Tables"]["user_quests"]["Insert"]>;
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          xp_reward: number;
          is_daily: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["tasks"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
      };
      user_tasks: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          completed: boolean;
          completed_at: string | null;
          task_date: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_tasks"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["user_tasks"]["Insert"]>;
      };
      questions: {
        Row: {
          id: string;
          quest_id: string;
          prompt: string;
          hint: string | null;
          xp_reward: number;
          order_num: number;
        };
        Insert: Omit<Database["public"]["Tables"]["questions"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>;
      };
      user_answers: {
        Row: {
          id: string;
          user_id: string;
          question_id: string;
          answer_text: string;
          submitted_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_answers"]["Row"], "id" | "submitted_at">;
        Update: Partial<Database["public"]["Tables"]["user_answers"]["Insert"]>;
      };
      badges: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon: string;
          condition_type: string;
          condition_value: number;
        };
        Insert: Omit<Database["public"]["Tables"]["badges"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["badges"]["Insert"]>;
      };
      user_badges: {
        Row: {
          id: string;
          user_id: string;
          badge_id: string;
          earned_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_badges"]["Row"], "id" | "earned_at">;
        Update: Partial<Database["public"]["Tables"]["user_badges"]["Insert"]>;
      };
    };
    Views: {
      leaderboard: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          points: number;
          level: number;
          rank: number;
        };
      };
    };
  };
}

// Convenience types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Quest = Database["public"]["Tables"]["quests"]["Row"];
export type UserQuest = Database["public"]["Tables"]["user_quests"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type UserTask = Database["public"]["Tables"]["user_tasks"]["Row"];
export type Question = Database["public"]["Tables"]["questions"]["Row"];
export type Badge = Database["public"]["Tables"]["badges"]["Row"];
export type UserBadge = Database["public"]["Tables"]["user_badges"]["Row"];
export type LeaderboardEntry = Database["public"]["Views"]["leaderboard"]["Row"];
