import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { verifyAuth } from '@/lib/firebase-admin';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { sanitizeForPrompt, sanitizeObjectForPrompt } from '@/lib/sanitize';

export async function POST(req: Request) {
    const rl = checkRateLimit(getRateLimitKey(req, 'chat-coach'), { maxRequests: 20, windowMs: 60_000 });
    if (rl) return rl;
    const uid = await verifyAuth(req);
    if (!uid) return new Response('Unauthorized', { status: 401 });
    try {
        const body = await req.json();
        const title = sanitizeForPrompt(body.title, 200);
        const userQuery = sanitizeForPrompt(body.userQuery, 1000);
        const chatHistory = sanitizeObjectForPrompt(body.chatHistory, 1000);
        const salonContext = sanitizeObjectForPrompt(body.salonContext, 500);

        // Build rich context from salon data if available
        const contextParts: string[] = [];
        if (salonContext) {
            if (salonContext.description) contextParts.push(`Description : ${salonContext.description}`);
            if (salonContext.category) contextParts.push(`Catégorie : ${Array.isArray(salonContext.category) ? salonContext.category.join(', ') : salonContext.category}`);
            if (salonContext.members?.length) contextParts.push(`Membres (${salonContext.members.length}) : ${salonContext.members.map((m: any) => m.name || m).join(', ')}`);
            if (salonContext.goalHours) contextParts.push(`Objectif horaire : ${salonContext.goalHours}h ${salonContext.goalFrequency || 'total'}`);
            if (salonContext.milestones?.length) {
                const done = salonContext.milestones.filter((m: any) => m.completed).length;
                contextParts.push(`Étapes : ${done}/${salonContext.milestones.length} complétées — ${salonContext.milestones.slice(0, 8).map((m: any) => `[${m.completed ? 'x' : ' '}] ${m.text}`).join(', ')}`);
            }
            if (salonContext.decisions?.length) contextParts.push(`Décisions : ${salonContext.decisions.slice(0, 5).map((d: any) => d.title).join(', ')}`);
            if (salonContext.announcements?.length) contextParts.push(`Annonces : ${salonContext.announcements.slice(0, 5).map((a: any) => a.title).join(', ')}`);
            if (salonContext.dailyFocuses?.length) contextParts.push(`Focus du jour : ${salonContext.dailyFocuses.slice(0, 5).join(', ')}`);
            if (salonContext.roadmapPhases?.length) contextParts.push(`Phases roadmap : ${salonContext.roadmapPhases.slice(0, 5).map((p: any) => `${p.title} (${p.startDate} → ${p.endDate})`).join(', ')}`);
            if (salonContext.sprints?.length) {
                const active = salonContext.sprints.find((s: any) => s.status === 'active');
                if (active) contextParts.push(`Sprint actif : "${active.title}"${active.goal ? ' — ' + active.goal : ''}`);
            }
            if (salonContext.resources?.length) contextParts.push(`Ressources : ${salonContext.resources.slice(0, 5).map((r: any) => r.text || r).join(', ')}`);
        }

        const salonCtxBlock = contextParts.length > 0
            ? `\n\nContexte du salon :\n${contextParts.join('\n')}`
            : '';

        const prompt = `L'objectif de l'utilisateur est : "${title}". ${salonCtxBlock}

Voici l'historique récent de sa discussion (avec toi ou son groupe) pour contexte : 
${chatHistory.map((m: any) => `${m.user_name}: ${m.content}`).join('\n')}

L'utilisateur te pose cette question : "${userQuery}"

En tant que "Coach IA", réponds directement à sa question de façon concise, pertinente, et motivante. 
Utilise le contexte complet du salon (étapes, décisions, roadmap, sprints, etc.) pour personnaliser ta réponse.
Utilise un ton chaleureux, quelques emojis, et limite toi à 2-3 phrases maximum. 
Ne signe pas le message, on sait que c'est toi.`;

        const { text } = await generateText({
            model: google('gemini-2.5-flash'),
            prompt: prompt,
        });

        return Response.json({ message: text.trim() });

    } catch (error) {
        console.error('AI Generation Error:', error);
        return new Response('Failed to generate coach message', { status: 500 });
    }
}
