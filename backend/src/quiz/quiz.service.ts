import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GameState, Team, Round, Category, Question } from './types';

@Injectable()
export class QuizService {
  private state: GameState = {
    rounds: [],
    activeRoundId: null,
    activeQuestion: null,
    teams: [],
    phase: 'lobby',
  };

  private captainSessions = new Map<string, string>(); // socketId -> teamId

  getState(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  // --- Teams ---

  addTeam(name: string, color: string): Team {
    const team: Team = { id: randomUUID(), name, score: 0, color };
    this.state.teams.push(team);
    return team;
  }

  updateTeam(
    id: string,
    updates: Partial<Pick<Team, 'name' | 'color' | 'score'>>,
  ): Team | null {
    const team = this.state.teams.find((t) => t.id === id);
    if (!team) return null;
    Object.assign(team, updates);
    return team;
  }

  deleteTeam(id: string): boolean {
    const idx = this.state.teams.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.state.teams.splice(idx, 1);
    return true;
  }

  // --- Rounds ---

  addRound(name: string): Round {
    const round: Round = { id: randomUUID(), name, categories: [] };
    this.state.rounds.push(round);
    return round;
  }

  updateRound(id: string, name: string): Round | null {
    const round = this.state.rounds.find((r) => r.id === id);
    if (!round) return null;
    round.name = name;
    return round;
  }

  deleteRound(id: string): { success: boolean; error?: string } {
    const round = this.state.rounds.find((r) => r.id === id);
    if (!round) return { success: false, error: 'Round not found' };
    if (this.state.activeRoundId === id)
      return { success: false, error: 'Cannot delete active round' };
    if (round.categories.some((c) => c.questions.some((q) => q.isOpened)))
      return { success: false, error: 'Cannot delete round with opened questions' };
    this.state.rounds = this.state.rounds.filter((r) => r.id !== id);
    return { success: true };
  }

  // --- Categories ---

  addCategory(roundId: string, name: string): Category | null {
    const round = this.state.rounds.find((r) => r.id === roundId);
    if (!round) return null;
    const category: Category = { id: randomUUID(), name, questions: [] };
    round.categories.push(category);
    return category;
  }

  updateCategory(
    id: string,
    name: string,
  ): { success: boolean; error?: string; category?: Category } {
    for (const round of this.state.rounds) {
      const cat = round.categories.find((c) => c.id === id);
      if (cat) {
        cat.name = name;
        return { success: true, category: cat };
      }
    }
    return { success: false, error: 'Category not found' };
  }

  deleteCategory(id: string): { success: boolean; error?: string } {
    for (const round of this.state.rounds) {
      const idx = round.categories.findIndex((c) => c.id === id);
      if (idx !== -1) {
        if (round.categories[idx].questions.some((q) => q.isOpened))
          return { success: false, error: 'Category has opened questions and is immutable' };
        round.categories.splice(idx, 1);
        return { success: true };
      }
    }
    return { success: false, error: 'Category not found' };
  }

  // --- Questions ---

  addQuestion(
    categoryId: string,
    text: string,
    answer: string,
    points: number,
    mediaUrl?: string,
    mediaType?: 'image' | 'audio',
    answerMediaUrl?: string,
    answerMediaType?: 'image' | 'audio',
  ): Question | null {
    const cat = this.findCategory(categoryId);
    if (!cat) return null;
    const question: Question = {
      id: randomUUID(),
      text,
      answer,
      points,
      isOpened: false,
      winnerId: null,
      mediaUrl,
      mediaType,
      answerMediaUrl,
      answerMediaType,
    };
    cat.questions.push(question);
    return question;
  }

  updateQuestion(
    id: string,
    updates: Partial<Pick<Question, 'text' | 'answer' | 'points'>> & {
      mediaUrl?: string | null;
      mediaType?: 'image' | 'audio' | null;
      answerMediaUrl?: string | null;
      answerMediaType?: 'image' | 'audio' | null;
    },
  ): { success: boolean; error?: string; question?: Question } {
    const found = this.findQuestion(id);
    if (!found) return { success: false, error: 'Question not found' };
    if (found.question.isOpened)
      return { success: false, error: 'Question is already opened and immutable' };
    const { mediaUrl, mediaType, answerMediaUrl, answerMediaType, ...rest } = updates;
    Object.assign(found.question, rest);
    if ('mediaUrl' in updates) found.question.mediaUrl = mediaUrl ?? undefined;
    if ('mediaType' in updates) found.question.mediaType = mediaType ?? undefined;
    if ('answerMediaUrl' in updates) found.question.answerMediaUrl = answerMediaUrl ?? undefined;
    if ('answerMediaType' in updates) found.question.answerMediaType = answerMediaType ?? undefined;
    return { success: true, question: found.question };
  }

  deleteQuestion(id: string): { success: boolean; error?: string } {
    for (const round of this.state.rounds) {
      for (const cat of round.categories) {
        const idx = cat.questions.findIndex((q) => q.id === id);
        if (idx !== -1) {
          if (cat.questions[idx].isOpened)
            return { success: false, error: 'Question is already opened and immutable' };
          cat.questions.splice(idx, 1);
          return { success: true };
        }
      }
    }
    return { success: false, error: 'Question not found' };
  }

  // --- Game control ---

  startRound(roundId: string): { success: boolean; error?: string } {
    const round = this.state.rounds.find((r) => r.id === roundId);
    if (!round) return { success: false, error: 'Round not found' };
    this.state.activeRoundId = roundId;
    this.state.activeQuestion = null;
    this.state.phase = 'board';
    return { success: true };
  }

  openQuestion(questionId: string): { success: boolean; error?: string } {
    if (!this.state.activeRoundId)
      return { success: false, error: 'No active round' };
    const found = this.findQuestion(questionId);
    if (!found) return { success: false, error: 'Question not found' };

    const activeRound = this.state.rounds.find((r) => r.id === this.state.activeRoundId);
    if (!activeRound?.categories.find((c) => c.id === found.category.id))
      return { success: false, error: 'Question not in active round' };

    if (found.question.isOpened) return { success: false, error: 'Question already opened' };

    found.question.isOpened = true;
    this.state.activeQuestion = {
      questionId: found.question.id,
      categoryId: found.category.id,
      categoryName: found.category.name,
      question: found.question.text,
      answer: found.question.answer,
      points: found.question.points,
      currentAnswererId: null,
      answeredTeamIds: [],
      mediaUrl: found.question.mediaUrl,
      mediaType: found.question.mediaType,
      answerMediaUrl: found.question.answerMediaUrl,
      answerMediaType: found.question.answerMediaType,
    };
    this.state.phase = 'question';
    return { success: true };
  }

  buzz(teamId: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'question')
      return { success: false, error: 'Not in question phase' };
    if (!this.state.activeQuestion)
      return { success: false, error: 'No active question' };
    const team = this.state.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: 'Team not found' };
    if (this.state.activeQuestion.answeredTeamIds.includes(teamId))
      return { success: false, error: 'Team already answered' };
    if (this.state.activeQuestion.currentAnswererId !== null)
      return { success: false, error: 'Another team is already answering' };

