import { Transform } from './Transform';
import { Rect } from './Rect';
import { Line } from './Line';
import { Oval } from './Oval';
import { Triangle } from './Triangle';
import { QuadraticBezier } from './QuadraticBezier';
import { CubicBezier } from './CubicBezier';
import { PathBezier } from './PathBezier';
import { type Shape } from './Shape';

function transformFromJSON(t: any): Transform {
  return new Transform({
    x: t?.x ?? 0,
    y: t?.y ?? 0,
    rotation: t?.rotation ?? 0,
    scaleX: t?.scaleX ?? 1,
    scaleY: t?.scaleY ?? 1,
  });
}

function styleFromJSON(s: any): any {
  return {
    fillStyle:    s?.fillStyle    ?? { r: 0, g: 0, b: 0, a: 255 },
    fillOpacity:  s?.fillOpacity  ?? 1,
    strokeStyle:  s?.strokeStyle  ?? { r: 0, g: 0, b: 0, a: 255 },
    strokeWidth:  s?.strokeWidth  ?? 1,
    strokeOpacity: s?.strokeOpacity ?? 1,
  };
}

export function shapeFromJSON(data: any): Shape | null {
  if (!data || !data.type) return null;

  const transform = transformFromJSON(data.transform);
  const style = styleFromJSON(data.style);

  switch (data.type) {

    case 'rect':
      // width и height — размеры прямоугольника в локальных единицах
      return new Rect(
        data.id,
        data.width,
        data.height,
        transform,
        style
      );

    case 'line':
      // x1/y1, x2/y2 — концы линии в локальных координатах
      return new Line(
        data.id,
        data.x1,
        data.y1,
        data.x2,
        data.y2,
        transform,
        style
      );

    case 'oval':
      // rx, ry — радиусы эллипса
      return new Oval(
        data.id,
        data.rx,
        data.ry,
        transform,
        style
      );

    case 'triangle': {
      const [v1, v2, v3] = data.vertices;
      const tri = new Triangle(data.id, v1, v2, v3, undefined, style);
      tri.transform = transform;
      return tri;
    }

    case 'quadraticBezier':
      return new QuadraticBezier(
        data.id,
        data.p0,
        data.p1,
        data.p2,
        transform,
        style
      );

    case 'cubicBezier':
      return new CubicBezier(
        data.id,
        data.p0,
        data.p1,
        data.p2,
        data.p3,
        transform,
        style
      );

    case 'pathBezier':
      return new PathBezier(
        data.id,
        data.points,
        data.pathType ?? 'polyline',
        data.closed ?? false,
        transform,
        style
      );

    default:
      console.warn(`shapeFromJSON: неизвестный тип фигуры "${data.type}", пропускаем`);
      return null;
  }
}