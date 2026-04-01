'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
  doc,
  onSnapshot,
  updateDoc,
  increment,
  arrayUnion,
} from 'firebase/firestore';

// ── Types ──

type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: UserStats) => boolean;
};

type UserStats = {
  xp: number;
  badges: string[];
  total_pomodoros: number;
  total_hours: number;
  total_sessions: number;
  streak_days: number;
  friends_count: number;
  milestones_completed: number;
  projects_joined: number;
  has_session_after_midnight: boolean;
  has_session_before_7am: boolean;
  // New stats for additional badges
  accountability_partners: number;
  checkins_completed: number;
  engagements_completed_weeks: number;
  messages_sent: number;
  coworking_sessions: number;
  roadmaps_generated: number;
  objectives_completed: number;
  projects_created: number;
  has_saturday_session: boolean;
  has_sunday_session: boolean;
};

type XPToast = {
  amount: number;
  reason: string;
} | null;

type GamificationContextType = {
  xp: number;
  level: number;
  badges: string[];
  stats: UserStats;
  addXP: (amount: number, reason: string) => void;
  checkBadges: () => void;
  showXPToast: XPToast;
  dismissToast: () => void;
  xpForLevel: (level: number) => number;
  xpForNextLevel: (level: number) => number;
  newlyEarnedBadge: string | null;
  dismissBadgeCelebration: () => void;
};

// ── XP Rewards ──

export const XP_REWARDS = {
  POMODORO_COMPLETE: 25,
  DAILY_CHECKIN: 15,
  FIRST_SESSION_OF_DAY: 50,
  MILESTONE_COMPLETE: 100,
  SEVEN_DAY_STREAK: 200,
} as const;

// ── Level Calculations ──

function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 100;
}

function xpForNextLevel(level: number): number {
  return Math.pow(level, 2) * 100;
}

// ── Badges ──

const BADGES: Badge[] = [
  {
    id: 'premier_pas',
    name: 'Premier pas',
    description: 'Completer sa premiere session',
    icon: '👣',
    condition: (s) => s.total_sessions >= 1,
  },
  {
    id: 'flamme',
    name: 'Flamme',
    description: 'Maintenir une serie de 7 jours',
    icon: '🔥',
    condition: (s) => s.streak_days >= 7,
  },
  {
    id: 'centurion',
    name: 'Centurion',
    description: 'Completer 100 pomodoros',
    icon: '🏛️',
    condition: (s) => s.total_pomodoros >= 100,
  },
  {
    id: 'marathonien',
    name: 'Marathonien',
    description: 'Accumuler 50 heures de travail',
    icon: '🏃',
    condition: (s) => s.total_hours >= 50,
  },
  {
    id: 'architecte',
    name: 'Architecte',
    description: 'Completer 10 jalons',
    icon: '🏗️',
    condition: (s) => s.milestones_completed >= 10,
  },
  {
    id: 'social',
    name: 'Social',
    description: 'Ajouter 5 amis',
    icon: '🤝',
    condition: (s) => s.friends_count >= 5,
  },
  {
    id: 'noctambule',
    name: 'Noctambule',
    description: 'Faire une session apres minuit',
    icon: '🦉',
    condition: (s) => s.has_session_after_midnight,
  },
  {
    id: 'leve_tot',
    name: 'Leve-tot',
    description: 'Faire une session avant 7h du matin',
    icon: '🌅',
    condition: (s) => s.has_session_before_7am,
  },
  {
    id: 'equipier',
    name: 'Equipier',
    description: 'Rejoindre 3 projets',
    icon: '👥',
    condition: (s) => s.projects_joined >= 3,
  },
  // ── Progression & Mastery ──
  {
    id: 'declic',
    name: 'Déclic',
    description: 'Compléter 10 sessions',
    icon: '⚡',
    condition: (s) => s.total_sessions >= 10,
  },
  {
    id: 'diamant',
    name: 'Diamant',
    description: 'Accumuler 200 heures de travail',
    icon: '💎',
    condition: (s) => s.total_hours >= 200,
  },
  {
    id: 'legende',
    name: 'Légende',
    description: 'Compléter 500 pomodoros',
    icon: '👑',
    condition: (s) => s.total_pomodoros >= 500,
  },
  {
    id: 'infernal',
    name: 'Infernal',
    description: 'Maintenir une série de 30 jours',
    icon: '🌋',
    condition: (s) => s.streak_days >= 30,
  },
  {
    id: 'inarretable',
    name: 'Inarrêtable',
    description: 'Maintenir une série de 100 jours',
    icon: '🧊',
    condition: (s) => s.streak_days >= 100,
  },
  // ── Accountability ──
  {
    id: 'gardien',
    name: 'Gardien',
    description: 'Avoir un partenaire de discipline',
    icon: '🛡️',
    condition: (s) => s.accountability_partners >= 1,
  },
  {
    id: 'discipline',
    name: 'Discipliné',
    description: 'Compléter 7 check-ins quotidiens',
    icon: '📋',
    condition: (s) => s.checkins_completed >= 7,
  },
  {
    id: 'engage',
    name: 'Engagé',
    description: 'Compléter tous ses engagements 4 semaines de suite',
    icon: '🎯',
    condition: (s) => s.engagements_completed_weeks >= 4,
  },
  // ── Collaboration & Social ──
  {
    id: 'communicant',
    name: 'Communicant',
    description: 'Envoyer 50 messages dans les salons',
    icon: '💬',
    condition: (s) => s.messages_sent >= 50,
  },
  {
    id: 'ambassadeur',
    name: 'Ambassadeur',
    description: 'Ajouter 20 amis',
    icon: '🌍',
    condition: (s) => s.friends_count >= 20,
  },
  {
    id: 'coworker',
    name: 'Coworker',
    description: 'Rejoindre 5 sessions de coworking',
    icon: '📡',
    condition: (s) => s.coworking_sessions >= 5,
  },
  // ── Objectives & Projects ──
  {
    id: 'stratege',
    name: 'Stratège',
    description: 'Générer une roadmap IA',
    icon: '🗺️',
    condition: (s) => s.roadmaps_generated >= 1,
  },
  {
    id: 'conquerant',
    name: 'Conquérant',
    description: 'Compléter un objectif à 100%',
    icon: '🏆',
    condition: (s) => s.objectives_completed >= 1,
  },
  {
    id: 'batisseur',
    name: 'Bâtisseur',
    description: 'Créer 3 projets',
    icon: '📦',
    condition: (s) => s.projects_created >= 3,
  },
  // ── Special / Fun ──
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Faire une session le samedi ET le dimanche',
    icon: '🎃',
    condition: (s) => s.has_saturday_session && s.has_sunday_session,
  },
];

