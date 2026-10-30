import { getLang, LANGS, messagesFor } from '../utils/i18n';
import { Button, Modal, Segmented } from './common';
import { useGame, useGameVersion, useMsg } from './GameContext';
import { IconGlobe, IconLayers, IconMute, IconVolume } from './Icons';

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 text-slate-300">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 flex-1 accent-cyan-400"
        aria-label={label}
      />
      <span className="w-10 text-right tabular-nums text-slate-400">{Math.round(value * 100)}</span>
    </label>
  );
}

/** Language, audio and display options (shared by the title screen and the in-game menu). */
export function SettingsBody({ showPollutionToggle = true }: { showPollutionToggle?: boolean }) {
  const game = useGame();
  useGameVersion();
  const m = useMsg();
  const t = m.settings;
  return (
    <div className="space-y-4">
      <section>
        <div className="mb-1 flex items-center gap-2 text-sm font-bold text-cyan-100">
          <IconGlobe className="h-4 w-4" /> {t.language}
        </div>
        <Segmented
          label={t.language}
          value={getLang()}
          onChange={(lang) => game.setLanguage(lang)}
          options={LANGS.map((l) => ({ value: l, label: messagesFor(l).langName }))}
        />
      </section>
      <section className="space-y-1 rounded-xl bg-slate-900/70 p-3">
        <Button onClick={() => game.setMuted(!game.sound.muted)} className="w-full justify-start">
          {game.sound.muted ? <IconMute /> : <IconVolume />} {game.sound.muted ? t.unmute : t.mute}
        </Button>
        <Slider label={t.music} value={game.sound.musicLevel} onChange={(v) => game.setMusicVolume(v)} />
        <Slider label={t.sfx} value={game.sound.sfxLevel} onChange={(v) => game.setSfxVolume(v)} />
      </section>
      {showPollutionToggle && (
        <Button className="w-full" variant={game.showPollution ? 'active' : 'default'} onClick={() => game.setPollutionOverlay(!game.showPollution)}>
          <IconLayers /> {t.pollutionMap(game.showPollution)}
        </Button>
      )}
    </div>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const m = useMsg();
  return (
    <Modal title={m.settings.title} onClose={onClose}>
      <SettingsBody />
    </Modal>
  );
}
