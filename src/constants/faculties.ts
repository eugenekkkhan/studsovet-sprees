export const facultyLabels = {
  ggt: "ГГиТ — географии, геоэкологии и туризма",
  geol: "Геолфак — геологический",
  jour: "Журфак — журналистики",
  hist: "Истфак — исторический",
  cs: "ФКН — компьютерных наук",
  math: "Матфак — математический",
  bio: "МБФ — медико-биологический",
  ir: "ФМО — международных отношений",
  amm: "ПММ — прикладной математики, информатики и механики",
  rgf: "РГФ — романо-германской филологии",
  pharm: "Фармфак — фармацевтический",
  phys: "Физфак — физический",
  phil: "Филфак — филологический",
  phipsy: "ФиПси — философии и психологии",
  chem: "Химфак — химический",
  econ: "Экономфак — экономический",
  law: "Юрфак — юридический",
} as const;

export type Faculty = keyof typeof facultyLabels;

export const facultyShortLabels: Record<Faculty, string> = Object.fromEntries(
  Object.entries(facultyLabels).map(([key, label]) => [key, label.split(" — ")[0]]),
) as Record<Faculty, string>;
