import React from 'react';
import { useQuiz } from './QuizContext';
import { Team } from './types';

const TeamChip = ({ team }: { team: Team }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 20px',
      border: `2px solid ${team.color}`,
      borderRadius: '16px',
      minWidth: '120px',
      gap: '4px',
    }}
  >
    <span style={{ fontWeight: 600, fontSize: '14px' }}>{team.name}</span>
    <span style={{ color: '#2563eb', fontFamily: 'Unbounded', fontSize: '20px', fontWeight: 700 }}>
      {team.score}
    </span>
  </div>
);

const BoardView = () => {
  const { state, connected } = useQuiz();
  const activeRound = state.rounds.find((r) => r.id === state.activeRoundId);

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      {!connected && (
        <div
          style={{
            background: '#fff3cd',
            color: '#856404',
            borderRadius: '8px',
            padding: '8px 16px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          Подключение к серверу...
        </div>
      )}

      {state.phase === 'lobby' && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <h2 style={{ fontFamily: 'Unbounded', fontSize: '24px', marginBottom: '12px' }}>
            Ожидание начала игры
          </h2>
          <p style={{ color: '#666' }}>Администратор ещё не запустил раунд</p>
        </div>
      )}

      {activeRound && (
        <>
          <h2 style={{ fontFamily: 'Unbounded', fontSize: '22px', marginBottom: '24px', color: '#081520' }}>
            {activeRound.name}
          </h2>

          {(() => {
            const allPoints = Array.from(
              new Set(activeRound.categories.flatMap((c) => c.questions.map((q) => q.points)))
            ).sort((a, b) => a - b);

            const colCount = allPoints.length;
            const gridCols = `200px ${Array(colCount).fill('1fr').join(' ')}`;

            const cellStyle = (bg: string, border = true): React.CSSProperties => ({
              padding: '14px 8px',
              textAlign: 'center',
              background: bg,
              borderLeft: border ? '1px solid #e5e7eb' : undefined,
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            });

            return (
              <div
                style={{
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  marginBottom: '24px',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: gridCols }}>
                  <div style={{ ...cellStyle('#2563eb', false), borderBottom: '2px solid #e5e7eb' }} />
                  {allPoints.map((pts) => (
                    <div
                      key={pts}
                      style={{ ...cellStyle('#2563eb'), borderBottom: '2px solid #e5e7eb', fontFamily: 'Unbounded', fontWeight: 700, fontSize: '14px', color: '#fff' }}
                    >
                      {pts}
                    </div>
                  ))}
                </div>

                {/* Category rows */}
                {activeRound.categories.map((cat, catIdx) => {
                  const isLast = catIdx === activeRound.categories.length - 1;
                  return (
                    <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: gridCols }}>
                      <div
                        style={{
                          ...cellStyle('#f8faff', false),
                          borderBottom: isLast ? 'none' : undefined,
                          fontWeight: 700,
                          fontSize: '13px',
                          color: '#2563eb',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          lineHeight: 1.3,
                          padding: '14px 12px',
                        }}
                      >
                        {cat.name}
                      </div>
                      {allPoints.map((pts) => {
                        const q = cat.questions.find((q) => q.points === pts);
                        if (!q) {
                          return (
                            <div key={pts} style={{ ...cellStyle('#fff'), borderBottom: isLast ? 'none' : undefined }} />
                          );
                        }
                        const isActive = state.activeQuestion?.questionId === q.id;
                        const winner = q.winnerId ? state.teams.find((t) => t.id === q.winnerId) : null;

                        const bg = isActive ? '#eff6ff' : q.isOpened && !winner ? '#f9fafb' : '#fff';

                        return (
                          <div
                            key={pts}
                            style={{
                              ...cellStyle(bg),
                              borderBottom: isLast ? 'none' : undefined,
                              fontWeight: 700,
                              fontSize: '15px',
                              color: winner ? winner.color : isActive ? '#2563eb' : '#6b7280',
                              opacity: q.isOpened && !isActive && !winner ? 0.5 : 1,
                              transition: 'background 0.2s',
                            }}
                          >
                            {winner ? '✓' : q.isOpened && !isActive ? '—' : pts}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {activeRound.categories.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
                    Категорий пока нет
                  </div>
                )}
              </div>
            );
          })()}

          {/* Active question card */}
          {state.activeQuestion && (
            <div
              style={{
                background: '#eff6ff',
                border: '1.5px solid #2563eb',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>
                  {state.activeQuestion.categoryName}
                </span>
                <span style={{ fontFamily: 'Unbounded', fontSize: '18px', fontWeight: 700, color: '#2563eb' }}>
                  {state.activeQuestion.points} очков
                </span>
              </div>

              <p style={{ fontSize: '18px', fontWeight: 500, color: '#081520', margin: '0 0 16px', lineHeight: 1.5 }}>
                {state.activeQuestion.question}
              </p>

              {state.activeQuestion.mediaType === 'image' && state.activeQuestion.mediaUrl && (
                <img
                  src={state.activeQuestion.mediaUrl}
                  alt=""
                  style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '10px', objectFit: 'contain', marginBottom: '14px', display: 'block' }}
                />
              )}
              {state.activeQuestion.mediaType === 'audio' && state.activeQuestion.mediaUrl && (
                <audio controls src={state.activeQuestion.mediaUrl} style={{ width: '100%', marginBottom: '14px' }} />
              )}

              {/* Answer — always visible on board */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  marginBottom: '14px',
                }}
              >
                <span style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  ОТВЕТ
                </span>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e40af' }}>
                  {state.activeQuestion.answer}
                </span>
                {state.activeQuestion.answerMediaType === 'image' && state.activeQuestion.answerMediaUrl && (
                  <img
                    src={state.activeQuestion.answerMediaUrl}
                    alt=""
                    style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px', objectFit: 'contain', marginTop: '10px', display: 'block' }}
                  />
                )}
                {state.activeQuestion.answerMediaType === 'audio' && state.activeQuestion.answerMediaUrl && (
                  <audio controls src={state.activeQuestion.answerMediaUrl} style={{ width: '100%', marginTop: '10px' }} />
                )}
              </div>

              {state.phase === 'question' && (
                <div style={{ color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>
                  Ожидаем нажатия кнопки...
                </div>
              )}

              {state.phase === 'answering' && state.activeQuestion.currentAnswererId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '16px' }}>
                  <span>Отвечает:</span>
                  <span
                    style={{
                      color: state.teams.find((t) => t.id === state.activeQuestion!.currentAnswererId)?.color ?? '#2563eb',
                    }}
                  >
                    {state.teams.find((t) => t.id === state.activeQuestion!.currentAnswererId)?.name}
                  </span>
                </div>
              )}

              {state.activeQuestion.answeredTeamIds.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '13px', color: '#9ca3af' }}>
                  Уже отвечали:{' '}
                  {state.activeQuestion.answeredTeamIds
                    .map((id) => state.teams.find((t) => t.id === id)?.name)
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {state.teams.length > 0 && (
        <div>
          <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Счёт команд
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {state.teams.map((team) => (
              <TeamChip key={team.id} team={team} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BoardView;
