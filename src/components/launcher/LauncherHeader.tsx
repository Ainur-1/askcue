import { t } from '../../i18n';
import React from 'react';
import type { Meeting } from '../Launcher';
import TopSearchPill from '../TopSearchPill';
import WindowControls from '../WindowControls';
import { isMac } from '../../utils/platformUtils';

interface LauncherHeaderProps {
    meetings: Meeting[];
    title: string;
    status: React.ReactNode;
    onAIQuery: (query: string) => void;
    onOpenMeetingId: (meetingId: string) => void;
}

const LauncherHeader: React.FC<LauncherHeaderProps> = ({
    meetings,
    title,
    status,
    onAIQuery,
    onOpenMeetingId,
}) => (
    <header className="workbench-header paper-texture drag-region relative z-sticky flex w-full shrink-0 select-none items-center justify-between border-b border-border-subtle">
        <div className="no-drag flex items-center gap-1">
            {isMac && <div className="w-16" />}
            <span className="workbench-title">{title}</span>
        </div>

        <TopSearchPill meetings={meetings} onAIQuery={onAIQuery} onOpenMeeting={onOpenMeetingId} />

        <div className={`no-drag flex shrink-0 items-center gap-3 ${isMac ? 'mr-1' : ''}`}>
            {status}
            {!isMac && <WindowControls />}
        </div>
    </header>
);

export default LauncherHeader;
