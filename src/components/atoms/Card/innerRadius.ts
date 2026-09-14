import { createContext, useContext } from "react";
import { controlRadius } from "../../../styles/tokens";

/**
 * The radius a container demands of whatever touches its corners — its own
 * radius minus its padding. Cards publish it, `Inset` re-publishes a smaller
 * one, and anything that has to round itself to fit reads it from here.
 */
const InnerRadiusContext = createContext<string | null>(null);

/** The corner radius required at this point in the tree. */
const useInnerRadius = (): string =>
  useContext(InnerRadiusContext) ?? controlRadius.md;

export { InnerRadiusContext, useInnerRadius };
