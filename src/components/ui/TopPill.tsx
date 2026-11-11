import { t } from '../../i18n';
import { ChevronUp, ChevronDown, PanelLeft, Square } from 'lucide-react';
import type { OverlayAppearance } from '../../lib/overlayAppearance';
import DetectableControl from './DetectableControl';
import { useMeetingClock } from '../../hooks/useMeetingClock';

interface TopPillProps {
  expanded: boolean;
  onToggle: () => void;
  onQuit: () => void;
  appearance: OverlayAppearance;
  onLogoClick?: () => void;
  status?: string;
}

export default function TopPill({ expanded, onToggle, onQuit, onLogoClick, status }: TopPillProps) {
  const duration = useMeetingClock();
  return <header className="meeting-toolbar paper-texture draggable-area w-full shrink-0">
    <span className="meeting-title">{t("Текущий разговор")}</span>
    <span className="text-xs text-text-secondary" role="status">{status ? t(status) : null}</span>
    <span className="meeting-duration">{t("Длительность")} <time>{duration}</time></span>
    <div className="flex-1" />
    <DetectableControl />
    <button className="meeting-toolbar-action" onClick={onToggle} title={expanded ? 'Свернуть рабочую область' : 'Развернуть рабочую область'}>
      {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>} {expanded ? t("Свернуть") : t("Развернуть")}
    </button>
    <button className="meeting-toolbar-action" onClick={onLogoClick}><PanelLeft size={15}/>{t("Разделы")}</button>
    <button className="meeting-toolbar-action danger" onClick={onQuit}><Square size={13}/>{t("Завершить")}</button>
  </header>;
}
