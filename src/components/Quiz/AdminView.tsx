import { useState, useEffect, useRef } from 'react';
import { useQuiz } from './QuizContext';
import { buildAdminApi, AdminApi } from './api';
import { Team } from './types';

// --- Shared helpers ---

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1.5px solid #e5e7eb',
  fontSize: '14px',
  outline: 'none',
  color: '#081520',
  width: '100%',
  boxSizing: 'border-box',
};

const Btn = ({
  onClick,
  children,
  disabled,
  color = '#2563eb',
  small,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  color?: string;
  small?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: small ? '4px 10px' : '8px 16px',
      borderRadius: '8px',
      background: disabled ? '#e5e7eb' : color,
      color: disabled ? '#9ca3af' : '#fff',
      border: 'none',
      fontSize: small ? '12px' : '14px',
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.15s',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </button>
);

const ErrorMsg = ({ msg }: { msg: string }) =>
  msg ? (
    <div
      style={{
        color: '#cb4d4d',
        fontSize: '13px',
        padding: '6px 10px',
        background: '#fff5f5',
        borderRadius: '6px',
        marginTop: '4px',
      }}
    >
      {msg}
    </div>
  ) : null;

const MediaUpload = ({
  mediaUrl,
  mediaType,
  onUpload,
  onRemove,
  api,
}: {
  mediaUrl: string | null;
  mediaType: 'image' | 'audio' | null;
  onUpload: (url: string, type: 'image' | 'audio') => void;
  onRemove: () => void;
  api: AdminApi;
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const res = await api.uploadMedia(file);
      if (res.ok) {
        const data = await res.json();
        onUpload(data.url, data.mediaType);
      } else {
        setUploadError('Ошибка загрузки');
      }
    } catch {
      setUploadError('Нет связи с сервером');
    }
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,audio/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {mediaUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {mediaType === 'image' ? (
            <img
              src={mediaUrl}
              alt=""
              style={{ maxHeight: '100px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain', border: '1px solid #e5e7eb' }}
            />
          ) : (
            <audio controls src={mediaUrl} style={{ width: '100%' }} />
          )}
          <Btn onClick={onRemove} color="#cb4d4d" small>Удалить медиа</Btn>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              background: 'none',
              border: '1px dashed #d1d5db',
              borderRadius: '8px',
              padding: '5px 12px',
              color: '#6b7280',
              fontSize: '13px',
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Загрузка...' : '+ Фото / звук'}
          </button>
          {uploadError && <span style={{ color: '#cb4d4d', fontSize: '12px' }}>{uploadError}</span>}
        </div>
      )}
    </div>
  );
};

// --- Game Tab ---

