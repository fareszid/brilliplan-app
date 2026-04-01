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

export default function Privacy() {
    const router = useRouter();
    return (
        <div style={S.page}>
            <button onClick={() => router.back()} style={{ ...S.back, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><ArrowLeft size={15} /> Retour</button>
            <h1 style={S.h1}>Politique de Confidentialité</h1>
            <p style={S.updated}>Dernière mise à jour : 23 mars 2026</p>

            <div style={S.card}>
                <h2 style={S.h2}>1. Responsable du traitement</h2>
                <p style={S.p}>Le responsable du traitement des données personnelles collectées via la plateforme BrilliPlan est l&apos;équipe BrilliPlan.</p>
                <p style={S.p}>Contact : <strong style={{ color: '#d4b872' }}>privacy@brilliplan.app</strong></p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>2. Données collectées</h2>
                <p style={S.p}>Nous collectons uniquement les données personnelles nécessaires au fonctionnement du service, notamment les informations d&apos;identification et de compte, ainsi que les données générées par votre utilisation de la plateforme.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>3. Finalités et base légale</h2>
                <p style={S.p}>Vos données sont traitées aux fins suivantes :</p>
                <ul style={S.ul}>
                    <li><strong style={{ color: '#e2e8f0' }}>Exécution du contrat :</strong> fourniture et fonctionnement du service</li>
                    <li><strong style={{ color: '#e2e8f0' }}>Intérêt légitime :</strong> amélioration du service et sécurité de la plateforme</li>
                    <li><strong style={{ color: '#e2e8f0' }}>Consentement :</strong> fonctionnalités optionnelles soumises à votre accord préalable</li>
                </ul>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>4. Sous-traitants</h2>
                <p style={S.p}>Certaines données peuvent être transmises à des prestataires techniques tiers qui agissent en qualité de sous-traitants dans le strict respect du RGPD. Ces prestataires n&apos;utilisent vos données qu&apos;aux fins nécessaires à l&apos;exécution de leurs services pour notre compte.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>5. Durée de conservation</h2>
                <p style={S.p}>Vos données sont conservées pendant toute la durée de vie de votre compte. Après suppression de votre compte, vos données sont effacées de manière irréversible dans un délai de 30 jours.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>6. Vos droits (RGPD)</h2>
                <p style={S.p}>Conformément au Règlement Général sur la Protection des Données (UE) 2016/679, vous disposez des droits suivants :</p>
                <ul style={S.ul}>
                    <li><strong style={{ color: '#e2e8f0' }}>Accès</strong> à vos données personnelles</li>
                    <li><strong style={{ color: '#e2e8f0' }}>Rectification</strong> de données inexactes</li>
                    <li><strong style={{ color: '#e2e8f0' }}>Suppression</strong> de vos données (droit à l&apos;oubli)</li>
                    <li><strong style={{ color: '#e2e8f0' }}>Portabilité</strong> de vos données dans un format structuré</li>
                    <li><strong style={{ color: '#e2e8f0' }}>Opposition</strong> au traitement de vos données</li>
                    <li><strong style={{ color: '#e2e8f0' }}>Limitation</strong> du traitement dans les cas prévus par la loi</li>
                </ul>
                <p style={S.p}>Pour exercer ces droits : <strong style={{ color: '#d4b872' }}>privacy@brilliplan.app</strong></p>
                <p style={S.p}>Vous disposez également du droit d&apos;introduire une réclamation auprès de la CNIL (Commission Nationale de l&apos;Informatique et des Libertés).</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>7. Sécurité</h2>
                <p style={S.p}>Nous mettons en œuvre les mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, perte ou divulgation.</p>
            </div>

            <div style={S.card}>
                <h2 style={S.h2}>8. Modification de cette politique</h2>
                <p style={S.p}>Nous nous réservons le droit de modifier la présente politique. En cas de changement significatif, vous en serez informé via la plateforme. La date de dernière mise à jour est indiquée en haut de cette page.</p>
            </div>
        </div>
    );
}
