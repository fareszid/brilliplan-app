'use client';

import React, { createContext, useContext, useState, useRef, useCallback, SetStateAction, ReactNode } from 'react';

export interface WorkInfo {
    id: string;
    title: string;
    type: 'objective' | 'project' | 'accountability';
}

type UIContextType = {
    isNavbarVisible: boolean;
    setNavbarVisible: (visible: boolean) => void;
    isWorking: boolean;
    setIsWorking: (working: SetStateAction<boolean>) => void;
    workInfo: WorkInfo | null;
    setWorkInfo: (info: WorkInfo | null) => void;
    // Stable stop function — calls whatever was last registered. Use workInfo to gate visibility.
    stopWork: () => void;
    registerStopWork: (fn: (() => void) | null) => void;
};

const UIContext = createContext<UIContextType>({
    isNavbarVisible: true,
    setNavbarVisible: () => { },
    isWorking: false,
    setIsWorking: () => { },
    workInfo: null,
    setWorkInfo: () => { },
    stopWork: () => { },
    registerStopWork: () => { },
});

export const UIProvider = ({ children }: { children: ReactNode }) => {
    const [isNavbarVisible, setNavbarVisible] = useState(true);
    const [isWorking, setIsWorking] = useState(false);
    const [workInfo, setWorkInfo] = useState<WorkInfo | null>(null);

    // Ref holds the latest stop function — never stale, no re-render needed
    const stopWorkRef = useRef<(() => void) | null>(null);
    const stopWork = useCallback(() => { stopWorkRef.current?.(); }, []);
    const registerStopWork = useCallback((fn: (() => void) | null) => { stopWorkRef.current = fn; }, []);

    return (
        <UIContext.Provider value={{ isNavbarVisible, setNavbarVisible, isWorking, setIsWorking, workInfo, setWorkInfo, stopWork, registerStopWork }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => useContext(UIContext);
