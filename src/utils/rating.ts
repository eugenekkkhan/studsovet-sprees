/** Минимум, по которому раздаются места: остальное в профиле на них не влияет. */
export interface RatedParticipant {
  userId: number;
  name: string;
  rating?: number;
}

/**
 * Места по всему рейтингу, а не по тому, что видно на экране: фильтр таблицы и
 * её сортировка менять их не должны.
 *
 * Равный рейтинг — равное место, а следующий за группой сдвигается на её
 * размер: 1, 2, 2, 4. Место тогда читается как «сколько человек строго выше»,
 * и два одинаковых результата не приходится разводить по алфавиту.
 */
export const ratingPlaces = (participants: RatedParticipant[]) => {
  const ranked = [...participants].sort((left, right) =>
    (right.rating ?? 0) - (left.rating ?? 0) || left.name.localeCompare(right.name, "ru"));
  const places = new Map<number, number>();
  let place = 0;
  let previous: number | null = null;

  ranked.forEach((participant, index) => {
    const rating = participant.rating ?? 0;
    if (rating !== previous) {
      place = index + 1;
      previous = rating;
    }
    places.set(participant.userId, place);
  });

  return places;
};
