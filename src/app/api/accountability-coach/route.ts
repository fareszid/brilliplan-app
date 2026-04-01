import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { verifyAuth } from '@/lib/firebase-admin';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { sanitizeForPrompt } from '@/lib/sanitize';

export async function POST(req: Request) {
    const rl = checkRateLimit(getRateLimitKey(req, 'acc-coach'), { maxRequests: 10, windowMs: 60_000 });
    if (rl) return rl;
    const uid = await verifyAuth(req);
    if (!uid) return new Response('Unauthorized', { status: 401 });
    try {
        const body = await req.json();
        const mode = body.mode || 'tips'; // 'tips' | 'weekly-report'
        const myName = sanitizeForPrompt(body.myName, 100);
        const partnerName = sanitizeForPrompt(body.partnerName, 100);
        const weeklyGoal = body.weeklyGoal;

        let prompt: string;

        if (mode === 'weekly-report') {
            const streak = body.streak ?? 0;
            const myReliability = body.myReliability ?? 0;
            const partnerReliability = body.partnerReliability ?? 0;
            const myKept = body.myKept ?? 0;
            const myMissed = body.myMissed ?? 0;
            const partnerKept = body.partnerKept ?? 0;
            const partnerMissed = body.partnerMissed ?? 0;
            const engagementsCompleted = body.engagementsCompleted ?? 0;
            const engagementsTotal = body.engagementsTotal ?? 0;

            prompt = `Tu es un coach d'accountability motivant et bienveillant pour un "Pacte de Discipline" entre deux personnes.
Partenaires : ${myName} et ${partnerName}. Objectif : ${weeklyGoal}h/semaine.

Bilan de la semaine :
- Streak actuel : ${streak} jours consécutifs
- Fiabilité ${myName} : ${myReliability}% (${myKept} check-ins tenus, ${myMissed} manqués)
- Fiabilité ${partnerName} : ${partnerReliability}% (${partnerKept} tenus, ${partnerMissed} manqués)
- Engagements complétés : ${engagementsCompleted}/${engagementsTotal}

Génère un bilan hebdomadaire court et motivant en 3 parties :
1. "recap" : Un résumé factuel de la semaine en 2 phrases max.
2. "strengths" : 2 points forts à célébrer (liste de 2 lignes commençant par "- ").
3. "improvements" : 2 axes d'amélioration concrets (liste de 2 lignes commençant par "- ").

Réponds en JSON valide : {"recap": "...", "strengths": ["...", "..."], "improvements": ["...", "..."]}
Sois direct, positif et concret. Pas de blabla.`;
        } else {
            const linkedSalon = sanitizeForPrompt(body.linkedSalon, 200);
            const myProgress = body.myProgress;
            const partnerProgress = body.partnerProgress;
            const userQuestion = sanitizeForPrompt(body.userQuestion, 500);
            const progressCtx = linkedSalon
                ? `Salon lié : "${linkedSalon}". ${myName} a complété ${myProgress}h, ${partnerName} a complété ${partnerProgress}h.`
                : '';
            const questionCtx = userQuestion?.trim()
                ? `\nQuestion posée par l'utilisateur : "${userQuestion.trim()}".`
                : '';

            prompt = `Tu es un coach d'accountability motivant et bienveillant. Tu aides deux personnes à progresser ensemble.
Partenaires : ${myName} et ${partnerName}. Objectif commun : ${weeklyGoal}h de travail par semaine. ${progressCtx}${questionCtx}

Donne exactement 5 conseils concrets, courts et actionnables pour les aider à atteindre leur objectif ensemble. Chaque conseil doit être spécifique à leur contexte.
Réponds uniquement avec une liste de 5 lignes commençant par "- ". Sois direct, motivant et pratique. Pas d'introduction ni de conclusion.`;
        }

        const { text } = await generateText({
            model: google('gemini-2.5-flash'),
            prompt,
        });

        if (mode === 'weekly-report') {
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                const report = jsonMatch ? JSON.parse(jsonMatch[0]) : { recap: text, strengths: [], improvements: [] };
                return Response.json({ report });
            } catch {
                return Response.json({ report: { recap: text, strengths: [], improvements: [] } });
            }
        }

        const tips = text.split('\n')
            .map(l => l.trim())
            .filter(l => /^[-*•]|^\d+[.)]\s/.test(l))
            .map(l => l.replace(/^[-*•]\s*|^\d+[.)]\s*/, '').replace(/\*\*/g, '').trim())
            .filter(l => l.length > 0);

        return Response.json({ tips });
    } catch (error) {
        console.error('Accountability coach error:', error);
        return new Response('Failed to generate advice', { status: 500 });
    }
}
