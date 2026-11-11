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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mix = (min: number, max: number, value: number) => min + ((max - min) * value);

export const OVERLAY_OPACITY_MIN = 0.35;
export const OVERLAY_OPACITY_MAX = 1;
/** @deprecated Use getDefaultOverlayOpacity() for theme-aware default. */
export const OVERLAY_OPACITY_DEFAULT = 0.65;
export const OVERLAY_OPACITY_DEFAULT_DARK = 0.84;
export const OVERLAY_OPACITY_DEFAULT_LIGHT = 0.78;

/** Returns the correct default opacity based on the currently active theme. */
export const getDefaultOverlayOpacity = (): number =>
    document.documentElement.getAttribute('data-theme') === 'light'
        ? OVERLAY_OPACITY_DEFAULT_LIGHT
        : OVERLAY_OPACITY_DEFAULT_DARK;

export const clampOverlayOpacity = (opacity: number) => clamp(opacity, OVERLAY_OPACITY_MIN, OVERLAY_OPACITY_MAX);

const normalizeOpacity = (opacity: number) =>
    (clampOverlayOpacity(opacity) - OVERLAY_OPACITY_MIN) / (OVERLAY_OPACITY_MAX - OVERLAY_OPACITY_MIN);
const scale = (min: number, max: number, strength: number, ease = 1) =>
    mix(min, max, Math.pow(clamp(strength, 0, 1), ease));

