import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { verifyAuth } from '@/lib/firebase-admin';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { sanitizeForPrompt, sanitizeObjectForPrompt } from '@/lib/sanitize';

export async function POST(req: Request) {
    const rl = checkRateLimit(getRateLimitKey(req, 'salon-ai'), { maxRequests: 20, windowMs: 60_000 });
    if (rl) return rl;
    const uid = await verifyAuth(req);
    if (!uid) return new Response('Unauthorized', { status: 401 });
    const body = await req.json();
    const messages = (body.messages || []).map((m: any) => ({
        ...m,
        content: sanitizeForPrompt(m.content, 2000),
    }));
    const context = sanitizeObjectForPrompt(body.context, 500);

    const system = buildSystemPrompt(context);

    const result = streamText({
        model: google('gemini-2.5-flash'),
        system,
        messages,
    });

    return result.toTextStreamResponse();
}

function buildSystemPrompt(ctx: any): string {
    const lines: string[] = [];

    lines.push(`Tu es un assistant IA intégré dans un salon collaboratif appelé "${ctx.title || 'ce salon'}".`);
    lines.push(`Type de salon : ${ctx.type === 'project' ? 'Projet' : 'Objectif'}.`);

    if (ctx.description) lines.push(`\nDescription : ${ctx.description}`);
    if (ctx.category)    lines.push(`Catégorie : ${Array.isArray(ctx.category) ? ctx.category.join(', ') : ctx.category}`);

    if (ctx.goalHours) {
        const freqLabel: Record<string, string> = { daily: 'par jour', weekly: 'par semaine', monthly: 'par mois', total: 'au total' };
        lines.push(`Objectif horaire : ${ctx.goalHours}h ${freqLabel[ctx.goalFrequency] || ctx.goalFrequency || 'au total'}`);
    }

    if (ctx.learningLink) lines.push(`Lien de formation : ${ctx.learningLink}`);
    if (ctx.githubLink)   lines.push(`Dépôt GitHub : ${ctx.githubLink}`);

    if (ctx.members?.length) {
        lines.push(`\nMembres (${ctx.members.length}) : ${ctx.members.map((m: any) => m.name).join(', ')}`);
    }

    if (ctx.milestones?.length) {
        const done = ctx.milestones.filter((m: any) => m.completed).length;
        lines.push(`\nÉtapes / Tâches — ${done}/${ctx.milestones.length} complétées :`);
        ctx.milestones.slice(0, 20).forEach((m: any) => {
            lines.push(`  ${m.completed ? '✅' : '⬜'} ${m.text}`);
        });
    }

    if (ctx.resources?.length) {
        lines.push(`\nRessources partagées :`);
        ctx.resources.slice(0, 10).forEach((r: any) => lines.push(`  • ${r.text}`));
    }

    if (ctx.decisions?.length) {
        lines.push(`\nDécisions prises :`);
        ctx.decisions.slice(0, 10).forEach((d: any) => {
            lines.push(`  • ${d.title}${d.description ? ' — ' + d.description : ''}${d.outcome ? ' [Résultat: ' + d.outcome + ']' : ''}`);
        });
    }

    if (ctx.announcements?.length) {
        lines.push(`\nAnnonces :`);
        ctx.announcements.slice(0, 8).forEach((a: any) => {
            lines.push(`  • ${a.title}${a.content ? ' — ' + a.content.slice(0, 150) : ''}`);
        });
    }

    if (ctx.questions?.length) {
        lines.push(`\nQuestions & Réponses :`);
        ctx.questions.slice(0, 10).forEach((q: any) => {
            lines.push(`  Q: ${q.question}`);
            if (q.answer) lines.push(`  R: ${q.answer}`);
        });
    }

    if (ctx.dailyFocuses?.length) {
        lines.push(`\nPoints de focus du jour :`);
        ctx.dailyFocuses.slice(0, 8).forEach((f: string) => lines.push(`  • ${f}`));
    }

    if (ctx.roadmapPhases?.length) {
        lines.push(`\nRoadmap — Phases :`);
        ctx.roadmapPhases.slice(0, 8).forEach((p: any) => {
            lines.push(`  📌 ${p.title} (${p.startDate || '?'} → ${p.endDate || '?'})${p.description ? ' — ' + p.description : ''}`);
        });
    }

    if (ctx.roadmapMilestones?.length) {
        lines.push(`\nRoadmap — Jalons :`);
        ctx.roadmapMilestones.slice(0, 10).forEach((m: any) => {
            lines.push(`  ◆ ${m.title} — ${m.date || '?'} (${m.type || 'jalon'})`);
        });
    }

    if (ctx.polls?.length) {
        lines.push(`\nSondages actifs :`);
        ctx.polls.slice(0, 5).forEach((p: any) => {
            lines.push(`  📊 ${p.question} — Options: ${p.options?.join(', ') || '?'}`);
        });
    }

    if (ctx.sessions?.length) {
        lines.push(`\nSessions de travail récentes :`);
        ctx.sessions.slice(0, 8).forEach((s: any) => {
            lines.push(`  🕐 ${s.title || 'Session'} — ${s.date || '?'}`);
        });
    }

    if (ctx.sharedFiles?.length) {
        lines.push(`\nFichiers partagés :`);
        ctx.sharedFiles.slice(0, 10).forEach((f: any) => lines.push(`  📄 ${f.name}`));
    }

    if (ctx.sprints?.length) {
        lines.push(`\nSprints :`);
        ctx.sprints.slice(0, 5).forEach((s: any) => {
            const statusLabel: Record<string, string> = { active: '🟢 Actif', planning: '📋 Planifié', completed: '✅ Terminé' };
            lines.push(`  ${statusLabel[s.status] || s.status} — ${s.title}${s.goal ? ' (Objectif: ' + s.goal + ')' : ''}`);
        });
    }

    if (ctx.sprintTasks?.length) {
        const done = ctx.sprintTasks.filter((t: any) => t.completed).length;
        lines.push(`\nTâches du sprint actif — ${done}/${ctx.sprintTasks.length} complétées :`);
        ctx.sprintTasks.slice(0, 15).forEach((t: any) => {
            lines.push(`  ${t.completed ? '✅' : '⬜'} [${t.priority}] ${t.title}`);
        });
    }

    if (ctx.recentMessages?.length) {
        lines.push(`\nDerniers messages du chat du salon :`);
        ctx.recentMessages.slice(-15).forEach((m: any) => {
            lines.push(`  ${m.user_name}: ${m.content}`);
        });
    }

    lines.push(`
Règles :
- Réponds dans la langue de l'utilisateur (français ou anglais).
- Sois concis, pertinent et utile pour CE salon spécifique.
- Utilise TOUT le contexte ci-dessus pour personnaliser tes réponses.
- Tu connais les décisions prises, les annonces, la roadmap, les sprints, les étapes, les ressources, les sessions et les sondages de ce salon.
- Aide avec planification, questions de contenu, motivation, organisation, analyse de progression.
- Ton chaleureux et professionnel. Emojis avec modération.`);

    if (ctx.currentUserName) lines.push(`\nUtilisateur actuel : ${ctx.currentUserName}`);

    return lines.join('\n');
}
