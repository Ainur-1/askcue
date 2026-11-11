import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Meeting } from '../Launcher';
import TopSearchPill from '../TopSearchPill';
import WindowControls from '../WindowControls';
import { isMac } from '../../utils/platformUtils';

interface LauncherHeaderProps {
    meetings: Meeting[];
    selectedMeeting: Meeting | null;
    forwardMeeting: Meeting | null;
    onBack: () => void;
    onForward: () => void;
    title: string;
    status: React.ReactNode;
    onAIQuery: (query: string) => void;
    onLiteralSearch: (query: string) => void;
    onOpenMeetingId: (meetingId: string) => void;
}

const LauncherHeader: React.FC<LauncherHeaderProps> = ({
    meetings,
    selectedMeeting,
    forwardMeeting,
    onBack,
    onForward,
    title,
    status,
    onAIQuery,
    onLiteralSearch,
    onOpenMeetingId,
}) => (
    <header className="workbench-header paper-texture drag-region relative z-sticky flex w-full shrink-0 select-none items-center justify-between border-b border-border-subtle">
        <div className="no-drag flex items-center gap-1">
            {isMac && <div className="w-16" />}
            <span className="workbench-title">{title}</span>
            <button onClick={selectedMeeting ? onBack : undefined} disabled={!selectedMeeting} aria-label="Back to meetings" className={`ml-2 mt-1 flex items-center justify-center p-1 transition-colors ${selectedMeeting ? 'text-text-secondary hover:text-text-primary' : 'cursor-default text-text-tertiary opacity-50'}`}>
                <ArrowLeft size={16} />
            </button>
            <button onClick={onForward} disabled={!forwardMeeting} aria-label="Forward to meeting details" className={`mt-1 flex items-center justify-center p-1 transition-colors ${forwardMeeting ? 'text-text-secondary hover:text-text-primary' : 'cursor-default text-text-tertiary opacity-0'}`}>
                <ArrowRight size={16} />
            </button>
        </div>

        <TopSearchPill meetings={meetings} onAIQuery={onAIQuery} onLiteralSearch={onLiteralSearch} onOpenMeeting={onOpenMeetingId} />

        <div className={`no-drag flex shrink-0 items-center gap-3 ${isMac ? 'mr-1' : ''}`}>
            {status}
            {!isMac && <WindowControls />}
        </div>
    </header>
);

export default LauncherHeader;
