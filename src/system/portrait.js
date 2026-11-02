/**
 * Portrait panel data: level, profession and the stat blocks (HP, PP, DB).
 */

/**
 * @param {Actor} actor
 * @returns {{level: number|undefined, profession: string|undefined, hp: {value: number, max: number}, pp: {value: number, max: number}, db: number}}
 */
export function getPortraitData(actor) {
    const sys = actor?.system ?? {};
    const hp = sys.health?.hp ?? {};
    const pp = sys.health?.power ?? {};
    return {
        level: sys.experience?.level,
        profession: sys._header?._professionName,
        hp: { value: Number(hp.value ?? 0), max: Number(hp.max ?? 0) },
        pp: { value: Number(pp.value ?? 0), max: Number(pp.max ?? 0) },
        db: Number(sys._dbBlock?.totalDB ?? 0),
    };
}
