import type { Sector } from './types';

export const FORTUNE_SECTORS: readonly Sector[] = [
  { id: 'sector-0', label: '0', type: 'lose-turn' },
  { id: 'sector-1', label: '+500', type: 'points', value: 500 },
  { id: 'sector-2', label: '+100', type: 'points', value: 100 },
  { id: 'sector-3', label: '+100', type: 'points', value: 100 },
  { id: 'sector-4', label: '+400', type: 'points', value: 400 },
  { id: 'sector-5', label: '+200', type: 'points', value: 200 },
  { id: 'sector-6', label: '+300', type: 'points', value: 300 },
  { id: 'sector-7', label: '+200', type: 'points', value: 200 },
  { id: 'sector-8', label: '+400', type: 'points', value: 400 },
  { id: 'sector-9', label: '+300', type: 'points', value: 300 },
  { id: 'sector-10', label: 'Задание', type: 'task', value: 500 },
  { id: 'sector-11', label: '+500', type: 'points', value: 500 },
  { id: 'sector-12', label: '+1000', type: 'points', value: 1000 },
  { id: 'sector-13', label: 'Б', type: 'bankrupt' },
  { id: 'sector-14', label: 'Друг', type: 'friend' },
  { id: 'sector-15', label: '×2', type: 'double' },
  { id: 'sector-16', label: 'ПРИЗ', type: 'prize', value: 500 },
  { id: 'sector-17', label: '+', type: 'plus' },
];

export const getSector = (id: string | null) =>
  FORTUNE_SECTORS.find((sector) => sector.id === id) ?? null;
