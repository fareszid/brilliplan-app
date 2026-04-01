import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { verifyAuth } from '@/lib/firebase-admin';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { sanitizeForPrompt, sanitizeObjectForPrompt } from '@/lib/sanitize';

export async function POST(req: Request) {
    const rl = checkRateLimit(getRateLimitKey(req, 'gen-resources'), { maxRequests: 5, windowMs: 60_000 });
    if (rl) return rl;
    const uid = await verifyAuth(req);
    if (!uid) return new Response('Unauthorized', { status: 401 });
    try {
        const body = await req.json();
        const title = sanitizeForPrompt(body.title, 200);
        const category = body.category;
        const userPrompt = sanitizeForPrompt(body.userPrompt, 500);
        const salonContext = sanitizeObjectForPrompt(body.salonContext, 500);

        if (!title) {
            return new Response('Missing objective title', { status: 400 });
        }

        // Build rich context from salon data if available
        const contextParts: string[] = [];
        if (salonContext) {
            if (salonContext.description) contextParts.push(`Description : ${salonContext.description}`);
            if (salonContext.members?.length) contextParts.push(`Membres (${salonContext.members.length}) : ${salonContext.members.map((m: any) => m.name || m).join(', ')}`);
            if (salonContext.milestones?.length) {
                const pending = salonContext.milestones.filter((m: any) => !m.completed);
                if (pending.length) contextParts.push(`Étapes en cours : ${pending.slice(0, 8).map((m: any) => m.text).join(', ')}`);
            }
            if (salonContext.decisions?.length) contextParts.push(`Décisions prises : ${salonContext.decisions.slice(0, 5).map((d: any) => d.title).join(', ')}`);
            if (salonContext.roadmapPhases?.length) contextParts.push(`Phases roadmap : ${salonContext.roadmapPhases.slice(0, 5).map((p: any) => p.title).join(', ')}`);
            if (salonContext.existingResources?.length) contextParts.push(`Ressources existantes (ne pas dupliquer) : ${salonContext.existingResources.slice(0, 8).map((r: any) => r.text || r).join(', ')}`);
            if (salonContext.dailyFocuses?.length) contextParts.push(`Focus actuels : ${salonContext.dailyFocuses.slice(0, 5).join(', ')}`);
            if (salonContext.sprints?.length) {
                const active = salonContext.sprints.find((s: any) => s.status === 'active');
                if (active) contextParts.push(`Sprint actif : "${active.title}"`);
            }
        }

        const contextBlock = contextParts.length > 0
            ? `\nContexte du salon :\n${contextParts.join('\n')}\n\nUtilise ce contexte pour recommander des ressources plus ciblées et pertinentes. Ne recommande pas les ressources qui existent déjà.`
            : '';

        const extraContext = userPrompt?.trim()
            ? `\nL'utilisateur précise : "${userPrompt.trim()}".`
            : '';

        const prompt = `Je travaille sur un projet intitulé "${title}" (catégorie : ${category || 'général'}).${contextBlock}${extraContext}
En tant que mentor, recommande-moi exactement 5 ressources clés (cours en ligne, documentation officielle, outils, concepts à rechercher) pour progresser sur ce projet.
Les ressources doivent être pertinentes par rapport aux étapes en cours, à la roadmap et aux décisions prises dans le salon.
Réponds uniquement avec une liste de 5 lignes, chaque ligne commençant par "- ". Sois concis et très pertinent. Pas d'introduction ni de conclusion.`;

        const { text } = await generateText({
            model: google('gemini-2.5-flash'),
            prompt,
        });

        // Robust parsing: accept lines starting with -, *, •, or numbers like "1."
        const resources = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .filter(line => /^[-*•]|^\d+[.)]\s/.test(line))
            .map(line => line.replace(/^[-*•]\s*|^\d+[.)]\s*/, '').replace(/\*\*/g, '').trim())
            .filter(line => line.length > 0);

        return Response.json({ resources });

    } catch (error) {
        console.error('AI Generation Error:', error);
        return new Response('Failed to generate resources', { status: 500 });
    }
}
