'use client';

import { useParams } from 'next/navigation';
import { UserProfileView } from '@/components/UserProfileView';

export default function UserProfile() {
    const { uid } = useParams<{ uid: string }>();
    return <UserProfileView uid={uid} redirectToUsername />;
}
