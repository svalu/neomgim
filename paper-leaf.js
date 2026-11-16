import { paperFrame, projectPaper, paperNormal, paperFacing } from './curl-geometry.js';

// Overlap neighboring triangle clips slightly so subpixel edges do not reveal the background.
function overlapPolygon(points) {
  const [a, b, c] = points;
  const count = points.length;
  const winding = Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const normals = points.map((point, index) => {
    const next = points[(index + 1) % count];
    const dx = next.x - point.x, dy = next.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: winding * dy / length, y: -winding * dx / length };
  });
  return points.map((point, index) => {
    const previous = normals[(index + count - 1) % count], next = normals[index];
    const scale = .65 / Math.max(.28, 1 + previous.x * next.x + previous.y * next.y);
    return { x: point.x + (previous.x + next.x) * scale, y: point.y + (previous.y + next.y) * scale };
  });
}

function drawTriangle(ctx, image, shade, [u, v, w], [a, b, c]) {
  const denominator = u.x * (v.y - w.y) + v.x * (w.y - u.y) + w.x * (u.y - v.y);
  if (Math.abs(denominator) < 1e-6) return;
  const transform = (start, middle, end) => [
    (start * (v.y - w.y) + middle * (w.y - u.y) + end * (u.y - v.y)) / denominator,
    (start * (w.x - v.x) + middle * (u.x - w.x) + end * (v.x - u.x)) / denominator,
    (start * (v.x * w.y - w.x * v.y) + middle * (w.x * u.y - u.x * w.y) + end * (u.x * v.y - v.x * u.y)) / denominator,
  ];
  const [ax, bx, cx] = transform(a.x, b.x, c.x);
  const [ay, by, cy] = transform(a.y, b.y, c.y);

  ctx.save();
  path(ctx, overlapPolygon([a, b, c]));
  ctx.clip();
  ctx.save();
  ctx.transform(ax, ay, bx, by, cx, cy);
  ctx.drawImage(image, 0, 0, image.width, image.height);
  ctx.restore();
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.restore();
}

function path(ctx, points, close = true, offsetX = 0) {
  ctx.beginPath();
  ctx.moveTo(points[0].x + offsetX, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x + offsetX, point.y);
  if (close) ctx.closePath();
}

// An omitted verso is transparent. A null verso uses the splash paper color.
export function drawPaperLeaf(ctx, rect, side, progress, front, back, { clipped = false, strips = 32, rows = 6 } = {}) {
  const { points, camera } = paperFrame(rect, side, progress, 0, clipped, strips, rows);
  const bend = Math.sin(progress * Math.PI);
  const boundary = [...points.map(col => col[0]), ...points.slice().reverse().map(col => col[rows])];
  path(ctx, boundary.map(point => ({ x: point.x + point.z * .48, y: point.y + point.z * .32 })));
  ctx.fillStyle = `rgba(25,18,10,${.17 * bend})`;
  ctx.fill();

  const cells = [];
  let frontEdgeVisible = false;
  for (let col = 0; col < strips; col++) {
    for (let row = 0; row < rows; row++) {
      const a = points[col][row], b = points[col + 1][row];
      const c = points[col + 1][row + 1], d = points[col][row + 1];
      const normal = paperNormal(a, b, c, d, side);
      const center = { x: (a.x + b.x + c.x + d.x) / 4, y: (a.y + b.y + c.y + d.y) / 4, z: (a.z + b.z + c.z + d.z) / 4 };
      cells.push({ col, row, corners: [a, b, c, d], normal, center });
    }
  }

  cells.sort((a, b) => a.center.z - b.center.z);
  for (const { col, row, corners, normal, center } of cells) {
    const isBack = paperFacing(normal, center, camera) < 0;
    if (isBack && back === undefined) continue;
    if (!isBack && col === strips - 1) frontEdgeVisible = true;
    const image = isBack ? back : front;
    const lighting = Math.max(0, (isBack ? -1 : 1) * (-.3 * normal.x - .4 * normal.y + normal.z) / Math.sqrt(1.25));
    const darkness = bend * (.09 + .25 * (1 - lighting));
    const [a, b, c, d] = corners.map(point => projectPaper(point, camera));
    if (!image) {
      const outerEdge = Math.pow((col + .5) / strips, 8);
      const brightness = 1 - darkness * .8 - outerEdge * .12;
      ctx.fillStyle = `rgb(${105 * brightness},${71 * brightness},${47 * brightness})`;
      path(ctx, overlapPolygon([a, b, c, d]));
      ctx.fill();
      continue;
    }
    const mirror = isBack ? side > 0 : side < 0;
    const x = index => (mirror ? 1 - index / strips : index / strips) * image.width;
    const y = index => index / rows * image.height;
    const tl = { x: x(col), y: y(row) }, tr = { x: x(col + 1), y: y(row) };
    const bl = { x: x(col), y: y(row + 1) }, br = { x: x(col + 1), y: y(row + 1) };
    const shade = `rgba(36,27,19,${darkness})`;
    drawTriangle(ctx, image, shade, [tl, tr, br], [a, b, c]);
    drawTriangle(ctx, image, shade, [tl, br, bl], [a, c, d]);
  }

  if (back === undefined && !frontEdgeVisible) return;
  const edge = points.at(-1).map(point => projectPaper(point, camera));
  ctx.save();
  ctx.globalAlpha *= bend;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = back === null ? '#352218' : '#71563d';
  path(ctx, edge, false);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = back === null ? '#9a6e49' : '#f7e6c7';
  path(ctx, edge, false, -side * .6);
  ctx.stroke();
  ctx.restore();
}
