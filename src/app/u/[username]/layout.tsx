import { Metadata } from 'next';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { username } = await params;
    return { title: `@${username}` };
}

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
