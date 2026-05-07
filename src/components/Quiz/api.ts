const API_BASE = 'http://localhost:3000/quiz';

const authHeader = (password: string) => ({
  Authorization: `Basic ${btoa(`admin:${password}`)}`,
  'Content-Type': 'application/json',
});

const authOnlyHeader = (password: string) => ({
  Authorization: `Basic ${btoa(`admin:${password}`)}`,
});

export const buildAdminApi = (password: string) => {
  const h = () => authHeader(password);
  const ho = () => authOnlyHeader(password);

  const post = (path: string, body?: object) =>
    fetch(`${API_BASE}/${path}`, {
      method: 'POST',
      headers: h(),
      body: body ? JSON.stringify(body) : undefined,
    });

  const put = (path: string, body: object) =>
    fetch(`${API_BASE}/${path}`, {
      method: 'PUT',
      headers: h(),
      body: JSON.stringify(body),
    });

  const del = (path: string) =>
    fetch(`${API_BASE}/${path}`, { method: 'DELETE', headers: h() });

  return {
    checkAuth: () => post('admin/auth'),

    uploadMedia: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch(`${API_BASE}/admin/upload`, {
        method: 'POST',
        headers: ho(),
        body: formData,
      });
    },

    addTeam: (name: string, color: string) =>
      post('admin/teams', { name, color }),
    updateTeam: (id: string, updates: object) =>
      put(`admin/teams/${id}`, updates),
    deleteTeam: (id: string) => del(`admin/teams/${id}`),

    addRound: (name: string) => post('admin/rounds', { name }),
    updateRound: (id: string, name: string) =>
      put(`admin/rounds/${id}`, { name }),
    deleteRound: (id: string) => del(`admin/rounds/${id}`),

    addCategory: (roundId: string, name: string) =>
      post(`admin/rounds/${roundId}/categories`, { name }),
    updateCategory: (id: string, name: string) =>
      put(`admin/categories/${id}`, { name }),
    deleteCategory: (id: string) => del(`admin/categories/${id}`),

    addQuestion: (
      categoryId: string,
      text: string,
      answer: string,
      points: number,
      mediaUrl?: string | null,
      mediaType?: 'image' | 'audio' | null,
      answerMediaUrl?: string | null,
      answerMediaType?: 'image' | 'audio' | null,
    ) => post(`admin/categories/${categoryId}/questions`, { text, answer, points, mediaUrl, mediaType, answerMediaUrl, answerMediaType }),
    updateQuestion: (id: string, updates: object) =>
      put(`admin/questions/${id}`, updates),
    deleteQuestion: (id: string) => del(`admin/questions/${id}`),

    startRound: (roundId: string) =>
      post('admin/game/start-round', { roundId }),
    openQuestion: (questionId: string) =>
      post('admin/game/open-question', { questionId }),
    judgeAnswer: (correct: boolean) =>
      post('admin/game/judge', { correct }),
    skipQuestion: () => post('admin/game/skip'),
    endRound: () => post('admin/game/end-round'),
  };
};

export type AdminApi = ReturnType<typeof buildAdminApi>;
