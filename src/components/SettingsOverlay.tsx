import { t } from '../i18n';
import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from 'react-query';
import packageJson from '../../package.json';
import {
    X, Mic, Speaker, Monitor, Keyboard, BookOpen, Upload,
    ArrowDown,
    RotateCcw, Eye, Layout, MessageSquare,
    ChevronDown, ChevronUp, ChevronRight, Check, BadgeCheck, Power, Palette, Ghost, Sun, Moon, RefreshCw, Info, Globe, FlaskConical, Terminal, Settings, Activity, ExternalLink, Trash2,
    Pencil, MapPin, HelpCircle, Zap, SlidersHorizontal, PointerOff,
    AlertCircle, Loader2, Shield
} from 'lucide-react';
import { analytics } from '../lib/analytics/analytics.service';
import { AboutSection } from './AboutSection';
import { AIProvidersSettings } from './settings/AIProvidersSettings';
import AppearanceSettings from './settings/AppearanceSettings';
import { SystemProxySettings } from './settings/SystemProxySettings';
import { motion, AnimatePresence } from 'framer-motion';
import { useShortcuts } from '../hooks/useShortcuts';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { KeyRecorder } from './ui/KeyRecorder';
import { ProfileVisualizer } from '../premium';
import { JDListManager } from './knowledge/JDListManager';
import icon from '../../assets/icon.png';
import { useProfileStatus } from '../hooks/useProfileStatus';
import { useProfileData } from '../hooks/useProfileData';
import { useUploadResume } from '../hooks/useUploadResume';
import { useKnowledgeMode } from '../hooks/useKnowledgeMode';

const DEFAULT_TRANSCRIPT_TRANSLATION_PROMPT =
    'You are a realtime subtitle translator. Preserve meaning, tone, technical terms, product names, numbers, and code tokens exactly when appropriate. Do not summarize, do not add explanations, and do not omit information. Return only the translated sentence(s), with no prefix/suffix and no markdown.';

type TranscriptAssemblerProfile = 'sentence_bias' | 'low_latency' | 'coherent';

const TRANSCRIPT_ASSEMBLER_PROFILE_OPTIONS: Array<{ value: TranscriptAssemblerProfile; label: string; desc: string }> = [
    { value: 'sentence_bias', label: 'Sentence-biased', desc: 'Balanced sentence completeness with moderate delay.' },
    { value: 'low_latency', label: 'Low-latency', desc: 'Fastest transcript updates, but long sentences may split earlier.' },
    { value: 'coherent', label: 'Coherent', desc: 'Most complete segments for translation; final subtitles may arrive 5-30s later.' },
];

