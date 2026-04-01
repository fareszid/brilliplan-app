import {
    Code, Palette, Briefcase, Megaphone, PenTool, BarChart3,
    Music, Dumbbell, FlaskConical, Lightbulb, Video, Share2,
    Handshake, Search, Scale
} from 'lucide-react';

export const ROLE_PRESETS = [
    { key: 'developer',  label: 'Développeur',   labelEn: 'Developer',       icon: Code,        color: '#c8a960' },
    { key: 'designer',   label: 'Designer',       labelEn: 'Designer',       icon: Palette,     color: '#7df4de' },
    { key: 'pm',         label: 'Chef de projet', labelEn: 'Project Manager', icon: Briefcase,   color: '#f59e0b' },
    { key: 'marketing',  label: 'Marketing',      labelEn: 'Marketing',      icon: Megaphone,   color: '#10b981' },
    { key: 'writer',     label: 'Rédacteur',      labelEn: 'Writer',         icon: PenTool,     color: '#8b5cf6' },
    { key: 'data',       label: 'Data / IA',      labelEn: 'Data / AI',      icon: BarChart3,   color: '#06b6d4' },
    { key: 'video',      label: 'Vidéaste',       labelEn: 'Videographer',    icon: Video,      color: '#f97316' },
    { key: 'social',     label: 'Community Manager', labelEn: 'Social Media', icon: Share2,     color: '#3b82f6' },
    { key: 'sales',      label: 'Commercial',     labelEn: 'Sales',          icon: Handshake,   color: '#22c55e' },
    { key: 'qa',         label: 'Testeur / QA',   labelEn: 'Tester / QA',    icon: Search,      color: '#94a3b8' },
    { key: 'legal',      label: 'Juriste',        labelEn: 'Legal',          icon: Scale,       color: '#b89a50' },
    { key: 'music',      label: 'Musicien',       labelEn: 'Musician',       icon: Music,       color: '#5eead4' },
    { key: 'sport',      label: 'Coach sportif',  labelEn: 'Sport Coach',    icon: Dumbbell,    color: '#ef4444' },
    { key: 'researcher', label: 'Chercheur',      labelEn: 'Researcher',     icon: FlaskConical, color: '#14b8a6' },
    { key: 'other',      label: 'Autre',          labelEn: 'Other',          icon: Lightbulb,   color: '#a1a1aa' },
];

export function getRolePreset(key: string) {
    return ROLE_PRESETS.find(r => r.key === key) || ROLE_PRESETS[ROLE_PRESETS.length - 1];
}
