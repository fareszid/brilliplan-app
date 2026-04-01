'use client';

import React, { useState } from 'react';
import { AVATAR_PRESETS, getAvatarUrl } from '@/lib/avatarPresets';

interface AvatarProps {
    uid?: string;
    email?: string;
    avatarUrl?: string;
    avatarStyle?: string;
    size?: number | string;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
    alt?: string;
}

export default function Avatar({
    uid,
    email,
    avatarUrl,
    avatarStyle = '1',
    size = 40,
    className = '',
    style = {},
    onClick,
    alt = 'Avatar'
}: AvatarProps) {
    const preset = AVATAR_PRESETS.find(p => p.id === avatarStyle) || AVATAR_PRESETS[0];
    const fallbackSrc = getAvatarUrl(preset.style, preset.seed);

    const isLegacyDicebear = avatarUrl?.includes('dicebear.com/');
    const isFirebaseUrl = avatarUrl?.includes('firebasestorage.googleapis.com') || avatarUrl?.includes('storage.googleapis.com');

    const directSrc = (!avatarUrl || isLegacyDicebear) ? fallbackSrc : avatarUrl;
    const proxySrc = isFirebaseUrl ? `/api/proxy-file?url=${encodeURIComponent(avatarUrl!)}` : null;

    const [src, setSrc] = useState(directSrc);
    const [triedProxy, setTriedProxy] = useState(false);

    // Reset when avatarUrl prop changes
    React.useEffect(() => {
        setSrc(directSrc);
        setTriedProxy(false);
    }, [directSrc]);

    const handleError = () => {
        if (!triedProxy && proxySrc) {
            setTriedProxy(true);
            setSrc(proxySrc);
        } else {
            setSrc(fallbackSrc);
        }
    };

    const dimension = typeof size === 'number' ? `${size}px` : size;

    return (
        <div
            className={className}
            onClick={onClick}
            style={{
                width: dimension,
                height: dimension,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                background: 'rgba(255,255,255,0.05)',
                cursor: onClick ? 'pointer' : 'default',
                ...style
            }}
        >
            <img
                src={src}
                alt={alt}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={handleError}
            />
        </div>
    );
}
