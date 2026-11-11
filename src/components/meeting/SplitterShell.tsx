import React, { useEffect, useState } from 'react';
import { Columns2, Rows2, Focus } from 'lucide-react';
import { Mic, MessageSquare } from 'lucide-react';
import ResizableSplitter from '../ui/ResizableSplitter';
import type { getOverlayAppearance } from '../../lib/overlayAppearance';

interface SplitterShellProps {
    left: React.ReactNode;
    right: React.ReactNode;
    splitterPosition: number;
    onSplitterChange: (next: number) => void;
    isExpanded: boolean;
    appearance: ReturnType<typeof getOverlayAppearance>;
    overlayPanelClass: string;
}

const ZoneHeader: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className={`meeting-zone-heading flex items-center gap-2 select-none shrink-0 ${label === 'Ответы' ? 'meeting-zone-answer' : ''}`}>
        {icon}
        <span>{label}</span>
    </div>
);

const SplitterShell: React.FC<SplitterShellProps> = ({
    left,
    right,
    splitterPosition,
    onSplitterChange,
    appearance,
    overlayPanelClass,
}) => {
    const [layout, setLayout] = useState(() => localStorage.getItem('pika_meeting_layout') || 'columns');
    const [wide, setWide] = useState(window.innerWidth >= 740);
    useEffect(() => {
        const resize = () => setWide(window.innerWidth >= 740);
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);
    const columns = layout === 'columns' && wide;
    const focus = layout === 'focus';
    const cycleLayout = () => {
        const next = layout === 'columns' ? 'rows' : layout === 'rows' ? 'focus' : 'columns';
        setLayout(next); localStorage.setItem('pika_meeting_layout', next);
    };
    return (
        <div
            className={`relative w-full flex-1 min-h-0 border rounded-[24px] overflow-hidden flex flex-col draggable-area overlay-shell-surface ${overlayPanelClass}`}
            style={appearance.shellStyle}
        >
            <div className="flex justify-end px-3 py-1 border-b border-border-subtle no-drag"><button onClick={cycleLayout} className="meeting-toolbar-action" title="Сменить расположение панелей">{focus ? <Focus size={13}/> : columns ? <Columns2 size={13}/> : <Rows2 size={13}/>} {focus ? 'Фокус' : columns ? 'Рядом' : 'Друг под другом'}</button></div>
            <div className={`flex-1 min-h-0 flex ${columns ? 'flex-row' : 'flex-col'}`}>
                {!focus && <>
                <section
                    className="min-w-0 min-h-0 overflow-hidden flex flex-col bg-white/[0.02]"
                    style={columns ? { width: `${splitterPosition}%` } : { height: `${splitterPosition}%` }}
                >
                    <ZoneHeader icon={<Mic className="w-2.5 h-2.5" />} label="Разговор" />
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{left}</div>
                </section>
                <ResizableSplitter
                    position={splitterPosition}
                    onPositionChange={onSplitterChange}
                    orientation={columns ? 'vertical' : 'horizontal'}
                />
                </>}
                <section className="min-w-0 min-h-0 flex-1 overflow-hidden flex flex-col bg-black/[0.04]">
                    <ZoneHeader icon={<MessageSquare className="w-2.5 h-2.5" />} label="Ответы" />
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{right}</div>
                </section>
            </div>
        </div>
    );
};

export default SplitterShell;
