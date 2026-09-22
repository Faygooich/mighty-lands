// «Игра по сети»: make a room and read out its code, or enter somebody's code — like Jackbox.
import { useEffect, useRef, useState } from 'react';
import { CODE_LENGTH, normCode } from '../../../net/protocol.ts';
import { hostRoom, joinRoom, resumeHostRoom, savedGuestRoom, savedHostRoom, forgetHostRoom, savedName, serverMode, type Session } from './session.ts';
import { Icon } from '../ui/Icon.tsx';

const NAMES = ['Громобой', 'Валькирия', 'Бородарь', 'Кувалда', 'Ярополк', 'Броня', 'Хрящ'];

export function OnlineMenu({ initialCode, onBack, onSession }: { initialCode?: string; onBack: () => void; onSession: (s: Session) => void }) {
  const [name, setName] = useState(() => savedName() || NAMES[Math.floor(Math.random() * NAMES.length)]);
  const [code, setCode] = useState(() => normCode(initialCode ?? ''));
  const [spectate, setSpectate] = useState(false);
  const [busy, setBusy] = useState<'' | 'host' | 'join' | 'resume'>('');
  const [err, setErr] = useState('');
  const host = savedHostRoom();
  const guestCode = savedGuestRoom();
  const server = serverMode();

  const run = async (what: 'host' | 'join' | 'resume', go: () => Promise<Session>) => {
    setBusy(what);
    setErr('');
    try { onSession(await go()); } catch (e) { setErr((e as Error).message); setBusy(''); }
  };

  // Came back to a room we were already in (reloaded tab, phone woken up): just walk back in.
  const rejoined = useRef(false);
  useEffect(() => {
    const back = initialCode && normCode(initialCode) === guestCode && !host;
    if (!back || rejoined.current) return;
    rejoined.current = true;
    void run('join', () => joinRoom(guestCode!, savedName() || 'Герой', false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, guestCode]);

  return (
    <div className="screen">
      <div className="screen-inner narrow">
        <button type="button" className="plaque ghost back" onClick={onBack}><span className="plaque-main"><Icon name="back" /> Назад</span></button>
        <h2 className="screen-title on-felt">Игра по сети</h2>

        <div className="parchment">
          <label className="field">Как вас звать в этой партии
            <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} aria-label="Ваше имя" />
          </label>

          <div className="net-cards">
            <div className="net-card">
              <h3>Создать комнату</h3>
              <p className="muted small">Вы получите код из {CODE_LENGTH} букв. Друзья открывают этот же сайт и вводят код — как в Jackbox, только у каждого своя рука и своё поле.</p>
              <button type="button" className="plaque primary big" disabled={!!busy} onClick={() => run('host', () => hostRoom(name.trim() || 'Герой', spectate))}>
                <span className="plaque-main"><Icon name="users" size={20} /> {busy === 'host' ? 'Создаём…' : 'Создать комнату'}</span>
                <span className="plaque-sub">{server ? 'комната живёт на сервере' : 'комната живёт в этой вкладке'}</span>
              </button>
              <label className="check"><input type="checkbox" checked={spectate} onChange={(e) => setSpectate(e.target.checked)} /> Я только смотрю (не занимать место)</label>
            </div>

            <div className="net-card">
              <h3>Войти по коду</h3>
              <input
                className="code-big" value={code} inputMode="text" autoCapitalize="characters" spellCheck={false}
                placeholder="КОД" aria-label="Код комнаты" maxLength={CODE_LENGTH}
                onChange={(e) => setCode(normCode(e.target.value))}
                onKeyDown={(e) => { if (e.key === 'Enter' && code.length === CODE_LENGTH) void run('join', () => joinRoom(code, name.trim() || 'Герой', spectate)); }}
              />
              <button type="button" className="plaque primary big" disabled={code.length !== CODE_LENGTH || !!busy} onClick={() => run('join', () => joinRoom(code, name.trim() || 'Герой', spectate))}>
                <span className="plaque-main"><Icon name="play" size={20} /> {busy === 'join' ? 'Заходим…' : 'Войти'}</span>
              </button>
            </div>
          </div>

          {err && <div className="warn"><Icon name="skull" size={16} /> {err}</div>}

          {(host || guestCode) && (
            <div className="net-resume">
              {host && (
                <>
                  <button type="button" className="plaque secondary" disabled={!!busy} onClick={() => run('resume', () => resumeHostRoom(host, name.trim() || 'Герой'))}>
                    <span className="plaque-main"><Icon name="upload" /> {busy === 'resume' ? 'Восстанавливаем…' : `Вернуть мою комнату ${host.code}`}</span>
                    <span className="plaque-sub">{host.phase === 'game' ? 'партия продолжится с того же места' : 'лобби соберётся заново'}</span>
                  </button>
                  <button type="button" className="plaque ghost tiny" onClick={() => { forgetHostRoom(); setErr(''); }}>Забыть комнату</button>
                </>
              )}
              {guestCode && !host && (
                <button type="button" className="plaque secondary" disabled={!!busy} onClick={() => { setCode(guestCode); void run('join', () => joinRoom(guestCode, name.trim() || 'Герой', spectate)); }}>
                  <span className="plaque-main"><Icon name="back" /> Вернуться в комнату {guestCode}</span>
                  <span className="plaque-sub">место осталось за вами</span>
                </button>
              )}
            </div>
          )}

          <p className="muted small">
            {server
              ? 'Комнаты держит сервер: хозяин может закрыть вкладку, партия не пропадёт.'
              : 'Соединение — напрямую между устройствами (WebRTC). Вкладка хозяина — это и есть комната: пока она открыта, партия жива; после перезагрузки её можно вернуть.'}
          </p>
        </div>
      </div>
    </div>
  );
}