interface CustomSelectProps {
    label: string;
    icon: React.ReactNode;
    value: string;
    options: MediaDeviceInfo[];
    onChange: (value: string) => void;
    placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ label, icon, value, options, onChange, placeholder = "Select device" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.deviceId === value)?.label || placeholder;

    return (
        <div className="bg-bg-card rounded-xl p-4 border border-border-subtle" ref={containerRef}>
            {label && (
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-text-secondary">{icon}</span>
                    <label className="text-xs font-medium text-text-primary uppercase tracking-wide">{t(label)}</label>
                </div>
            )}

            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary flex items-center justify-between hover:bg-bg-elevated transition-colors"
                >
                    <span className="truncate pr-4">{selectedLabel}</span>
                    <ChevronDown size={14} className={`text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animated fadeIn">
                        <div className="p-1 space-y-0.5">
                            {options.map((device) => (
                                <button
                                    key={device.deviceId}
                                    onClick={() => {
                                        onChange(device.deviceId);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between group transition-colors ${value === device.deviceId ? 'bg-bg-input hover:bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                >
                                    <span className="truncate">{device.label || `Device ${device.deviceId.slice(0, 5)}...`}</span>
                                    {value === device.deviceId && <Check size={14} className="text-accent-primary" />}
                                </button>
                            ))}
                            {options.length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500 italic">{t("No devices found")}</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ProviderOption {
    id: string;
    label: string;
    badge?: string | null;
    recommended?: boolean;
    desc: string;
    color: string;
    icon: React.ReactNode;
}

interface ProviderSelectProps {
    value: string;
    options: ProviderOption[];
    onChange: (value: string) => void;
}

const ProviderSelect: React.FC<ProviderSelectProps> = ({ value, options, onChange }) => {
    const isLight = useResolvedTheme() === 'light';
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selected = options.find(o => o.id === value);

    const getBadgeStyle = (color?: string) => {
        switch (color) {
            case 'blue': return 'bg-state-info-soft text-state-info border-state-info-border';
            case 'orange': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'purple': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'teal': return 'bg-teal-500/10 text-teal-500 border-teal-500/20';
            case 'cyan': return 'bg-state-info-soft text-state-info border-cyan-500/20';
            case 'indigo': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
            case 'green': return 'bg-state-success-soft text-state-success border-state-success-border';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    const getIconStyle = (color?: string, isSelectedItem: boolean = false) => {
        if (isSelectedItem) return 'bg-accent-primary text-white shadow-sm';
        // For unselected items in list or trigger
        switch (color) {
            case 'blue': return 'bg-state-info-soft text-blue-600';
            case 'orange': return 'bg-orange-500/10 text-orange-600';
            case 'purple': return 'bg-purple-500/10 text-purple-600';
            case 'teal': return 'bg-teal-500/10 text-teal-600';
            case 'cyan': return 'bg-state-info-soft text-cyan-600';
            case 'indigo': return 'bg-indigo-500/10 text-indigo-600';
            case 'green': return 'bg-state-success-soft text-green-600';
            default: return 'bg-gray-500/10 text-gray-600';
        }
    };

    return (
        <div ref={containerRef} className="relative z-20 font-sans">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full group bg-bg-input border border-border-subtle hover:border-border-muted shadow-sm rounded-xl p-2.5 pr-3.5 flex items-center justify-between transition-all duration-200 outline-none focus:ring-2 focus:ring-accent-primary/20 ${isOpen ? 'ring-2 ring-accent-primary/20 border-accent-primary/50' : 'hover:shadow-md'}`}
            >
                {selected ? (
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-300 ${getIconStyle(selected.color)}`}>
                            {selected.icon}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-text-primary truncate leading-tight">{t(selected.label)}</span>
                                {selected.badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ml-2 ${getBadgeStyle(selected.badge === 'Saved' ? 'green' : selected.color)}`}>{selected.badge}</span>}
                                {selected.recommended && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ml-2 ${getBadgeStyle(selected.color)}`}>{t("Recommended")}</span>}
                            </div>
                            {/* Short description for trigger */}
                            <span className="text-[11px] text-text-tertiary truncate block leading-tight mt-0.5">{selected.desc}</span>
                        </div>
                    </div>
                ) : <span className="text-text-secondary px-2 text-sm">{t("Select Provider")}</span>}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-text-tertiary transition-transform duration-300 group-hover:bg-bg-input ${isOpen ? 'rotate-180 bg-bg-input text-text-primary' : ''}`}>
                    <ChevronDown size={14} strokeWidth={2.5} />
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className={`absolute top-full left-0 w-full mt-2 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 ${isLight ? 'bg-bg-elevated border border-border-subtle' : 'bg-bg-elevated/90 border border-white/5'}`}
                    >
                        <div className="max-h-[320px] overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                            {options.map(option => {
                                const isSelected = value === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => { onChange(option.id); setIsOpen(false); }}
                                        className={`w-full rounded-[10px] p-2 flex items-center gap-3 transition-all duration-200 group relative ${isSelected ? (isLight ? 'bg-bg-item-active shadow-inner' : 'bg-white/10 shadow-inner') : (isLight ? 'hover:bg-bg-item-surface' : 'hover:bg-white/5')}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-95 group-hover:scale-100'} ${getIconStyle(option.color, false)}`}>
                                            {option.icon}
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[13px] font-medium transition-colors ${isSelected && !isLight ? 'text-white' : 'text-text-primary'}`}>{t(option.label)}</span>
                                                    {option.badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${getBadgeStyle(option.badge === 'Saved' ? 'green' : option.color)}`}>{option.badge}</span>}
                                                    {option.recommended && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${getBadgeStyle(option.color)}`}>{t("Recommended")}</span>}
                                                </div>
                                                {isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={14} className="text-accent-primary" strokeWidth={3} /></motion.div>}
                                            </div>
                                            <span className={`text-[11px] block truncate transition-colors ${isSelected && !isLight ? 'text-white/70' : 'text-text-tertiary'}`}>{option.desc}</span>
                                        </div>
                                        {/* Hover Indicator */}
                                        {!isSelected && <div className="absolute inset-0 rounded-[10px] ring-1 ring-inset ring-transparent group-hover:ring-border-subtle pointer-events-none" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface SettingsOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: string;
    embedded?: boolean;
    materialsOnly?: boolean;
}

const SettingsOverlay: React.FC<SettingsOverlayProps> = ({ isOpen, onClose, initialTab = 'general', embedded = false, materialsOnly = false }) => {
    const isLight = useResolvedTheme() === 'light';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [showMoreShortcuts, setShowMoreShortcuts] = useState<boolean>(false);

    // Sync active tab when modal opens
    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    const { shortcuts, updateShortcut, resetShortcuts } = useShortcuts();
    const [isUndetectable, setIsUndetectable] = useState(false);
    const [isMousePassthrough, setIsMousePassthrough] = useState(false);
    const [disguiseMode, setDisguiseMode] = useState<'terminal' | 'settings' | 'activity' | 'none'>('none');
    const [openOnLogin, setOpenOnLogin] = useState(false);
    const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system');
    const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
    const [isAiLangDropdownOpen, setIsAiLangDropdownOpen] = useState(false);
    const themeDropdownRef = React.useRef<HTMLDivElement>(null);
    const aiLangDropdownRef = React.useRef<HTMLDivElement>(null);

    // Profile Engine State
    const queryClient = useQueryClient();
    const { data: profileStatus = { hasProfile: false, profileMode: false } } = useProfileStatus();
    const { data: profileData } = useProfileData(activeTab === 'profile');
    const uploadResume = useUploadResume();
    const { isEnabled: knowledgeMode, toggle: toggleKnowledge } = useKnowledgeMode();
    const profileUploading = uploadResume.isLoading;
    const profileError = uploadResume.error instanceof Error ? uploadResume.error.message : '';
    const [verboseLogging, setVerboseLogging] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<{ microphone: string; screen: string } | null>(null);

    // Close dropdown when clicking outside
    // Sync with global state changes
    useEffect(() => {
        if (isOpen) {
            // Fetch true initial state from main process
            window.electronAPI?.getUndetectable?.().then(setIsUndetectable).catch(() => { });
            window.electronAPI?.getOverlayMousePassthrough?.().then(setIsMousePassthrough).catch(() => { });
            window.electronAPI?.getDisguise?.().then(setDisguiseMode).catch(() => { });
            window.electronAPI?.getVerboseLogging?.().then(setVerboseLogging).catch(() => { });
            window.electronAPI?.getPermissionStatus?.().then(setPermissionStatus).catch(() => { });
        }
    }, [isOpen]);

    useEffect(() => {
        if (window.electronAPI?.onUndetectableChanged) {
            const unsubscribe = window.electronAPI.onUndetectableChanged((newState: boolean) => {
                setIsUndetectable(newState);
            });
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        if (window.electronAPI?.onDisguiseChanged) {
            const unsubscribe = window.electronAPI.onDisguiseChanged((newMode: any) => {
                setDisguiseMode(newMode);
            });
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        if (window.electronAPI?.onOverlayMousePassthroughChanged) {
            const unsubscribe = window.electronAPI.onOverlayMousePassthroughChanged((enabled: boolean) => {
                setIsMousePassthrough(enabled);
            });
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
                setIsThemeDropdownOpen(false);
            }
            if (aiLangDropdownRef.current && !aiLangDropdownRef.current.contains(event.target as Node)) {
                setIsAiLangDropdownOpen(false);
            }
        };

        if (isThemeDropdownOpen || isAiLangDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isThemeDropdownOpen, isAiLangDropdownOpen]);

    const [showTranscript, setShowTranscript] = useState(() => {
        const stored = localStorage.getItem('pika_interviewer_transcript');
        return stored !== 'false';
    });

    // Recognition Language
    const [recognitionLanguage, setRecognitionLanguage] = useState('');
    const [selectedSttGroup, setSelectedSttGroup] = useState('');
    const [availableLanguages, setAvailableLanguages] = useState<Record<string, any>>({});

    // AI Response Language
    const [aiResponseLanguage, setAiResponseLanguage] = useState('English');
    const [availableAiLanguages, setAvailableAiLanguages] = useState<any[]>([]);

    useEffect(() => {
        const loadLanguages = async () => {
            if (window.electronAPI?.getRecognitionLanguages) {
                const langs = await window.electronAPI.getRecognitionLanguages();
                setAvailableLanguages(langs);

                // Load stored preference or auto-detect
                const storedStt = await window.electronAPI.getSttLanguage();
                let currentLangKey = storedStt;

                if (!currentLangKey) {
                    const systemLocale = navigator.language;
                    // Try to find exact match or primary match
                    const match = Object.entries(langs).find(([_, config]: [string, any]) =>
                        config.bcp47 === systemLocale ||
                        config.iso639 === systemLocale ||
                        (config.alternates && config.alternates.includes(systemLocale))
                    );

                    currentLangKey = match ? match[0] : 'english-us';

                    // Save the auto-detected default
                    if (window.electronAPI?.setRecognitionLanguage) {
                        window.electronAPI.setRecognitionLanguage(currentLangKey);
                    }
                }

                setRecognitionLanguage(currentLangKey);

                // Initialize Group based on current language
                if (langs[currentLangKey]) {
                    setSelectedSttGroup(langs[currentLangKey].group);
                } else {
                    setSelectedSttGroup('English');
                }
            }

            if (window.electronAPI?.getAiResponseLanguages) {
                const aiLangs = await window.electronAPI.getAiResponseLanguages();
                // Sort: English first, then alphabetical
                const sortedAiLangs = [...aiLangs].sort((a, b) => {
                    if (a.label === 'English') return -1;
                    if (b.label === 'English') return 1;
                    return a.label.localeCompare(b.label);
                });
                setAvailableAiLanguages(sortedAiLangs);

                const storedAi = await window.electronAPI.getAiResponseLanguage();
                setAiResponseLanguage(storedAi || 'English');
            }
        };
        loadLanguages();
    }, []);

    // Providers that don't support multi-language / auto-detect in a single request.
    const STT_PROVIDERS_WITHOUT_AUTO = new Set(['azure', 'ibmwatson']);

    const handleLanguageChange = async (key: string) => {
        setRecognitionLanguage(key);
        if (key === 'auto') {
            setSelectedSttGroup('Auto');
        } else if (availableLanguages[key]) {
            setSelectedSttGroup(availableLanguages[key].group);
        }
        if (window.electronAPI?.setRecognitionLanguage) {
            await window.electronAPI.setRecognitionLanguage(key);
        }
    };

    const handleGroupChange = (group: string) => {
        setSelectedSttGroup(group);
        if (group === 'Auto') {
            handleLanguageChange('auto');
            return;
        }
        // Find default variant for this group (first one)
        const firstVariant = Object.entries(availableLanguages).find(([_, lang]) => lang.group === group);
        if (firstVariant) {
            handleLanguageChange(firstVariant[0]);
        }
    };

    // Base list of unique language groups. The "Auto" group is injected at
    // render time below (only when the current STT provider supports it).
    const baseLanguageGroups = Array.from(new Set(Object.values(availableLanguages).map((l: any) => l.group)))
        .sort((a, b) => {
            if (a === 'English') return -1;
            if (b === 'English') return 1;
            return a.localeCompare(b);
        });

    const translationLanguageOptions = useMemo(() => {
        return Object.entries(availableLanguages)
            .map(([k, v]) => ({ value: k, label: (v as { label?: string }).label || k }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [availableLanguages]);

    // Helper to get variants for current group
    const currentGroupVariants = Object.entries(availableLanguages)

        .filter(([_, lang]) => lang.group === selectedSttGroup)
        .map(([key, lang]) => ({
            deviceId: key,
            label: lang.label,
            kind: 'audioinput' as MediaDeviceKind,
            groupId: '',
            toJSON: () => ({})
        }));

    const handleAiLanguageChange = async (key: string) => {
        if (!key) return;
        const previous = aiResponseLanguage;
        setAiResponseLanguage(key); // Optimistic update
        try {
            if (window.electronAPI?.setAiResponseLanguage) {
                const result = await window.electronAPI.setAiResponseLanguage(key);
                if (result && !result.success) {
                    // Rollback on explicit failure
                    setAiResponseLanguage(previous);
                    console.error('[Settings] Failed to set AI response language:', result.error);
                }
            }
        } catch (err) {
            // Rollback on exception
            setAiResponseLanguage(previous);
            console.error('[Settings] Exception setting AI response language:', err);
        }
    };


    // Sync transcript setting
    useEffect(() => {
        const handleStorage = () => {
            const stored = localStorage.getItem('pika_interviewer_transcript');
            setShowTranscript(stored !== 'false');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Theme Handlers
    const handleSetTheme = async (mode: 'system' | 'light' | 'dark') => {
        setThemeMode(mode);
        if (window.electronAPI?.setThemeMode) {
            await window.electronAPI.setThemeMode(mode);
        }
    };

    // Audio Settings
    const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedInput, setSelectedInput] = useState('');
    const [selectedOutput, setSelectedOutput] = useState('');
    const [micLevel, setMicLevel] = useState(0);
    const [isMicTesting, setIsMicTesting] = useState(false);
    const [micTestError, setMicTestError] = useState('');
    const [inputDeviceNotFound, setInputDeviceNotFound] = useState(false);
    const [useExperimentalSck, setUseExperimentalSck] = useState(false);

    // STT Provider settings
    const [sttProvider, setSttProvider] = useState<'google' | 'groq' | 'openai' | 'deepgram' | 'elevenlabs' | 'azure' | 'ibmwatson' | 'soniox'>('google');
    const [transcriptAssemblerProfile, setTranscriptAssemblerProfile] = useState<TranscriptAssemblerProfile>('sentence_bias');
    const [groqSttModel, setGroqSttModel] = useState('whisper-large-v3-turbo');
    const [sttGroqKey, setSttGroqKey] = useState('');
    const [sttOpenaiKey, setSttOpenaiKey] = useState('');
    const [sttDeepgramKey, setSttDeepgramKey] = useState('');
    const [sttElevenLabsKey, setSttElevenLabsKey] = useState('');
    const [sttAzureKey, setSttAzureKey] = useState('');
    const [sttAzureRegion, setSttAzureRegion] = useState('eastus');
    const [sttIbmKey, setSttIbmKey] = useState('');
    const [sttTestStatus, setSttTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [sttTestError, setSttTestError] = useState('');
    const [sttSaving, setSttSaving] = useState(false);
    const [sttSaved, setSttSaved] = useState(false);
    const [googleServiceAccountPath, setGoogleServiceAccountPath] = useState<string | null>(null);
    const [hasStoredSttGroqKey, setHasStoredSttGroqKey] = useState(false);
    const [hasStoredSttOpenaiKey, setHasStoredSttOpenaiKey] = useState(false);
    const [hasStoredDeepgramKey, setHasStoredDeepgramKey] = useState(false);
    const [hasStoredElevenLabsKey, setHasStoredElevenLabsKey] = useState(false);
    const [hasStoredAzureKey, setHasStoredAzureKey] = useState(false);
    const [hasStoredIbmWatsonKey, setHasStoredIbmWatsonKey] = useState(false);
    const [sttSonioxKey, setSttSonioxKey] = useState('');
    const [hasStoredSonioxKey, setHasStoredSonioxKey] = useState(false);
    const [isSttDropdownOpen, setIsSttDropdownOpen] = useState(false);
    const sttDropdownRef = React.useRef<HTMLDivElement>(null);
    const [transcriptTranslationEnabled, setTranscriptTranslationEnabled] = useState(false);
    const [transcriptTranslationProvider, setTranscriptTranslationProvider] = useState<string>('ollama');
    const [transcriptTranslationModel, setTranscriptTranslationModel] = useState('');
    const [translationLlmKeyStatus, setTranslationLlmKeyStatus] = useState({
        gemini: false,
        groq: false,
        openai: false,
        claude: false,
    });
    const [translationOpenAICompatFromSettings, setTranslationOpenAICompatFromSettings] = useState<
        Array<{ id: string; name: string; baseUrl: string; apiKey: string; preferredModel?: string }>
    >([]);
    const [transcriptTranslationPrompt, setTranscriptTranslationPrompt] = useState(DEFAULT_TRANSCRIPT_TRANSLATION_PROMPT);
    const [transcriptTranslationDisplayMode, setTranscriptTranslationDisplayMode] = useState<'original' | 'translated' | 'both'>('original');
    const [transcriptTranslationSourceLanguage, setTranscriptTranslationSourceLanguage] = useState('auto');
    const [transcriptTranslationTargetLanguage, setTranscriptTranslationTargetLanguage] = useState('chinese');
    const [translationSettingsSaved, setTranslationSettingsSaved] = useState(false);
    const [translationModelOptions, setTranslationModelOptions] = useState<{ id: string; label: string }[]>([]);
    const [translationModelsFetchLoading, setTranslationModelsFetchLoading] = useState(false);
    const [translationModelsFetchError, setTranslationModelsFetchError] = useState<string | null>(null);

    // Close STT dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sttDropdownRef.current && !sttDropdownRef.current.contains(event.target as Node)) {
                setIsSttDropdownOpen(false);
            }
        };
        if (isSttDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSttDropdownOpen]);

    // Load STT settings on mount
    useEffect(() => {
        const loadSttSettings = async () => {
            try {
                // @ts-ignore
                const creds = await window.electronAPI?.getStoredCredentials?.();
                if (creds) {
                    setSttProvider(creds.sttProvider || 'google');
                    if (creds.groqSttModel) setGroqSttModel(creds.groqSttModel);
                    setGoogleServiceAccountPath(creds.googleServiceAccountPath);
                    setHasStoredSttGroqKey(creds.hasSttGroqKey);
                    setHasStoredSttOpenaiKey(creds.hasSttOpenaiKey);
                    setHasStoredDeepgramKey(creds.hasDeepgramKey);
                    setHasStoredElevenLabsKey(creds.hasElevenLabsKey);
                    setHasStoredAzureKey(creds.hasAzureKey);
                    if (creds.azureRegion) setSttAzureRegion(creds.azureRegion);
                    setHasStoredIbmWatsonKey(creds.hasIbmWatsonKey);
                    setHasStoredSonioxKey(creds.hasSonioxKey || false);
                    setTranscriptTranslationEnabled(!!creds.transcriptTranslationEnabled);
                    setTranscriptTranslationProvider(creds.transcriptTranslationProvider || 'ollama');
                    setTranscriptTranslationModel(creds.transcriptTranslationModel || '');
                    if (typeof creds.transcriptTranslationPrompt === 'string' && creds.transcriptTranslationPrompt.length > 0) {
                        setTranscriptTranslationPrompt(creds.transcriptTranslationPrompt);
                    } else {
                        setTranscriptTranslationPrompt(DEFAULT_TRANSCRIPT_TRANSLATION_PROMPT);
                    }
                    setTranscriptTranslationDisplayMode(creds.transcriptTranslationDisplayMode || 'original');
                    setTranscriptTranslationSourceLanguage(
                        typeof creds.transcriptTranslationSourceLanguage === 'string'
                            ? creds.transcriptTranslationSourceLanguage
                            : 'auto'
                    );
                    setTranscriptTranslationTargetLanguage(
                        typeof creds.transcriptTranslationTargetLanguage === 'string'
                            ? creds.transcriptTranslationTargetLanguage
                            : 'chinese'
                    );
                    setTranslationLlmKeyStatus({
                        gemini: !!creds.hasGeminiKey,
                        groq: !!creds.hasGroqKey,
                        openai: !!creds.hasOpenaiKey,
                        claude: !!creds.hasClaudeKey,
                    });
                }
                const oaiList = await window.electronAPI?.getOpenAICompatibleProviders?.();
                if (oaiList) {
                    setTranslationOpenAICompatFromSettings(oaiList);
                }
                const assemblerProfile = await window.electronAPI?.getTranscriptAssemblerProfile?.();
                if (assemblerProfile) {
                    setTranscriptAssemblerProfile(assemblerProfile);
                }
            } catch (e) {
                console.error('Failed to load STT settings:', e);
            }
        };
        if (isOpen) loadSttSettings();
    }, [isOpen]);

    const translationProviderOptions = useMemo(() => {
        const o: { value: string; label: string }[] = [];
        o.push({ value: 'ollama', label: 'Ollama (local)' });
        if (translationLlmKeyStatus.gemini) o.push({ value: 'gemini', label: 'Gemini' });
        if (translationLlmKeyStatus.groq) o.push({ value: 'groq', label: 'Groq' });
        if (translationLlmKeyStatus.openai) o.push({ value: 'openai', label: 'OpenAI' });
        if (translationLlmKeyStatus.claude) o.push({ value: 'claude', label: 'Claude' });
        translationOpenAICompatFromSettings.forEach((p) =>
            o.push({ value: p.id, label: `${p.name} (OpenAI-compatible)` })
        );
        return o;
    }, [translationLlmKeyStatus, translationOpenAICompatFromSettings]);

    useEffect(() => {
        if (translationProviderOptions.length === 0) return;
        if (!translationProviderOptions.some((x) => x.value === transcriptTranslationProvider)) {
            setTranscriptTranslationProvider(translationProviderOptions[0].value);
        }
    }, [translationProviderOptions, transcriptTranslationProvider]);

    useEffect(() => {
        const api = window.electronAPI;
        if (!api?.onOpenAICompatibleProvidersChanged) return undefined;
        const unsub = api.onOpenAICompatibleProvidersChanged(async () => {
            try {
                const list = await api.getOpenAICompatibleProviders?.();
                if (list) {
                    setTranslationOpenAICompatFromSettings(list);
                }
                const creds = await api.getStoredCredentials?.();
                if (creds) {
                    setTranslationLlmKeyStatus({
                        gemini: !!creds.hasGeminiKey,
                        groq: !!creds.hasGroqKey,
                        openai: !!creds.hasOpenaiKey,
                        claude: !!creds.hasClaudeKey,
                    });
                }
            } catch {
                // ignore
            }
        });
        return () => unsub();
    }, []);

    const handleSttProviderChange = async (provider: 'google' | 'groq' | 'openai' | 'deepgram' | 'elevenlabs' | 'azure' | 'ibmwatson' | 'soniox') => {
        setSttProvider(provider);
        setIsSttDropdownOpen(false);
        setSttTestStatus('idle');
        setSttTestError('');
        try {
            // @ts-ignore
            await window.electronAPI?.setSttProvider?.(provider);
        } catch (e) {
            console.error('Failed to set STT provider:', e);
        }
        // If switching to a provider that doesn't support multi-language detection
        // and the current STT language is "auto", fall back to a sensible default.
        if (STT_PROVIDERS_WITHOUT_AUTO.has(provider) && recognitionLanguage === 'auto') {
            await handleLanguageChange('english-us');
        }
    };

    const handleTranscriptAssemblerProfileChange = async (profile: TranscriptAssemblerProfile) => {
        const previousProfile = transcriptAssemblerProfile;
        setTranscriptAssemblerProfile(profile);
        try {
            const result = await window.electronAPI?.setTranscriptAssemblerProfile?.(profile);
            if (result && !result.success) {
                setTranscriptAssemblerProfile(previousProfile);
            }
        } catch (e) {
            console.error('Failed to set transcript segmentation profile:', e);
            setTranscriptAssemblerProfile(previousProfile);
        }
    };

    const handleSttKeySubmit = async (provider: 'groq' | 'openai' | 'deepgram' | 'elevenlabs' | 'azure' | 'ibmwatson' | 'soniox', key: string) => {
        if (!key.trim()) return;

        // Auto-test before saving
        setSttSaving(true);
        setSttTestStatus('testing');
        setSttTestError('');

        try {
            // @ts-ignore
            const testResult = await window.electronAPI?.testSttConnection?.(
                provider,
                key.trim(),
                provider === 'azure' ? sttAzureRegion : undefined
            );

            if (!testResult?.success) {
                setSttTestStatus('error');
                setSttTestError(testResult?.error || 'Validation failed. Key not saved.');
                setSttSaving(false);
                return; // Stop save
            }

            // If success, proceed to save
            setSttTestStatus('success');
            setTimeout(() => setSttTestStatus('idle'), 3000);

            if (provider === 'groq') {
                // @ts-ignore
                await window.electronAPI?.setGroqSttApiKey?.(key.trim());
            } else if (provider === 'openai') {
                // @ts-ignore
                await window.electronAPI?.setOpenAiSttApiKey?.(key.trim());
            } else if (provider === 'elevenlabs') {
                // @ts-ignore
                await window.electronAPI?.setElevenLabsApiKey?.(key.trim());
            } else if (provider === 'azure') {
                // @ts-ignore
                await window.electronAPI?.setAzureApiKey?.(key.trim());
            } else if (provider === 'ibmwatson') {
                // @ts-ignore
                await window.electronAPI?.setIbmWatsonApiKey?.(key.trim());
            } else if (provider === 'soniox') {
                // @ts-ignore
                await window.electronAPI?.setSonioxApiKey?.(key.trim());
            } else {
                // @ts-ignore
                await window.electronAPI?.setDeepgramApiKey?.(key.trim());
            }
            if (provider === 'groq') setHasStoredSttGroqKey(true);
            else if (provider === 'openai') setHasStoredSttOpenaiKey(true);
            else if (provider === 'elevenlabs') setHasStoredElevenLabsKey(true);
            else if (provider === 'azure') setHasStoredAzureKey(true);
            else if (provider === 'ibmwatson') setHasStoredIbmWatsonKey(true);
            else if (provider === 'soniox') setHasStoredSonioxKey(true);
            else setHasStoredDeepgramKey(true);

            setSttSaved(true);
            setTimeout(() => setSttSaved(false), 2000);
        } catch (e: any) {
            console.error(`Failed to save ${provider} STT key:`, e);
            setSttTestStatus('error');
            setSttTestError(e.message || 'Validation failed');
        } finally {
            setSttSaving(false);
        }
    };

    const handleRemoveSttKey = async (provider: 'groq' | 'openai' | 'deepgram' | 'elevenlabs' | 'azure' | 'ibmwatson' | 'soniox') => {
        if (!confirm(`Are you sure you want to remove the ${provider === 'ibmwatson' ? 'IBM Watson' : provider.charAt(0).toUpperCase() + provider.slice(1)} API key?`)) return;

        try {
            if (provider === 'groq') {
                // @ts-ignore
                await window.electronAPI?.setGroqSttApiKey?.('');
                setSttGroqKey('');
                setHasStoredSttGroqKey(false);
            } else if (provider === 'openai') {
                // @ts-ignore
                await window.electronAPI?.setOpenAiSttApiKey?.('');
                setSttOpenaiKey('');
                setHasStoredSttOpenaiKey(false);
            } else if (provider === 'elevenlabs') {
                // @ts-ignore
                await window.electronAPI?.setElevenLabsApiKey?.('');
                setSttElevenLabsKey('');
                setHasStoredElevenLabsKey(false);
            } else if (provider === 'azure') {
                // @ts-ignore
                await window.electronAPI?.setAzureApiKey?.('');
                setSttAzureKey('');
                setHasStoredAzureKey(false);
            } else if (provider === 'ibmwatson') {
                // @ts-ignore
                await window.electronAPI?.setIbmWatsonApiKey?.('');
                setSttIbmKey('');
                setHasStoredIbmWatsonKey(false);
            } else if (provider === 'soniox') {
                // @ts-ignore
                await window.electronAPI?.setSonioxApiKey?.('');
                setSttSonioxKey('');
                setHasStoredSonioxKey(false);
            } else {
                // @ts-ignore
                await window.electronAPI?.setDeepgramApiKey?.('');
                setSttDeepgramKey('');
                setHasStoredDeepgramKey(false);
            }
        } catch (e) {
            console.error(`Failed to remove ${provider} STT key:`, e);
        }
    };


    const handleTestSttConnection = async () => {
        if (sttProvider === 'google') return;
        const keyMap: Record<string, string> = {
            groq: sttGroqKey, openai: sttOpenaiKey, deepgram: sttDeepgramKey,
            elevenlabs: sttElevenLabsKey, azure: sttAzureKey, ibmwatson: sttIbmKey,
            soniox: sttSonioxKey,
        };
        const hasStoredMap: Record<string, boolean> = {
            groq: hasStoredSttGroqKey, openai: hasStoredSttOpenaiKey, deepgram: hasStoredDeepgramKey,
            elevenlabs: hasStoredElevenLabsKey, azure: hasStoredAzureKey, ibmwatson: hasStoredIbmWatsonKey,
            soniox: hasStoredSonioxKey,
        };
        const keyToTest = keyMap[sttProvider] || '';
        // Allow test with empty local key if a stored key exists (backend will use it)
        if (!keyToTest.trim() && !hasStoredMap[sttProvider]) {
            setSttTestStatus('error');
            setSttTestError('Please enter an API key first');
            return;
        }

        setSttTestStatus('testing');
        setSttTestError('');
        try {
            // @ts-ignore
            const result = await window.electronAPI?.testSttConnection?.(
                sttProvider,
                keyToTest.trim(),
                sttProvider === 'azure' ? sttAzureRegion : undefined
            );
            if (result?.success) {
                setSttTestStatus('success');
                setTimeout(() => setSttTestStatus('idle'), 3000);
            } else {
                setSttTestStatus('error');
                setSttTestError(result?.error || 'Connection failed');
            }
        } catch (e: any) {
            setSttTestStatus('error');
            setSttTestError(e.message || 'Test failed');
        }
    };

    useEffect(() => {
        setTranslationModelOptions([]);
        setTranslationModelsFetchError(null);
    }, [transcriptTranslationProvider]);

    const handleFetchTranslationModels = async () => {
        setTranslationModelsFetchLoading(true);
        setTranslationModelsFetchError(null);
        try {
            if (transcriptTranslationProvider === 'ollama') {
                const list = (await window.electronAPI.getAvailableOllamaModels()) ?? [];
                const opts = list.map((id) => ({ id, label: id }));
                setTranslationModelOptions(opts);
                if (opts.length === 0) {
                    setTranslationModelsFetchError('No local Ollama models found. Pull a model or start Ollama.');
                } else if (!transcriptTranslationModel.trim()) {
                    setTranscriptTranslationModel(opts[0].id);
                }
            } else if (
                transcriptTranslationProvider === 'gemini' ||
                transcriptTranslationProvider === 'groq' ||
                transcriptTranslationProvider === 'openai' ||
                transcriptTranslationProvider === 'claude'
            ) {
                const p = transcriptTranslationProvider as 'gemini' | 'groq' | 'openai' | 'claude';
                const result = await window.electronAPI.fetchProviderModels(p, '');
                if (result?.success && result.models && result.models.length > 0) {
                    setTranslationModelOptions(result.models);
                    if (!transcriptTranslationModel.trim()) {
                        setTranscriptTranslationModel(result.models[0].id);
                    }
                } else if (result?.success && (!result.models || result.models.length === 0)) {
                    setTranslationModelsFetchError('No models returned.');
                } else {
                    setTranslationModelsFetchError(result?.error || 'Failed to fetch models');
                }
            } else {
                const ep = translationOpenAICompatFromSettings.find((x) => x.id === transcriptTranslationProvider);
                if (!ep) {
                    setTranslationModelsFetchError('This endpoint is not in AI Providers. Add it under AI Providers, then reopen settings.');
                    return;
                }
                const result = await window.electronAPI.fetchOpenAICompatibleModels(ep.baseUrl, ep.apiKey);
                if (result?.success && result.models && result.models.length > 0) {
                    setTranslationModelOptions(result.models);
                    if (!transcriptTranslationModel.trim()) {
                        setTranscriptTranslationModel(result.models[0].id);
                    }
                } else if (result?.success && (!result.models || result.models.length === 0)) {
                    setTranslationModelsFetchError('No models returned.');
                } else {
                    setTranslationModelsFetchError(result?.error || 'Failed to fetch models');
                }
            }
        } catch (e: unknown) {
            setTranslationModelsFetchError(e instanceof Error ? e.message : 'Failed to fetch models');
        } finally {
            setTranslationModelsFetchLoading(false);
        }
    };

    const handleSaveTranscriptTranslationSettings = async () => {
        try {
            await window.electronAPI?.setTranscriptTranslationSettings?.({
                enabled: transcriptTranslationEnabled,
                provider: transcriptTranslationProvider,
                model: transcriptTranslationModel,
                prompt: transcriptTranslationPrompt,
                displayMode: transcriptTranslationDisplayMode,
                sourceLanguage: transcriptTranslationSourceLanguage,
                targetLanguage: transcriptTranslationTargetLanguage,
            });
            setTranslationSettingsSaved(true);
            setTimeout(() => setTranslationSettingsSaved(false), 2000);
        } catch (e) {
            console.error('Failed to save transcript translation settings:', e);
        }
    };

    const handleResetTranscriptTranslationPrompt = () => {
        setTranscriptTranslationPrompt(DEFAULT_TRANSCRIPT_TRANSLATION_PROMPT);
    };


    // Load stored credentials on mount




    useEffect(() => {
        if (isOpen) {
            // Load detectable status
            if (window.electronAPI?.getUndetectable) {
                window.electronAPI.getUndetectable().then(setIsUndetectable);
            }
            if (window.electronAPI?.getOpenAtLogin) {
                window.electronAPI.getOpenAtLogin().then(setOpenOnLogin);
            }
            if (window.electronAPI?.getThemeMode) {
                window.electronAPI.getThemeMode().then(({ mode }) => setThemeMode(mode));
            }

            // Load settings
            const loadDevices = async () => {
                try {
                    const [inputs, outputs] = await Promise.all([
                        // @ts-ignore
                        window.electronAPI?.getInputDevices() || Promise.resolve([]),
                        // @ts-ignore
                        window.electronAPI?.getOutputDevices() || Promise.resolve([])
                    ]);

                    // Map to shape compatible with CustomSelect (which expects MediaDeviceInfo-like objects)
                    const formatDevices = (devs: any[]) => devs.map(d => ({
                        deviceId: d.id,
                        label: d.name,
                        kind: 'audioinput' as MediaDeviceKind,
                        groupId: '',
                        toJSON: () => d
                    }));

                    setInputDevices(formatDevices(inputs));
                    setOutputDevices(formatDevices(outputs));

                    // Load saved preferences
                    const savedInput = localStorage.getItem('preferredInputDeviceId');
                    const savedOutput = localStorage.getItem('preferredOutputDeviceId');

                    if (savedInput && inputs.find((d: any) => d.id === savedInput)) {
                        setSelectedInput(savedInput);
                    } else if (inputs.length > 0 && !selectedInput) {
                        setSelectedInput(inputs[0].id);
                    }

                    if (savedOutput && outputs.find((d: any) => d.id === savedOutput)) {
                        setSelectedOutput(savedOutput);
                    } else if (outputs.length > 0 && !selectedOutput) {
                        setSelectedOutput(outputs[0].id);
                    }
                } catch (e) {
                    console.error("Error loading native devices:", e);
                }
            };
            loadDevices();

            // Load Experimental SCK pref
            const savedSck = localStorage.getItem('useExperimentalSckBackend') === 'true';
            setUseExperimentalSck(savedSck);

        }
    }, [isOpen, selectedInput, selectedOutput]); // Re-run if isOpen changes, or if selected devices are cleared

    useEffect(() => {
        if (!isOpen || activeTab !== 'audio' || !isMicTesting) return;
        let cancelled = false;
        setMicTestError('');
        const unsubscribe = window.electronAPI.onAudioTestLevel(level => {
            if (!cancelled) setMicLevel(Math.max(0, Math.min(100, level * 100)));
        });
        const removeError = window.electronAPI.onAudioTestError(message => {
            if (!cancelled) { setMicTestError(message); setIsMicTesting(false); }
        });
        window.electronAPI.startAudioTest(selectedInput || undefined).then(result => {
            if (!cancelled) setInputDeviceNotFound(Boolean(result.warning));
        }).catch(error => {
            if (!cancelled) { setMicTestError(String(error)); setIsMicTesting(false); }
        });
        return () => {
            cancelled = true; unsubscribe?.(); removeError?.(); setMicLevel(0);
            void window.electronAPI.stopAudioTest().catch(console.error);
        };
    }, [isOpen, activeTab, selectedInput, isMicTesting]);

    useEffect(() => { if (!isOpen || activeTab !== 'audio') setIsMicTesting(false); }, [isOpen, activeTab]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    id="settings-backdrop"
                    className={`fixed inset-0 z-50 flex items-center justify-center p-8 transition-colors duration-150 ${embedded ? `embedded-settings ${materialsOnly ? 'materials-only' : ''}` : 'bg-black/60 backdrop-blur-sm'}`}
                >
                    <motion.div
                        id="settings-panel-wrapper"
                        initial={{ scale: 0.94, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.94, opacity: 0, y: 20 }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 32,
                            mass: 1
                        }}
                        className="bg-bg-elevated w-full max-w-4xl h-[80vh] rounded-2xl border border-border-subtle shadow-2xl overflow-hidden relative"
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label={t("Close settings")}
                            className="absolute top-4 right-4 z-10 p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-item-active/60 transition-colors"
                            style={{ visibility: embedded ? 'hidden' : 'visible' }}
                        >
                            <X size={16} strokeWidth={2.25} />
                        </button>
                        <div
                            id="settings-panel"
                            className="settings-layout flex w-full h-full flex-col"
                        >
                        {!materialsOnly && <div className="settings-tabs-bar">
                          <nav role="tablist" aria-label={t("Настройки")}>
                            {[
                              {id:'general',label:'Общие',Icon:Monitor},
                              {id:'ai-providers',label:'Модели',Icon:FlaskConical},
                              {id:'audio',label:'Звук',Icon:Mic},
                              {id:'keybinds',label:'Клавиши',Icon:Keyboard},
                              {id:'profile',label:'Материалы',Icon:BookOpen},
                              {id:'about',label:'О приложении',Icon:Info},
                            ].map(({id,label,Icon}) => <button key={id} id={`settings-tab-${id}`} type="button" role="tab" aria-selected={activeTab===id} aria-controls="settings-content" onClick={() => setActiveTab(id)}><Icon size={15}/>{t(label)}</button>)}
                          </nav>
                        </div>}

                        {/* Content */}
                        <div id="settings-content" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} className="settings-content flex-1 min-h-0 overflow-y-auto bg-bg-main p-8">
                            {activeTab === 'general' && (
                                <div className="space-y-6 animated fadeIn">
                                    <AppearanceSettings themeMode={themeMode} onThemeChange={handleSetTheme} />
                                    <div className="space-y-3.5">
                                        <div>
                                            <h3 className="text-lg font-bold text-text-primary mb-1">{t("Поведение приложения")}</h3>


                                            {/* System Permissions Status */}
                                            {permissionStatus && (
                                                <div className={`${isLight ? 'bg-bg-card' : 'bg-bg-item-surface'} rounded-xl p-4 border border-border-subtle mb-3`}>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Shield size={16} className="text-text-secondary" />
                                                        <h4 className="text-sm font-bold text-text-primary">{t("System Permissions")}</h4>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {([
                                                            { key: 'microphone' as const, label: 'Microphone', icon: <Mic size={15} /> },
                                                            { key: 'screen' as const, label: 'Screen Recording', icon: <Monitor size={15} /> },
                                                        ]).map(({ key, label, icon }) => {
                                                            const granted = permissionStatus[key] === 'granted';
                                                            return (
                                                                <div key={key} className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <span className="text-text-tertiary">{icon}</span>
                                                                        <span className="text-xs text-text-primary">{t(label)}</span>
                                                                    </div>
                                                                    {granted ? (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Check size={13} className="text-state-success" />
                                                                            <span className="text-xs text-state-success">{t("Granted")}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => window.electronAPI?.openPrivacySettings(key)}
                                                                            className="flex items-center gap-1.5 text-xs text-state-warning hover:text-amber-300 transition-colors"
                                                                        >
                                                                            <AlertCircle size={13} />
                                                                            <span>{t("Not granted")}</span>
                                                                            <ExternalLink size={11} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div className={`rounded-xl border ${isLight ? 'bg-bg-card border-border-subtle divide-y divide-border-subtle' : 'bg-transparent border-transparent divide-y divide-border-subtle/20'}`}>
                                            <div className="space-y-0">
                                                <SystemProxySettings />
                                                <div className="settings-behavior-row flex items-center justify-between px-4 py-3 gap-4">
                                                  <div className="flex items-center gap-4 min-w-0"><div className="w-10 h-10 shrink-0 bg-bg-item-surface rounded-lg border border-border-subtle flex items-center justify-center text-text-tertiary"><PointerOff size={20}/></div><div><h3 className="text-sm font-bold text-text-primary">{t("Mouse Passthrough")}</h3><p className="text-xs text-text-secondary mt-0.5">{t("Overlay stays visible but lets all mouse clicks pass through to the app beneath.")}</p></div></div>
                                                  <button type="button" role="switch" aria-label={t("Mouse Passthrough")} aria-checked={isMousePassthrough} className={`settings-switch shrink-0 w-11 h-6 rounded-full relative transition-colors ${isMousePassthrough ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`} onClick={() => {const next=!isMousePassthrough;setIsMousePassthrough(next);window.electronAPI.setOverlayMousePassthrough(next);}}><span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isMousePassthrough ? 'translate-x-5' : ''}`}/></button>
                                                </div>
                                                {/* Open at Login */}
                                                <div className="flex items-center justify-between px-4 py-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-bg-item-surface rounded-lg border border-border-subtle flex items-center justify-center text-text-tertiary">
                                                            <Power size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">{t("Open Pika when you log in")}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">{t("Pika will open automatically when you log in to your computer")}</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !openOnLogin;
                                                            setOpenOnLogin(newState);
                                                            window.electronAPI?.setOpenAtLogin(newState);
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative transition-colors ${openOnLogin ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${openOnLogin ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>

                                                {/* Debug Logging */}
                                                <div className="flex items-center justify-between px-4 py-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 bg-bg-item-surface rounded-lg border flex items-center justify-center transition-colors border-border-subtle text-text-tertiary`}>
                                                            <Terminal size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">{t("Verbose debug logging")}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">{t("Print detailed audio, STT, and pipeline diagnostics to the terminal")}</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !verboseLogging;
                                                            setVerboseLogging(newState);
                                                            window.electronAPI?.setVerboseLogging?.(newState);
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative transition-colors ${verboseLogging ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${verboseLogging ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>

                                                {/* Interviewer Transcript */}
                                                <div className="flex items-center justify-between px-4 py-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-bg-item-surface rounded-lg border border-border-subtle flex items-center justify-center text-text-tertiary">
                                                            <MessageSquare size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">{t("Interviewer Transcript")}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">{t("Show real-time transcription of the interviewer")}</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !showTranscript;
                                                            setShowTranscript(newState);
                                                            localStorage.setItem('pika_interviewer_transcript', String(newState));
                                                            window.dispatchEvent(new Event('storage'));
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative transition-colors ${showTranscript ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${showTranscript ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>


                                                {/* AI Response Language */}
                                                <div className="flex items-center justify-between px-4 py-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-bg-item-surface rounded-lg border border-border-subtle flex items-center justify-center text-text-tertiary">
                                                            <Globe size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-text-primary">{t("AI Response Language")}</h3>
                                                            <p className="text-xs text-text-secondary mt-0.5">{t("Language for AI suggestions and notes")}</p>
                                                        </div>
                                                    </div>

                                                    <div className="relative" ref={aiLangDropdownRef}>
                                                        <button
                                                            onClick={() => setIsAiLangDropdownOpen(!isAiLangDropdownOpen)}
                                                            className="bg-bg-component hover:bg-bg-elevated border border-border-subtle text-text-primary pl-4 pr-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 min-w-[110px] justify-between"
                                                        >
                                                            <span className="capitalize text-ellipsis overflow-hidden whitespace-nowrap">
                                                                {aiResponseLanguage}
                                                            </span>
                                                            <ChevronDown size={12} className={`shrink-0 transition-transform ${isAiLangDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {/* Dropdown Menu */}
                                                        {isAiLangDropdownOpen && (
                                                            <div className="absolute right-0 top-full mt-1 min-w-full w-max bg-bg-elevated border border-border-subtle rounded-lg shadow-xl overflow-hidden z-20 p-1 animated fadeIn select-none max-h-60 overflow-y-auto custom-scrollbar">
                                                                {availableAiLanguages.map((option) => (
                                                                    <button
                                                                        key={option.code}
                                                                        onClick={() => {
                                                                            handleAiLanguageChange(option.code);
                                                                            setIsAiLangDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${aiResponseLanguage === option.code ? 'text-text-primary bg-bg-item-active/50' : 'text-text-secondary hover:bg-bg-input hover:text-text-primary'}`}
                                                                    >
                                                                        <span className="font-medium">{t(option.label)}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                            </div>
                                            </div>

                                        </div>
                                    </div>

                                    {/* Process Disguise */}
                                    {/* Process Disguise */}
                                    <div className={`${isLight ? 'bg-bg-card' : 'bg-bg-item-surface'} rounded-xl p-5 border border-border-subtle`}>
                                        <div className="flex flex-col gap-1 mb-3">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-text-primary">{t("Process Disguise")}</h3>
                                            </div>
                                            <p className="text-xs text-text-secondary">{t("Disguise Pika as another application to prevent detection during screen sharing.")}<span className="block mt-1 text-text-tertiary">{t("Select a disguise to be automatically applied when Undetectable mode is on.")}</span>
                                            </p>
                                        </div>

                                        <div className={`grid grid-cols-2 gap-3 ${isUndetectable ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {isUndetectable && (
                                                <p className="col-span-2 text-xs text-state-warning -mt-1 mb-1">{t("⚠️ Disable Undetectable mode first to change disguise.")}</p>
                                            )}
                                            {[
                                                { id: 'none', label: 'None (Default)', icon: <Layout size={14} /> },
                                                { id: 'terminal', label: 'Terminal', icon: <Terminal size={14} /> },
                                                { id: 'settings', label: 'System Settings', icon: <Settings size={14} /> },
                                                { id: 'activity', label: 'Activity Monitor', icon: <Activity size={14} /> }
                                            ].map((option) => (
                                                <button
                                                    key={option.id}
                                                    disabled={isUndetectable}
                                                    onClick={() => {
                                                        if (isUndetectable) return;
                                                        // @ts-ignore
                                                        setDisguiseMode(option.id);
                                                        // @ts-ignore
                                                        window.electronAPI?.setDisguise(option.id);
                                                        // Analytics
                                                        analytics.trackModeSelected(`disguise_${option.id}`);
                                                    }}
                                                    className={`p-3 rounded-lg border text-left flex items-center gap-3 transition-all ${disguiseMode === option.id
                                                        ? 'bg-accent-primary border-accent-primary text-white shadow-lg shadow-blue-500/20'
                                                        : 'bg-bg-input border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-subtle-hover'
                                                        } ${isUndetectable ? 'cursor-not-allowed' : ''}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${disguiseMode === option.id ? 'bg-white/20 text-white' : 'bg-bg-item-surface text-text-secondary'
                                                        }`}>
                                                        {option.icon}
                                                    </div>
                                                    <span className="text-xs font-medium">{t(option.label)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            )}
                            {activeTab === 'profile' && (
                                <div className="space-y-6 animated fadeIn">
                                    {/* Profile Header */}
                                    <div className="bg-bg-item-surface rounded-xl border border-border-subtle flex flex-col justify-between overflow-hidden">
                                        <div className="flex flex-col justify-between min-h-[160px]">

                                            {/* Header */}
                                            <div className="p-5 pb-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-bg-input border border-border-subtle flex items-center justify-center text-text-primary shadow-sm hover:scale-105 transition-transform duration-300">
                                                            <span className="font-bold text-sm tracking-tight">
                                                                {profileData?.identity?.name ? profileData.identity.name.charAt(0).toUpperCase() : 'U'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-bold text-text-primary tracking-tight">
                                                                {profileData?.identity?.name || 'Your Background'}
                                                            </h4>
                                                            <p className="text-xs text-text-secondary mt-0.5 tracking-wide">
                                                                {profileData?.identity?.email || 'Add your resume to personalize interview support around your experience.'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        {profileStatus.hasProfile && (
                                                            <button
                                                                onClick={async () => {
                                                                    if (!confirm('Are you sure you want to delete your resume? This will clear your profile data.')) return;
                                                                    try {
                                                                        await window.electronAPI?.profileDelete?.();
                                                                        queryClient.invalidateQueries(['profile']);
                                                                    } catch (e) { console.error('Failed to delete profile:', e); }
                                                                }}
                                                                className="text-[12px] font-medium text-text-tertiary hover:text-state-danger transition-colors px-3 py-1.5 rounded-full hover:bg-state-danger-soft"
                                                            >{t("Delete Profile")}</button>
                                                        )}

                                                        {/* High-fidelity Toggle */}
                                                        <div className={`flex items-center gap-2 bg-bg-input px-3 py-1.5 rounded-full border border-border-subtle ${!profileStatus.hasProfile ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                                            <span className="text-xs font-medium text-text-secondary">{t("Use your background in suggestions")}</span>
                                                            <div
                                                                onClick={() => {
                                                                    if (!profileStatus.hasProfile) return;
                                                                    toggleKnowledge.mutate(!knowledgeMode);
                                                                }}
                                                                className={`w-9 h-5 rounded-full relative transition-colors ${!profileStatus.hasProfile ? 'opacity-40 cursor-not-allowed bg-bg-toggle-switch' : knowledgeMode ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                            >
                                                                <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${knowledgeMode ? 'translate-x-4' : 'translate-x-0'}`} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Data Metrics & Extracted Skills */}
                                            <div className="p-5 pt-0 mt-auto">
                                                <div className="flex items-center justify-between bg-bg-input border border-border-subtle py-4 px-6 rounded-2xl shadow-sm">
                                                    <div className="flex flex-col items-center justify-center flex-1">
                                                        <span className="text-[20px] font-bold text-text-primary tracking-tight leading-none mb-1">{profileData?.experienceCount || 0}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-state-success shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                                            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest">{t("Experience")}</span>
                                                        </div>
                                                    </div>

                                                    <div className="h-8 w-px bg-border-subtle/60" />

                                                    <div className="flex flex-col items-center justify-center flex-1">
                                                        <span className="text-[20px] font-bold text-text-primary tracking-tight leading-none mb-1">{profileData?.projectCount || 0}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-state-info shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                                                            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest">{t("Projects")}</span>
                                                        </div>
                                                    </div>

                                                    <div className="h-8 w-px bg-border-subtle/60" />

                                                    <div className="flex flex-col items-center justify-center flex-1">
                                                        <span className="text-[20px] font-bold text-text-primary tracking-tight leading-none mb-1">{profileData?.nodeCount || 0}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                                                            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest">{t("Profile Summary")}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {profileData?.skills && profileData.skills.length > 0 && (
                                                    <div className="mt-5">
                                                        <div className="text-[10px] font-bold text-text-primary uppercase tracking-wide mb-2">{t("Core Skills")}</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {profileData.skills.slice(0, 15).map((skill: string, i: number) => (
                                                                <span key={i} className="text-[10px] font-medium text-text-secondary px-2 py-1 rounded-md border border-border-subtle bg-bg-input">
                                                                    {skill}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Upload Area */}
                                    <div className="mt-5">
                                        <div className={`bg-bg-item-surface rounded-xl border transition-all ${profileUploading ? 'border-accent-primary/50 ring-1 ring-accent-primary/20' : 'border-border-subtle'}`}>
                                            <div className="p-5 flex items-center justify-between">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-10 h-10 rounded-lg bg-bg-input border border-border-subtle flex items-center justify-center text-text-tertiary shrink-0">
                                                        {profileUploading ? <RefreshCw size={20} className="animate-spin text-accent-primary" /> : <Upload size={20} />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-bold text-text-primary mb-0.5 truncate pr-4">
                                                            {profileStatus.hasProfile ? t("Refresh Resume") : t("Add Resume")}
                                                        </h4>
                                                        {profileUploading ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-[4px] w-[100px] bg-bg-input rounded-full overflow-hidden">
                                                                    <div className="h-full bg-accent-primary rounded-full animate-pulse" style={{ width: '50%' }} />
                                                                </div>
                                                                <span className="text-[10px] text-text-secondary tracking-wide">{t("Reviewing your resume...")}</span>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-text-secondary truncate pr-4">{t("Add your resume to personalize prep, suggestions, and role alignment.")}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={async () => {
                                                        const fileResult = await window.electronAPI?.profileSelectFile?.();
                                                        if (fileResult?.filePath) {
                                                            uploadResume.mutate(fileResult.filePath);
                                                        }
                                                    }}
                                                    disabled={profileUploading}
                                                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 ${profileUploading ? 'bg-bg-input text-text-tertiary cursor-wait border border-border-subtle' : 'bg-text-primary text-bg-main hover:opacity-90 shadow-sm'}`}
                                                >
                                                    {profileUploading ? t("Uploading...") : t("Choose File")}
                                                </button>
                                            </div>

                                            {profileError && (
                                                <div className="px-5 pb-4">
                                                    <div className="px-3 py-2 bg-state-danger-soft border border-state-danger-border rounded-lg flex items-center gap-2 text-[11px] text-state-danger font-medium">
                                                        <X size={12} /> {profileError}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* JD List Manager */}
                                    <div className="mt-5">
                                        <JDListManager onSelectFile={() => window.electronAPI?.profileSelectFile?.()} />
                                    </div>

                                    <ProfileVisualizer profileData={profileData} />

                                </div>
                            )}
                            {activeTab === 'ai-providers' && (
                                <AIProvidersSettings />
                            )}
                            {activeTab === 'keybinds' && (
                                <div className="space-y-3 animated fadeIn select-text pb-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="max-w-2xl">
                                            <h3 className="text-lg font-bold text-text-primary mb-1">{t("Shortcuts")}</h3>
                                            <p className="text-xs text-text-secondary leading-relaxed">{t("Customize how you trigger Pika.")}</p>
                                        </div>
                                        <button
                                            onClick={resetShortcuts}
                                            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-border-subtle bg-bg-subtle/30 hover:bg-bg-subtle hover:border-state-success-border transition-all duration-200 text-xs font-medium text-text-secondary hover:text-state-success active:scale-95 mt-1 whitespace-nowrap"
                                        >
                                            <RotateCcw size={13} strokeWidth={2.5} />{t("Restore defaults")}</button>
                                    </div>

                                    <div className="bg-bg-card border border-border-subtle rounded-2xl p-4 md:p-5">
                                        {[
                                            { id: 'toggleVisibility', label: 'Show or hide Pika' },
                                            { id: 'whatToAnswer', label: 'What should I answer?' },
                                            { id: 'captureAndProcess', label: 'Capture screen and ask AI' },
                                            { id: 'processScreenshots', label: 'Process current screenshots' },
                                            { id: 'resetCancel', label: 'Reset or cancel' },
                                        ].map((item) => (
                                            <div key={item.id} className="flex items-center justify-between py-2 border-b border-border-subtle/50 last:border-b-0">
                                                <span className="text-sm text-text-secondary">{t(item.label)}</span>
                                                <KeyRecorder
                                                    currentKeys={shortcuts[item.id as keyof typeof shortcuts]}
                                                    onSave={(keys) => updateShortcut(item.id as any, keys)}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-bg-card border border-border-subtle rounded-2xl p-4 md:p-5">
                                        <button
                                            onClick={() => setShowMoreShortcuts(!showMoreShortcuts)}
                                            className="w-full flex items-center justify-between text-left text-sm text-text-secondary hover:text-text-primary transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                <ChevronRight size={15} className={`transition-transform ${showMoreShortcuts ? 'rotate-90' : ''}`} />{t("More shortcuts")}</span>
                                            <span className="px-2 py-0.5 rounded-full bg-bg-subtle text-[11px] text-text-tertiary font-medium">15</span>
                                        </button>

                                        {showMoreShortcuts && (
                                            <div className="mt-4">
                                                {[
                                                    {
                                                        title: 'AI actions',
                                                        items: [
                                                            { id: 'clarify', label: 'Clarify the question' },
                                                            { id: 'followUp', label: 'Generate a follow-up' },
                                                            { id: 'dynamicAction4', label: 'Recap or brainstorm' },
                                                            { id: 'answer', label: 'Answer or record' },
                                                            { id: 'codeHint', label: 'Get a code hint' },
                                                            { id: 'brainstorm', label: 'Brainstorm approaches' },
                                                            { id: 'scrollUp', label: 'Scroll up' },
                                                            { id: 'scrollDown', label: 'Scroll down' },
                                                        ],
                                                    },
                                                    {
                                                        title: 'Window',
                                                        items: [
                                                            { id: 'moveWindowUp', label: 'Move up' },
                                                            { id: 'moveWindowDown', label: 'Move down' },
                                                            { id: 'moveWindowLeft', label: 'Move left' },
                                                            { id: 'moveWindowRight', label: 'Move right' },
                                                        ],
                                                    },
                                                    {
                                                        title: 'Other',
                                                        items: [
                                                            { id: 'toggleMousePassthrough', label: 'Toggle mouse passthrough' },
                                                            { id: 'takeScreenshot', label: 'Full screenshot' },
                                                            { id: 'selectiveScreenshot', label: 'Selective screenshot' },
                                                        ],
                                                    },
                                                ].map((group) => (
                                                    <div key={group.title} className="border-t border-border-subtle pt-3 first:border-t-0 first:pt-0">
                                                        <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1 mt-3 first:mt-0">{group.title}</div>
                                                        {group.items.map((item) => (
                                                            <div key={item.id} className="flex items-center justify-between py-2 border-b border-border-subtle/50 last:border-b-0">
                                                                <span className="text-sm text-text-secondary">{t(item.label)}</span>
                                                                <KeyRecorder
                                                                    currentKeys={shortcuts[item.id as keyof typeof shortcuts]}
                                                                    onSave={(keys) => updateShortcut(item.id as any, keys)}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'audio' && (
                                <div className="space-y-6 animated fadeIn">
                                    {/* ── Speech Provider Section ── */}
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-1">{t("Speech Provider")}</h3>
                                        <p className="text-xs text-text-secondary mb-5">{t("Choose the engine that transcribes audio to text.")}</p>

                                        <div className="space-y-4">
                                            <div className="bg-bg-card rounded-xl border border-border-subtle p-4 space-y-3">
                                                <label className="text-xs font-medium text-text-secondary block">{t("Speech Provider")}</label>
                                                <div className="relative">
                                                    <ProviderSelect
                                                        value={sttProvider}
                                                        onChange={(val) => handleSttProviderChange(val as any)}
                                                        options={[
                                                            { id: 'google', label: 'Google Cloud', badge: googleServiceAccountPath ? 'Saved' : null, recommended: true, desc: 'gRPC streaming via Service Account', color: 'blue', icon: <Mic size={14} /> },
                                                            { id: 'groq', label: 'Groq Whisper', badge: hasStoredSttGroqKey ? 'Saved' : null, recommended: true, desc: 'Ultra-fast REST transcription', color: 'orange', icon: <Mic size={14} /> },
                                                            { id: 'openai', label: 'OpenAI Whisper', badge: hasStoredSttOpenaiKey ? 'Saved' : null, desc: 'OpenAI-compatible Whisper API', color: 'green', icon: <Mic size={14} /> },
                                                            { id: 'deepgram', label: 'Deepgram Nova-3', badge: hasStoredDeepgramKey ? 'Saved' : null, recommended: true, desc: 'High-accuracy REST transcription', color: 'purple', icon: <Mic size={14} /> },
                                                            { id: 'elevenlabs', label: 'ElevenLabs Scribe', badge: hasStoredElevenLabsKey ? 'Saved' : null, desc: 'Scribe v2 Realtime API', color: 'teal', icon: <Mic size={14} /> },
                                                            { id: 'azure', label: 'Azure Speech', badge: hasStoredAzureKey ? 'Saved' : null, desc: 'Microsoft Cognitive Services STT', color: 'cyan', icon: <Mic size={14} /> },
                                                            { id: 'ibmwatson', label: 'IBM Watson', badge: hasStoredIbmWatsonKey ? 'Saved' : null, desc: 'IBM Watson cloud STT service', color: 'indigo', icon: <Mic size={14} /> },
                                                            { id: 'soniox', label: 'Soniox', badge: hasStoredSonioxKey ? 'Saved' : null, recommended: true, desc: '60+ languages, multilingual, domain context', color: 'cyan', icon: <Mic size={14} /> },
                                                        ]}
                                                    />
                                                </div>
                                            </div>

                                            {/* Groq Model Selector */}
                                            {sttProvider === 'groq' && (
                                                <div className="bg-bg-card rounded-xl border border-border-subtle p-4">
                                                    <label className="text-xs font-medium text-text-secondary mb-2.5 block">{t("Whisper Model")}</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {[
                                                            { id: 'whisper-large-v3-turbo', label: 'V3 Turbo', desc: 'Fastest' },
                                                            { id: 'whisper-large-v3', label: 'V3', desc: 'Most Accurate' },
                                                        ].map((m) => (
                                                            <button
                                                                key={m.id}
                                                                type="button"
                                                                onClick={async () => {
                                                                    setGroqSttModel(m.id);
                                                                    try {
                                                                        await window.electronAPI.setGroqSttModel(m.id);
                                                                    } catch (e) {
                                                                        console.error('Failed to set Groq model:', e);
                                                                    }
                                                                }}
                                                                className={`rounded-lg px-3 py-2.5 text-left transition-all duration-200 ease-in-out active:scale-[0.98] ${groqSttModel === m.id
                                                                    ? 'bg-blue-600 text-white shadow-md'
                                                                    : 'bg-bg-input hover:bg-bg-elevated text-text-primary'
                                                                    }`}
                                                            >
                                                                <span className="text-sm font-medium block">{t(m.label)}</span>
                                                                <span className={`text-[11px] transition-colors ${groqSttModel === m.id ? 'text-white/70' : 'text-text-tertiary'
                                                                    }`}>{m.desc}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Google Cloud Service Account */}
                                            {sttProvider === 'google' && (
                                                <div className="bg-bg-card rounded-xl border border-border-subtle p-4">
                                                    <label className="text-xs font-medium text-text-secondary mb-2 block">{t("Service Account JSON")}</label>
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-secondary font-mono truncate">
                                                            {googleServiceAccountPath
                                                                ? <span className="text-text-primary">{googleServiceAccountPath.split('/').pop()}</span>
                                                                : <span className="text-text-tertiary italic">{t("No file selected")}</span>}
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                // @ts-ignore
                                                                const result = await window.electronAPI?.selectServiceAccount?.();
                                                                if (result?.success && result.path) {
                                                                    setGoogleServiceAccountPath(result.path);
                                                                }
                                                            }}
                                                            className="px-3 py-2 bg-bg-input hover:bg-bg-elevated border border-border-subtle rounded-lg text-xs font-medium text-text-primary transition-colors flex items-center gap-2"
                                                        >
                                                            <Upload size={14} />{t("Select File")}</button>
                                                    </div>
                                                    <p className="text-[10px] text-text-tertiary mt-2">{t("Required for Google Cloud Speech-to-Text.")}</p>
                                                </div>
                                            )}

                                            {/* API Key Input (non-Google providers) */}
                                            {sttProvider !== 'google' && (
                                                <div className="bg-bg-card rounded-xl border border-border-subtle p-4 space-y-3">
                                                    <label className="text-xs font-medium text-text-secondary block">
                                                        {sttProvider === 'groq' ? 'Groq' : sttProvider === 'openai' ? 'OpenAI STT' : sttProvider === 'elevenlabs' ? 'ElevenLabs' : sttProvider === 'azure' ? 'Azure' : sttProvider === 'ibmwatson' ? 'IBM Watson' : sttProvider === 'soniox' ? 'Soniox' : 'Deepgram'}{t("API Key")}</label>
                                                    {sttProvider === 'openai' && (
                                                        <p className="text-[10px] text-text-tertiary mb-1.5">{t("This key is separate from your main AI Provider key.")}</p>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="password"
                                                            value={
                                                                sttProvider === 'groq' ? sttGroqKey
                                                                    : sttProvider === 'openai' ? sttOpenaiKey
                                                                        : sttProvider === 'elevenlabs' ? sttElevenLabsKey
                                                                            : sttProvider === 'azure' ? sttAzureKey
                                                                                : sttProvider === 'ibmwatson' ? sttIbmKey
                                                                                    : sttProvider === 'soniox' ? sttSonioxKey
                                                                                        : sttDeepgramKey
                                                            }
                                                            onChange={(e) => {
                                                                if (sttProvider === 'groq') setSttGroqKey(e.target.value);
                                                                else if (sttProvider === 'openai') setSttOpenaiKey(e.target.value);
                                                                else if (sttProvider === 'elevenlabs') setSttElevenLabsKey(e.target.value);
                                                                else if (sttProvider === 'azure') setSttAzureKey(e.target.value);
                                                                else if (sttProvider === 'ibmwatson') setSttIbmKey(e.target.value);
                                                                else if (sttProvider === 'soniox') setSttSonioxKey(e.target.value);
                                                                else setSttDeepgramKey(e.target.value);
                                                            }}
                                                            placeholder={
                                                                sttProvider === 'groq'
                                                                    ? (hasStoredSttGroqKey ? '••••••••••••' : 'Enter Groq API key')
                                                                    : sttProvider === 'openai'
                                                                        ? (hasStoredSttOpenaiKey ? '••••••••••••' : 'Enter OpenAI STT API key')
                                                                        : sttProvider === 'elevenlabs'
                                                                            ? (hasStoredElevenLabsKey ? '••••••••••••' : 'Enter ElevenLabs API key')
                                                                            : sttProvider === 'azure'
                                                                                ? (hasStoredAzureKey ? '••••••••••••' : 'Enter Azure API key')
                                                                                : sttProvider === 'ibmwatson'
                                                                                    ? (hasStoredIbmWatsonKey ? '••••••••••••' : 'Enter IBM Watson API key')
                                                                                    : sttProvider === 'soniox'
                                                                                        ? (hasStoredSonioxKey ? '••••••••••••' : 'Enter Soniox API key')
                                                                                        : (hasStoredDeepgramKey ? '••••••••••••' : 'Enter Deepgram API key')
                                                            }
                                                            className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const keyMap: Record<string, string> = {
                                                                    groq: sttGroqKey, openai: sttOpenaiKey, deepgram: sttDeepgramKey,
                                                                    elevenlabs: sttElevenLabsKey, azure: sttAzureKey, ibmwatson: sttIbmKey,
                                                                };
                                                                handleSttKeySubmit(sttProvider as any, keyMap[sttProvider] || '');
                                                            }}
                                                            disabled={sttSaving || !(() => {
                                                                const keyMap: Record<string, string> = {
                                                                    groq: sttGroqKey, openai: sttOpenaiKey, deepgram: sttDeepgramKey,
                                                                    elevenlabs: sttElevenLabsKey, azure: sttAzureKey, ibmwatson: sttIbmKey,
                                                                    soniox: sttSonioxKey,
                                                                };
                                                                return (keyMap[sttProvider] || '').trim();
                                                            })()}
                                                            className={`px-5 py-2.5 rounded-lg text-xs font-medium transition-colors ${sttSaved
                                                                ? 'bg-state-success-soft text-state-success'
                                                                : 'bg-bg-input hover:bg-bg-input/80 border border-border-subtle text-text-primary disabled:opacity-50'
                                                                }`}
                                                        >
                                                            {sttSaving ? 'Saving...' : sttSaved ? t("Saved!") : t("Save")}
                                                        </button>
                                                        {(() => {
                                                            const hasKeyMap: Record<string, boolean> = {
                                                                groq: hasStoredSttGroqKey,
                                                                openai: hasStoredSttOpenaiKey,
                                                                deepgram: hasStoredDeepgramKey,
                                                                elevenlabs: hasStoredElevenLabsKey,
                                                                azure: hasStoredAzureKey,
                                                                ibmwatson: hasStoredIbmWatsonKey,
                                                                soniox: hasStoredSonioxKey,
                                                            };
                                                            return hasKeyMap[sttProvider] ? (
                                                                <button
                                                                    onClick={() => handleRemoveSttKey(sttProvider as any)}
                                                                    className="px-2.5 py-2.5 rounded-lg text-xs font-medium text-text-tertiary hover:text-state-danger hover:bg-state-danger-soft transition-all"
                                                                    title="Remove API Key"
                                                                >
                                                                    <Trash2 size={16} strokeWidth={1.5} />
                                                                </button>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    {/* Azure Region Input */}
                                                    {sttProvider === 'azure' && (
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-medium text-text-secondary block">{t("Region")}</label>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={sttAzureRegion}
                                                                    onChange={(e) => setSttAzureRegion(e.target.value)}
                                                                    placeholder="e.g. eastus"
                                                                    className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
                                                                />
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!sttAzureRegion.trim()) return;
                                                                        // @ts-ignore
                                                                        await window.electronAPI?.setAzureRegion?.(sttAzureRegion.trim());
                                                                        setSttSaved(true);
                                                                        setTimeout(() => setSttSaved(false), 2000);
                                                                    }}
                                                                    disabled={!sttAzureRegion.trim()}
                                                                    className="px-5 py-2.5 rounded-lg text-xs font-medium bg-bg-input hover:bg-bg-input/80 border border-border-subtle text-text-primary disabled:opacity-50 transition-colors"
                                                                >{t("Save")}</button>
                                                            </div>
                                                            <p className="text-[10px] text-text-tertiary">e.g. eastus, westeurope, westus2</p>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={handleTestSttConnection}
                                                            disabled={sttTestStatus === 'testing'}
                                                            className="text-xs bg-bg-input hover:bg-bg-elevated text-text-primary px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                                                        >
                                                            {sttTestStatus === 'testing' ? (
                                                                <><RefreshCw size={12} className="animate-spin" /> {t("Testing...")}</>
                                                            ) : sttTestStatus === 'success' ? (
                                                                <><Check size={12} className="text-state-success" /> {t("Connected")}</>
                                                            ) : (
                                                                <>{t("Test Connection")}</>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const urls: Record<string, string> = {
                                                                    groq: 'https://console.groq.com/keys',
                                                                    openai: 'https://platform.openai.com/api-keys',
                                                                    deepgram: 'https://console.deepgram.com',
                                                                    elevenlabs: 'https://elevenlabs.io/app/settings/api-keys',
                                                                    azure: 'https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeech',
                                                                    ibmwatson: 'https://cloud.ibm.com/catalog/services/speech-to-text'
                                                                };
                                                                if (urls[sttProvider]) {
                                                                    // @ts-ignore
                                                                    window.electronAPI?.openExternal(urls[sttProvider]);
                                                                }
                                                            }}
                                                            className="text-xs text-text-tertiary hover:text-text-primary flex items-center gap-1 transition-colors ml-1"
                                                            title="Get API Key"
                                                        >
                                                            <ExternalLink size={12} />
                                                        </button>
                                                        {sttTestStatus === 'error' && (
                                                            <span className="text-xs text-state-danger">{sttTestError}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Recognition Language Family */}
                                            <CustomSelect
                                                label="Language"
                                                icon={<Globe size={14} />}
                                                value={selectedSttGroup}
                                                options={(STT_PROVIDERS_WITHOUT_AUTO.has(sttProvider)
                                                    ? baseLanguageGroups
                                                    : ['Auto', ...baseLanguageGroups]
                                                ).map(g => ({
                                                    deviceId: g,
                                                    label: g === 'Auto' ? 'Auto (multi-language)' : g,
                                                    kind: 'audioinput' as MediaDeviceKind,
                                                    groupId: '',
                                                    toJSON: () => ({})
                                                }))}
                                                onChange={handleGroupChange}
                                                placeholder="Select Language"
                                            />

                                            {/* Variant/Accent Selector (Conditional) */}
                                            {currentGroupVariants.length > 1 && (
                                                <div className="mt-3 animated fadeIn">
                                                    <CustomSelect
                                                        label="Accent / Region"
                                                        icon={<MapPin size={14} />}
                                                        value={recognitionLanguage}
                                                        options={currentGroupVariants}
                                                        onChange={handleLanguageChange}
                                                        placeholder="Select Region"
                                                    />
                                                </div>
                                            )}

                                            <div className="flex gap-2 items-center mt-2 px-1">
                                                <Info size={14} className="text-text-secondary shrink-0" />
                                                <p className="text-xs text-text-secondary">
                                                    {selectedSttGroup === 'Auto'
                                                        ? 'Auto: detect language per segment for multilingual meetings. Not available on Azure / IBM Watson.'
                                                        : 'Select the primary language being spoken in the meeting. Choose Auto for multilingual meetings.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-1">{t("Transcript Segmentation")}</h3>
                                        <p className="text-xs text-text-secondary mb-5">{t("Choose how patiently Pika buffers final speech segments before translation.")}</p>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {TRANSCRIPT_ASSEMBLER_PROFILE_OPTIONS.map((option) => {
                                                const selected = transcriptAssemblerProfile === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => handleTranscriptAssemblerProfileChange(option.value)}
                                                        className={`rounded-xl border p-4 text-left transition-all duration-base ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary ${selected
                                                            ? 'bg-accent-primary/10 border-accent-primary text-text-primary shadow-sm'
                                                            : 'bg-bg-card border-border-subtle text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-3 mb-2">
                                                            <span className="text-sm font-semibold">{t(option.label)}</span>
                                                            {selected && <Check size={15} className="text-accent-primary" />}
                                                        </div>
                                                        <p className="text-xs leading-relaxed text-text-tertiary">{option.desc}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-1">{t("Transcript Translation")}</h3>
                                        <p className="text-xs text-text-secondary mb-5">{t("STT is realtime. Translation is applied asynchronously to final interviewer segments.")}</p>

                                        <div className="bg-bg-card rounded-xl border border-border-subtle p-4 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <label className="text-xs font-medium text-text-secondary block">{t("Enable Translation")}</label>
                                                    <p className="text-[10px] text-text-tertiary mt-1">{t("Requires independent provider and model configuration.")}</p>
                                                </div>
                                                <button
                                                    onClick={() => setTranscriptTranslationEnabled((v) => !v)}
                                                    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${transcriptTranslationEnabled ? 'bg-state-info' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                >
                                                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${transcriptTranslationEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                            </div>

                                            <p className="text-[10px] text-text-tertiary">{t("Uses the same API keys and OpenAI-compatible endpoints as AI Providers (nothing new to add here).")}</p>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-text-secondary block">{t("Translation provider")}</label>
                                                    <select
                                                        value={
                                                            translationProviderOptions.some((x) => x.value === transcriptTranslationProvider)
                                                                ? transcriptTranslationProvider
                                                                : translationProviderOptions[0]?.value ?? 'ollama'
                                                        }
                                                        onChange={(e) => setTranscriptTranslationProvider(e.target.value)}
                                                        className="w-full h-11 bg-bg-input border border-border-subtle rounded-lg px-3 text-sm text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                                                    >
                                                        {translationProviderOptions.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {t(opt.label)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-text-secondary block">{t("Display Mode")}</label>
                                                    <select
                                                        value={transcriptTranslationDisplayMode}
                                                        onChange={(e) => setTranscriptTranslationDisplayMode(e.target.value as any)}
                                                        className="w-full h-11 bg-bg-input border border-border-subtle rounded-lg px-3 text-sm text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                                                    >
                                                        <option value="original">{t("Original Only")}</option>
                                                        <option value="translated">{t("Translation Only")}</option>
                                                        <option value="both">{t("Original + Translation")}</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-text-secondary block">{t("Source language hint")}</label>
                                                    <select
                                                        value={transcriptTranslationSourceLanguage}
                                                        onChange={(e) => setTranscriptTranslationSourceLanguage(e.target.value)}
                                                        className="w-full h-11 bg-bg-input border border-border-subtle rounded-lg px-3 text-sm text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                                                    >
                                                        <option value="auto">{t("Auto-detect (recommended)")}</option>
                                                        {translationLanguageOptions.map((o) => (
                                                            <option key={o.value} value={o.value}>
                                                                {t(o.label)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p className="text-[10px] text-text-tertiary leading-snug">{t("Translation always targets the language below. Source is auto-detected; this hint only nudges the model on short or ambiguous segments.")}</p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-text-secondary block">{t("Target language")}</label>
                                                    <select
                                                        value={transcriptTranslationTargetLanguage}
                                                        onChange={(e) => setTranscriptTranslationTargetLanguage(e.target.value)}
                                                        className="w-full h-11 bg-bg-input border border-border-subtle rounded-lg px-3 text-sm text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                                                    >
                                                        {translationLanguageOptions.map((o) => (
                                                            <option key={o.value} value={o.value}>
                                                                {t(o.label)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <label className="text-xs font-medium text-text-secondary block">{t("Translation Model")}</label>
                                                    <button
                                                        type="button"
                                                        onClick={handleFetchTranslationModels}
                                                        disabled={translationModelsFetchLoading}
                                                        className="shrink-0 h-9 flex items-center gap-1.5 px-3 rounded-md text-xs font-medium border border-border-subtle bg-bg-input hover:bg-bg-elevated text-text-primary disabled:opacity-50 transition-colors"
                                                        title={
                                                            transcriptTranslationProvider === 'ollama'
                                                                ? 'List models from local Ollama'
                                                                : transcriptTranslationProvider === 'gemini' ||
                                                                    transcriptTranslationProvider === 'groq' ||
                                                                    transcriptTranslationProvider === 'openai' ||
                                                                    transcriptTranslationProvider === 'claude'
                                                                  ? 'Uses stored API keys from AI Providers'
                                                                  : 'Uses the selected OpenAI-compatible endpoint from AI Providers (URL + key)'
                                                        }
                                                    >
                                                        {translationModelsFetchLoading ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <RefreshCw size={12} />
                                                        )}{t("Fetch Models")}</button>
                                                </div>
                                                {translationModelsFetchError && (
                                                    <p className="text-[11px] text-state-danger">{translationModelsFetchError}</p>
                                                )}
                                                {translationModelOptions.length > 0 && (
                                                    <select
                                                        value={
                                                            translationModelOptions.some((o) => o.id === transcriptTranslationModel)
                                                                ? transcriptTranslationModel
                                                                : ''
                                                        }
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            if (v) setTranscriptTranslationModel(v);
                                                        }}
                                                        className="w-full h-11 bg-bg-input border border-border-subtle rounded-lg px-3 text-sm text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                                                    >
                                                        <option value="">{t("Quick pick from list")}</option>
                                                        {translationModelOptions.map((m) => (
                                                            <option key={m.id} value={m.id}>
                                                                {m.label || m.id}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                                <input
                                                    type="text"
                                                    value={transcriptTranslationModel}
                                                    onChange={(e) => setTranscriptTranslationModel(e.target.value)}
                                                    placeholder={
                                                        transcriptTranslationProvider === 'ollama'
                                                            ? 'e.g. qwen2.5:7b'
                                                            : transcriptTranslationProvider === 'gemini' ||
                                                                transcriptTranslationProvider === 'groq' ||
                                                                transcriptTranslationProvider === 'openai' ||
                                                                transcriptTranslationProvider === 'claude'
                                                              ? 'Provider model id'
                                                              : 'Model id (optional if endpoint has a preferred model)'
                                                    }
                                                    className="w-full h-11 bg-bg-input border border-border-subtle rounded-lg px-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
                                                />
                                                <p className="text-[10px] text-text-tertiary">
                                                    {transcriptTranslationProvider === 'ollama'
                                                        ? 'Ollama must be running. Cloud providers use keys from the AI Providers tab.'
                                                        : transcriptTranslationProvider === 'gemini' ||
                                                            transcriptTranslationProvider === 'groq' ||
                                                            transcriptTranslationProvider === 'openai' ||
                                                            transcriptTranslationProvider === 'claude'
                                                          ? 'Save API keys under AI Providers before fetching.'
                                                          : 'OpenAI-compatible endpoints are only listed here after you add them under AI Providers.'}
                                                </p>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-medium text-text-secondary block">{t("Translation Prompt")}</label>
                                                    <button
                                                        onClick={handleResetTranscriptTranslationPrompt}
                                                        className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors"
                                                    >{t("Reset to Default")}</button>
                                                </div>
                                                <textarea
                                                    value={transcriptTranslationPrompt}
                                                    onChange={(e) => setTranscriptTranslationPrompt(e.target.value)}
                                                    rows={4}
                                                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary transition-colors resize-y"
                                                />
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                <button
                                                    onClick={handleSaveTranscriptTranslationSettings}
                                                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${translationSettingsSaved ? 'bg-state-success-soft text-state-success' : 'bg-bg-input hover:bg-bg-input/80 border border-border-subtle text-text-primary'}`}
                                                >
                                                    {translationSettingsSaved ? t("Saved!") : t("Save Translation Settings")}
                                                </button>
                                                <p className="text-[10px] text-text-tertiary sm:pl-1">{t("Only interviewer final transcript segments are translated in phase 1.")}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-border-subtle" />

                                    {/* ── Audio Configuration Section ── */}
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary mb-1">{t("Audio Configuration")}</h3>
                                        <p className="text-xs text-text-secondary mb-5">{t("Manage input and output devices.")}</p>

                                        <div className="space-y-4">
                                            <CustomSelect
                                                label="Input Device"
                                                icon={<Mic size={16} />}
                                                value={selectedInput}
                                                options={inputDevices}
                                                onChange={(id) => {
                                                    setSelectedInput(id);
                                                    setInputDeviceNotFound(false);
                                                    localStorage.setItem('preferredInputDeviceId', id);
                                                }}
                                                placeholder="Default Microphone"
                                            />
                                            {inputDeviceNotFound && (
                                                <p className="text-xs text-state-warning mt-1 px-1">{t("Previously selected device not found. Using default microphone.")}</p>
                                            )}

                                            <div>
                                                <div className="flex justify-between text-xs text-text-secondary mb-2 px-1">
                                                    <span>{t("Input Level")}</span>
                                                    <button type="button" data-testid="microphone-test" onClick={() => setIsMicTesting(value => !value)} className="text-xs text-accent-primary">{t(isMicTesting ? 'Stop microphone test' : 'Test microphone')}</button>
                                                </div>
                                                <div className="h-1.5 bg-bg-input rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-state-success transition-all duration-100 ease-out"
                                                        style={{ width: `${micLevel}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {micTestError && <p role="alert" className="text-xs text-state-danger">{t(micTestError)}</p>}
                                            <div className="h-px bg-border-subtle my-2" />

                                            <CustomSelect
                                                label="Output Device"
                                                icon={<Speaker size={16} />}
                                                value={selectedOutput}
                                                options={outputDevices}
                                                onChange={(id) => {
                                                    setSelectedOutput(id);
                                                    localStorage.setItem('preferredOutputDeviceId', id);
                                                }}
                                                placeholder="Default Speakers"
                                            />

                                            <div className="flex justify-end">
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                                                            if (!AudioContext) {
                                                                console.error("Web Audio API not supported");
                                                                return;
                                                            }

                                                            const ctx = new AudioContext();

                                                            if (ctx.state === 'suspended') {
                                                                await ctx.resume();
                                                            }

                                                            const oscillator = ctx.createOscillator();
                                                            const gainNode = ctx.createGain();

                                                            oscillator.connect(gainNode);
                                                            gainNode.connect(ctx.destination);

                                                            oscillator.type = 'sine';
                                                            oscillator.frequency.setValueAtTime(523.25, ctx.currentTime);
                                                            gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
                                                            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);

                                                            if (selectedOutput && (ctx as any).setSinkId) {
                                                                try {
                                                                    await (ctx as any).setSinkId(selectedOutput);
                                                                } catch (e) {
                                                                    console.warn("Error setting sink for AudioContext", e);
                                                                }
                                                            }

                                                            oscillator.start();
                                                            oscillator.stop(ctx.currentTime + 1.0);
                                                        } catch (e) {
                                                            console.error("Error playing test sound", e);
                                                        }
                                                    }}
                                                    className="text-xs bg-bg-input hover:bg-bg-elevated text-text-primary px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
                                                >
                                                    <Speaker size={12} />{t("Test Sound")}</button>
                                            </div>

                                            <div className="h-px bg-border-subtle my-2" />

                                            {/* SCK Backend Toggle */}
                                            <div className="bg-state-warning-soft rounded-xl border border-state-warning-border p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 p-1.5 rounded-lg bg-state-warning-soft text-state-warning">
                                                            <FlaskConical size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <h3 className="text-sm font-bold text-text-primary">{t("SCK Backend")}</h3>
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-state-info-soft text-state-info uppercase tracking-wide">{t("Alternative")}</span>
                                                            </div>
                                                            <p className="text-xs text-text-secondary leading-relaxed max-w-[300px]">{t("Use the ScreenCaptureKit backend. An optimized alternative to CoreAudio if you experience any capture issues.")}</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            const newState = !useExperimentalSck;
                                                            setUseExperimentalSck(newState);
                                                            window.localStorage.setItem('useExperimentalSckBackend', newState ? 'true' : 'false');
                                                        }}
                                                        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${useExperimentalSck ? 'bg-state-warning' : 'bg-bg-toggle-switch border border-border-muted'}`}
                                                    >
                                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${useExperimentalSck ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}


                            {activeTab === 'about' && (
                                <AboutSection />
                            )}
                        </div>
                    </div>
                    </motion.div>
                </motion.div>
            )
            }
        </AnimatePresence >
    );
};

export default SettingsOverlay;
