export function projectPaper(p, camera) {
    const scale = camera.distance / (camera.distance - p.z);
    return { x: camera.x + (p.x - camera.x) * scale, y: camera.y + (p.y - camera.y) * scale };
}
/** A whole leaf bows around a vertical cylinder while hinging at the binding.
 * Both horizontal edges follow the same arc; no diagonal crease or flat flap.
 * Arc length is the original page width, so the paper itself never stretches.
 */
export function paperFrame(rect, side, progress, corner, clipped, strips = 48, rows = 10) {
    const t = Math.max(0, Math.min(1, progress)), bend = Math.sin(Math.PI * t);
    // The hand changes the fullness of the bow, not the binding's direction.
    const arc = 1.9 * bend * (1 + .08 * Math.max(-1, Math.min(1, corner)));
    const angle = Math.PI * t - arc / 2, radius = arc > 1e-7 ? rect.w / arc : 0;
    const spine = side > 0 ? rect.x : rect.x + rect.w;
    // An elevated viewpoint lets lifted paper hang towards the reader, as in
    // the reference drawing. A longer lens keeps its apparent size close to the
    // resting page; z=0 remains pixel-aligned with the original layout.
    const camera = { x: clipped ? rect.x + rect.w / 2 : spine, y: rect.y - rect.h * 3.2, distance: Math.max(rect.w * 18, rect.h * 16) };
    const points = [];
    for (let col = 0; col <= strips; col++) {
        const u = col / strips, q = u * rect.w, column = [];
        const n = t === 0 ? q : t === 1 ? -q : radius ? radius * (Math.sin(angle + arc * u) - Math.sin(angle)) : q * Math.cos(Math.PI * t);
        const z = t === 0 || t === 1 ? 0 : radius ? Math.max(0, radius * (Math.cos(angle) - Math.cos(angle + arc * u))) : q * Math.sin(Math.PI * t);
        for (let row = 0; row <= rows; row++)
            column.push({ x: spine + side * n, y: rect.y + row / rows * rect.h, z });
        points.push(column);
    }
    // radius is a physical radius; fold records the attached binding position.
    return { points, camera, fold: 0, radius, tilt: 0 };
}
export function paperNormal(a, b, c, d, side) {
    const u = { x: (b.x - a.x + c.x - d.x) / 2, y: (b.y - a.y + c.y - d.y) / 2, z: (b.z - a.z + c.z - d.z) / 2 };
    const v = { x: (d.x - a.x + c.x - b.x) / 2, y: (d.y - a.y + c.y - b.y) / 2, z: (d.z - a.z + c.z - b.z) / 2 };
    const x = (u.y * v.z - u.z * v.y) * side, y = (u.z * v.x - u.x * v.z) * side, z = (u.x * v.y - u.y * v.x) * side;
    const length = Math.hypot(x, y, z) || 1;
    return { x: x / length, y: y / length, z: z / length };
}
export function paperFacing(normal, center, camera) {
    return normal.x * (camera.x - center.x) + normal.y * (camera.y - center.y) + normal.z * (camera.distance - center.z);
}
/** Fixed light above-left, projected onto the same z=0 receiving book plane. */
export function paperShadow(p) { return { x: p.x + p.z * .48, y: p.y + p.z * .32 }; }
export function shadowHull(points) {
    const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const half = (list) => { const out = []; for (const p of list) {
        while (out.length > 1 && cross(out[out.length - 2], out[out.length - 1], p) <= 0)
            out.pop();
        out.push(p);
    } return out; };
    const lower = half(sorted), upper = half(sorted.slice().reverse());
    lower.pop();
    upper.pop();
    return [...lower, ...upper].flatMap(p => [p.x, p.y]);
}
