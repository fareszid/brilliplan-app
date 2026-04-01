'use client';

import React, { createContext, useContext, useState, SetStateAction, ReactNode } from 'react';

type UIContextType = {
    isNavbarVisible: boolean;
    setNavbarVisible: (visible: boolean) => void;
    isWorking: boolean;
    setIsWorking: (working: SetStateAction<boolean>) => void;
};

const UIContext = createContext<UIContextType>({
    isNavbarVisible: true,
    setNavbarVisible: () => { },
    isWorking: false,
    setIsWorking: () => { },
});

export const UIProvider = ({ children }: { children: ReactNode }) => {
    const [isNavbarVisible, setNavbarVisible] = useState(true);
    const [isWorking, setIsWorking] = useState(false);

    return (
        <UIContext.Provider value={{ isNavbarVisible, setNavbarVisible, isWorking, setIsWorking }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => useContext(UIContext);
