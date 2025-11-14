
// Defines the possible goals.
export type GoalType = 'weight_loss' | 'muscle_gain' | 'recomposition';

// 메인 사용자 프로필 (새 디자인에 맞게 업데이트)
export interface Profile {
    status: 'new_user' | 'active_user';
    name: string;
    email: string;
    goal: GoalType; // <-- UPDATED: Now uses our new GoalType
    weight_kg: string; // Current Weight
    start_weight_kg: string;
    goal_weight_kg: string;
    height_cm: string;
    age: string;
    gender: string;
    bmi: string;
    body_fat_percentage: string;
    activity_level: string;
    allergies: string;
    plans?: {
        diet_plan: DietPlan;
        workout_plan: WorkoutPlan[];
    };
}

// 식단 계획 (water 제거)
export interface DietPlan {
    daily_calories_goal: number;
    daily_protein_goal_g: number;
    daily_carbs_goal_g: number;
    daily_fat_goal_g: number;
    notes: string;
}

// (Exercise and WorkoutPlan remain the same)
export interface Exercise {
    name: string;
    sets_reps: string;
    youtube_link?: string;
}
export interface WorkoutPlan {
    day: string;
    exercises: Exercise[];
}

// 매크로 세트 (water 제거)
export interface MacroSet {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

// 일일 매크로 요약 (water 제거)
export interface Summary {
    total: MacroSet;
    goal: MacroSet;
}

// 글로벌 React Context
export interface AppContextType {
    profile: Profile | null;
    setProfile: (profile: Profile | null) => void;
}

export interface User {
    _id: string | number;
    name?: string;
    avatar?: string;
}

export interface IMessage {
    _id: string | number;
    text: string;
    createdAt: Date | number;
    user: User;
    // You can add these other optional fields if you need them
    image?: string;
    video?: string;
    audio?: string;
    system?: boolean;
    sent?: boolean;
    received?: boolean;
    pending?: boolean;
}