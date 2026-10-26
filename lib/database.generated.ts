export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      adaptive_decisions: {
        Row: {
          attempt_id: string
          clipped: boolean | null
          contributions: Json | null
          created_at: string
          delta: number | null
          difficulty: number | null
          explained: boolean
          factors: string[] | null
          id: string
          multiplier: number | null
          output: string
          shares: number[] | null
          suppressed_by_clip: boolean
          text: string | null
        }
        Insert: {
          attempt_id: string
          clipped?: boolean | null
          contributions?: Json | null
          created_at?: string
          delta?: number | null
          difficulty?: number | null
          explained: boolean
          factors?: string[] | null
          id?: string
          multiplier?: number | null
          output: string
          shares?: number[] | null
          suppressed_by_clip?: boolean
          text?: string | null
        }
        Update: {
          attempt_id?: string
          clipped?: boolean | null
          contributions?: Json | null
          created_at?: string
          delta?: number | null
          difficulty?: number | null
          explained?: boolean
          factors?: string[] | null
          id?: string
          multiplier?: number | null
          output?: string
          shares?: number[] | null
          suppressed_by_clip?: boolean
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_decisions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "task_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          condition_type: string
          condition_value: number
          description: string | null
          icon: string
          id: string
          name: string
        }
        Insert: {
          condition_type: string
          condition_value: number
          description?: string | null
          icon: string
          id?: string
          name: string
        }
        Update: {
          condition_type?: string
          condition_value?: number
          description?: string | null
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      bandit_state: {
        Row: {
          a: number
          arm: string
          b: number
          n: number
          updated_at: string
        }
        Insert: {
          a?: number
          arm: string
          b?: number
          n?: number
          updated_at?: string
        }
        Update: {
          a?: number
          arm?: string
          b?: number
          n?: number
          updated_at?: string
        }
        Relationships: []
      }
      bank_items: {
        Row: {
          active: boolean
          bands: string[]
          domain: string
          explanation_ro: string
          id: string
          level: number
          misconceptions: Json
          prompt_ro: string
          reference_answer_ro: string
          rubric: Json
          tier: string
          version: number
        }
        Insert: {
          active?: boolean
          bands?: string[]
          domain: string
          explanation_ro: string
          id: string
          level: number
          misconceptions?: Json
          prompt_ro: string
          reference_answer_ro: string
          rubric: Json
          tier: string
          version?: number
        }
        Update: {
          active?: boolean
          bands?: string[]
          domain?: string
          explanation_ro?: string
          id?: string
          level?: number
          misconceptions?: Json
          prompt_ro?: string
          reference_answer_ro?: string
          rubric?: Json
          tier?: string
          version?: number
        }
        Relationships: []
      }
      consents: {
        Row: {
          given_at: string
          id: string
          kind: string
          learner_id: string
          version: string
        }
        Insert: {
          given_at?: string
          id?: string
          kind: string
          learner_id: string
          version: string
        }
        Update: {
          given_at?: string
          id?: string
          kind?: string
          learner_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["learner_id"]
          },
        ]
      }
      feedback_decisions: {
        Row: {
          arm: string
          attempt_id: string
          bandit_updated: boolean
          core_commit: string
          created_at: string
          delivered_arm: string
          excluded_reason: string | null
          feedback_text: string | null
          finalized_at: string | null
          half: string
          id: string
          llm_call_id: string | null
          posterior_snapshot: Json
          propensities: Json
          propensity: number
          reward: number | null
          thompson_probs: Json
          tutor_status: string
        }
        Insert: {
          arm: string
          attempt_id: string
          bandit_updated?: boolean
          core_commit: string
          created_at?: string
          delivered_arm: string
          excluded_reason?: string | null
          feedback_text?: string | null
          finalized_at?: string | null
          half: string
          id?: string
          llm_call_id?: string | null
          posterior_snapshot: Json
          propensities: Json
          propensity: number
          reward?: number | null
          thompson_probs: Json
          tutor_status: string
        }
        Update: {
          arm?: string
          attempt_id?: string
          bandit_updated?: boolean
          core_commit?: string
          created_at?: string
          delivered_arm?: string
          excluded_reason?: string | null
          feedback_text?: string | null
          finalized_at?: string | null
          half?: string
          id?: string
          llm_call_id?: string | null
          posterior_snapshot?: Json
          propensities?: Json
          propensity?: number
          reward?: number | null
          thompson_probs?: Json
          tutor_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_decisions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "task_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_decisions_llm_call_id_fkey"
            columns: ["llm_call_id"]
            isOneToOne: false
            referencedRelation: "llm_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      freshlearn_completions: {
        Row: {
          completion_date: string | null
          course_id: string
          course_name: string
          email: string
          enrollment_date: string | null
          id: number
          progress: number
          rating: number | null
          synced_at: string
        }
        Insert: {
          completion_date?: string | null
          course_id: string
          course_name: string
          email: string
          enrollment_date?: string | null
          id?: number
          progress?: number
          rating?: number | null
          synced_at?: string
        }
        Update: {
          completion_date?: string | null
          course_id?: string
          course_name?: string
          email?: string
          enrollment_date?: string | null
          id?: number
          progress?: number
          rating?: number | null
          synced_at?: string
        }
        Relationships: []
      }
      freshlearn_members: {
        Row: {
          city: string | null
          country: string | null
          email: string
          first_name: string | null
          fl_member_id: number | null
          full_name: string | null
          id: number
          joined_date: string | null
          last_name: string | null
          phone: string | null
          synced_at: string
          uid_number: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          email: string
          first_name?: string | null
          fl_member_id?: number | null
          full_name?: string | null
          id?: number
          joined_date?: string | null
          last_name?: string | null
          phone?: string | null
          synced_at?: string
          uid_number?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          email?: string
          first_name?: string | null
          fl_member_id?: number | null
          full_name?: string | null
          id?: number
          joined_date?: string | null
          last_name?: string | null
          phone?: string | null
          synced_at?: string
          uid_number?: string | null
        }
        Relationships: []
      }
      learners: {
        Row: {
          adaptive: boolean
          created_at: string
          grade_band: string | null
          learner_id: string
          user_id: string
        }
        Insert: {
          adaptive?: boolean
          created_at?: string
          grade_band?: string | null
          learner_id?: string
          user_id: string
        }
        Update: {
          adaptive?: boolean
          created_at?: string
          grade_band?: string | null
          learner_id?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_sessions: {
        Row: {
          absent_slots_before: number
          adaptive: boolean
          core_commit: string
          ended_at: string | null
          grade_band: string
          grader_model: string
          id: string
          learner_id: string
          planned_tasks: number
          prompt_version: string
          quit_early: boolean
          session_index: number
          started_at: string
          tutor_model: string
        }
        Insert: {
          absent_slots_before?: number
          adaptive: boolean
          core_commit: string
          ended_at?: string | null
          grade_band: string
          grader_model: string
          id?: string
          learner_id: string
          planned_tasks: number
          prompt_version: string
          quit_early?: boolean
          session_index: number
          started_at?: string
          tutor_model: string
        }
        Update: {
          absent_slots_before?: number
          adaptive?: boolean
          core_commit?: string
          ended_at?: string | null
          grade_band?: string
          grader_model?: string
          id?: string
          learner_id?: string
          planned_tasks?: number
          prompt_version?: string
          quit_early?: boolean
          session_index?: number
          started_at?: string
          tutor_model?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_sessions_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["learner_id"]
          },
        ]
      }
      llm_calls: {
        Row: {
          attempt: number
          created_at: string
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string
          output_tokens: number | null
          parsed: Json | null
          prompt_version: string
          provider: string
          purpose: string
          request: Json
          response_text: string | null
          session_id: string | null
          status: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          output_tokens?: number | null
          parsed?: Json | null
          prompt_version: string
          provider: string
          purpose: string
          request: Json
          response_text?: string | null
          session_id?: string | null
          status: string
        }
        Update: {
          attempt?: number
          created_at?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          output_tokens?: number | null
          parsed?: Json | null
          prompt_version?: string
          provider?: string
          purpose?: string
          request?: Json
          response_text?: string | null
          session_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          coins: number
          created_at: string
          energy: number
          energy_regen_at: string | null
          id: string
          last_active_date: string | null
          level: number
          nickname: string
          points: number
          streak_days: number
          updated_at: string
          username: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          coins?: number
          created_at?: string
          energy?: number
          energy_regen_at?: string | null
          id: string
          last_active_date?: string | null
          level?: number
          nickname?: string
          points?: number
          streak_days?: number
          updated_at?: string
          username: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          coins?: number
          created_at?: string
          energy?: number
          energy_regen_at?: string | null
          id?: string
          last_active_date?: string | null
          level?: number
          nickname?: string
          points?: number
          streak_days?: number
          updated_at?: string
          username?: string
          xp?: number
        }
        Relationships: []
      }
      questions: {
        Row: {
          hint: string | null
          id: string
          order_num: number
          prompt: string
          quest_id: string
          xp_reward: number
        }
        Insert: {
          hint?: string | null
          id?: string
          order_num?: number
          prompt: string
          quest_id: string
          xp_reward?: number
        }
        Update: {
          hint?: string | null
          id?: string
          order_num?: number
          prompt?: string
          quest_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          coin_reward: number
          created_at: string
          description: string | null
          id: string
          tier: Database["public"]["Enums"]["quest_tier"]
          title: string
          xp_required: number
          xp_reward: number
        }
        Insert: {
          coin_reward?: number
          created_at?: string
          description?: string | null
          id?: string
          tier?: Database["public"]["Enums"]["quest_tier"]
          title: string
          xp_required?: number
          xp_reward?: number
        }
        Update: {
          coin_reward?: number
          created_at?: string
          description?: string | null
          id?: string
          tier?: Database["public"]["Enums"]["quest_tier"]
          title?: string
          xp_required?: number
          xp_reward?: number
        }
        Relationships: []
      }
      task_attempts: {
        Row: {
          b: number | null
          completed_at: string | null
          created_at: string
          difficulty_used: number
          dont_know: boolean | null
          e: number | null
          e_used: number
          feedback_arm: string | null
          feedback_shown_at: string | null
          first_answer_at: string | null
          first_answer_text: string | null
          first_correct: boolean | null
          first_grader_status: string | null
          first_misconception: string | null
          first_score: number | null
          id: string
          learner_id: string
          multiplier: number | null
          retry_answer_at: string | null
          retry_answer_text: string | null
          retry_correct: boolean | null
          retry_dont_know: boolean | null
          retry_grader_status: string | null
          retry_score: number | null
          rt_ms: number | null
          session_id: string
          shown_at: string | null
          step: string
          task_id: string
          task_in_session: number
          task_level: number
          task_version: number
          u: number | null
          xp_awarded: number | null
        }
        Insert: {
          b?: number | null
          completed_at?: string | null
          created_at?: string
          difficulty_used: number
          dont_know?: boolean | null
          e?: number | null
          e_used: number
          feedback_arm?: string | null
          feedback_shown_at?: string | null
          first_answer_at?: string | null
          first_answer_text?: string | null
          first_correct?: boolean | null
          first_grader_status?: string | null
          first_misconception?: string | null
          first_score?: number | null
          id?: string
          learner_id: string
          multiplier?: number | null
          retry_answer_at?: string | null
          retry_answer_text?: string | null
          retry_correct?: boolean | null
          retry_dont_know?: boolean | null
          retry_grader_status?: string | null
          retry_score?: number | null
          rt_ms?: number | null
          session_id: string
          shown_at?: string | null
          step?: string
          task_id: string
          task_in_session: number
          task_level: number
          task_version: number
          u?: number | null
          xp_awarded?: number | null
        }
        Update: {
          b?: number | null
          completed_at?: string | null
          created_at?: string
          difficulty_used?: number
          dont_know?: boolean | null
          e?: number | null
          e_used?: number
          feedback_arm?: string | null
          feedback_shown_at?: string | null
          first_answer_at?: string | null
          first_answer_text?: string | null
          first_correct?: boolean | null
          first_grader_status?: string | null
          first_misconception?: string | null
          first_score?: number | null
          id?: string
          learner_id?: string
          multiplier?: number | null
          retry_answer_at?: string | null
          retry_answer_text?: string | null
          retry_correct?: boolean | null
          retry_dont_know?: boolean | null
          retry_grader_status?: string | null
          retry_score?: number | null
          rt_ms?: number | null
          session_id?: string
          shown_at?: string | null
          step?: string
          task_id?: string
          task_in_session?: number
          task_level?: number
          task_version?: number
          u?: number | null
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attempts_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["learner_id"]
          },
          {
            foreignKeyName: "task_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attempts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "bank_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          id: string
          is_daily: boolean
          title: string
          xp_reward: number
        }
        Insert: {
          id?: string
          is_daily?: boolean
          title: string
          xp_reward?: number
        }
        Update: {
          id?: string
          is_daily?: boolean
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      user_answers: {
        Row: {
          answer_text: string
          id: string
          question_id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          answer_text: string
          id?: string
          question_id: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          answer_text?: string
          id?: string
          question_id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_quests: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          quest_id: string
          started_at: string
          user_id: string
          xp_progress: number
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          quest_id: string
          started_at?: string
          user_id: string
          xp_progress?: number
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          quest_id?: string
          started_at?: string
          user_id?: string
          xp_progress?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_quests_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_quests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_quests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          task_date: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          task_date?: string
          task_id: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          task_date?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null
          id: string | null
          level: number | null
          points: number | null
          rank: number | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_learner_data: { Args: { p_user: string }; Returns: undefined }
      finalize_feedback: {
        Args: {
          p_decision: string
          p_excluded: string
          p_reward: number
          p_update: boolean
        }
        Returns: boolean
      }
      generate_nickname: { Args: never; Returns: string }
      purge_learning_data: { Args: { p_cutoff: string }; Returns: number }
    }
    Enums: {
      quest_tier: "bronze" | "silver" | "gold" | "diamond"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      quest_tier: ["bronze", "silver", "gold", "diamond"],
    },
  },
} as const
