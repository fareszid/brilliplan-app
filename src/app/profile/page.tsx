'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth, db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, orderBy, limit as fbLimit } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, updateProfile, deleteUser, signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useLocale } from '@/context/LocaleContext';
import { useUI } from '@/context/UIContext';
import { Save, User as UserIcon, ShieldCheck, Lock, Target, Clock, ShieldX, Image as ImageIcon, X, Check, Sparkles, RefreshCw, Upload, MapPin, ChevronDown, ChevronUp, CalendarDays, Settings, Bell, Globe, Trash2, AlertTriangle, LogOut, Activity, Download, BarChart3, Flame, Timer, Eye, EyeOff } from 'lucide-react';
import { COUNTRIES } from '@/lib/countries';
import { AVATAR_PRESETS, getAvatarUrl } from '@/lib/avatarPresets';
import { authFetch } from '@/lib/authFetch';
import { validateImageUpload } from '@/lib/uploadValidation';
import { useTabParam } from '@/hooks/useTabParam';
import { useRouter } from 'next/navigation';
import { deleteDoc } from 'firebase/firestore';
import ProgressInsights from '@/components/ProgressInsights';
import { ActivityHeatmap, RadialClock, CategoryDonut, StreakCalendar, CumulativeLine } from '@/components/ActivityVisualizations';
import GamificationProfile from '@/components/GamificationProfile';

const fmtHours = (h: number) => h < 1 ? `${Math.round(h * 60)}min` : `${parseFloat(h.toFixed(2))}h`;
const fmtDuration = (h: number) => {
    if (h < 1 / 60) return '<1min';
    if (h < 1) return `${Math.round(h * 60)}min`;
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins > 0 ? `${hrs}h${mins.toString().padStart(2, '0')}` : `${hrs}h`;
};

interface SessionLog {
    id: string;
    objective_id: string;
    type: string;
    title: string;
    started_at: Date;
    ended_at: Date;
    duration_hours: number;
    pomodoros: number;
}

type Tab = 'profile' | 'discipline' | 'security' | 'settings' | 'activity';