    this.state.activeQuestion.currentAnswererId = teamId;
    this.state.phase = 'answering';
    return { success: true };
  }

  judgeAnswer(correct: boolean): { success: boolean; error?: string } {
    if (this.state.phase !== 'answering')
      return { success: false, error: 'Not in answering phase' };
    if (!this.state.activeQuestion)
      return { success: false, error: 'No active question' };

    const { currentAnswererId, questionId, points } = this.state.activeQuestion;
    if (!currentAnswererId) return { success: false, error: 'No current answerer' };

    if (correct) {
      const team = this.state.teams.find((t) => t.id === currentAnswererId);
      if (team) team.score += points;
      const found = this.findQuestion(questionId);
      if (found) found.question.winnerId = currentAnswererId;
      this.state.activeQuestion = null;
      this.state.phase = 'board';
    } else {
      this.state.activeQuestion.answeredTeamIds.push(currentAnswererId);
      this.state.activeQuestion.currentAnswererId = null;

      const remaining = this.state.teams.filter(
        (t) => !this.state.activeQuestion!.answeredTeamIds.includes(t.id),
      );
      if (remaining.length === 0) {
        this.state.activeQuestion = null;
        this.state.phase = 'board';
      } else {
        this.state.phase = 'question';
      }
    }

    return { success: true };
  }

  skipQuestion(): { success: boolean; error?: string } {
    if (!this.state.activeQuestion)
      return { success: false, error: 'No active question' };
    this.state.activeQuestion = null;
    this.state.phase = 'board';
    return { success: true };
  }

  endRound(): void {
    this.state.activeRoundId = null;
    this.state.activeQuestion = null;
    this.state.phase = 'lobby';
  }

  private findCategory(categoryId: string): Category | undefined {
    for (const round of this.state.rounds) {
      const cat = round.categories.find((c) => c.id === categoryId);
      if (cat) return cat;
    }
    return undefined;
  }

  private findQuestion(questionId: string): { question: Question; category: Category } | null {
    for (const round of this.state.rounds) {
      for (const cat of round.categories) {
        const q = cat.questions.find((q) => q.id === questionId);
        if (q) return { question: q, category: cat };
      }
    }
    return null;
  }

  // --- Captain sessions ---

  registerCaptain(socketId: string, teamId: string): { success: boolean; error?: string } {
    const team = this.state.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: 'Team not found' };
    for (const [sid, tid] of this.captainSessions.entries()) {
      if (tid === teamId && sid !== socketId)
        return { success: false, error: 'Team already has a captain logged in' };
    }
    this.captainSessions.set(socketId, teamId);
    return { success: true };
  }

  unregisterCaptain(socketId: string): void {
    this.captainSessions.delete(socketId);
  }

  getCaptainTeamId(socketId: string): string | null {
    return this.captainSessions.get(socketId) ?? null;
  }
}