const GameTab = ({ api }: { api: AdminApi }) => {
  const { state } = useQuiz();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const call = async (fn: () => Promise<Response>) => {
    setLoading(true);
    setError('');
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? `Ошибка ${res.status}`);
      }
    } catch {
      setError('Не удалось связаться с сервером');
    }
    setLoading(false);
  };

  const activeRound = state.rounds.find((r) => r.id === state.activeRoundId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ErrorMsg msg={error} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', color: '#9ca3af' }}>Фаза:</span>
        <span
          style={{
            background: '#eff6ff',
            color: '#2563eb',
            borderRadius: '20px',
            padding: '3px 12px',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          {{ lobby: 'Лобби', board: 'Доска', question: 'Вопрос открыт', answering: 'Отвечают' }[state.phase]}
        </span>
      </div>

      {/* Lobby */}
      {state.phase === 'lobby' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontWeight: 600 }}>Запустить раунд</div>
          {state.rounds.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Создайте раунды во вкладке «Раунды»</p>
          ) : (
            state.rounds.map((round) => (
              <div
                key={round.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 16px',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '12px',
                }}
              >
                <span style={{ fontWeight: 500 }}>{round.name}</span>
                <Btn onClick={() => call(() => api.startRound(round.id))} disabled={loading} small>
                  Запустить
                </Btn>
              </div>
            ))
          )}
        </div>
      )}

      {/* Board */}
      {state.phase === 'board' && activeRound && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>{activeRound.name}</div>
            <Btn onClick={() => call(() => api.endRound())} disabled={loading} color='#6b7280' small>
              Завершить раунд
            </Btn>
          </div>

          {activeRound.categories.map((cat) => (
            <div
              key={cat.id}
              style={{ border: '1.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}
            >
              <div
                style={{
                  padding: '8px 14px',
                  background: '#f8faff',
                  fontWeight: 700,
                  fontSize: '13px',
                  color: '#2563eb',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                {cat.name}
              </div>
              {cat.questions.map((q, idx) => {
                const winner = q.winnerId ? state.teams.find((t) => t.id === q.winnerId) : null;
                return (
                  <div
                    key={q.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      padding: '10px 14px',
                      gap: '10px',
                      alignItems: 'center',
                      borderTop: idx > 0 ? '1px solid #f3f4f6' : undefined,
                      background: q.isOpened ? '#f9fafb' : '#fff',
                      opacity: q.isOpened ? 0.65 : 1,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '14px' }}>{q.text}</div>
                      {winner && (
                        <div style={{ fontSize: '12px', color: winner.color, marginTop: '2px' }}>
                          ✓ {winner.name}
                        </div>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '14px' }}>{q.points}</span>
                    <Btn
                      onClick={() => call(() => api.openQuestion(q.id))}
                      disabled={loading || q.isOpened}
                      small
                    >
                      {q.isOpened ? 'Открыт' : 'Открыть'}
                    </Btn>
                  </div>
                );
              })}
              {cat.questions.length === 0 && (
                <div style={{ padding: '12px 14px', color: '#d1d5db', fontSize: '13px' }}>
                  Нет вопросов
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Question / Answering */}
      {(state.phase === 'question' || state.phase === 'answering') && state.activeQuestion && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: '#eff6ff',
              border: '1.5px solid #2563eb',
              borderRadius: '12px',
              padding: '16px',
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}
            >
              <span style={{ color: '#2563eb', fontWeight: 600 }}>{state.activeQuestion.categoryName}</span>
              <span style={{ fontWeight: 700 }}>{state.activeQuestion.points} очков</span>
            </div>
            <p style={{ fontWeight: 500, fontSize: '16px', margin: '0 0 12px', color: '#081520' }}>
              {state.activeQuestion.question}
            </p>
            <div
              style={{
                background: '#fff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '8px 14px',
              }}
            >
              <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 600, display: 'block', marginBottom: '3px' }}>
                ОТВЕТ
              </span>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#1e40af' }}>
                {state.activeQuestion.answer}
              </span>
              {state.activeQuestion.answerMediaType === 'image' && state.activeQuestion.answerMediaUrl && (
                <img
                  src={state.activeQuestion.answerMediaUrl}
                  alt=""
                  style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain', marginTop: '8px', display: 'block' }}
                />
              )}
              {state.activeQuestion.answerMediaType === 'audio' && state.activeQuestion.answerMediaUrl && (
                <audio controls src={state.activeQuestion.answerMediaUrl} style={{ width: '100%', marginTop: '8px' }} />
              )}
            </div>
          </div>

          {state.phase === 'question' && (
            <div style={{ color: '#9ca3af', fontSize: '14px', fontStyle: 'italic' }}>
              Ожидаем нажатия кнопки...
            </div>
          )}

          {state.phase === 'answering' && state.activeQuestion.currentAnswererId && (
            <div style={{ fontWeight: 600, fontSize: '16px' }}>
              Отвечает:{' '}
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
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>
              Уже отвечали:{' '}
              {state.activeQuestion.answeredTeamIds
                .map((id) => state.teams.find((t) => t.id === id)?.name)
                .join(', ')}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {state.phase === 'answering' && (
              <>
                <Btn onClick={() => call(() => api.judgeAnswer(true))} disabled={loading} color='#75b666'>
                  ✓ Правильно
                </Btn>
                <Btn onClick={() => call(() => api.judgeAnswer(false))} disabled={loading} color='#cb4d4d'>
                  ✗ Неверно
                </Btn>
              </>
            )}
            <Btn onClick={() => call(() => api.skipQuestion())} disabled={loading} color='#6b7280'>
              Пропустить
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Rounds Tab ---

type NewQuestion = { text: string; answer: string; points: string; mediaUrl: string | null; mediaType: 'image' | 'audio' | null; answerMediaUrl: string | null; answerMediaType: 'image' | 'audio' | null };
type EditQuestionState = { id: string; text?: string; answer?: string; points?: number; mediaUrl: string | null; mediaType: 'image' | 'audio' | null; answerMediaUrl: string | null; answerMediaType: 'image' | 'audio' | null };

const RoundsTab = ({ api }: { api: AdminApi }) => {
  const { state } = useQuiz();
  const [newRoundName, setNewRoundName] = useState('');
  const [editRound, setEditRound] = useState<{ id: string; name: string } | null>(null);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [newCatName, setNewCatName] = useState<Record<string, string>>({});
  const [editQ, setEditQ] = useState<EditQuestionState | null>(null);
  const [newQ, setNewQ] = useState<Record<string, NewQuestion>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const call = async (fn: () => Promise<Response>) => {
    setLoading(true);
    setError('');
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? `Ошибка ${res.status}`);
      }
    } catch {
      setError('Не удалось связаться с сервером');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ErrorMsg msg={error} />

      {/* Add round */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: '10px' }}>Новый раунд</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={newRoundName}
            onChange={(e) => setNewRoundName(e.target.value)}
            placeholder="Название раунда"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newRoundName.trim()) {
                call(() => api.addRound(newRoundName.trim())).then(() => setNewRoundName(''));
              }
            }}
          />
          <Btn
            onClick={() => call(() => api.addRound(newRoundName.trim())).then(() => setNewRoundName(''))}
            disabled={!newRoundName.trim() || loading}
          >
            Добавить
          </Btn>
        </div>
      </div>

      {state.rounds.map((round) => (
        <div
          key={round.id}
          style={{ border: '1.5px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden' }}
        >
          {/* Round header */}
          <div
            style={{
              background: '#f9fafb',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            {editRound?.id === round.id ? (
              <>
                <input
                  value={editRound.name}
                  onChange={(e) => setEditRound((r) => r && { ...r, name: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                  autoFocus
                />
                <Btn
                  onClick={() => call(() => api.updateRound(round.id, editRound.name)).then(() => setEditRound(null))}
                  disabled={loading}
                  small
                >
                  Сохранить
                </Btn>
                <Btn onClick={() => setEditRound(null)} color='#6b7280' small>Отмена</Btn>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 600, flex: 1 }}>{round.name}</span>
                <Btn onClick={() => setEditRound({ id: round.id, name: round.name })} color='#6b7280' small>
                  Изменить
                </Btn>
                <Btn onClick={() => call(() => api.deleteRound(round.id))} color='#cb4d4d' disabled={loading} small>
                  Удалить
                </Btn>
              </>
            )}
          </div>

          {/* Categories */}
          {round.categories.map((cat) => (
            <div key={cat.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {/* Category header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: '#f8faff',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                {editCatId === cat.id ? (
                  <>
                    <input
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                      autoFocus
                    />
                    <Btn
                      onClick={() =>
                        call(() => api.updateCategory(cat.id, editCatName)).then(() => setEditCatId(null))
                      }
                      disabled={loading}
                      small
                    >
                      Сохранить
                    </Btn>
                    <Btn onClick={() => setEditCatId(null)} color='#6b7280' small>Отмена</Btn>
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '14px', flex: 1 }}>
                      {cat.name}
                    </span>
                    <Btn
                      onClick={() => { setEditCatId(cat.id); setEditCatName(cat.name); }}
                      color='#6b7280'
                      small
                    >
                      Изменить
                    </Btn>
                    <Btn
                      onClick={() => call(() => api.deleteCategory(cat.id))}
                      color='#cb4d4d'
                      disabled={loading}
                      small
                    >
                      Удалить
                    </Btn>
                  </>
                )}
              </div>

              {/* Questions list */}
              {cat.questions.map((q) => (
                <div key={q.id} style={{ padding: '10px 16px 10px 28px', borderBottom: '1px solid #f9fafb', background: q.isOpened ? '#fafafa' : '#fff' }}>
                  {editQ?.id === q.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <textarea
                        value={editQ.text ?? ''}
                        onChange={(e) => setEditQ((prev) => prev && { ...prev, text: e.target.value })}
                        placeholder="Вопрос"
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                      <input
                        value={editQ.answer ?? ''}
                        onChange={(e) => setEditQ((prev) => prev && { ...prev, answer: e.target.value })}
                        placeholder="Ответ"
                        style={inputStyle}
                      />
                      <input
                        type="number"
                        value={editQ.points ?? ''}
                        onChange={(e) => setEditQ((prev) => prev && { ...prev, points: Number(e.target.value) })}
                        placeholder="Очки"
                        style={inputStyle}
                      />
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Медиа к вопросу</div>
                      <MediaUpload
                        mediaUrl={editQ.mediaUrl}
                        mediaType={editQ.mediaType}
                        onUpload={(url, type) => setEditQ((prev) => prev && { ...prev, mediaUrl: url, mediaType: type })}
                        onRemove={() => setEditQ((prev) => prev && { ...prev, mediaUrl: null, mediaType: null })}
                        api={api}
                      />
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Медиа ответ</div>
                      <MediaUpload
                        mediaUrl={editQ.answerMediaUrl}
                        mediaType={editQ.answerMediaType}
                        onUpload={(url, type) => setEditQ((prev) => prev && { ...prev, answerMediaUrl: url, answerMediaType: type })}
                        onRemove={() => setEditQ((prev) => prev && { ...prev, answerMediaUrl: null, answerMediaType: null })}
                        api={api}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Btn
                          onClick={() =>
                            call(() =>
                              api.updateQuestion(q.id, {
                                text: editQ.text,
                                answer: editQ.answer,
                                points: Number(editQ.points),
                                mediaUrl: editQ.mediaUrl,
                                mediaType: editQ.mediaType,
                                answerMediaUrl: editQ.answerMediaUrl,
                                answerMediaType: editQ.answerMediaType,
                              }),
                            ).then(() => setEditQ(null))
                          }
                          disabled={loading}
                          small
                        >
                          Сохранить
                        </Btn>
                        <Btn onClick={() => setEditQ(null)} color='#6b7280' small>Отмена</Btn>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '8px', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '3px' }}>
                          {q.text}
                          {q.isOpened && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#9ca3af' }}>🔒</span>}
                        </div>
                        <div style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>
                          → {q.answer}
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, color: '#6b7280', fontSize: '13px', paddingTop: '2px' }}>
                        {q.points} очк.
                      </span>
                      <Btn
                        onClick={() => setEditQ({ id: q.id, text: q.text, answer: q.answer, points: q.points, mediaUrl: q.mediaUrl ?? null, mediaType: q.mediaType ?? null, answerMediaUrl: q.answerMediaUrl ?? null, answerMediaType: q.answerMediaType ?? null })}
                        disabled={q.isOpened || loading}
                        color='#6b7280'
                        small
                      >
                        Изменить
                      </Btn>
                      <Btn
                        onClick={() => call(() => api.deleteQuestion(q.id))}
                        disabled={q.isOpened || loading}
                        color='#cb4d4d'
                        small
                      >
                        Удалить
                      </Btn>
                    </div>
                  )}
                </div>
              ))}

              {/* Add question form */}
              <div style={{ padding: '10px 16px 10px 28px', background: '#fafafa' }}>
                {newQ[cat.id] ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <textarea
                      value={newQ[cat.id].text}
                      onChange={(e) =>
                        setNewQ((prev) => ({ ...prev, [cat.id]: { ...prev[cat.id], text: e.target.value } }))
                      }
                      placeholder="Текст вопроса"
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                    <input
                      value={newQ[cat.id].answer}
                      onChange={(e) =>
                        setNewQ((prev) => ({ ...prev, [cat.id]: { ...prev[cat.id], answer: e.target.value } }))
                      }
                      placeholder="Ответ"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      value={newQ[cat.id].points}
                      onChange={(e) =>
                        setNewQ((prev) => ({ ...prev, [cat.id]: { ...prev[cat.id], points: e.target.value } }))
                      }
                      placeholder="Очки"
                      style={inputStyle}
                    />
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Медиа к вопросу</div>
                    <MediaUpload
                      mediaUrl={newQ[cat.id].mediaUrl}
                      mediaType={newQ[cat.id].mediaType}
                      onUpload={(url, type) =>
                        setNewQ((prev) => ({ ...prev, [cat.id]: { ...prev[cat.id], mediaUrl: url, mediaType: type } }))
                      }
                      onRemove={() =>
                        setNewQ((prev) => ({ ...prev, [cat.id]: { ...prev[cat.id], mediaUrl: null, mediaType: null } }))
                      }
                      api={api}
                    />
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Медиа ответ</div>
                    <MediaUpload
                      mediaUrl={newQ[cat.id].answerMediaUrl}
                      mediaType={newQ[cat.id].answerMediaType}
                      onUpload={(url, type) =>
                        setNewQ((prev) => ({ ...prev, [cat.id]: { ...prev[cat.id], answerMediaUrl: url, answerMediaType: type } }))
                      }
                      onRemove={() =>
                        setNewQ((prev) => ({ ...prev, [cat.id]: { ...prev[cat.id], answerMediaUrl: null, answerMediaType: null } }))
                      }
                      api={api}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Btn
                        onClick={() => {
                          const nq = newQ[cat.id];
                          if (!nq.text || !nq.answer || !nq.points) return;
                          call(() => api.addQuestion(cat.id, nq.text, nq.answer, Number(nq.points), nq.mediaUrl, nq.mediaType, nq.answerMediaUrl, nq.answerMediaType)).then(() =>
                            setNewQ((prev) => ({ ...prev, [cat.id]: { text: '', answer: '', points: '', mediaUrl: null, mediaType: null, answerMediaUrl: null, answerMediaType: null } })),
                          );
                        }}
                        disabled={loading || !newQ[cat.id]?.text || !newQ[cat.id]?.answer || !newQ[cat.id]?.points}
                        small
                      >
                        Добавить вопрос
                      </Btn>
                      <Btn
                        onClick={() => setNewQ((prev) => { const n = { ...prev }; delete n[cat.id]; return n; })}
                        color='#6b7280'
                        small
                      >
                        Отмена
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewQ((prev) => ({ ...prev, [cat.id]: { text: '', answer: '', points: '', mediaUrl: null, mediaType: null, answerMediaUrl: null, answerMediaType: null } }))}
                    style={{
                      background: 'none',
                      border: '1px dashed #d1d5db',
                      borderRadius: '8px',
                      padding: '5px 12px',
                      color: '#6b7280',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    + Добавить вопрос
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add category form */}
          <div style={{ padding: '12px 16px', background: '#fafafa' }}>
            {newCatName[round.id] !== undefined ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={newCatName[round.id]}
                  onChange={(e) => setNewCatName((prev) => ({ ...prev, [round.id]: e.target.value }))}
                  placeholder="Название категории"
                  style={inputStyle}
                  autoFocus
                />
                <Btn
                  onClick={() =>
                    call(() => api.addCategory(round.id, newCatName[round.id].trim())).then(() =>
                      setNewCatName((prev) => { const n = { ...prev }; delete n[round.id]; return n; }),
                    )
                  }
                  disabled={!newCatName[round.id]?.trim() || loading}
                  small
                >
                  Добавить
                </Btn>
                <Btn
                  onClick={() => setNewCatName((prev) => { const n = { ...prev }; delete n[round.id]; return n; })}
                  color='#6b7280'
                  small
                >
                  Отмена
                </Btn>
              </div>
            ) : (
              <button
                onClick={() => setNewCatName((prev) => ({ ...prev, [round.id]: '' }))}
                style={{
                  background: 'none',
                  border: '1px dashed #d1d5db',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  color: '#6b7280',
                  fontSize: '13px',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                + Добавить категорию
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Teams Tab ---

const TeamsTab = ({ api }: { api: AdminApi }) => {
  const { state } = useQuiz();
  const [newTeam, setNewTeam] = useState({ name: '', color: '#2563eb' });
  const [editTeam, setEditTeam] = useState<(Partial<Team> & { id: string }) | null>(null);
  const [scoreInput, setScoreInput] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const call = async (fn: () => Promise<Response>) => {
    setLoading(true);
    setError('');
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? `Ошибка ${res.status}`);
      }
    } catch {
      setError('Не удалось связаться с сервером');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ErrorMsg msg={error} />

      <div>
        <div style={{ fontWeight: 600, marginBottom: '10px' }}>Новая команда</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={newTeam.name}
            onChange={(e) => setNewTeam((t) => ({ ...t, name: e.target.value }))}
            placeholder="Название команды"
            style={{ ...inputStyle, flex: 1, minWidth: '150px' }}
          />
          <input
            type="color"
            value={newTeam.color}
            onChange={(e) => setNewTeam((t) => ({ ...t, color: e.target.value }))}
            style={{ width: '40px', height: '38px', borderRadius: '8px', border: '1.5px solid #e5e7eb', cursor: 'pointer', padding: '2px' }}
          />
          <Btn
            onClick={() =>
              call(() => api.addTeam(newTeam.name.trim(), newTeam.color)).then(() =>
                setNewTeam({ name: '', color: '#2563eb' }),
              )
            }
            disabled={!newTeam.name.trim() || loading}
          >
            Добавить
          </Btn>
        </div>
      </div>

      {state.teams.map((team) => (
        <div
          key={team.id}
          style={{ border: `2px solid ${team.color}`, borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          {editTeam?.id === team.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  value={editTeam.name ?? ''}
                  onChange={(e) => setEditTeam((t) => t && { ...t, name: e.target.value })}
                  placeholder="Название"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="color"
                  value={editTeam.color ?? '#2563eb'}
                  onChange={(e) => setEditTeam((t) => t && { ...t, color: e.target.value })}
                  style={{ width: '40px', height: '38px', borderRadius: '8px', border: '1.5px solid #e5e7eb', cursor: 'pointer', padding: '2px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Btn
                  onClick={() =>
                    call(() => api.updateTeam(team.id, { name: editTeam.name, color: editTeam.color })).then(
                      () => setEditTeam(null),
                    )
                  }
                  disabled={loading}
                  small
                >
                  Сохранить
                </Btn>
                <Btn onClick={() => setEditTeam(null)} color='#6b7280' small>Отмена</Btn>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '16px', color: team.color }}>{team.name}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Btn
                  onClick={() => setEditTeam({ id: team.id, name: team.name, color: team.color })}
                  color='#6b7280'
                  small
                >
                  Изменить
                </Btn>
                <Btn onClick={() => call(() => api.deleteTeam(team.id))} color='#cb4d4d' disabled={loading} small>
                  Удалить
                </Btn>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>Счёт:</span>
            <span style={{ fontFamily: 'Unbounded', fontSize: '20px', fontWeight: 700 }}>{team.score}</span>
            <input
              type="number"
              value={scoreInput[team.id] ?? ''}
              onChange={(e) => setScoreInput((s) => ({ ...s, [team.id]: e.target.value }))}
              placeholder="Новый счёт"
              style={{ ...inputStyle, width: '110px' }}
            />
            <Btn
              onClick={() => {
                const val = Number(scoreInput[team.id]);
                if (isNaN(val)) return;
                call(() => api.updateTeam(team.id, { score: val })).then(() =>
                  setScoreInput((s) => ({ ...s, [team.id]: '' })),
                );
              }}
              disabled={!scoreInput[team.id] || loading}
              small
            >
              Установить
            </Btn>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Login + shell ---

const AdminView = () => {
  const [password, setPassword] = useState(() => localStorage.getItem('quizAdminPassword') ?? '');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState<'game' | 'rounds' | 'teams'>('game');

  const api = buildAdminApi(password);

  const handleLogin = async () => {
    setAuthError('');
    try {
      const res = await api.checkAuth();
      if (res.ok) {
        setAuthed(true);
        localStorage.setItem('quizAdminPassword', password);
      } else {
        setAuthError('Неверный пароль');
      }
    } catch {
      setAuthError('Не удалось связаться с сервером');
    }
  };

  useEffect(() => {
    if (password && !authed) {
      api.checkAuth().then((res) => { if (res.ok) setAuthed(true); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authed) {
    return (
      <div style={{ padding: '24px', width: '400px', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Unbounded', fontSize: '20px', marginBottom: '24px', color: '#081520' }}>
          Вход для администратора
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            style={inputStyle}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <ErrorMsg msg={authError} />
          <Btn onClick={handleLogin} disabled={!password}>Войти</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Unbounded', fontSize: '20px', color: '#081520', margin: 0 }}>Администратор</h2>
        <button
          onClick={() => { setAuthed(false); localStorage.removeItem('quizAdminPassword'); }}
          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}
        >
          Выйти
        </button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
        {(['game', 'rounds', 'teams'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? '#eff6ff' : 'none',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 20px',
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? '#2563eb' : '#6b7280',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {{ game: 'Игра', rounds: 'Раунды', teams: 'Команды' }[t]}
          </button>
        ))}
      </div>

      {tab === 'game' && <GameTab api={api} />}
      {tab === 'rounds' && <RoundsTab api={api} />}
      {tab === 'teams' && <TeamsTab api={api} />}
    </div>
  );
};

export default AdminView;