export const getOverlayAppearance = (opacity: number, theme: OverlayTheme): OverlayAppearance => {
    const strength = normalizeOpacity(opacity);
    const surfaceStrength = Math.pow(strength, 1.02);
    const blurStrength = Math.pow(strength, 0.94);

    if (theme === 'light') {
        return {
            shellStyle: {
                backgroundColor: `rgba(243, 234, 214, ${scale(0.74, 0.975, surfaceStrength)})`,
                borderColor: `rgba(80, 89, 66, ${scale(0.11, 0.17, surfaceStrength)})`,
                boxShadow: `0 24px 48px rgba(80, 89, 66, ${scale(0.035, 0.08, surfaceStrength)})`,
                backdropFilter: `blur(${scale(8, 17, blurStrength)}px) saturate(132%)`,
                WebkitBackdropFilter: `blur(${scale(8, 17, blurStrength)}px) saturate(132%)`,
            },
            pillStyle: {
                backgroundColor: `rgba(247, 239, 222, ${scale(0.72, 0.955, surfaceStrength)})`,
                borderColor: `rgba(80, 89, 66, ${scale(0.09, 0.155, surfaceStrength)})`,
                boxShadow: `0 12px 28px rgba(80, 89, 66, ${scale(0.02, 0.06, surfaceStrength)})`,
                backdropFilter: `blur(${scale(5, 10, blurStrength)}px) saturate(130%)`,
                WebkitBackdropFilter: `blur(${scale(5, 10, blurStrength)}px) saturate(130%)`,
            },
            transcriptStyle: {
                backgroundColor: 'transparent',
                borderBottomColor: 'transparent',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
            },
            subtleStyle: {
                backgroundColor: `rgba(237, 228, 207, ${scale(0.66, 0.9, surfaceStrength)})`,
                borderColor: `rgba(80, 89, 66, ${scale(0.07, 0.13, surfaceStrength)})`,
            },
            chipStyle: {
                backgroundColor: `rgba(243, 234, 214, ${scale(0.7, 0.92, surfaceStrength)})`,
                borderColor: `rgba(80, 89, 66, ${scale(0.07, 0.13, surfaceStrength)})`,
            },
            inputStyle: {
                backgroundColor: `rgba(247, 239, 222, ${scale(0.8, 0.955, surfaceStrength)})`,
                borderColor: `rgba(80, 89, 66, ${scale(0.085, 0.145, surfaceStrength)})`,
            },
            controlStyle: {
                backgroundColor: `rgba(243, 234, 214, ${scale(0.72, 0.92, surfaceStrength)})`,
                borderColor: `rgba(80, 89, 66, ${scale(0.08, 0.145, surfaceStrength)})`,
            },
            iconStyle: {
                backgroundColor: `rgba(243, 234, 214, ${scale(0.68, 0.88, surfaceStrength)})`,
            },
            codeBlockStyle: {
                backgroundColor: `rgba(235, 226, 205, ${scale(0.76, 0.94, surfaceStrength)})`,
                borderColor: `rgba(80, 89, 66, ${scale(0.08, 0.145, surfaceStrength)})`,
            },
            codeHeaderStyle: {
                backgroundColor: `rgba(231, 222, 199, ${scale(0.8, 0.955, surfaceStrength)})`,
                borderBottomColor: `rgba(80, 89, 66, ${scale(0.09, 0.155, surfaceStrength)})`,
            },
            dividerStyle: {
                backgroundColor: `rgba(80, 89, 66, ${scale(0.09, 0.15, surfaceStrength)})`,
            },
        };
    }

    return {
        shellStyle: {
            backgroundColor: `rgba(27, 29, 25, ${scale(0.92, 0.975, surfaceStrength)})`,
            borderColor: `rgba(232, 221, 195, ${scale(0.11, 0.15, surfaceStrength)})`,
            boxShadow: `0 24px 48px rgba(0, 0, 0, ${scale(0.1, 0.23, surfaceStrength)})`,
            backdropFilter: `blur(${scale(8, 18, blurStrength)}px) saturate(130%)`,
            WebkitBackdropFilter: `blur(${scale(8, 18, blurStrength)}px) saturate(130%)`,
        },
        pillStyle: {
            backgroundColor: `rgba(32, 35, 29, ${scale(0.7, 0.95, surfaceStrength)})`,
            borderColor: `rgba(232, 221, 195, ${scale(0.1, 0.145, surfaceStrength)})`,
            boxShadow: `0 12px 28px rgba(0, 0, 0, ${scale(0.05, 0.16, surfaceStrength)})`,
            backdropFilter: `blur(${scale(5, 12, blurStrength)}px) saturate(128%)`,
            WebkitBackdropFilter: `blur(${scale(5, 12, blurStrength)}px) saturate(128%)`,
        },
        transcriptStyle: {
            backgroundColor: 'transparent',
            borderBottomColor: 'transparent',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
        },
        subtleStyle: {
            backgroundColor: `rgba(37, 41, 31, ${scale(0.56, 0.88, surfaceStrength)})`,
            borderColor: `rgba(232, 221, 195, ${scale(0.055, 0.085, surfaceStrength)})`,
        },
        chipStyle: {
            backgroundColor: `rgba(43, 48, 36, ${scale(0.58, 0.9, surfaceStrength)})`,
            borderColor: `rgba(232, 221, 195, ${scale(0.055, 0.085, surfaceStrength)})`,
        },
        inputStyle: {
            backgroundColor: `rgba(37, 41, 31, ${scale(0.72, 0.92, surfaceStrength)})`,
            borderColor: `rgba(232, 221, 195, ${scale(0.065, 0.095, surfaceStrength)})`,
        },
        controlStyle: {
            backgroundColor: `rgba(37, 41, 31, ${scale(0.62, 0.89, surfaceStrength)})`,
            borderColor: `rgba(232, 221, 195, ${scale(0.065, 0.095, surfaceStrength)})`,
        },
        iconStyle: {
            backgroundColor: `rgba(43, 48, 36, ${scale(0.56, 0.86, surfaceStrength)})`,
        },
        codeBlockStyle: {
            backgroundColor: `rgba(32, 35, 29, ${scale(0.76, 0.94, surfaceStrength)})`,
            borderColor: `rgba(232, 221, 195, ${scale(0.065, 0.105, surfaceStrength)})`,
        },
        codeHeaderStyle: {
            backgroundColor: `rgba(37, 41, 31, ${scale(0.66, 0.9, surfaceStrength)})`,
            borderBottomColor: `rgba(232, 221, 195, ${scale(0.065, 0.105, surfaceStrength)})`,
        },
        dividerStyle: {
            backgroundColor: `rgba(247, 239, 222, ${scale(0.08, 0.12, surfaceStrength)})`,
        },
    };
};
