import brandLogo from '../../assets/askcue-logo.svg';
import { t } from '../i18n';
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Briefcase, Calendar, CheckCircle, DownloadCloud, Link as LinkIcon, RefreshCw, Zap, History, BookOpen, Settings, MessageSquarePlus, AudioLines, Mic, FileText } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import MeetingDetails from './MeetingDetails';
import GlobalChatOverlay from './GlobalChatOverlay';
import SettingsOverlay from './SettingsOverlay';
import DetectableControl from './ui/DetectableControl';
import LauncherHeader from './launcher/LauncherHeader';
import MeetingHistorySection from './launcher/MeetingHistorySection';
import { generateMeetingPDF } from '../utils/pdfGenerator';
import { analytics } from '../lib/analytics/analytics.service';
import { useShortcuts } from '../hooks/useShortcuts';
import { useProfileData } from '../hooks/useProfileData';
export interface Meeting {
    id: string; title: string; date: string; duration: string; summary: string;
    detailedSummary?: { actionItems: string[]; keyPoints: string[] };
    transcript?: Array<{ speaker: string; text: string; timestamp: number }>;
    usage?: Array<{ type: 'assist' | 'followup' | 'chat' | 'followup_questions'; timestamp: number; question?: string; answer?: string; items?: string[] }>;
    participants?: unknown[]; participantCount?: number; active?: boolean; time?: string;
}
interface LauncherProps {
    onStartMeeting: () => void;
    onOpenSettings: (tab?: string) => void;
    onPageChange?: (isMain: boolean) => void;
    ollamaPullStatus?: 'idle' | 'downloading' | 'complete' | 'failed';
    ollamaPullPercent?: number;
    ollamaPullMessage?: string;
}
const Launcher: React.FC<LauncherProps> = ({
    onStartMeeting,
    onPageChange,
    ollamaPullStatus = 'idle',
    ollamaPullPercent = 0,
    ollamaPullMessage = '',
}) => {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [page, setPage] = useState<'session' | 'history' | 'materials' | 'settings'>('session');
    const [settingsTab, setSettingsTab] = useState('general');
    const onOpenSettings = (tab = 'general') => { setSettingsTab(tab); setPage(tab === 'profile' ? 'materials' : 'settings'); setSelectedMeeting(null); };
    const [isMeetingActive, setIsMeetingActive] = useState(false);
    const wasMeetingActive = useRef(false);
    useEffect(() => {
        if (wasMeetingActive.current && !isMeetingActive) { setPage('history'); setSelectedMeeting(null); }
        wasMeetingActive.current = isMeetingActive;
    }, [isMeetingActive]);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [isPrepared, setIsPrepared] = useState(false);
    const [preparedEvent, setPreparedEvent] = useState<any>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [menuEntered, setMenuEntered] = useState(false);
    const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
    const [submittedGlobalQuery, setSubmittedGlobalQuery] = useState('');
    const { isShortcutPressed } = useShortcuts();
    const { data: profileData } = useProfileData();

    const fetchMeetings = () => {
        window.electronAPI?.getRecentMeetings?.().then(setMeetings).catch(err => console.error('Failed to fetch meetings:', err));
    };
    const fetchEvents = () => {
        window.electronAPI?.getUpcomingEvents?.().then(setUpcomingEvents).catch(err => console.error('Failed to fetch events:', err));
    };
    const handleRefresh = async () => {
        setIsRefreshing(true);
        analytics.trackCommandExecuted('refresh_calendar');
        try {
            if (window.electronAPI?.calendarRefresh) {
                setShowNotification(true);
                await window.electronAPI.calendarRefresh();
                fetchEvents();
                fetchMeetings();
                setTimeout(() => setShowNotification(false), 3000);
            } else {
                console.warn('electronAPI.calendarRefresh not found');
            }
        } catch (e) {
            console.error('Refresh failed in handleRefresh:', e);
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };
    useEffect(() => {
        let mounted = true;
        console.log('Launcher mounted');

        fetchMeetings();
        fetchEvents();
        window.electronAPI?.getMeetingActive?.().then((active) => { if (mounted) setIsMeetingActive(active); }).catch(() => {});
        const removeMeetingStateListener = window.electronAPI?.onMeetingStateChanged?.(({ isActive }) => setIsMeetingActive(isActive));
        const removeMeetingsListener = window.electronAPI?.onMeetingsUpdated?.(() => {
            console.log('Received meetings-updated event');
            fetchMeetings();
        });
        const interval = setInterval(fetchEvents, 60000);
        return () => {
            mounted = false;
            removeMeetingsListener?.();
            removeMeetingStateListener?.();
            clearInterval(interval);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isShortcutPressed(e, 'toggleVisibility')) {
                e.preventDefault();
                window.electronAPI.toggleWindow();
            } else if (isShortcutPressed(e, 'moveWindowUp')) {
                e.preventDefault();
                window.electronAPI.moveWindowUp?.();
            } else if (isShortcutPressed(e, 'moveWindowDown')) {
                e.preventDefault();
                window.electronAPI.moveWindowDown?.();
            } else if (isShortcutPressed(e, 'moveWindowLeft')) {
                e.preventDefault();
                window.electronAPI.moveWindowLeft?.();
            } else if (isShortcutPressed(e, 'moveWindowRight')) {
                e.preventDefault();
                window.electronAPI.moveWindowRight?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isShortcutPressed]);
    useEffect(() => setMenuEntered(false), [activeMenuId]);
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);
    useEffect(() => {
        onPageChange?.(!selectedMeeting && !isGlobalChatOpen);
    }, [selectedMeeting, isGlobalChatOpen, onPageChange]);
    if (!window.electronAPI) {
        return <div className="p-10 text-white">{t("Error: Electron API not initialized. Check preload script.")}</div>;
    }
    const nextMeeting = upcomingEvents.find(e => {
        const diff = new Date(e.startTime).getTime() - Date.now();
        return diff > -5 * 60000 && diff < 60 * 60000;
    });
    const showUpcomingHero = Boolean((isPrepared && preparedEvent) || nextMeeting);
    const handleStartPreparedMeeting = async () => {
        if (!preparedEvent) return;
        analytics.trackCommandExecuted('start_prepared_meeting');
        try {
            await window.electronAPI.startMeeting({
                title: preparedEvent.title,
                calendarEventId: preparedEvent.id,
                source: 'calendar',
                audio: {
                    inputDeviceId: localStorage.getItem('preferredInputDeviceId'),
                    outputDeviceId: localStorage.getItem('preferredOutputDeviceId'),
                },
            });
            setIsPrepared(false);
            await window.electronAPI.setWindowMode('overlay', true);
        } catch (e) {
            console.error('Failed to start prepared meeting', e);
        }
    };
    const handleOpenMeeting = async (meeting: Meeting) => {
        setPage('history');
        console.log('[Launcher] Opening meeting:', meeting.id);
        analytics.trackCommandExecuted('open_meeting_details');
        try {
            const fullMeeting = await window.electronAPI?.getMeetingDetails?.(meeting.id);
            if (fullMeeting) {
                setSelectedMeeting(fullMeeting);
                return;
            }
        } catch (err) {
            console.error('[Launcher] Failed to fetch meeting details:', err);
        }
        setSelectedMeeting(meeting);
    };
    const handleExportMeeting = async (meeting: Meeting) => {
        setActiveMenuId(null);
        analytics.trackPdfExported();
        try {
            const fullMeeting = await window.electronAPI?.getMeetingDetails?.(meeting.id);
            generateMeetingPDF(fullMeeting || meeting);
        } catch (e) {
            console.error('Failed to fetch details for PDF', e);
            generateMeetingPDF(meeting);
        }
    };
    const handleDeleteMeeting = async (meeting: Meeting) => {
        const success = await window.electronAPI?.deleteMeeting?.(meeting.id);
        if (success) setMeetings(prev => prev.filter(item => item.id !== meeting.id));
        setActiveMenuId(null);
    };
    const handleBack = () => {
        setSelectedMeeting(null);
    };
    return (
        <div className="workbench text-text-primary">
          <div className="workbench-row">
            <aside className="workbench-sidebar paper-texture">
              <div className="workbench-brand"><img src={brandLogo} alt=""/><span>AskCue</span></div>
              <nav className="workbench-nav" aria-label={t("Разделы")}>
                <button title={t("Новый разговор")} aria-current={page === 'session' ? 'page' : undefined} onClick={() => { setPage('session'); setSelectedMeeting(null); }}><MessageSquarePlus size={18}/><span>{isMeetingActive ? t("Текущий разговор") : t("Новый разговор")}</span></button>
                <button title={t("История встреч")} aria-current={page === 'history' ? 'page' : undefined} onClick={() => { setPage('history'); setSelectedMeeting(null); }}><History size={18}/><span>{t("История встреч")}</span></button>
                <button title={t("Материалы")} aria-current={page === 'materials' ? 'page' : undefined} onClick={() => onOpenSettings('profile')}><BookOpen size={18}/><span>{t("Материалы")}</span></button>
                <button title={t("Настройки")} aria-current={page === 'settings' ? 'page' : undefined} onClick={() => onOpenSettings()}><Settings size={18}/><span>{t("Настройки")}</span></button>
              </nav>
              {isMeetingActive && <button className="paper-primary mt-auto text-xs" onClick={() => window.electronAPI.setWindowMode('overlay', true)}>{t("Вернуться к разговору")} <ArrowRight size={14}/></button>}
            </aside>
            <div className="workbench-body">
            <LauncherHeader
                meetings={meetings}
                title={selectedMeeting ? selectedMeeting.title : page === 'history' ? t("История встреч") : page === 'materials' ? t("Материалы") : page === 'settings' ? t("Настройки") : isMeetingActive ? t("Текущий разговор") : t("Новый разговор")}
                status={<DetectableControl />}
                onAIQuery={(query) => {
                    analytics.trackCommandExecuted('ai_query_search');
                    setSubmittedGlobalQuery(query);
                    setIsGlobalChatOpen(true);
                }}
                onOpenMeetingId={async (meetingId) => {
                    const meeting = meetings.find(m => m.id === meetingId);
                    if (meeting) await handleOpenMeeting(meeting);
                    else {
                        const details = await window.electronAPI.getMeetingDetails(meetingId);
                        if (details) { setPage('history'); setSelectedMeeting(details); }
                    }
                }}
            />
            <div className="relative flex flex-1 flex-col overflow-hidden">
                {(page === 'settings' || page === 'materials') ? <SettingsOverlay key={`${page}-${settingsTab}`} isOpen onClose={() => setPage('session')} initialTab={settingsTab} embedded materialsOnly={page === 'materials'} /> : <>

                <AnimatePresence mode="wait">
                    {selectedMeeting ? (
                        <motion.div key="details" className="flex-1 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                            <MeetingDetails meeting={selectedMeeting} onBack={handleBack} onOpenSettings={onOpenSettings} />
                        </motion.div>
                    ) : (
                        <motion.div key="launcher" className="flex flex-1 flex-col overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                            {page === 'session' && <main className="custom-scrollbar flex-1 overflow-y-auto">
                              <div className="prep-screen">
                                <div className="prep-kicker">{t("Подготовка к разговору")}</div>
                                <div className="prep-row"><FileText/><div><strong>{t("Профиль кандидата")}</strong><small>{profileData?.rawText || profileData?.identity?.name ? t("Резюме и опыт добавлены") : t("Добавьте резюме и опыт для персональных подсказок")}</small></div><button onClick={() => onOpenSettings('profile')}>{t("Открыть")}</button></div>
                                <div className="prep-row"><Briefcase/><div><strong>{profileData?.activeJD?.title || 'Вакансия'}</strong><small>{profileData?.activeJD?.company || 'Выберите вакансию в материалах'}</small></div><button onClick={() => onOpenSettings('profile')}>{t("Выбрать")}</button></div>
                                <div className="prep-row"><Mic/><div><strong>{t("Звук и распознавание")}</strong><small>{t("Микрофон, системный звук и сервис расшифровки")}</small></div><button onClick={() => onOpenSettings('audio')}>{t("Настроить")}</button></div>
                                <div className="flex items-center gap-4 mt-8 mb-8 flex-wrap">
                                  <button className="paper-primary" onClick={() => { if (isMeetingActive) void window.electronAPI.setWindowMode('overlay', true); else onStartMeeting(); }}>{isMeetingActive ? t("Вернуться к разговору") : t("Начать разговор")} <ArrowRight size={16}/></button>
                                  <button className="text-xs text-text-secondary p-2" onClick={() => onOpenSettings('ai-providers')}>{t("Модели и подключения")}</button>
                                </div>
                                {ollamaPullStatus !== 'idle' && <div className="text-xs text-text-secondary mb-4 flex items-center gap-2">{ollamaPullStatus === 'downloading' ? <DownloadCloud size={14}/> : ollamaPullStatus === 'complete' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>} {ollamaPullStatus === 'downloading' ? `Подготовка AI-памяти… ${ollamaPullPercent}%` : ollamaPullMessage}</div>}
                                    {showUpcomingHero && (
                                        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5 shadow-sm">
                                            {isPrepared && preparedEvent ? (
                                                <div className="flex items-center justify-between gap-4">
                                                    <div>
                                                        <span className="mb-2 inline-flex rounded-full border border-state-success/30 bg-state-success-soft px-3 py-1 text-xs font-bold text-state-success">{t("READY TO JOIN")}</span>
                                                        <h2 className="text-2xl font-bold text-text-primary">{preparedEvent.title}</h2>
                                                        <p className="mt-2 flex items-center gap-2 text-xs text-text-secondary"><Calendar size={12} />{new Date(preparedEvent.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(preparedEvent.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{preparedEvent.link && ' • Link Ready'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button type="button" onClick={handleStartPreparedMeeting} className="flex items-center gap-2 rounded-xl bg-state-success px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-95">{t("Start Meeting")} <ArrowRight size={16} /></button>
                                                        <button type="button" onClick={() => setIsPrepared(false)} className="rounded-xl px-4 py-3 text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary">{t("Cancel")}</button>
                                                    </div>
                                                </div>
                                            ) : nextMeeting ? (
                                                <div className="space-y-4">
                                                    <div>
                                                        <div className="mb-2 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-state-success" /><span className="text-xs font-bold uppercase tracking-wide text-state-success">{t("Up Next")}</span><span className="text-xs text-text-tertiary">{t("Starts in")} {Math.max(0, Math.ceil((new Date(nextMeeting.startTime).getTime() - Date.now()) / 60000))} {t("min")}</span></div>
                                                        <h2 className="line-clamp-2 text-xl font-bold text-text-primary">{nextMeeting.title}</h2>
                                                        <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary"><Calendar size={12} /><span>{new Date(nextMeeting.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(nextMeeting.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>{nextMeeting.link && <><span className="opacity-50">|</span><LinkIcon size={12} /><span>{t("Meeting Link Found")}</span></>}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3 border-t border-border-subtle pt-4">
                                                        <button type="button" onClick={() => { setPreparedEvent(nextMeeting); setIsPrepared(true); }} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border-muted bg-bg-item-surface px-4 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-bg-item-active"><Zap size={13} className="text-state-warning" />{t("Prepare")}</button>
                                                        <button type="button" onClick={onStartMeeting} className="rounded-lg px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-input hover:text-text-primary">{t("Start now")}</button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                              </div>
                            </main>}
                            {page === 'history' && <main className="custom-scrollbar flex-1 overflow-y-auto bg-bg-primary">
                                <div className="flex justify-end px-8 pt-4"><button onClick={handleRefresh} disabled={isRefreshing} className="text-xs text-text-secondary flex gap-2 items-center"><RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''}/>{t("Обновить")}</button></div>
                                <section className="min-h-full px-8 py-8">
                                    <MeetingHistorySection meetings={meetings} onOpenMeeting={handleOpenMeeting} onExportMeeting={handleExportMeeting} onDeleteMeeting={handleDeleteMeeting} activeMenuId={activeMenuId} onMenuToggle={setActiveMenuId} menuEntered={menuEntered} onMenuEnteredChange={setMenuEntered} />
                                </section>
                            </main>}
                        </motion.div>
                    )}
                </AnimatePresence></>}
            </div>
            </div>
          </div>
            <AnimatePresence>
                {showNotification && (
                    <motion.div initial={{ x: 300, opacity: 0, scale: 0.95 }} animate={{ x: 0, opacity: 1, scale: 1 }} exit={{ x: 300, opacity: 0, scale: 0.95 }} className="fixed bottom-10 right-10 z-modal flex items-center gap-4 rounded-2xl border border-border-subtle bg-bg-elevated/90 py-3 pl-4 pr-6 shadow-xl backdrop-blur-xl">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-state-info-soft"><RefreshCw size={15} className="animate-spin text-state-info" /></div>
                        <div className="flex flex-col gap-1"><span className="text-sm font-semibold text-text-primary">{t("Refreshed")}</span><span className="text-xs text-text-tertiary">{t("Synced with calendar")}</span></div>
                    </motion.div>
                )}
            </AnimatePresence>
            <GlobalChatOverlay isOpen={isGlobalChatOpen} onClose={() => { setIsGlobalChatOpen(false); setSubmittedGlobalQuery(''); }} initialQuery={submittedGlobalQuery} />
        </div>
    );
};
export default Launcher;
