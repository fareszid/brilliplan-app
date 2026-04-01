'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

const S = {
    page: { maxWidth: '720px', margin: '0 auto', padding: '2rem 2rem 4rem' } as const,
    back: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', marginBottom: '2rem' } as const,
    h1: { fontSize: '2rem', fontWeight: 900, color: '#f4f4f5', letterSpacing: '-0.03em', marginBottom: '0.5rem' } as const,
    updated: { fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)', marginBottom: '2.5rem' } as const,
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '2rem', marginBottom: '1.25rem' } as const,
    h2: { fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '8px' } as const,
    p: { fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, margin: '0 0 0.75rem' } as const,
    ul: { margin: '0.5rem 0 0.75rem', paddingLeft: '1.25rem', fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.75 } as const,
};

export default function Terms() {
    const router = useRouter();
    return (
        <div style={S.page}>
            <button onClick={() => router.back()} style={{ ...S.back, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><ArrowLeft size={15} /> Retour</button>
            <h1 style={S.h1}>Conditions Générales d&apos;Utilisation</h1>
            <p style={S.updated}>Dernière mise à jour : 23 mars 2026</p>

            <div style={S.card}>
                <h2 style={S.h2}>1. Objet et acceptation</h2>
                <p style={S.p}>Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et l&apos;utilisation de la plateforme BrilliPlan, accessible à l&apos;adresse brilliplan.app. En créant un compte ou en utilisant nos services, vous acceptez ces conditions dans leur intégralité.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>2. Accès au service</h2>
                <p style={S.p}>L&apos;utilisation de BrilliPlan nécessite la création d&apos;un compte avec une adresse email valide. Vous êtes seul responsable de la confidentialité de vos identifiants et de toute activité effectuée depuis votre compte.</p>
                <p style={S.p}>Vous vous engagez à fournir des informations exactes et à les maintenir à jour.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>3. Utilisation acceptable</h2>
                <p style={S.p}>Il vous est interdit de :</p>
                <ul style={S.ul}>
                    <li>Utiliser le service à des fins illégales ou contraires aux bonnes mœurs</li>
                    <li>Porter atteinte aux droits ou à la réputation d&apos;autres utilisateurs</li>
                    <li>Tenter de compromettre la sécurité ou l&apos;intégrité de la plateforme</li>
                    <li>Collecter des données personnelles d&apos;autres utilisateurs sans leur consentement</li>
                    <li>Accéder au service par des moyens automatisés non autorisés</li>
                </ul>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>4. Contenu utilisateur</h2>
                <p style={S.p}>Vous conservez la propriété intellectuelle du contenu que vous publiez sur la plateforme. En utilisant BrilliPlan, vous nous accordez une licence limitée, non exclusive, pour stocker et transmettre ce contenu dans le seul but d&apos;assurer le fonctionnement du service.</p>
                <p style={S.p}>Vous êtes seul responsable du contenu que vous publiez et garantissez qu&apos;il ne porte pas atteinte aux droits de tiers.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>5. Fonctionnalités d&apos;intelligence artificielle</h2>
                <p style={S.p}>BrilliPlan intègre des fonctionnalités assistées par intelligence artificielle. Ces fonctionnalités sont fournies à titre indicatif uniquement et ne constituent pas des conseils professionnels. Nous ne garantissons pas l&apos;exactitude, la complétude ou la pertinence des contenus générés automatiquement.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>6. Suppression de compte</h2>
                <p style={S.p}>Vous pouvez supprimer votre compte à tout moment depuis les paramètres de votre profil. La suppression est définitive et entraîne la perte irréversible de toutes vos données associées.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>7. Disponibilité du service</h2>
                <p style={S.p}>BrilliPlan est fourni « tel quel ». Nous ne garantissons pas un fonctionnement ininterrompu ou exempt d&apos;erreurs. Nous nous réservons le droit de suspendre ou modifier le service à tout moment, notamment pour des raisons de maintenance ou de sécurité.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>8. Limitation de responsabilité</h2>
                <p style={S.p}>Dans les limites autorisées par la loi applicable, BrilliPlan ne saurait être tenu responsable des dommages indirects résultant de l&apos;utilisation ou de l&apos;impossibilité d&apos;utiliser le service.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>9. Modification des CGU</h2>
                <p style={S.p}>Nous nous réservons le droit de modifier les présentes conditions. Les utilisateurs seront informés de tout changement significatif. La poursuite de l&apos;utilisation du service après modification vaut acceptation des nouvelles conditions.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>10. Droit applicable</h2>
                <p style={S.p}>Les présentes CGU sont soumises au droit français. Pour toute question : <strong style={{ color: '#d4b872' }}>contact@brilliplan.app</strong></p>
            </div>
        </div>
    );
}
