import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { verifyAuth } from '@/lib/firebase-admin';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { sanitizeForPrompt, sanitizeObjectForPrompt } from '@/lib/sanitize';

export async function POST(req: Request) {
    const rl = checkRateLimit(getRateLimitKey(req, 'gen-smart-agenda'), { maxRequests: 5, windowMs: 60_000 });
    if (rl) return rl;
    const uid = await verifyAuth(req);
    if (!uid) return new Response('Unauthorized', { status: 401 });
    try {
        const body = await req.json();
        const title = sanitizeForPrompt(body.title, 200);
        const category = body.category;
        const targetHours = body.targetHours;
        const rhythm = body.rhythm;
        const timePref = sanitizeForPrompt(body.timePref, 300);
        const salonContext = sanitizeObjectForPrompt(body.salonContext, 500);

        // Build rich context from salon data if available
        const contextParts: string[] = [];
        if (salonContext) {
            if (salonContext.description) contextParts.push(`Description du salon : ${salonContext.description}`);
            if (salonContext.members?.length) contextParts.push(`Membres (${salonContext.members.length}) : ${salonContext.members.map((m: any) => m.name || m).join(', ')}`);
            if (salonContext.milestones?.length) {
                const done = salonContext.milestones.filter((m: any) => m.completed).length;
                const pending = salonContext.milestones.filter((m: any) => !m.completed);
                contextParts.push(`Étapes en cours (${done}/${salonContext.milestones.length} complétées) :\n${pending.slice(0, 10).map((m: any) => `  - ${m.text}`).join('\n')}`);
            }
            if (salonContext.decisions?.length) contextParts.push(`Décisions prises : ${salonContext.decisions.slice(0, 5).map((d: any) => d.title).join(', ')}`);
            if (salonContext.roadmapPhases?.length) contextParts.push(`Phases de roadmap existantes :\n${salonContext.roadmapPhases.slice(0, 6).map((p: any) => `  - "${p.title}" (${p.startDate} → ${p.endDate})`).join('\n')}`);
            if (salonContext.roadmapMilestones?.length) contextParts.push(`Jalons roadmap : ${salonContext.roadmapMilestones.slice(0, 6).map((m: any) => `"${m.title}" (${m.date})`).join(', ')}`);
            if (salonContext.existingSessions?.length) contextParts.push(`Sessions déjà planifiées : ${salonContext.existingSessions.slice(0, 6).map((s: any) => `"${s.title}" le ${s.date}`).join(', ')}`);
            if (salonContext.sprints?.length) {
                const active = salonContext.sprints.find((s: any) => s.status === 'active');
                if (active) contextParts.push(`Sprint actif : "${active.title}"${active.goal ? ' — Objectif: ' + active.goal : ''}`);
            }
            if (salonContext.sprintTasks?.length) {
                const pending = salonContext.sprintTasks.filter((t: any) => !t.completed);
                if (pending.length) contextParts.push(`Tâches sprint en cours : ${pending.slice(0, 8).map((t: any) => `"${t.title}" [${t.priority}]`).join(', ')}`);
            }
            if (salonContext.dailyFocuses?.length) contextParts.push(`Focus actuels : ${salonContext.dailyFocuses.slice(0, 5).join(', ')}`);
            if (salonContext.announcements?.length) contextParts.push(`Annonces récentes : ${salonContext.announcements.slice(0, 3).map((a: any) => a.title).join(', ')}`);
        }

        const contextBlock = contextParts.length > 0
            ? `\n\nContexte détaillé du salon :\n${contextParts.join('\n')}\n\nUtilise ces informations pour créer des sessions qui correspondent aux étapes en cours, à la roadmap existante et aux tâches du sprint actif. Les sessions doivent être alignées avec les objectifs et décisions du salon.`
            : '';

        const prompt = `
Tu es un planificateur de projets et un coach d'apprentissage pro-actif pour un groupe de travail.
Le projet/salon s'appelle "${title}" (Catégorie: ${category}). L'objectif de temps de travail est de ${targetHours} heures par membre.
${contextBlock}

Ton objectif est de créer un **Plan d'Action Intelligent (Smart Agenda)** complet. Tu vas d'abord décomposer l'objectif global en une série d'étapes (milestones) logiques, avec une estimation de temps, puis tu vas proposer un planning de sessions concrètes pour avancer sur ces étapes.

**1. Étapes Logiques (Milestones)**
Génère une liste d'étapes clés nécessaires pour accomplir "${title}". 
- Les étapes doivent être orientées vers l'action et claires (ex: "Configurer l'environnement de développement", "Lire le chapitre 1 à 3", "Rédiger l'introduction").
- Pour chaque étape, estime le temps nécessaire en heures. La somme du temps estimé pour toutes les étapes doit s'approcher de ${targetHours}h.
- Si des étapes existent déjà dans le salon, tiens-en compte et complète-les plutôt que de les dupliquer.

**2. Sessions de travail (Agenda)**
Ensuite, crée un planning de futures sessions de travail réparties sur les 2 prochaines semaines.
Rythme demandé par l'utilisateur: "${rhythm}".
- Rythme Léger: 2 à 3 sessions au total, espacées.
- Rythme Régulier: 4 à 6 sessions au total.
- Rythme Intensif: 8 à 10 sessions au total.

${timePref ? `⚠️ Très important : Les membres ont spécifié des préférences d'horaires : "${timePref}". Adapte l'heure des sessions de travail à ces préférences.` : ''}

Aujourd'hui nous sommes le ${new Date().toISOString()}.
Génère des dates (format ISO 8601 YYYY-MM-DDTHH:mm:00Z) réparties **dans le futur** (dans les 14 prochains jours). Varie les heures en fonction des préférences.
Pour chaque session, fais un lien clair avec le Milestone correspondant dans la description.
`;

        const { object } = await generateObject({
            model: google('gemini-2.5-flash'),
            schema: z.object({
                milestones: z.array(z.object({
                    title: z.string().describe("Titre court et clair de l'étape"),
                    description: z.string().describe("Description de 1 ou 2 phrases de ce qu'il faut accomplir"),
                    estimated_hours: z.number().describe("Nombre d'heures estimées pour cette étape (par exemple 2.5)"),
                })),
                sessions: z.array(z.object({
                    title: z.string().describe("Titre de la session (ex: Intro et configuration)"),
                    description: z.string().describe("Description de ce sur quoi les membres devraient se concentrer"),
                    type: z.enum(['travail', 'discussion', 'recherche']),
                    scheduled_at: z.string().describe("Date ISO 8601 future"),
                }))
            }),
            prompt: prompt,
        });

        return Response.json(object);

    } catch (error: any) {
        console.error('Error generating smart agenda:', error);
        return new Response(JSON.stringify({ error: 'Generation failed' }), { status: 500 });
    }
}
