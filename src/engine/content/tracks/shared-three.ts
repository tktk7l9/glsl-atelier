// Helpers shared by two or more Three.js scene tracks. Each track module
// imports what it uses.

/** The sandbox clear colour (#05060d) as the validators see it. */
export const BACKGROUND: [number, number, number] = [0.02, 0.024, 0.051];

export const SKY_BLUE: [number, number, number] = [0.68, 0.85, 0.9];

/** Mid-grey: MeshNormalMaterial writes normal * 0.5 + 0.5 for a unit normal,
 *  so every colour it draws is exactly 0.5 away from this. */
export const NORMAL_COLOURED: [number, number, number] = [0.5, 0.5, 0.5];
