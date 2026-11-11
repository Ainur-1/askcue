import type React from 'react';

export type OverlayTheme = 'light' | 'dark';

export interface OverlayAppearance {
    shellStyle: React.CSSProperties;
    pillStyle: React.CSSProperties;
    transcriptStyle: React.CSSProperties;
    subtleStyle: React.CSSProperties;
    chipStyle: React.CSSProperties;
    inputStyle: React.CSSProperties;
    controlStyle: React.CSSProperties;
    iconStyle: React.CSSProperties;
    codeBlockStyle: React.CSSProperties;
    codeHeaderStyle: React.CSSProperties;
    dividerStyle: React.CSSProperties;
}

/** Opaque surfaces; the former adjustable transparency feature has been removed. */
export const getOverlayAppearance = (theme: OverlayTheme): OverlayAppearance => {
    const paper = theme === 'light' ? '#f3ead6' : '#1b1d19';
    const raised = theme === 'light' ? '#f7efde' : '#25291f';
    const edge = theme === 'light' ? '#d3cbb4' : '#3c4234';
    const surface = { backgroundColor: paper, borderColor: edge };
    const control = { backgroundColor: raised, borderColor: edge };
    return {
        shellStyle: surface, pillStyle: surface,
        transcriptStyle: { backgroundColor: 'transparent' },
        subtleStyle: control, chipStyle: control, inputStyle: control,
        controlStyle: control, iconStyle: { backgroundColor: raised },
        codeBlockStyle: control, codeHeaderStyle: { ...control, borderBottomColor: edge },
        dividerStyle: { backgroundColor: edge },
    };
};