// ── Default Stats ──

const DEFAULT_STATS: UserStats = {
  xp: 0,
  badges: [],
  total_pomodoros: 0,
  total_hours: 0,
  total_sessions: 0,
  streak_days: 0,
  friends_count: 0,
  milestones_completed: 0,
  projects_joined: 0,
  has_session_after_midnight: false,
  has_session_before_7am: false,
  accountability_partners: 0,
  checkins_completed: 0,
  engagements_completed_weeks: 0,
  messages_sent: 0,
  coworking_sessions: 0,
  roadmaps_generated: 0,
  objectives_completed: 0,
  projects_created: 0,
  has_saturday_session: false,
  has_sunday_session: false,
};

// ── Context ──

const GamificationContext = createContext<GamificationContextType>({
  xp: 0,
  level: 1,
  badges: [],
  stats: DEFAULT_STATS,
  addXP: () => {},
  checkBadges: () => {},
  showXPToast: null,
  dismissToast: () => {},
  xpForLevel,
  xpForNextLevel,
  newlyEarnedBadge: null,
  dismissBadgeCelebration: () => {},
});

export const GamificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
  const [showXPToast, setShowXPToast] = useState<XPToast>(null);
  const [newlyEarnedBadge, setNewlyEarnedBadge] = useState<string | null>(null);
  const badgeQueueRef = useRef<string[]>([]);

  const xp = stats.xp;
  const level = calculateLevel(xp);
  const badges = stats.badges;

  useEffect(() => {
    if (!user) {
      setStats(DEFAULT_STATS);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setStats({
        xp: data.xp ?? 0,
        badges: data.badges ?? [],
        total_pomodoros: data.total_pomodoros ?? 0,
        total_hours: data.total_hours ?? 0,
        total_sessions: data.total_sessions ?? 0,
        streak_days: data.streak_days ?? 0,
        friends_count: data.friends_count ?? 0,
        milestones_completed: data.milestones_completed ?? 0,
        projects_joined: data.projects_joined ?? 0,
        has_session_after_midnight: data.has_session_after_midnight ?? false,
        has_session_before_7am: data.has_session_before_7am ?? false,
        accountability_partners: data.accountability_partners ?? 0,
        checkins_completed: data.checkins_completed ?? 0,
        engagements_completed_weeks: data.engagements_completed_weeks ?? 0,
        messages_sent: data.messages_sent ?? 0,
        coworking_sessions: data.coworking_sessions ?? 0,
        roadmaps_generated: data.roadmaps_generated ?? 0,
        objectives_completed: data.objectives_completed ?? 0,
        projects_created: data.projects_created ?? 0,
        has_saturday_session: data.has_saturday_session ?? false,
        has_sunday_session: data.has_sunday_session ?? false,
      });
    });

    return () => unsubscribe();
  }, [user]);

  const addXP = useCallback(
    (amount: number, reason: string) => {
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      updateDoc(userRef, { xp: increment(amount) }).catch(console.error);
      setShowXPToast({ amount, reason });
    },
    [user],
  );

  const checkBadges = useCallback(() => {
    if (!user) return;

    const newBadgeIds = BADGES.filter(
      (badge) => !stats.badges.includes(badge.id) && badge.condition(stats),
    ).map((b) => b.id);

    if (newBadgeIds.length === 0) return;

    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, { badges: arrayUnion(...newBadgeIds) }).catch(console.error);

    // Trigger celebration for newly earned badges
    badgeQueueRef.current = [...badgeQueueRef.current, ...newBadgeIds];
    if (!newlyEarnedBadge) {
      setNewlyEarnedBadge(badgeQueueRef.current.shift()!);
    }
  }, [user, stats, newlyEarnedBadge]);

  // Auto-check badges whenever stats change
  useEffect(() => {
    if (user) checkBadges();
  }, [user, stats, checkBadges]);

  const dismissToast = useCallback(() => {
    setShowXPToast(null);
  }, []);

  const dismissBadgeCelebration = useCallback(() => {
    setNewlyEarnedBadge(null);
    // Show next badge in queue if any
    setTimeout(() => {
      if (badgeQueueRef.current.length > 0) {
        setNewlyEarnedBadge(badgeQueueRef.current.shift()!);
      }
    }, 600);
  }, []);

  return (
    <GamificationContext.Provider
      value={{
        xp,
        level,
        badges,
        stats,
        addXP,
        checkBadges,
        showXPToast,
        dismissToast,
        xpForLevel,
        xpForNextLevel,
        newlyEarnedBadge,
        dismissBadgeCelebration,
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => useContext(GamificationContext);

export { BADGES };
export type { Badge, UserStats, XPToast };
