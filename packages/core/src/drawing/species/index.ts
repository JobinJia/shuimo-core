import { drawLotus } from "./lotus";

export type SpeciesDrawOpts = {
  xof: number;
  yof: number;
  fast: boolean;
};

export type SpeciesDraw = (
  ctx: CanvasRenderingContext2D,
  opts: SpeciesDrawOpts,
) => void;

export type SpeciesName = "lotus";

export const SPECIES: Record<SpeciesName, SpeciesDraw> = {
  lotus: drawLotus,
};
