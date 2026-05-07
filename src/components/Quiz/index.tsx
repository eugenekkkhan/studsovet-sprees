import { useState } from 'react';
import { QuizProvider, useQuiz } from './QuizContext';
import BoardView from './BoardView';
import AdminView from './AdminView';
import CaptainView from './CaptainView';
import './Quiz.css';

type View = 'board' | 'admin' | 'captain';

const QuizInner = () => {
  const [view, setView] = useState<View>('board');
  const { connected } = useQuiz();

  return (
    <div className="quiz-wrapper">
      <nav className="quiz-nav">
        {(['board', 'admin', 'captain'] as View[]).map((v) => (
          <button
            key={v}
            className={`quiz-nav-btn${view === v ? ' active' : ''}`}
            onClick={() => setView(v)}
          >
            {{ board: 'Доска', admin: 'Администратор', captain: 'Капитан' }[v]}
          </button>
        ))}
        <span className={`quiz-connection ${connected ? 'ok' : 'err'}`} title={connected ? 'Подключено' : 'Нет соединения'}>
          ●
        </span>
      </nav>

      {view === 'board' && <BoardView />}
      {view === 'admin' && <AdminView />}
      {view === 'captain' && <CaptainView />}
    </div>
  );
};

const Quiz = () => (
  <QuizProvider>
    <QuizInner />
  </QuizProvider>
);

export default Quiz;
