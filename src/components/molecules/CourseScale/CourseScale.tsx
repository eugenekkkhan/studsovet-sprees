import type { EducationLevel } from "../../../api/participantsApi";
import { cn } from "cn";

export const educationLabels: Record<EducationLevel, string> = {
  bachelor: "Бакалавриат",
  master: "Магистратура",
  postgraduate: "Аспирантура",
  specialist: "Специалитет",
};

export const educationCourseLimits: Record<EducationLevel, number> = {
  bachelor: 4,
  master: 2,
  postgraduate: 4,
  specialist: 6,
};

const colors: Record<EducationLevel, string> = {
  bachelor: "bg-primary",
  master: "bg-success",
  postgraduate: "bg-warning",
  specialist: "bg-danger",
};

interface CourseScaleProps {
  level: EducationLevel | null;
  course: number | null;
}

export const CourseScale = ({ level, course }: CourseScaleProps) => {
  if (!level) return <span className="text-muted-foreground">—</span>;
  const limit = educationCourseLimits[level];
  return (
    <div className="min-w-[112px]" title={`${educationLabels[level]}, ${course ? `${course} курс` : "курс не указан"}`}>
      <div className="mb-1 text-xs whitespace-nowrap text-muted-foreground">
        {educationLabels[level]}{course ? ` · ${course}` : ""}
      </div>
      <div className="flex gap-1" aria-label={course ? `Курс ${course} из ${limit}` : "Курс не указан"}>
        {Array.from({ length: limit }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-2 flex-1 rounded-pill",
              course && index < course ? colors[level] : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
};