function ProfileContent() {
    const { user, loading } = useAuth();
    const { t, locale, setLocale } = useLocale();
    const { setNavbarVisible } = useUI();

    const [activeTab, setActiveTab] = useTabParam<Tab>('tab', 'profile');

    const [name, setName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('');
    const [photoMode, setPhotoMode] = useState<'avatar' | 'upload'>('avatar');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [email, setEmail] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarStyle, setAvatarStyle] = useState('1');
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [pendingStyle, setPendingStyle] = useState('1');

    const [country, setCountry] = useState('');
    const [city, setCity] = useState('');
    const [countrySearch, setCountrySearch] = useState('');
    const [countryOpen, setCountryOpen] = useState(false);
    const countryRef = useRef<HTMLDivElement>(null);

    const [createdAt, setCreatedAt] = useState<Date | null>(null);

    const [totalHours, setTotalHours] = useState(0);
    const [totalRooms, setTotalRooms] = useState(0);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [saving, setSaving] = useState(false);
    const [updatingPassword, setUpdatingPassword] = useState(false);

    const [message, setMessage] = useState({ text: '', type: 'success' });
    const [pwdMessage, setPwdMessage] = useState({ text: '', type: 'success' });

    // Settings
    const router = useRouter();
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [notifFriends, setNotifFriends] = useState(true);
    const [notifSessions, setNotifSessions] = useState(true);
    const [notifMessages, setNotifMessages] = useState(true);
    const [showSalonsOnProfile, setShowSalonsOnProfile] = useState(true);
    const [notifReminders, setNotifReminders] = useState(true);

    // Discipline profile
    const [disciplineProfile, setDisciplineProfile] = useState<any>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [showProfileForm, setShowProfileForm] = useState(false);
    // Questionnaire — multi-choice where marked
    const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
    const [mainChallenges, setMainChallenges] = useState<string[]>([]);
    const [workStyle, setWorkStyle] = useState('');
    const [motivators, setMotivators] = useState<string[]>([]);
    const [motivationDip, setMotivationDip] = useState('');

    // Activity / Session history
    const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [activityRange, setActivityRange] = useState<'week' | 'month' | 'all'>('week');
    const [loginStreak, setLoginStreak] = useState(0);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showAllSessions, setShowAllSessions] = useState(false);

    // RGPD export
    const [exporting, setExporting] = useState(false);
    const [exportConfirm, setExportConfirm] = useState(false);
    const [exportPassword, setExportPassword] = useState('');
    const [exportError, setExportError] = useState('');

    // Close country dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (countryRef.current && !countryRef.current.contains(e.target as Node)) setCountryOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectedCountry = COUNTRIES.find(c => c.code === country);
    const filteredCountries = countrySearch
        ? COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.toLowerCase().includes(countrySearch.toLowerCase()))
        : COUNTRIES;

    const toggleMulti = (arr: string[], val: string, max: number): string[] => {
        if (arr.includes(val)) return arr.filter(v => v !== val);
        if (arr.length >= max) return arr;
        return [...arr, val];
    };

    useEffect(() => {
        if (!user) return;
        setEmail(user.email || '');

        // Real-time profile doc
        const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setName(data.full_name || '');
                setFirstName(data.first_name || '');
                setLastName(data.last_name || '');
                setUsername(data.username || '');
                if (data.avatar_url) { setUploadedPhotoUrl(data.avatar_url); setPhotoMode('upload'); }
                if (data.avatar_style) { setAvatarStyle(data.avatar_style); setPendingStyle(data.avatar_style); }
                if (data.avatar_url) setAvatarUrl(data.avatar_url);
                if (data.created_at?.toDate) setCreatedAt(data.created_at.toDate());
                if (data.country) setCountry(data.country);
                if (data.city) setCity(data.city);
                if (data.notif_prefs) {
                    const np = data.notif_prefs;
                    if (np.friends !== undefined) setNotifFriends(np.friends);
                    if (np.sessions !== undefined) setNotifSessions(np.sessions);
                    if (np.messages !== undefined) setNotifMessages(np.messages);
                    if (np.reminders !== undefined) setNotifReminders(np.reminders);
                }
                if (data.show_salons_on_profile !== undefined) setShowSalonsOnProfile(data.show_salons_on_profile);
                if (data.discipline_profile) setDisciplineProfile(data.discipline_profile);
                if (data.discipline_questionnaire) {
                    const q = data.discipline_questionnaire;
                    if (q.preferredTimes) setPreferredTimes(q.preferredTimes);
                    if (q.mainChallenges) setMainChallenges(q.mainChallenges);
                    if (q.workStyle) setWorkStyle(q.workStyle);
                    if (q.motivationDip) setMotivationDip(q.motivationDip);
                    if (q.motivators) setMotivators(q.motivators);
                }
                // Streak from user doc (login-based, single source of truth)
                setLoginStreak(data.streak_days ?? 0);
            }
        });

        // Real-time membership stats
        const unsubMem = onSnapshot(query(collection(db, 'memberships'), where('user_id', '==', user.uid)), (snap) => {
            let hours = 0, rooms = 0;
            snap.forEach(d => { rooms++; hours += d.data().completed_hours || 0; });
            setTotalRooms(rooms);
            setTotalHours(hours);
        });

        return () => { unsubProfile(); unsubMem(); };
    }, [user]);

    // Load session logs when Activity tab is active
    useEffect(() => {
        if (!user || activeTab !== 'activity') return;
        setSessionsLoading(true);
        const q = query(
            collection(db, 'session_logs'),
            where('user_id', '==', user.uid),
            orderBy('started_at', 'desc'),
            fbLimit(200)
        );
        const unsub = onSnapshot(q, snap => {
            setSessionLogs(snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    objective_id: data.objective_id || '',
                    type: data.type || 'objective',
                    title: data.title || 'Session',
                    started_at: data.started_at?.toDate?.() || new Date(data.started_at),
                    ended_at: data.ended_at?.toDate?.() || new Date(data.ended_at),
                    duration_hours: data.duration_hours || 0,
                    pomodoros: data.pomodoros || 0,
                };
            }));
            setSessionsLoading(false);
        });
        return () => unsub();
    }, [user, activeTab]);

    // Computed activity stats
    const activityStats = useMemo(() => {
        const now = new Date();
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);

        const cutoff = activityRange === 'week' ? weekAgo : activityRange === 'month' ? monthAgo : new Date(0);
        const filtered = sessionLogs.filter(s => s.started_at >= cutoff);

        const totalHrs = filtered.reduce((sum, s) => sum + s.duration_hours, 0);
        const totalPoms = filtered.reduce((sum, s) => sum + s.pomodoros, 0);
        const sessionCount = filtered.length;

        // Daily breakdown for chart (last 7 or 30 days)
        const days = activityRange === 'week' ? 7 : activityRange === 'month' ? 30 : 30;
        const dailyMap: Record<string, number> = {};
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now); d.setDate(d.getDate() - i);
            dailyMap[d.toISOString().slice(0, 10)] = 0;
        }
        filtered.forEach(s => {
            const key = s.started_at.toISOString().slice(0, 10);
            if (key in dailyMap) dailyMap[key] += s.duration_hours;
        });

        const dailyData = Object.entries(dailyMap).map(([date, hours]) => ({ date, hours }));
        const maxHours = Math.max(...dailyData.map(d => d.hours), 0.5);

        return { totalHrs, totalPoms, sessionCount, dailyData, maxHours, filtered };
    }, [sessionLogs, activityRange]);

    // RGPD data export — requires re-authentication
    const handleExportData = async () => {
        if (!user || !user.email) return;
        setExporting(true);
        setExportError('');
        try {
            // Re-authenticate before exporting sensitive data
            const credential = EmailAuthProvider.credential(user.email, exportPassword);
            await reauthenticateWithCredential(user, credential);

            const exportData: Record<string, any> = {};

            // User profile
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) exportData.profile = userDoc.data();

            // Memberships (objectives)
            const memSnap = await getDocs(query(collection(db, 'memberships'), where('user_id', '==', user.uid)));
            exportData.memberships = memSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Project memberships
            const pmSnap = await getDocs(query(collection(db, 'project_memberships'), where('user_id', '==', user.uid)));
            exportData.project_memberships = pmSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Friendships
            const f1 = await getDocs(query(collection(db, 'friendships'), where('user1_id', '==', user.uid)));
            const f2 = await getDocs(query(collection(db, 'friendships'), where('user2_id', '==', user.uid)));
            exportData.friendships = [...f1.docs, ...f2.docs].map(d => ({ id: d.id, ...d.data() }));

            // Accountability pairs
            const a1 = await getDocs(query(collection(db, 'accountability_pairs'), where('user1_id', '==', user.uid)));
            const a2 = await getDocs(query(collection(db, 'accountability_pairs'), where('user2_id', '==', user.uid)));
            exportData.accountability_pairs = [...a1.docs, ...a2.docs].map(d => ({ id: d.id, ...d.data() }));

            // Session logs
            const slSnap = await getDocs(query(collection(db, 'session_logs'), where('user_id', '==', user.uid)));
            exportData.session_logs = slSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Notifications
            const notifSnap = await getDocs(collection(db, 'users', user.uid, 'notifications'));
            exportData.notifications = notifSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Presence
            const presDoc = await getDoc(doc(db, 'presence_global', user.uid));
            if (presDoc.exists()) exportData.presence = presDoc.data();

            // Serialize timestamps
            const serialize = (obj: any): any => {
                if (obj === null || obj === undefined) return obj;
                if (obj?.toDate) return obj.toDate().toISOString();
                if (obj instanceof Date) return obj.toISOString();
                if (Array.isArray(obj)) return obj.map(serialize);
                if (typeof obj === 'object') {
                    const result: Record<string, any> = {};
                    for (const [k, v] of Object.entries(obj)) result[k] = serialize(v);
                    return result;
                }
                return obj;
            };

            const json = JSON.stringify(serialize(exportData), null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `brilliplan-export-${user.uid.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setExportConfirm(false);
            setExportPassword('');
        } catch (err: any) {
            console.error('Export failed:', err);
            const msgs: Record<string, string> = {
                'auth/invalid-credential': 'Mot de passe incorrect.',
                'auth/wrong-password': 'Mot de passe incorrect.',
                'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
            };
            setExportError(msgs[err?.code] || 'Erreur lors de l\'export. Réessaie.');
        } finally {
            setExporting(false);
        }
    };

    const handleGenerateProfile = async () => {
        const canGenerate = preferredTimes.length > 0 && mainChallenges.length > 0 && workStyle;
        if (!user || !canGenerate || profileLoading) return;
        setProfileLoading(true);
        try {
            const res = await authFetch('/api/discipline-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    totalHours: parseFloat(totalHours.toFixed(1)),
                    totalObjectives: totalRooms,
                    totalPairs: 0,
                    preferredTimes,
                    mainChallenges,
                    workStyle,
                    motivators,
                    motivationDip,
                    userName: name || 'l\'utilisateur',
                }),
            });
            const profile = await res.json();
            setDisciplineProfile(profile);
            setShowProfileForm(false);
            await setDoc(doc(db, 'users', user.uid), { discipline_profile: profile }, { merge: true });
        } catch (err) { console.error(err); }
        finally { setProfileLoading(false); }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);
        setMessage({ text: '', type: 'success' });
        try {
            const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || name;
            await setDoc(doc(db, 'users', user.uid), {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                full_name: fullName,
                username: username.trim(),
                avatar_style: avatarStyle,
                country: country || '',
                city: city.trim(),
                ...(uploadedPhotoUrl && photoMode === 'upload' ? { avatar_url: uploadedPhotoUrl } : { avatar_url: '' }),
            }, { merge: true });
            await updateProfile(user, { displayName: fullName });
            setName(fullName);
            setMessage({ text: t('profile_success') || 'Profil mis à jour avec succès.', type: 'success' });
            setTimeout(() => setMessage({ text: '', type: 'success' }), 4000);
        } catch {
            setMessage({ text: 'Erreur lors de la sauvegarde du profil.', type: 'error' });
        } finally { setSaving(false); }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.email) return;
        if (newPassword !== confirmPassword) { setPwdMessage({ text: 'Les mots de passe ne correspondent pas.', type: 'error' }); return; }
        if (newPassword.length < 6) { setPwdMessage({ text: 'Minimum 6 caractères requis.', type: 'error' }); return; }
        setUpdatingPassword(true);
        setPwdMessage({ text: '', type: 'success' });
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            setPwdMessage({ text: 'Mot de passe mis à jour avec succès !', type: 'success' });
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
            setTimeout(() => setPwdMessage({ text: '', type: 'success' }), 4000);
        } catch (error: any) {
            const msgs: Record<string, string> = {
                'auth/invalid-credential': 'Mot de passe actuel incorrect.',
                'auth/wrong-password': 'Mot de passe actuel incorrect.',
                'auth/weak-password': 'Nouveau mot de passe trop faible (6 caractères minimum).',
                'auth/requires-recent-login': 'Reconnecte-toi avant de changer ton mot de passe.',
                'auth/too-many-requests': 'Trop de tentatives. Patiente quelques minutes.',
                'auth/network-request-failed': 'Impossible de se connecter. Vérifie ta connexion internet.',
            };
            setPwdMessage({ text: msgs[error.code] || 'Erreur lors du changement de mot de passe.', type: 'error' });
        } finally { setUpdatingPassword(false); }
    };

    const confirmAvatarSelection = () => {
        setAvatarStyle(pendingStyle);
        setShowAvatarModal(false);
        setNavbarVisible(true);
    };

    const handleOpenAvatarModal = () => {
        setPendingStyle(avatarStyle);
        setShowAvatarModal(true);
        setNavbarVisible(false);
    };

    const handleCloseAvatarModal = () => {
        setShowAvatarModal(false);
        setNavbarVisible(true);
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        const uploadErr = validateImageUpload(file);
        if (uploadErr) { alert(uploadErr); return; }
        setUploading(true);
        try {
            const storageRef = ref(storage, `avatars/${user.uid}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setUploadedPhotoUrl(url);
            setPhotoMode('upload');
            await setDoc(doc(db, 'users', user.uid), { avatar_url: url }, { merge: true });
        } catch (err) { console.error(err); }
        finally { setUploading(false); }
    };

    const handleSaveNotifPrefs = async (key: string, value: boolean) => {
        if (!user) return;
        const prefs = { friends: notifFriends, sessions: notifSessions, messages: notifMessages, reminders: notifReminders, [key]: value };
        await setDoc(doc(db, 'users', user.uid), { notif_prefs: prefs }, { merge: true });
    };

    const handleDeleteAccount = async () => {
        if (!user || !user.email) return;
        setDeleteLoading(true);
        setDeleteError('');
        try {
            const credential = EmailAuthProvider.credential(user.email, deletePassword);
            await reauthenticateWithCredential(user, credential);
            const uid = user.uid;

            // Helper: delete all docs matching a query
            const deleteQuery = async (q: any) => {
                const snap = await getDocs(q);
                await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
            };

            // Helper: delete all docs in a subcollection
            const deleteSub = async (parentPath: string, subName: string) => {
                const snap = await getDocs(collection(db, parentPath, subName));
                await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
            };

            // Delete objectives owned by user (and their subcollections)
            const ownedObjs = await getDocs(query(collection(db, 'objectives'), where('owner_id', '==', uid)));
            for (const objDoc of ownedObjs.docs) {
                const objPath = `objectives/${objDoc.id}`;
                for (const sub of ['tasks', 'messages', 'resources', 'sprints', 'milestones', 'presence', 'live_session', 'activity']) {
                    await deleteSub(objPath, sub).catch(() => {});
                }
                await deleteDoc(objDoc.ref);
            }

            // Delete projects owned by user (and their subcollections)
            const ownedProjs = await getDocs(query(collection(db, 'projects'), where('owner_id', '==', uid)));
            for (const projDoc of ownedProjs.docs) {
                const projPath = `projects/${projDoc.id}`;
                for (const sub of ['tasks', 'messages', 'resources', 'sprints', 'milestones', 'presence', 'live_session', 'activity']) {
                    await deleteSub(projPath, sub).catch(() => {});
                }
                await deleteDoc(projDoc.ref);
            }

            // Delete memberships (objective)
            await deleteQuery(query(collection(db, 'memberships'), where('user_id', '==', uid)));

            // Delete project memberships
            await deleteQuery(query(collection(db, 'project_memberships'), where('user_id', '==', uid)));

            // Delete friendships (both directions)
            await deleteQuery(query(collection(db, 'friendships'), where('from_uid', '==', uid)));
            await deleteQuery(query(collection(db, 'friendships'), where('to_uid', '==', uid)));

            // Delete accountability pairs (both directions)
            await deleteQuery(query(collection(db, 'accountability_pairs'), where('user1_id', '==', uid)));
            await deleteQuery(query(collection(db, 'accountability_pairs'), where('user2_id', '==', uid)));

            // Delete teammate requests (created by user)
            await deleteQuery(query(collection(db, 'teammate_requests'), where('creator_id', '==', uid)));

            // Delete blocks (by user)
            await deleteQuery(query(collection(db, 'blocks'), where('user_id', '==', uid)));

            // Delete session logs
            await deleteQuery(query(collection(db, 'session_logs'), where('user_id', '==', uid)));

            // Delete notifications subcollection
            await deleteSub(`users/${uid}`, 'notifications').catch(() => {});
            await deleteSub(`users/${uid}`, 'messages').catch(() => {});

            // Delete user doc & presence
            await deleteDoc(doc(db, 'users', uid));
            await deleteDoc(doc(db, 'presence_global', uid)).catch(() => {});

            // Delete email index entry
            if (user.email) {
                await deleteDoc(doc(db, 'email_index', user.email)).catch(() => {});
            }

            // Delete username index entry
            const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
            if (userSnap?.exists() && userSnap.data().username) {
                await deleteDoc(doc(db, 'username_index', userSnap.data().username)).catch(() => {});
            }

            // Delete Firebase Auth account
            await deleteUser(user);
            router.push('/login');
        } catch (err: any) {
            const msgs: Record<string, string> = {
                'auth/invalid-credential': 'Mot de passe incorrect.',
                'auth/wrong-password': 'Mot de passe incorrect.',
                'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
                'auth/requires-recent-login': 'Reconnecte-toi puis réessaie.',
            };
            setDeleteError(msgs[err.code] || 'Erreur lors de la suppression.');
        } finally { setDeleteLoading(false); }
    };

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    };

    if (loading) return <div className="container py-16 text-center">Chargement...</div>;
    if (!user) return <div className="container py-16 text-center">Non autorisé</div>;

    const currentPreset = AVATAR_PRESETS.find(s => s.id === avatarStyle) || AVATAR_PRESETS[0];
    const dynamicAvatarUrl = (photoMode === 'upload' && uploadedPhotoUrl) ? uploadedPhotoUrl : (avatarUrl || getAvatarUrl(currentPreset.style, currentPreset.seed));
    const pendingPreset = AVATAR_PRESETS.find(s => s.id === pendingStyle) || AVATAR_PRESETS[0];

    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'profile',    label: 'Mon Profil',  icon: '👤' },
        { id: 'activity',   label: 'Activité',    icon: '📊' },
        { id: 'discipline', label: 'Discipline',  icon: '🧠' },
        { id: 'security',   label: 'Sécurité',    icon: '🔒' },
        { id: 'settings',   label: 'Paramètres',  icon: '⚙️' },
    ];

    const questionnaireDone = [
        preferredTimes.length > 0,
        mainChallenges.length > 0,
        !!workStyle,
        motivators.length > 0,
        !!motivationDip,
    ].filter(Boolean).length;
    const canGenerate = questionnaireDone >= 3 && preferredTimes.length > 0 && mainChallenges.length > 0 && !!workStyle;

    return (
        <div style={{ minHeight: '100vh', paddingBottom: '4rem' }}>

            {/* ── HERO HEADER ── */}
            <div style={{
                background: 'linear-gradient(160deg, rgba(200,169,96,0.14) 0%, rgba(200,169,96,0.07) 55%, rgba(94,234,212,0.05) 100%)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                paddingBottom: 0,
            }}>
                <div style={{ maxWidth: '820px', margin: '0 auto', padding: '2.5rem 2rem 0' }}>

                    {/* Avatar + Name + Stats row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.25rem', flexWrap: 'wrap' }}>

                        {/* Avatar with edit button */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div style={{
                                width: '84px', height: '84px', borderRadius: '50%',
                                background: 'rgba(200,169,96,0.15)',
                                border: '3px solid rgba(200,169,96,0.5)',
                                padding: '3px', overflow: 'hidden',
                                boxShadow: '0 0 0 6px rgba(200,169,96,0.08), 0 8px 32px rgba(200,169,96,0.2)',
                            }}>
                                <img src={dynamicAvatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = getAvatarUrl(currentPreset.style, currentPreset.seed); }} />
                            </div>
                            <button
                                onClick={handleOpenAvatarModal}
                                title="Changer l'avatar"
                                style={{
                                    position: 'absolute', bottom: '2px', right: '2px',
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    background: '#c8a960',
                                    border: '2px solid var(--color-bg)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: 'white',
                                    boxShadow: '0 2px 8px rgba(200,169,96,0.5)',
                                }}
                            >
                                <ImageIcon size={11} />
                            </button>
                        </div>

                        {/* Name + email */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h1 style={{
                                fontSize: '1.65rem', fontWeight: 800, color: 'white',
                                margin: '0 0 0.2rem', letterSpacing: '-0.03em',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {name || 'Mon Profil'}
                            </h1>
                            <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '0.85rem' }}>{email}</p>

                            {/* Meta: membre depuis + location */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {createdAt && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>
                                        <CalendarDays size={11} />
                                        Membre depuis {createdAt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                                    </div>
                                )}
                                {(country || city) && (() => {
                                    const c = country ? COUNTRIES.find(ct => ct.code === country) : null;
                                    const parts = [city, c?.name].filter(Boolean);
                                    if (parts.length === 0) return null;
                                    return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>
                                            {createdAt && <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>}
                                            <MapPin size={11} style={{ flexShrink: 0 }} />
                                            {c?.flag && <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{c.flag}</span>}
                                            {parts.join(', ')}
                                        </div>
                                    );
                                })()}
                            </div>

                            {disciplineProfile && (
                                <div
                                    onClick={() => setActiveTab('discipline')}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        marginTop: '8px', padding: '3px 10px 3px 7px',
                                        borderRadius: '20px', cursor: 'pointer',
                                        background: `${disciplineProfile.color}18`,
                                        border: `1px solid ${disciplineProfile.color}35`,
                                    }}
                                >
                                    <span style={{ fontSize: '0.8rem' }}>{disciplineProfile.emoji}</span>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: disciplineProfile.color }}>{disciplineProfile.type}</span>
                                </div>
                            )}
                        </div>

                        {/* Stats chips */}
                        <div style={{ display: 'flex', gap: '0.6rem', flexShrink: 0 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '9px',
                                padding: '9px 14px', borderRadius: '14px',
                                background: 'rgba(52,211,153,0.09)',
                                border: '1px solid rgba(52,211,153,0.2)',
                            }}>
                                <Clock size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{fmtHours(totalHours)}</div>
                                    <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '3px' }}>{t('profile_stat_hours')}</div>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '9px',
                                padding: '9px 14px', borderRadius: '14px',
                                background: 'rgba(244,114,182,0.09)',
                                border: '1px solid rgba(244,114,182,0.2)',
                            }}>
                                <Target size={14} style={{ color: '#7df4de', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{totalRooms}</div>
                                    <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '3px' }}>{t('profile_stat_objs')}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Tab Bar ── */}
                    <div style={{ display: 'flex', gap: '0' }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '7px',
                                    padding: '0.7rem 1.2rem',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: activeTab === tab.id ? 700 : 500,
                                    color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.4)',
                                    borderBottom: activeTab === tab.id
                                        ? '2px solid #c8a960'
                                        : '2px solid transparent',
                                    transition: 'color 0.18s, border-color 0.18s',
                                    marginBottom: '-1px',
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                <span style={{ fontSize: '0.9rem' }}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── TAB CONTENT ── */}
            <div style={{ maxWidth: '820px', margin: '0 auto', padding: '2rem' }}>

                {/* ════ TAB: PROFIL ════ */}
                {activeTab === 'profile' && (
                    <div className="fade-enter">
                        <div className="card card-glass border border-white/10" style={{ padding: '2rem 2.25rem' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 1.5rem' }}>
                                <UserIcon size={16} style={{ color: '#c8a960' }} /> Informations publiques
                            </h3>

                            {message.text && (
                                <div className={`p-3 mb-5 rounded-lg flex items-center gap-2 text-sm font-medium ${message.type === 'success' ? 'bg-primary-light text-primary' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {message.type === 'success' ? <ShieldCheck size={16} /> : <ShieldX size={16} />} {message.text}
                                </div>
                            )}

                            <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
                                {/* First + Last name side by side */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group mb-0">
                                        <label className="text-sm font-semibold text-slate-300">Prénom</label>
                                        <input type="text" className="input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ton prénom" />
                                    </div>
                                    <div className="form-group mb-0">
                                        <label className="text-sm font-semibold text-slate-300">Nom</label>
                                        <input type="text" className="input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Ton nom" />
                                    </div>
                                </div>

                                {/* Username — read-only */}
                                <div className="form-group mb-0 opacity-60 pointer-events-none">
                                    <label className="text-sm font-semibold text-slate-300">Pseudo <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(@unique)</span></label>
                                    <input type="text" className="input" value={username} readOnly />
                                    <p className="text-xs text-secondary mt-1">Le pseudo ne peut pas être modifié.</p>
                                </div>

                                <div className="form-group mb-0 opacity-60 pointer-events-none">
                                    <label className="text-sm font-semibold text-slate-300">{t('profile_label_email')}</label>
                                    <input type="email" className="input" value={email} readOnly />
                                    <p className="text-xs text-secondary mt-1">L&apos;email ne peut pas être modifié.</p>
                                </div>

                                {/* ── Location (optional) ── */}
                                <div style={{ background: 'rgba(200,169,96,0.04)', border: '1px solid rgba(200,169,96,0.14)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <MapPin size={13} style={{ color: '#c8a960' }} />
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Localisation</span>
                                        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '2px' }}>optionnel</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {/* Country dropdown */}
                                        <div style={{ position: 'relative' }} ref={countryRef}>
                                            <button
                                                type="button"
                                                onClick={() => { setCountryOpen(!countryOpen); setCountrySearch(''); }}
                                                className="input"
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    gap: '8px', cursor: 'pointer', textAlign: 'left',
                                                    color: selectedCountry ? '#fff' : 'rgba(255,255,255,0.35)',
                                                    borderColor: countryOpen ? 'rgba(200,169,96,0.5)' : undefined,
                                                }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                                                    {selectedCountry ? <><span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{selectedCountry.flag}</span> {selectedCountry.name}</> : 'Pays'}
                                                </span>
                                                <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, transform: countryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                            </button>
                                            {countryOpen && (
                                                <div style={{
                                                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                                    background: 'rgba(20,20,28,0.98)', border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: '12px', zIndex: 50, overflow: 'hidden',
                                                    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                                                    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                                                }}>
                                                    <div style={{ padding: '8px 8px 4px' }}>
                                                        <input
                                                            type="text" value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                                                            placeholder="Rechercher..."
                                                            autoFocus
                                                            className="input"
                                                            style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                                                        />
                                                    </div>
                                                    <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                                                        {filteredCountries.length === 0 ? (
                                                            <div style={{ padding: '12px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Aucun résultat</div>
                                                        ) : filteredCountries.map(c => (
                                                            <button
                                                                key={c.code} type="button"
                                                                onClick={() => { setCountry(c.code); setCountryOpen(false); setCountrySearch(''); }}
                                                                style={{
                                                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                                                    padding: '8px 10px', borderRadius: '8px', border: 'none',
                                                                    background: country === c.code ? 'rgba(200,169,96,0.15)' : 'transparent',
                                                                    color: '#fff', fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left',
                                                                    transition: 'background 0.12s',
                                                                }}
                                                                onMouseEnter={e => { if (country !== c.code) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                                                onMouseLeave={e => { if (country !== c.code) e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{c.flag}</span>
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                                                {country === c.code && <Check size={13} style={{ color: '#c8a960', marginLeft: 'auto', flexShrink: 0 }} />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {/* City */}
                                        <input
                                            type="text" className="input" value={city}
                                            onChange={e => setCity(e.target.value.slice(0, 80))}
                                            placeholder="Ville"
                                        />
                                    </div>
                                    {(selectedCountry || city) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
                                            <MapPin size={11} />
                                            {[selectedCountry?.flag, city, selectedCountry?.name].filter(Boolean).join(' · ')}
                                        </div>
                                    )}
                                </div>

                                {/* Photo / Avatar section */}
                                <div style={{ background: 'rgba(200,169,96,0.05)', border: '1px solid rgba(200,169,96,0.18)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Photo de profil</div>

                                    {/* Toggle avatar / upload */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button type="button" onClick={() => setPhotoMode('avatar')}
                                            style={{ flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', border: `1.5px solid ${photoMode === 'avatar' ? 'rgba(200,169,96,0.7)' : 'rgba(255,255,255,0.1)'}`, background: photoMode === 'avatar' ? 'rgba(200,169,96,0.15)' : 'rgba(255,255,255,0.03)', color: photoMode === 'avatar' ? '#d4b872' : 'rgba(255,255,255,0.45)', transition: 'all 0.15s' }}>
                                            🎭 Avatar
                                        </button>
                                        <button type="button" onClick={() => fileInputRef.current?.click()}
                                            style={{ flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', border: `1.5px solid ${photoMode === 'upload' ? 'rgba(16,185,129,0.7)' : 'rgba(255,255,255,0.1)'}`, background: photoMode === 'upload' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)', color: photoMode === 'upload' ? '#6ee7b7' : 'rgba(255,255,255,0.45)', transition: 'all 0.15s' }}>
                                            {uploading ? '⏳ Upload...' : '📷 Photo'}
                                        </button>
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />

                                    {/* Preview + action */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <img
                                            src={dynamicAvatarUrl} alt="avatar"
                                            style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 0 2px rgba(200,169,96,0.35)' }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>
                                                {photoMode === 'upload' && uploadedPhotoUrl ? 'Photo personnalisée' : `Avatar ${currentPreset.id}`}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                                                {photoMode === 'upload' ? 'Importée depuis ton ordinateur' : 'Style actuel'}
                                            </div>
                                        </div>
                                        {photoMode === 'avatar' && (
                                            <button type="button" onClick={handleOpenAvatarModal}
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', background: 'rgba(200,169,96,0.15)', border: '1px solid rgba(200,169,96,0.35)', color: '#d4b872', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <ImageIcon size={13} /> Choisir
                                            </button>
                                        )}
                                        {photoMode === 'upload' && uploadedPhotoUrl && (
                                            <button type="button" onClick={() => { setPhotoMode('avatar'); setUploadedPhotoUrl(''); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <X size={13} /> Retirer
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end border-t border-white/5 pt-5 mt-1">
                                    <button type="submit" className="btn btn-primary px-8 shadow-glow" disabled={saving}>
                                        <Save size={16} /> {saving ? 'Sauvegarde...' : t('profile_btn_save')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ════ TAB: ACTIVITÉ ════ */}
                {activeTab === 'activity' && (
                    <div className="fade-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Gamification — Level, XP, Badges */}
                        <GamificationProfile />

                        {/* ── OVERVIEW SECTION ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            {/* Section header + range selector */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 3, height: 16, borderRadius: 2, background: '#c8a960' }} />
                                    <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ede9e3', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        Aperçu
                                    </h2>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
                                    {([['week', '7j'], ['month', '30j'], ['all', 'Tout']] as const).map(([key, label]) => (
                                        <button key={key} onClick={() => setActivityRange(key)}
                                            style={{
                                                padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                                                border: 'none',
                                                background: activityRange === key ? 'rgba(200,169,96,0.18)' : 'transparent',
                                                color: activityRange === key ? '#c8a960' : 'rgba(255,255,255,0.35)',
                                                fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.15s',
                                            }}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Stats cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
                                {[
                                    { label: 'Temps total', value: fmtDuration(activityStats.totalHrs), icon: <Clock size={15} />, color: '#4ade80', gradient: 'linear-gradient(135deg, rgba(74,222,128,0.08), rgba(74,222,128,0.02))' },
                                    { label: 'Sessions', value: String(activityStats.sessionCount), icon: <Timer size={15} />, color: '#c8a960', gradient: 'linear-gradient(135deg, rgba(200,169,96,0.08), rgba(200,169,96,0.02))' },
                                    { label: 'Pomodoros', value: String(activityStats.totalPoms), icon: <BarChart3 size={15} />, color: '#5eead4', gradient: 'linear-gradient(135deg, rgba(94,234,212,0.08), rgba(94,234,212,0.02))' },
                                    { label: 'Streak', value: loginStreak > 0 ? `${loginStreak}j` : '—', icon: <Flame size={15} />, color: '#fbbf24', gradient: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.02))' },
                                ].map(({ label, value, icon, color, gradient }) => (
                                    <div key={label} style={{
                                        padding: '1.1rem 1rem', textAlign: 'center', borderRadius: 14,
                                        background: gradient, border: `1px solid ${color}15`,
                                        position: 'relative', overflow: 'hidden',
                                    }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />
                                        <div style={{ color, marginBottom: '6px', display: 'flex', justifyContent: 'center', opacity: 0.8 }}>{icon}</div>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 900, color: '#ede9e3', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
                                        <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Progress Insights */}
                            {!sessionsLoading && <ProgressInsights sessions={activityStats.filtered} />}

                            {/* Daily chart */}
                            <div style={{
                                padding: '1.5rem 1.75rem', borderRadius: 18, overflow: 'hidden',
                                background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ede9e3', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <BarChart3 size={14} style={{ color: '#c8a960' }} />
                                    Temps de travail par jour
                                </h3>

                                {sessionsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>Chargement...</div>
                                ) : activityStats.dailyData.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>Aucune donnée</div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px' }}>
                                        {activityStats.dailyData.map(({ date, hours }: { date: string; hours: number }) => {
                                            const pct = activityStats.maxHours > 0 ? (hours / activityStats.maxHours) * 100 : 0;
                                            const d = new Date(date);
                                            const isToday = date === new Date().toISOString().slice(0, 10);
                                            return (
                                                <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}
                                                    title={`${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}: ${fmtDuration(hours)}`}
                                                >
                                                    <div style={{
                                                        width: '100%', minHeight: hours > 0 ? '4px' : '2px',
                                                        height: `${Math.max(pct, hours > 0 ? 4 : 1)}%`,
                                                        borderRadius: '4px 4px 2px 2px',
                                                        background: hours > 0
                                                            ? isToday ? 'linear-gradient(180deg, #c8a960, #a8893e)' : 'rgba(200,169,96,0.4)'
                                                            : 'rgba(255,255,255,0.04)',
                                                        transition: 'height 0.3s ease',
                                                    }} />
                                                    {(activityRange === 'week' || d.getDay() === 1) && (
                                                        <span style={{ fontSize: '0.55rem', color: isToday ? '#c8a960' : 'rgba(255,255,255,0.2)', fontWeight: isToday ? 700 : 500 }}>
                                                            {activityRange === 'week' ? d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2) : d.getDate().toString()}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── DEEP ANALYTICS SECTION (collapsible) ── */}
                        {!sessionsLoading && sessionLogs.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <button
                                        onClick={() => setShowAnalytics(!showAnalytics)}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            width: '100%', padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
                                            background: showAnalytics
                                                ? 'linear-gradient(135deg, rgba(200,169,96,0.08), rgba(94,234,212,0.04))'
                                                : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${showAnalytics ? 'rgba(200,169,96,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 3, height: 16, borderRadius: 2, background: '#5eead4' }} />
                                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ede9e3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                Analyses avancées
                                            </span>
                                            <span style={{
                                                fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                                                background: 'rgba(94,234,212,0.12)', color: '#5eead4',
                                                border: '1px solid rgba(94,234,212,0.2)',
                                            }}>5 graphiques</span>
                                        </div>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            color: showAnalytics ? '#c8a960' : 'rgba(255,255,255,0.35)',
                                            fontSize: '0.78rem', fontWeight: 600,
                                        }}>
                                            {showAnalytics ? 'Masquer' : 'Voir plus'}
                                            {showAnalytics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                    </button>

                                    {showAnalytics && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'fadeSlideIn 0.3s ease-out' }}>
                                            {/* Heatmap */}
                                            <ActivityHeatmap sessions={sessionLogs} />

                                            {/* Two-column: Radial Clock + Category Donut */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                <RadialClock sessions={sessionLogs} />
                                                <CategoryDonut sessions={sessionLogs} />
                                            </div>

                                            {/* Cumulative progress */}
                                            <CumulativeLine sessions={sessionLogs} />

                                            {/* Streak Calendar */}
                                            <StreakCalendar streak={loginStreak} sessions={sessionLogs} />
                                        </div>
                                    )}
                                </div>
                        )}

                        {/* ── SESSION HISTORY ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Section header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 3, height: 16, borderRadius: 2, background: '#a78bfa' }} />
                                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ede9e3', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Historique
                                </h2>
                                {activityStats.filtered.length > 0 && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6 }}>
                                        {activityStats.filtered.length} session{activityStats.filtered.length > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>

                            <div style={{
                                padding: '1.25rem 1.5rem', borderRadius: 18,
                                background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                {sessionsLoading ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>Chargement...</div>
                                ) : activityStats.filtered.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                                        <Timer size={28} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto 12px' }} />
                                        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem', margin: '0 0 4px' }}>Aucune session enregistrée</p>
                                        <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.75rem', margin: 0 }}>Lance une session depuis un objectif ou projet</p>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {(showAllSessions ? activityStats.filtered : activityStats.filtered.slice(0, 8)).map((s, idx) => (
                                                <div key={s.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    padding: '10px 12px', borderRadius: '10px',
                                                    background: 'rgba(255,255,255,0.015)',
                                                    transition: 'background 0.12s',
                                                    animation: `fadeSlideIn 0.2s ease-out ${idx * 0.02}s both`,
                                                }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.035)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                                                >
                                                    {/* Type indicator */}
                                                    <div style={{
                                                        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                                                        background: s.type === 'project' ? '#5eead4' : '#c8a960',
                                                        boxShadow: `0 0 6px ${s.type === 'project' ? 'rgba(94,234,212,0.3)' : 'rgba(200,169,96,0.3)'}`,
                                                    }} />
                                                    {/* Title + date */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.72)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {s.title}
                                                        </div>
                                                        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>
                                                            {s.started_at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            {' · '}
                                                            {s.started_at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                            {' – '}
                                                            {s.ended_at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    {/* Duration */}
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ede9e3', fontFamily: 'var(--font-display)' }}>
                                                            {fmtDuration(s.duration_hours)}
                                                        </div>
                                                        {s.pomodoros > 0 && (
                                                            <div style={{ fontSize: '0.6rem', color: 'rgba(200,169,96,0.55)', marginTop: '1px' }}>
                                                                {s.pomodoros} pom{s.pomodoros > 1 ? 's' : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* View more/less */}
                                        {activityStats.filtered.length > 8 && (
                                            <button
                                                onClick={() => setShowAllSessions(!showAllSessions)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                    width: '100%', padding: '10px', marginTop: '8px',
                                                    borderRadius: 10, cursor: 'pointer',
                                                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                                                    color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', fontWeight: 600,
                                                    transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#c8a960'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                                            >
                                                {showAllSessions ? (
                                                    <><ChevronUp size={14} /> Voir moins</>
                                                ) : (
                                                    <><ChevronDown size={14} /> Voir les {activityStats.filtered.length - 8} sessions restantes</>
                                                )}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Keyframe for slide animations */}
                        <style>{`
                            @keyframes fadeSlideIn {
                                from { opacity: 0; transform: translateY(8px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                        `}</style>
                    </div>
                )}

                {/* ════ TAB: DISCIPLINE ════ */}
                {activeTab === 'discipline' && (
                    <div className="fade-enter">
                        {disciplineProfile && !showProfileForm ? (

                            /* ── ARCHETYPE RESULT ── */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Main card */}
                                <div className="card card-glass border border-white/10" style={{ overflow: 'hidden' }}>
                                    {/* Header band */}
                                    <div style={{
                                        background: `linear-gradient(135deg, ${disciplineProfile.color}22, ${disciplineProfile.color}06)`,
                                        borderBottom: `1px solid ${disciplineProfile.color}28`,
                                        padding: '1.75rem 2rem',
                                        display: 'flex', alignItems: 'flex-start', gap: '1.25rem',
                                    }}>
                                        <div style={{
                                            width: '68px', height: '68px', borderRadius: '18px', flexShrink: 0,
                                            background: `${disciplineProfile.color}18`,
                                            border: `1.5px solid ${disciplineProfile.color}35`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '2rem',
                                            boxShadow: `0 4px 20px ${disciplineProfile.color}20`,
                                        }}>
                                            {disciplineProfile.emoji}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: disciplineProfile.color, textTransform: 'uppercase', letterSpacing: '0.13em', marginBottom: '5px' }}>
                                                Profil de discipline
                                            </div>
                                            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'white', margin: '0 0 3px', letterSpacing: '-0.03em' }}>
                                                {disciplineProfile.type}
                                            </h2>
                                            <p style={{ fontSize: '0.875rem', color: disciplineProfile.color, fontWeight: 600, margin: '0 0 10px' }}>
                                                {disciplineProfile.tagline}
                                            </p>
                                            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.58)', margin: 0, lineHeight: 1.65 }}>
                                                {disciplineProfile.description}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowProfileForm(true)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '5px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '10px', padding: '7px 12px',
                                                cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
                                                fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
                                            }}
                                        >
                                            <RefreshCw size={12} /> Refaire
                                        </button>
                                    </div>

                                    {/* Forces + À développer */}
                                    <div style={{ padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.13em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ color: '#10b981' }}>✦</span> Forces
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                                {disciplineProfile.strengths?.map((s: string, i: number) => (
                                                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                        <div style={{
                                                            width: '20px', height: '20px', borderRadius: '7px', flexShrink: 0, marginTop: '1px',
                                                            background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.28)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}>
                                                            <Check size={10} style={{ color: '#10b981' }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.55 }}>{s}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.13em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ color: '#f59e0b' }}>✦</span> À développer
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                                {disciplineProfile.growth_areas?.map((g: string, i: number) => (
                                                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                        <div style={{
                                                            width: '20px', height: '20px', borderRadius: '7px', flexShrink: 0, marginTop: '1px',
                                                            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.24)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '10px', color: '#f59e0b',
                                                        }}>
                                                            →
                                                        </div>
                                                        <span style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.55 }}>{g}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tip banner */}
                                    <div style={{
                                        margin: '0 1.75rem 1.75rem',
                                        padding: '14px 18px', borderRadius: '14px',
                                        background: `${disciplineProfile.color}10`,
                                        border: `1px solid ${disciplineProfile.color}25`,
                                    }}>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: disciplineProfile.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                                            💡 Conseil personnalisé
                                        </div>
                                        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.68)', margin: 0, lineHeight: 1.65 }}>
                                            {disciplineProfile.tip}
                                        </p>
                                    </div>
                                </div>
                            </div>

                        ) : (

                            /* ── QUESTIONNAIRE ── */
                            <div className="card card-glass border border-white/10" style={{ overflow: 'hidden' }}>
                                {/* Form header */}
                                <div style={{
                                    padding: '1.5rem 2rem',
                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                    background: 'linear-gradient(135deg, rgba(200,169,96,0.09), rgba(200,169,96,0.04))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', margin: '0 0 3px' }}>
                                            Analyser mon profil de discipline
                                        </h3>
                                        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.38)', margin: 0 }}>
                                            Répondez pour découvrir votre archétype de productivité
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {/* Dot progress */}
                                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                            {[0, 1, 2, 3, 4].map(i => (
                                                <div key={i} style={{
                                                    width: i < questionnaireDone ? '18px' : '7px',
                                                    height: '7px', borderRadius: '4px',
                                                    background: i < questionnaireDone ? '#c8a960' : 'rgba(255,255,255,0.12)',
                                                    transition: 'all 0.25s',
                                                }} />
                                            ))}
                                        </div>
                                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{questionnaireDone}/5</span>
                                        {disciplineProfile && (
                                            <button onClick={() => setShowProfileForm(false)}
                                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem' }}>
                                                Annuler
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Questions */}
                                <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

                                    {/* Q1: Preferred times */}
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>🕐</span> Quand travaillez-vous le mieux ?
                                            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}>plusieurs choix</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {[
                                                { label: 'Tôt matin', sub: '5h–9h' },
                                                { label: 'Matinée', sub: '9h–12h' },
                                                { label: 'Après-midi', sub: '12h–18h' },
                                                { label: 'Soir', sub: '18h–22h' },
                                                { label: 'Nuit', sub: '22h+' },
                                            ].map(({ label, sub }) => {
                                                const sel = preferredTimes.includes(label);
                                                return (
                                                    <button key={label} onClick={() => setPreferredTimes(prev => toggleMulti(prev, label, 3))}
                                                        style={{
                                                            padding: '8px 14px', borderRadius: '10px', cursor: 'pointer',
                                                            border: `1.5px solid ${sel ? 'rgba(200,169,96,0.7)' : 'rgba(255,255,255,0.1)'}`,
                                                            background: sel ? 'rgba(200,169,96,0.18)' : 'rgba(255,255,255,0.03)',
                                                            color: sel ? '#c7d2fe' : 'rgba(255,255,255,0.45)',
                                                            fontSize: '0.82rem', fontWeight: 600,
                                                            transition: 'all 0.15s',
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '76px',
                                                        }}>
                                                        {label}
                                                        <span style={{ fontSize: '0.62rem', opacity: 0.55, fontWeight: 400 }}>{sub}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Q2: Obstacles */}
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>🧱</span> Vos principaux obstacles ?
                                            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}>jusqu&apos;à 3</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {['Démarrer', 'Concentration', 'Régularité', 'Terminer', 'Procrastination', 'Perfectionnisme'].map(opt => {
                                                const sel = mainChallenges.includes(opt);
                                                const maxed = mainChallenges.length >= 3 && !sel;
                                                return (
                                                    <button key={opt} onClick={() => !maxed && setMainChallenges(prev => toggleMulti(prev, opt, 3))}
                                                        style={{
                                                            padding: '8px 14px', borderRadius: '10px',
                                                            border: `1.5px solid ${sel ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.1)'}`,
                                                            background: sel ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                                                            color: sel ? '#fca5a5' : maxed ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.45)',
                                                            fontSize: '0.82rem', fontWeight: 600,
                                                            cursor: maxed ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                                                        }}>
                                                        {opt}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Q3 + Q5 side by side */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        {/* Q3: Work rhythm */}
                                        <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>⚡</span> Votre rythme naturel ?
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {[
                                                    { label: 'Bursts courts & intenses', icon: '🔥' },
                                                    { label: 'Longues sessions profondes', icon: '🌊' },
                                                    { label: 'Rythme régulier & planifié', icon: '📅' },
                                                    { label: 'Aléatoire selon inspiration', icon: '🎲' },
                                                ].map(({ label, icon }) => {
                                                    const sel = workStyle === label;
                                                    return (
                                                        <button key={label} onClick={() => setWorkStyle(label)}
                                                            style={{
                                                                padding: '9px 12px', borderRadius: '10px',
                                                                border: `1.5px solid ${sel ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.08)'}`,
                                                                background: sel ? 'rgba(16,185,129,0.13)' : 'rgba(255,255,255,0.02)',
                                                                color: sel ? '#6ee7b7' : 'rgba(255,255,255,0.45)',
                                                                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                                                textAlign: 'left', transition: 'all 0.15s',
                                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                            }}>
                                                            <span>{icon}</span>{label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Q5: Motivation dip */}
                                        <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>📉</span> Face à une baisse de motivation ?
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {[
                                                    { label: 'Je prends une pause', icon: '⏸️' },
                                                    { label: 'Je force et continue', icon: '💪' },
                                                    { label: 'Je change de tâche', icon: '🔄' },
                                                    { label: "Je cherche de l'aide", icon: '🤝' },
                                                ].map(({ label, icon }) => {
                                                    const sel = motivationDip === label;
                                                    return (
                                                        <button key={label} onClick={() => setMotivationDip(label)}
                                                            style={{
                                                                padding: '9px 12px', borderRadius: '10px',
                                                                border: `1.5px solid ${sel ? 'rgba(200,169,96,0.6)' : 'rgba(255,255,255,0.08)'}`,
                                                                background: sel ? 'rgba(200,169,96,0.13)' : 'rgba(255,255,255,0.02)',
                                                                color: sel ? '#ede9e3' : 'rgba(255,255,255,0.45)',
                                                                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                                                textAlign: 'left', transition: 'all 0.15s',
                                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                            }}>
                                                            <span>{icon}</span>{label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Q4: Motivators */}
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>🔑</span> Ce qui vous motive ?
                                            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}>jusqu&apos;à 3</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {['Voir ma progression', 'Les défis', 'La routine', 'La nouveauté', 'Être reconnu', 'Accomplir'].map(opt => {
                                                const sel = motivators.includes(opt);
                                                const maxed = motivators.length >= 3 && !sel;
                                                return (
                                                    <button key={opt} onClick={() => !maxed && setMotivators(prev => toggleMulti(prev, opt, 3))}
                                                        style={{
                                                            padding: '8px 14px', borderRadius: '10px',
                                                            border: `1.5px solid ${sel ? 'rgba(245,158,11,0.65)' : 'rgba(255,255,255,0.1)'}`,
                                                            background: sel ? 'rgba(245,158,11,0.13)' : 'rgba(255,255,255,0.03)',
                                                            color: sel ? '#fcd34d' : maxed ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.45)',
                                                            fontSize: '0.82rem', fontWeight: 600,
                                                            cursor: maxed ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                                                        }}>
                                                        {opt}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Progress + Generate */}
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', width: `${(questionnaireDone / 5) * 100}%`,
                                                background: 'linear-gradient(90deg, #c8a960, #c8a960)',
                                                borderRadius: '2px', transition: 'width 0.35s ease',
                                            }} />
                                        </div>
                                        <button
                                            onClick={handleGenerateProfile}
                                            disabled={!canGenerate || profileLoading}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                padding: '13px', borderRadius: '12px', border: 'none',
                                                background: canGenerate
                                                    ? 'linear-gradient(135deg, #c8a960 0%, #c8a960 100%)'
                                                    : 'rgba(255,255,255,0.05)',
                                                color: canGenerate ? '#fff' : 'rgba(255,255,255,0.22)',
                                                fontSize: '0.9rem', fontWeight: 700,
                                                cursor: canGenerate ? 'pointer' : 'not-allowed',
                                                transition: 'all 0.2s',
                                                boxShadow: canGenerate ? '0 4px 24px rgba(200,169,96,0.38)' : 'none',
                                            }}>
                                            {profileLoading
                                                ? <><span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Analyse en cours…</>
                                                : <><Sparkles size={15} /> Révéler mon archétype</>
                                            }
                                        </button>
                                        {!canGenerate && (
                                            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.22)', textAlign: 'center', margin: 0 }}>
                                                Répondez aux 3 premières questions pour continuer
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ════ TAB: SÉCURITÉ ════ */}
                {activeTab === 'security' && (
                    <div className="fade-enter">
                        <div className="card card-glass border border-pink-500/15" style={{ padding: '2rem 2.25rem' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Lock size={16} style={{ color: '#7df4de' }} /> Modifier le mot de passe
                            </h3>

                            {pwdMessage.text && (
                                <div className={`p-3 mb-5 rounded-lg flex items-center gap-2 text-sm font-medium ${pwdMessage.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {pwdMessage.type === 'success' ? <ShieldCheck size={16} /> : <ShieldX size={16} />} {pwdMessage.text}
                                </div>
                            )}

                            <form onSubmit={handleUpdatePassword} className="flex flex-col gap-5">
                                <div className="form-group mb-0">
                                    <label className="text-sm font-semibold text-slate-300">Mot de passe actuel</label>
                                    <input type="password" className="input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Pour confirmer votre identité" required />
                                </div>
                                <div className="form-group mb-0">
                                    <label className="text-sm font-semibold text-slate-300">Nouveau mot de passe</label>
                                    <input type="password" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 caractères" required />
                                </div>
                                <div className="form-group mb-0">
                                    <label className="text-sm font-semibold text-slate-300">Confirmer</label>
                                    <input type="password" className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Idem nouveau mot de passe" required />
                                </div>
                                <div className="border-t border-white/5 pt-5 mt-2">
                                    <button type="submit" className="btn w-full"
                                        style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.38)', color: '#7df4de' }}
                                        disabled={updatingPassword}>
                                        <Lock size={16} /> {updatingPassword ? 'Mise à jour...' : 'Modifier le mot de passe'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ════ TAB: PARAMÈTRES ════ */}
                {activeTab === 'settings' && (
                    <div className="fade-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* ── Langue ── */}
                        <div className="card card-glass" style={{ padding: '1.75rem 2rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Globe size={16} style={{ color: '#c8a960' }} /> Langue
                            </h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {([['fr', '🇫🇷', 'Français'], ['en', '🇬🇧', 'English']] as const).map(([code, flag, label]) => {
                                    const active = locale === code;
                                    return (
                                        <button key={code} onClick={() => setLocale(code)}
                                            style={{
                                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                                padding: '12px', borderRadius: '12px', cursor: 'pointer',
                                                border: `1.5px solid ${active ? 'rgba(200,169,96,0.6)' : 'rgba(255,255,255,0.08)'}`,
                                                background: active ? 'rgba(200,169,96,0.12)' : 'rgba(255,255,255,0.02)',
                                                color: active ? '#c7d2fe' : 'rgba(255,255,255,0.45)',
                                                fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.15s',
                                            }}>
                                            <span style={{ fontSize: '1.2rem' }}>{flag}</span> {label}
                                            {active && <Check size={14} style={{ color: '#c8a960' }} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Notifications ── */}
                        <div className="card card-glass" style={{ padding: '1.75rem 2rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Bell size={16} style={{ color: '#f59e0b' }} /> Notifications
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {([
                                    { key: 'friends', label: 'Invitations & amis', desc: 'Demandes d\'ami, acceptations', value: notifFriends, set: setNotifFriends, color: '#c8a960' },
                                    { key: 'sessions', label: 'Sessions & activité', desc: 'Démarrage de sessions, rappels Pomodoro', value: notifSessions, set: setNotifSessions, color: '#10b981' },
                                    { key: 'messages', label: 'Messages', desc: 'Nouveaux messages de tes amis et salons', value: notifMessages, set: setNotifMessages, color: '#5eead4' },
                                    { key: 'reminders', label: 'Rappels calendrier', desc: 'Événements et rappels à venir', value: notifReminders, set: setNotifReminders, color: '#f59e0b' },
                                ] as const).map((item, i) => (
                                    <div key={item.key} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '14px 0',
                                        borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>{item.label}</div>
                                            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{item.desc}</div>
                                        </div>
                                        <button onClick={() => { item.set(!item.value); handleSaveNotifPrefs(item.key, !item.value); }}
                                            style={{
                                                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                                background: item.value ? item.color : 'rgba(255,255,255,0.1)',
                                                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                                            }}>
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%',
                                                background: 'white', position: 'absolute', top: '3px',
                                                left: item.value ? '23px' : '3px',
                                                transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                                            }} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Confidentialité ── */}
                        <div className="card card-glass" style={{ padding: '1.75rem 2rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Eye size={16} style={{ color: '#a78bfa' }} /> Confidentialit&eacute;
                            </h3>
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '14px 0',
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>Afficher mes salons publics</div>
                                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>Les objectifs et projets publics apparaissent sur ton profil</div>
                                </div>
                                <button onClick={async () => {
                                    const newVal = !showSalonsOnProfile;
                                    setShowSalonsOnProfile(newVal);
                                    if (user) await setDoc(doc(db, 'users', user.uid), { show_salons_on_profile: newVal }, { merge: true });
                                }}
                                    style={{
                                        width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                        background: showSalonsOnProfile ? '#a78bfa' : 'rgba(255,255,255,0.1)',
                                        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                                    }}>
                                    <div style={{
                                        width: '18px', height: '18px', borderRadius: '50%',
                                        background: 'white', position: 'absolute', top: '3px',
                                        left: showSalonsOnProfile ? '23px' : '3px',
                                        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                                    }} />
                                </button>
                            </div>
                        </div>

                        {/* ── Déconnexion ── */}
                        <div className="card card-glass" style={{ padding: '1.75rem 2rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <LogOut size={15} style={{ color: 'rgba(255,255,255,0.4)' }} /> Se déconnecter
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>Déconnecte-toi de ta session actuelle</div>
                                </div>
                                <button onClick={handleLogout}
                                    style={{
                                        padding: '9px 20px', borderRadius: '10px', cursor: 'pointer',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                                        color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: 600,
                                        transition: 'all 0.15s',
                                    }}>
                                    Déconnexion
                                </button>
                            </div>
                        </div>

                        {/* ── Export RGPD ── */}
                        <div className="card card-glass" style={{ padding: '1.75rem 2rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: exportConfirm ? '1rem' : 0 }}>
                                <div>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Download size={15} style={{ color: '#5eead4' }} /> Exporter mes données
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px', lineHeight: 1.5 }}>
                                        Télécharge l&apos;ensemble de tes données au format JSON (RGPD Art. 20)
                                    </div>
                                </div>
                                {!exportConfirm && (
                                    <button onClick={() => { setExportConfirm(true); setExportError(''); setExportPassword(''); }}
                                        style={{
                                            padding: '9px 20px', borderRadius: '10px', cursor: 'pointer',
                                            background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.2)',
                                            color: '#5eead4', fontSize: '0.85rem', fontWeight: 600,
                                            transition: 'all 0.15s', flexShrink: 0,
                                        }}>
                                        Télécharger
                                    </button>
                                )}
                            </div>

                            {exportConfirm && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {exportError && (
                                        <div style={{
                                            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                                            borderRadius: '10px', padding: '10px 14px', fontSize: '0.83rem', color: '#fca5a5',
                                        }}>
                                            {exportError}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                                        Confirme ton identité pour exporter :
                                    </div>
                                    <input type="password" className="input" value={exportPassword}
                                        onChange={e => setExportPassword(e.target.value)}
                                        placeholder="Ton mot de passe"
                                        onKeyDown={e => { if (e.key === 'Enter' && exportPassword) handleExportData(); }}
                                    />
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => { setExportConfirm(false); setExportPassword(''); setExportError(''); }}
                                            style={{
                                                flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 600,
                                            }}>
                                            Annuler
                                        </button>
                                        <button onClick={handleExportData} disabled={exporting || !exportPassword}
                                            style={{
                                                flex: 1, padding: '10px', borderRadius: '10px',
                                                cursor: (exporting || !exportPassword) ? 'not-allowed' : 'pointer',
                                                background: 'rgba(94,234,212,0.12)', border: '1px solid rgba(94,234,212,0.3)',
                                                color: '#5eead4', fontSize: '0.85rem', fontWeight: 700,
                                                opacity: (exporting || !exportPassword) ? 0.5 : 1,
                                            }}>
                                            {exporting ? 'Export en cours...' : 'Confirmer l\'export'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Zone danger : Supprimer le compte ── */}
                        <div className="card card-glass" style={{ padding: '1.75rem 2rem', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fca5a5', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={16} style={{ color: '#ef4444' }} /> Zone dangereuse
                            </h3>
                            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 1.25rem', lineHeight: 1.6 }}>
                                Supprimer ton compte est irréversible. Toutes tes données, objectifs, projets et messages seront définitivement perdus.
                            </p>

                            {!deleteConfirm ? (
                                <button onClick={() => setDeleteConfirm(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '10px 20px', borderRadius: '10px', cursor: 'pointer',
                                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                        color: '#f87171', fontSize: '0.85rem', fontWeight: 600,
                                    }}>
                                    <Trash2 size={14} /> Supprimer mon compte
                                </button>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {deleteError && (
                                        <div style={{
                                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                                            borderRadius: '10px', padding: '10px 14px', fontSize: '0.83rem', color: '#fca5a5',
                                        }}>
                                            {deleteError}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fca5a5' }}>
                                        Confirme avec ton mot de passe :
                                    </div>
                                    <input type="password" className="input" value={deletePassword}
                                        onChange={e => setDeletePassword(e.target.value)}
                                        placeholder="Ton mot de passe actuel"
                                        style={{ borderColor: 'rgba(239,68,68,0.3)' }}
                                    />
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => { setDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }}
                                            style={{
                                                flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 600,
                                            }}>
                                            Annuler
                                        </button>
                                        <button onClick={handleDeleteAccount} disabled={deleteLoading || !deletePassword}
                                            style={{
                                                flex: 1, padding: '10px', borderRadius: '10px',
                                                cursor: (deleteLoading || !deletePassword) ? 'not-allowed' : 'pointer',
                                                background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)',
                                                color: '#f87171', fontSize: '0.85rem', fontWeight: 700,
                                                opacity: (deleteLoading || !deletePassword) ? 0.5 : 1,
                                            }}>
                                            {deleteLoading ? 'Suppression...' : 'Confirmer la suppression'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Légal ── */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', paddingTop: '0.5rem' }}>
                            <a href="/terms" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Conditions d&apos;utilisation</a>
                            <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
                            <a href="/privacy" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Politique de confidentialité</a>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Avatar Picker Modal ── */}
            {showAvatarModal && (
                <div
                    className="fixed inset-0 flex items-center justify-center p-4 fade-enter"
                    style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 50 }}
                    onClick={e => { if (e.target === e.currentTarget) handleCloseAvatarModal(); }}
                >
                    <div
                        className="card glass-panel w-full relative shadow-2xl no-scrollbar slide-up"
                        style={{ maxWidth: '620px', border: '1px solid rgba(255,255,255,0.1)', padding: '0', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}
                    >
                        <div style={{ background: 'linear-gradient(135deg, rgba(200,169,96,0.18), rgba(94,234,212,0.1))', padding: '1.75rem 2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                            <button onClick={handleCloseAvatarModal} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
                                <X size={16} />
                            </button>
                            <div className="flex items-center gap-4">
                                <div style={{ background: 'rgba(200,169,96,0.2)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(200,169,96,0.3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <UserIcon className="text-primary" size={26} />
                                </div>
                                <div className="flex flex-col justify-center">
                                    <h3 className="m-0 text-xl font-bold" style={{ lineHeight: '1', marginBottom: '4px', marginTop: '15px' }}>Choisir un Avatar</h3>
                                    <p className="m-0 text-sm opacity-60" style={{ lineHeight: '1' }}>Personnalisez votre présence sur BrilliPlan</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '1.75rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '16px' }}>
                            {AVATAR_PRESETS.map(preset => {
                                const isPending = pendingStyle === preset.id;
                                return (
                                    <div
                                        key={preset.id}
                                        onClick={() => setPendingStyle(preset.id)}
                                        className="relative group cursor-pointer transition-all duration-300"
                                        style={{ aspectRatio: '1', borderRadius: '20px', padding: '8px', border: isPending ? '2px solid rgba(200,169,96,0.9)' : '2px solid transparent', background: isPending ? 'rgba(200,169,96,0.1)' : 'rgba(255,255,255,0.03)', boxShadow: isPending ? '0 8px 25px -5px rgba(200,169,96,0.3)' : 'none', transform: isPending ? 'scale(1.05)' : 'scale(1)' }}
                                    >
                                        <div style={{ width: '100%', height: '100%', borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', boxShadow: isPending ? '0 0 0 2px rgba(200,169,96,0.5) inset' : 'inset 0 0 0 1px rgba(255,255,255,0.05)', transition: 'transform 0.2s' }} className={`${!isPending ? 'group-hover:scale-105 group-hover:brightness-110' : ''}`}>
                                            <img src={getAvatarUrl(preset.style, preset.seed)} alt="Avatar option" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        {isPending && (
                                            <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '24px', height: '24px', background: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--color-bg)', boxShadow: '0 2px 10px rgba(0,0,0,0.5)', animation: 'scaleIn 0.2s ease-out forwards' }}>
                                                <Check size={14} strokeWidth={3} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-between items-center" style={{ padding: '0 2rem 1.75rem' }}>
                            <div className="flex items-center gap-4">
                                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(200,169,96,0.15)', border: '2px solid rgba(200,169,96,0.4)', overflow: 'hidden', flexShrink: 0 }}>
                                    <img src={getAvatarUrl(pendingPreset.style, pendingPreset.seed)} alt="preview" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold tracking-wide">Avatar {pendingPreset.id}</div>
                                    <div className="text-xs text-secondary opacity-70">Aperçu</div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" className="btn btn-ghost" onClick={handleCloseAvatarModal}>Annuler</button>
                                <button type="button" className="btn btn-primary" onClick={confirmAvatarSelection}>
                                    <Check size={16} /> Appliquer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Profile() {
    return (
        <Suspense fallback={<div className="container py-16 text-center">Chargement...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
