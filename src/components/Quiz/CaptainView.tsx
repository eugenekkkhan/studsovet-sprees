import { useState, useEffect } from 'react';
import { useQuiz } from './QuizContext';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];

const CaptainView = () => {
  const { state, connected, joinAsCaptain, buzz } = useQuiz();
  const [captainTeamId, setCaptainTeamId] = useState<string | null>(
    localStorage.getItem('quizCaptainTeamId'),
  );
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [buzzFeedback, setBuzzFeedback] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const captainTeam = state.teams.find((t) => t.id === captainTeamId);

  useEffect(() => {
    if (captainTeamId && !state.teams.find((t) => t.id === captainTeamId)) {
      setCaptainTeamId(null);
      localStorage.removeItem('quizCaptainTeamId');
    }
  }, [state.teams, captainTeamId]);

  const handleJoin = async (teamId: string) => {
    if (!teamId) return;
    setJoining(true);
    setJoinError('');
    const result = await joinAsCaptain(teamId);
    setJoining(false);
    if (result.success) {
      setCaptainTeamId(teamId);
    } else {
      setJoinError(result.error ?? 'Ошибка подключения');
    }
  };

  const handleCreateTeam = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('http://localhost:3000/quiz/self-register-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (res.ok) {
        const team = await res.json();
        setShowCreate(false);
        setNewName('');
        await handleJoin(team.id);
      } else {
        const body = await res.json().catch(() => ({}));
        setCreateError(body.message ?? 'Ошибка создания команды');
      }
    } catch {
      setCreateError('Нет связи с сервером');
    }
    setCreating(false);
  };

  const handleLeave = () => {
    setCaptainTeamId(null);
    localStorage.removeItem('quizCaptainTeamId');
  };

  const handleBuzz = () => {
    buzz();
    setBuzzFeedback('Кнопка нажата!');
    setTimeout(() => setBuzzFeedback(''), 1500);
  };

  const { activeQuestion, phase, teams } = state;

  const alreadyAnswered =
    captainTeamId != null &&
    activeQuestion?.answeredTeamIds.includes(captainTeamId);
  const isAnswering = activeQuestion?.currentAnswererId === captainTeamId;
  const buzzEnabled =
    connected &&
    phase === 'question' &&
    !alreadyAnswered &&
    !isAnswering &&
    captainTeamId != null;

  if (!captainTeamId || !captainTeam) {
    return (
      <div style={{ padding: '24px', maxWidth: '480px', margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: 'Unbounded',
            fontSize: '20px',
            marginBottom: '24px',
            color: '#081520',
          }}
        >
          Войти как капитан
        </h2>

        {/* Team cards */}
        {teams.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {teams.map((t) => (
              <div
                key={t.id}
                onClick={() => !joining && setSelectedTeamId(t.id)}
                style={{
                  padding: '12px 16px',
                  border: `2px solid ${selectedTeamId === t.id ? t.color : '#e5e7eb'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: selectedTeamId === t.id ? `${t.color}12` : '#fff',
                  transition: 'border-color 0.15s',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: t.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 500, fontSize: '15px' }}>{t.name}</span>
              </div>
            ))}
          </div>
        )}

        {joinError && (
          <div
            style={{
              color: '#cb4d4d',
              fontSize: '14px',
              padding: '8px 12px',
              background: '#fff5f5',
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            {joinError}
          </div>
        )}

        {selectedTeamId && !showCreate && (
          <button
            onClick={() => handleJoin(selectedTeamId)}
            disabled={joining || !connected}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              fontSize: '16px',
              fontWeight: 600,
              cursor: joining || !connected ? 'not-allowed' : 'pointer',
              opacity: joining || !connected ? 0.5 : 1,
              marginBottom: '12px',
            }}
          >
            {joining ? 'Подключение...' : 'Войти'}
          </button>
        )}

        {/* Create team section */}
        {showCreate ? (
          <div
            style={{
              border: '1.5px solid #e5e7eb',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '15px' }}>Новая команда</div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название команды"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1.5px solid #e5e7eb',
                fontSize: '15px',
                outline: 'none',
                color: '#081520',
              }}
            />
            <div>
              <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>Цвет</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => setNewColor(c)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: c,
                      cursor: 'pointer',
                      border: newColor === c ? '3px solid #081520' : '3px solid transparent',
                      boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>
            </div>
            {createError && (
              <div style={{ color: '#cb4d4d', fontSize: '13px' }}>{createError}</div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCreateTeam}
                disabled={!newName.trim() || creating || !connected}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: !newName.trim() || creating || !connected ? 'not-allowed' : 'pointer',
                  opacity: !newName.trim() || creating || !connected ? 0.5 : 1,
                }}
              >
                {creating ? 'Создание...' : 'Создать и войти'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setCreateError(''); }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'none',
                  border: '1px solid #e5e7eb',
                  color: '#6b7280',
                  fontSize: '15px',
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setShowCreate(true); setSelectedTeamId(''); }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              background: 'none',
              border: '1px dashed #d1d5db',
              color: '#6b7280',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            + Создать новую команду
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '480px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>
            Ваша команда
          </div>
          <div
            style={{
              fontFamily: 'Unbounded',
              fontSize: '20px',
              fontWeight: 700,
              color: captainTeam.color,
            }}
          >
            {captainTeam.name}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Счёт</div>
          <div
            style={{ fontFamily: 'Unbounded', fontSize: '28px', fontWeight: 700, color: '#081520' }}
          >
            {captainTeam.score}
          </div>
        </div>
      </div>

      {activeQuestion && (
        <div
          style={{
            background: '#eff6ff',
            border: '1.5px solid #2563eb',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              marginBottom: '10px',
            }}
          >
            <span style={{ color: '#2563eb', fontWeight: 600 }}>
              {activeQuestion.categoryName}
            </span>
            <span style={{ fontWeight: 700, color: '#2563eb' }}>
              {activeQuestion.points} очков
            </span>
          </div>
          <p style={{ fontSize: '17px', fontWeight: 500, color: '#081520', margin: '0 0 12px' }}>
            {activeQuestion.question}
          </p>

          {activeQuestion.mediaType === 'image' && activeQuestion.mediaUrl && (
            <img
              src={activeQuestion.mediaUrl}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '10px', objectFit: 'contain', marginBottom: '12px', display: 'block' }}
            />
          )}
          {activeQuestion.mediaType === 'audio' && activeQuestion.mediaUrl && (
            <audio controls src={activeQuestion.mediaUrl} style={{ width: '100%', marginBottom: '12px' }} />
          )}

          {/* Answer only shown when it's this team's turn to answer */}
          {isAnswering && (
            <div style={{ marginTop: '12px' }}>
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  marginBottom: '10px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                  ОТВЕТ
                </span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#1e40af' }}>
                  {activeQuestion.answer}
                </span>
                {activeQuestion.answerMediaType === 'image' && activeQuestion.answerMediaUrl && (
                  <img
                    src={activeQuestion.answerMediaUrl}
                    alt=""
                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain', marginTop: '8px', display: 'block' }}
                  />
                )}
                {activeQuestion.answerMediaType === 'audio' && activeQuestion.answerMediaUrl && (
                  <audio controls src={activeQuestion.answerMediaUrl} style={{ width: '100%', marginTop: '8px' }} />
                )}
              </div>
              <div
                style={{
                  padding: '8px 14px',
                  background: '#dcfce7',
                  borderRadius: '8px',
                  color: '#166534',
                  fontWeight: 600,
                  fontSize: '15px',
                }}
              >
                Отвечайте!
              </div>
            </div>
          )}

          {alreadyAnswered && !isAnswering && (
            <div
              style={{
                marginTop: '12px',
                padding: '8px 14px',
                background: '#fee2e2',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '14px',
              }}
            >
              Вы уже ответили неверно
            </div>
          )}
        </div>
      )}

      {phase === 'lobby' && (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 0',
            color: '#9ca3af',
            fontSize: '15px',
          }}
        >
          Ожидание начала игры...
        </div>
      )}

      {(phase === 'board' || (phase !== 'question' && !activeQuestion)) &&
        phase !== 'lobby' && (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 0',
              color: '#9ca3af',
              fontSize: '15px',
            }}
          >
            Ожидание вопроса...
          </div>
        )}

      {(phase === 'question' || phase === 'answering') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleBuzz}
            disabled={!buzzEnabled}
            style={{
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: buzzEnabled ? '#2563eb' : '#e5e7eb',
              color: buzzEnabled ? '#fff' : '#9ca3af',
              border: 'none',
              fontFamily: 'Unbounded',
              fontSize: '22px',
              fontWeight: 700,
              cursor: buzzEnabled ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
              boxShadow: buzzEnabled ? '0 8px 24px rgba(37,99,235,0.35)' : 'none',
              transform: buzzEnabled ? 'scale(1)' : 'scale(0.95)',
            }}
            onMouseDown={(e) => {
              if (buzzEnabled)
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)';
            }}
            onMouseUp={(e) => {
              if (buzzEnabled)
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            {isAnswering ? 'Ваш ход!' : alreadyAnswered ? 'Ждите' : 'Жми ёпта!!!'}
          </button>

          {buzzFeedback && (
            <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '15px' }}>
              {buzzFeedback}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleLeave}
        style={{
          marginTop: '32px',
          background: 'none',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '8px 16px',
          color: '#9ca3af',
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        Выйти из команды
      </button>
    </div>
  );
};

export default CaptainView;
