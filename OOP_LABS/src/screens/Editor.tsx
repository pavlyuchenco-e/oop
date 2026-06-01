import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Triangle as TriangleIcon, Square, Circle, Pen, Move, GitBranch, Palette, ArrowLeft, Save, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { RasterRenderer, type RGBA, type LineAlg, hexToRGBA } from '../lib/raster/RasterRenderer';
import { Shape } from '../lib/geometry/Shape';
import { Rect } from '../lib/geometry/Rect';
import { Line } from '../lib/geometry/Line';
import { Oval } from '../lib/geometry/Oval';
import { Triangle } from '../lib/geometry/Triangle';
import { QuadraticBezier } from '../lib/geometry/QuadraticBezier';
import { CubicBezier } from '../lib/geometry/CubicBezier';
import { PathBezier } from '../lib/geometry/PathBezier';
import { Transform } from '../lib/geometry/Transform';

type InteractionMode = 'none' | 'move' | 'resize' | 'rotate' | 'editPoint';

interface ResizeHandle {
  cx: number;
  cy: number;
  type: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedTool, setSelectedTool] = useState('select');
  const [lineAlg, setLineAlg] = useState<LineAlg>('bresenham');
  const [color, setColor] = useState('#3b82f6');
  const [lineThickness, setLineThickness] = useState(1);

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const shapesRef = useRef<Shape[]>([]);
  const selectedShapeRef = useRef<Shape | null>(null);

  // Для рисования линии по двум кликам
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Для интерактивного взаимодействия
  const [interaction, setInteraction] = useState<InteractionMode>('none');
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedShapeJSON, setSelectedShapeJSON] = useState<string>('');

  const shapeStartRef = useRef<{
    transform: Transform;
    width?: number;
    height?: number;
    rx?: number;
    ry?: number;
    points?: { x: number; y: number }[];
    controlPointIndex?: number;
    startBounds?: Bounds;  // saved AABB at the moment drag started
    shapeClone?: Shape;    // full clone of shape at drag start (for resize after rotation)
  } | null>(null);
  const resizeHandleRef = useRef<string | null>(null);
  const initialAngleRef = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);

  // Навигация
  const goBack = () => navigate(-1);
  const saveAndGoHome = () => navigate('/', { replace: true });

  const tools = [
    { id: 'select', icon: Move, label: 'Выбор' },
    { id: 'rect', icon: Square, label: 'Прямоугольник' },
    { id: 'circle', icon: Circle, label: 'Круг' },
    { id: 'line', icon: Pen, label: 'Линия' },
    { id: 'triangle', icon: TriangleIcon, label: 'Треугольник' },
    { id: 'quadratic', icon: GitBranch, label: 'Квадр. Безье' },
    { id: 'cubic', icon: GitBranch, label: 'Куб. Безье' },
    { id: 'path', icon: GitBranch, label: 'Путь' },
  ];

      useEffect(() => {
    if (selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (shape && typeof shape.toJSON === 'function') {
        try {
          const json = shape.toJSON();
          setSelectedShapeJSON(JSON.stringify(json, null, 2));
        } catch (err) {
          setSelectedShapeJSON('Ошибка сериализации');
        }
      } else {
        setSelectedShapeJSON('Нет данных toJSON');
      }
    } else {
      setSelectedShapeJSON('');
    }
  }, [selectedShapeId, shapes]);

  // Синхронизация рефов
  useEffect(() => {
    shapesRef.current = shapes;
    setSelectedShapeId(prev => {
      if (prev && !shapes.some(s => s.id === prev)) return null;
      return prev;
    });
  }, [shapes]);

  useEffect(() => {
    selectedShapeRef.current = selectedShapeId ? shapes.find(s => s.id === selectedShapeId) || null : null;
  }, [selectedShapeId, shapes]);

  // Инициализация рендерера и цикла анимации
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new RasterRenderer(canvas);
    renderer.setLineAlgorithm(lineAlg);
    rendererRef.current = renderer;

    const resizeObserver = new ResizeObserver(() => renderer.resize());
    resizeObserver.observe(canvas);

    let animId: number;
    const frame = () => {
      renderer.beginFrame(true);
      drawScene(renderer);
      renderer.commit();
      animId = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setLineAlgorithm(lineAlg);
    }
  }, [lineAlg]);

  // Отрисовка сцены (фигуры + выделение + ручки + контрольные точки)
  function drawScene(r: RasterRenderer) {
    // Статические тестовые фигуры (оставляем для демонстрации)
    const red: RGBA = { r: 255, g: 0, b: 0, a: 255 };
    r.fillPolygon([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 200, y: 300 },
    ], red);

    const translucentBlue: RGBA = { r: 0, g: 100, b: 255, a: 200 };
    r.fillCircle(230, 150, 60, translucentBlue);

    const black: RGBA = { r: 0, g: 0, b: 0, a: 255 };
    r.strokePolygon([
      { x: 500, y: 100 },
      { x: 700, y: 100 },
      { x: 700, y: 300 },
      { x: 500, y: 300 },
    ], black, 6);

    const yellow: RGBA = { r: 255, g: 255, b: 0, a: 255 };
    r.drawLine(50, 400, 750, 550, yellow);

    // Рисуем все пользовательские фигуры
    for (const shape of shapesRef.current) {
      shape.drawRaster(r);
    }

    // Рисуем выделение и ручки, если есть выбранная фигура
    const selected = selectedShapeRef.current;
    if (selected) {
      const bounds = selected.getBounds();
      if (bounds) {
        // Рамка выделения
        r.strokePolygon([
          { x: bounds.minX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.maxY },
          { x: bounds.minX, y: bounds.maxY },
        ], { r: 0, g: 150, b: 255, a: 255 }, 2);

        // Ручки изменения размера (8 точек)
        const handles: ResizeHandle[] = [
          { cx: bounds.minX, cy: bounds.minY, type: 'nw' },
          { cx: (bounds.minX + bounds.maxX) / 2, cy: bounds.minY, type: 'n' },
          { cx: bounds.maxX, cy: bounds.minY, type: 'ne' },
          { cx: bounds.maxX, cy: (bounds.minY + bounds.maxY) / 2, type: 'e' },
          { cx: bounds.maxX, cy: bounds.maxY, type: 'se' },
          { cx: (bounds.minX + bounds.maxX) / 2, cy: bounds.maxY, type: 's' },
          { cx: bounds.minX, cy: bounds.maxY, type: 'sw' },
          { cx: bounds.minX, cy: (bounds.minY + bounds.maxY) / 2, type: 'w' },
        ];
        for (const h of handles) {
          r.fillCircle(h.cx, h.cy, 5, { r: 255, g: 255, b: 255, a: 255 });
          r.strokeCircle(h.cx, h.cy, 5, { r: 0, g: 0, b: 0, a: 255 }, 1);
        }

        // Ручка поворота (сверху над рамкой)
        const rotateX = (bounds.minX + bounds.maxX) / 2;
        const rotateY = bounds.minY - 20;
        r.fillCircle(rotateX, rotateY, 6, { r: 255, g: 200, b: 0, a: 255 });
        r.strokeCircle(rotateX, rotateY, 6, { r: 0, g: 0, b: 0, a: 255 }, 1);
        r.drawLine(rotateX, rotateY, (bounds.minX + bounds.maxX) / 2, bounds.minY, { r: 255, g: 200, b: 0, a: 255 });
      }

      // Контрольные точки для кривых
      if ('getControlPoints' in selected && typeof (selected as any).getControlPoints === 'function') {
        const points = (selected as any).getControlPoints();
        if (points && points.length) {
          for (let i = 0; i < points.length; i++) {
            const wp = selected.transformPointToDevice(points[i].x, points[i].y);
            r.fillCircle(wp.x, wp.y, 5, { r: 255, g: 100, b: 100, a: 255 });
            r.strokeCircle(wp.x, wp.y, 5, { r: 0, g: 0, b: 0, a: 255 }, 1);
          }
        }
      }
    }

    // Предпросмотр резиновой линии для инструмента "Линия"
    if (selectedTool === 'line' && lineStart && mousePos) {
      const previewColor = hexToRGBA(color, 150);
      if (lineThickness <= 1) {
        r.drawLine(lineStart.x, lineStart.y, mousePos.x, mousePos.y, previewColor);
      } else {
        r.strokeLine(lineStart.x, lineStart.y, mousePos.x, mousePos.y, previewColor, lineThickness);
      }
    }
  }

  // Преобразование CSS → физические координаты
  function getDeviceCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const renderer = rendererRef.current;
    if (!renderer) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const dpr = renderer.dpr;
    return {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
    };
  }

  // Поиск фигуры под курсором (с верхнего слоя)
  function findShapeAt(x: number, y: number): Shape | null {
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const shape = shapesRef.current[i];
      if (shape.hitTest(x, y)) return shape;
    }
    return null;
  }

  // Поиск ручки изменения размера
  function findResizeHandle(x: number, y: number, bounds: any): { type: string } | null {
    const handles = [
      { cx: bounds.minX, cy: bounds.minY, type: 'nw' },
      { cx: (bounds.minX + bounds.maxX) / 2, cy: bounds.minY, type: 'n' },
      { cx: bounds.maxX, cy: bounds.minY, type: 'ne' },
      { cx: bounds.maxX, cy: (bounds.minY + bounds.maxY) / 2, type: 'e' }, // was bounds.maxX (typo)
      { cx: bounds.maxX, cy: bounds.maxY, type: 'se' },
      { cx: (bounds.minX + bounds.maxX) / 2, cy: bounds.maxY, type: 's' },
      { cx: bounds.minX, cy: bounds.maxY, type: 'sw' },
      { cx: bounds.minX, cy: (bounds.minY + bounds.maxY) / 2, type: 'w' },
    ];
    const hitRadius = Math.max(8, (rendererRef.current?.dpr ?? 1) * 6);
    for (const h of handles) {
      const dx = h.cx - x;
      const dy = h.cy - y;
      if (Math.hypot(dx, dy) < hitRadius) return h;
    }
    return null;
  }

  // Поиск контрольной точки
  function findControlPoint(x: number, y: number, shape: Shape): { index: number } | null {
    if ('getControlPoints' in shape && typeof (shape as any).getControlPoints === 'function') {
      const points = (shape as any).getControlPoints();
      for (let i = 0; i < points.length; i++) {
        const wp = shape.transformPointToDevice(points[i].x, points[i].y);
        const dx = wp.x - x;
        const dy = wp.y - y;
        if (Math.hypot(dx, dy) < 8) return { index: i };
      }
    }
    return null;
  }

  // Поиск ручки поворота
  function findRotateHandle(x: number, y: number, bounds: any): boolean {
    const rx = (bounds.minX + bounds.maxX) / 2;
    const ry = bounds.minY - 20;
    return Math.hypot(rx - x, ry - y) < 8;
  }

  // Начало взаимодействия
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getDeviceCoords(e);
    if (!coords) return;
    const { x, y } = coords;

    // Если выбран инструмент "Выбор" (select) – взаимодействие с объектами
    if (selectedTool === 'select') {
      const selected = selectedShapeRef.current;
      if (selected) {
        const bounds = selected.getBounds();
        if (bounds) {
          // Проверяем ручку поворота
          if (findRotateHandle(x, y, bounds)) {
            setInteraction('rotate');
            dragStartRef.current = { x, y };
            shapeStartRef.current = {
              transform: selected.transform.clone(),
            };
            const center = selected.getCenter();
            initialAngleRef.current = Math.atan2(y - center.y, x - center.x);
            return;
          }
          // Проверяем ручки изменения размера
          const handle = findResizeHandle(x, y, bounds);
          if (handle) {
            setInteraction('resize');
            dragStartRef.current = { x, y };
            resizeHandleRef.current = handle.type;
            shapeStartRef.current = {
              transform: selected.transform.clone(),
              width: (selected as any).width,
              height: (selected as any).height,
              rx: (selected as any).rx,
              ry: (selected as any).ry,
              startBounds: { ...bounds },
              shapeClone: selected.clone(),
            };
            return;
          }
          // Проверяем контрольные точки
          const cp = findControlPoint(x, y, selected);
          if (cp) {
            setInteraction('editPoint');
            dragStartRef.current = { x, y };
            shapeStartRef.current = {
                transform: selected.transform.clone(),
                controlPointIndex: cp.index,
                points: 'getControlPoints' in selected 
                    ? (selected as any).getControlPoints().map((p: { x: number; y: number }) => ({ ...p }))
                    : [],
            };
            return;
        }
        }
        // Проверяем попадание в саму фигуру (для перемещения)
        if (selected.hitTest(x, y)) {
          setInteraction('move');
          dragStartRef.current = { x, y };
          shapeStartRef.current = {
            transform: selected.transform.clone(),
          };
          return;
        }
      }
      // Если не попали никуда – пытаемся выбрать другую фигуру
      const shapeUnderCursor = findShapeAt(x, y);
      if (shapeUnderCursor) {
        setSelectedShapeId(shapeUnderCursor.id);
        // Можно сразу начать перемещение (по желанию)
        setInteraction('move');
        dragStartRef.current = { x, y };
        shapeStartRef.current = {
          transform: shapeUnderCursor.transform.clone(),
        };
      } else {
        setSelectedShapeId(null);
        setInteraction('none');
      }
    }
  };

  // Обработка движения мыши (перемещение, масштабирование, поворот, правка точек)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Предпросмотр линии при рисовании
    if (selectedTool === 'line') {
      if (lineStart !== null) {
        const coords = getDeviceCoords(e);
        if (coords) setMousePos(coords);
      }
      return;
    }

    if (interaction === 'none') return;

    const coords = getDeviceCoords(e);
    if (!coords) return;
    const { x, y } = coords;
    const start = dragStartRef.current;
    const shapeStart = shapeStartRef.current;
    if (!shapeStart) return;

    const selected = selectedShapeRef.current;
    if (!selected) return;

    const dx = x - start.x;
    const dy = y - start.y;

    if (interaction === 'move') {
      const newTransform = shapeStart.transform.clone();
      newTransform.x = shapeStart.transform.x + dx;
      newTransform.y = shapeStart.transform.y + dy;
      selected.transform = newTransform;
      // Обновляем state для перерисовки
      setShapes([...shapesRef.current]);
    }
    else if (interaction === 'resize') {
      const handleType = resizeHandleRef.current;
      const startBounds = shapeStart.startBounds;
      const shapeClone = shapeStart.shapeClone;
      if (!startBounds || !shapeClone) return;

      // Restore shape geometry from the clone taken at drag start.
      // Without this, each mousemove compounds on the already-resized shape,
      // causing acceleration and incorrect behavior after rotation.
      selected.transform = shapeClone.transform.clone();
      if ('x1' in selected && 'x1' in shapeClone) {
        (selected as any).x1 = (shapeClone as any).x1;
        (selected as any).y1 = (shapeClone as any).y1;
        (selected as any).x2 = (shapeClone as any).x2;
        (selected as any).y2 = (shapeClone as any).y2;
      }
      if ('width' in selected && 'width' in shapeClone) (selected as any).width = (shapeClone as any).width;
      if ('height' in selected && 'height' in shapeClone) (selected as any).height = (shapeClone as any).height;
      if ('rx' in selected && 'rx' in shapeClone) (selected as any).rx = (shapeClone as any).rx;
      if ('ry' in selected && 'ry' in shapeClone) (selected as any).ry = (shapeClone as any).ry;
      if ('p0' in selected && 'p0' in shapeClone) {
        (selected as any).p0 = { ...(shapeClone as any).p0 };
        (selected as any).p1 = { ...(shapeClone as any).p1 };
        (selected as any).p2 = { ...(shapeClone as any).p2 };
      }
      if ('p3' in selected && 'p3' in shapeClone) {
        (selected as any).p3 = { ...(shapeClone as any).p3 };
      }
      if ('points' in selected && 'points' in shapeClone) {
        (selected as any).points = (shapeClone as any).points.map((p: {x:number,y:number}) => ({...p}));
        // PathBezier хранит кэш кривых Безье — нужно обновить после восстановления точек
        if (typeof (selected as any).updateCache === 'function') {
          (selected as any).updateCache();
        }
      }
      // Triangle private vertices — copy via getLocalVertices / internal access
      if ('_v1' in (selected as any) && '_v1' in (shapeClone as any)) {
        (selected as any)._v1 = { ...(shapeClone as any)._v1 };
        (selected as any)._v2 = { ...(shapeClone as any)._v2 };
        (selected as any)._v3 = { ...(shapeClone as any)._v3 };
      }

      // Always compute from startBounds + total delta from drag start
      let newMinX = startBounds.minX;
      let newMinY = startBounds.minY;
      let newMaxX = startBounds.maxX;
      let newMaxY = startBounds.maxY;

      const minSize = 10;

      if (handleType === 'nw') {
        newMinX = Math.min(startBounds.minX + dx, startBounds.maxX - minSize);
        newMinY = Math.min(startBounds.minY + dy, startBounds.maxY - minSize);
      } else if (handleType === 'n') {
        newMinY = Math.min(startBounds.minY + dy, startBounds.maxY - minSize);
      } else if (handleType === 'ne') {
        newMaxX = Math.max(startBounds.maxX + dx, startBounds.minX + minSize);
        newMinY = Math.min(startBounds.minY + dy, startBounds.maxY - minSize);
      } else if (handleType === 'e') {
        newMaxX = Math.max(startBounds.maxX + dx, startBounds.minX + minSize);
      } else if (handleType === 'se') {
        newMaxX = Math.max(startBounds.maxX + dx, startBounds.minX + minSize);
        newMaxY = Math.max(startBounds.maxY + dy, startBounds.minY + minSize);
      } else if (handleType === 's') {
        newMaxY = Math.max(startBounds.maxY + dy, startBounds.minY + minSize);
      } else if (handleType === 'sw') {
        newMinX = Math.min(startBounds.minX + dx, startBounds.maxX - minSize);
        newMaxY = Math.max(startBounds.maxY + dy, startBounds.minY + minSize);
      } else if (handleType === 'w') {
        newMinX = Math.min(startBounds.minX + dx, startBounds.maxX - minSize);
      }

      selected.resizeFromDeviceAABB(newMinX, newMinY, newMaxX, newMaxY);
      setShapes([...shapesRef.current]);
    }
    else if (interaction === 'rotate') {
      const center = selected.getCenter();
      const angle = Math.atan2(y - center.y, x - center.x);
      const delta = angle - initialAngleRef.current;
      selected.transform.rotation = shapeStart.transform.rotation + delta;
      setShapes([...shapesRef.current]);
    }
    else if (interaction === 'editPoint') {
      const cpIndex = shapeStart.controlPointIndex;
      if (cpIndex === undefined) return;
      if ('setControlPoint' in selected && typeof (selected as any).setControlPoint === 'function') {
        // Точку нужно установить в локальных координатах. Преобразуем экранные координаты в локальные.
        const local = selected.transformPointToLocal(x, y);
        if (local) {
          (selected as any).setControlPoint(cpIndex, local);
          setShapes([...shapesRef.current]);
        }
      }
    }
  }, [interaction, selectedTool, lineStart, shapesRef, selectedShapeRef]);

  const handleMouseUp = () => {
    setInteraction('none');
    resizeHandleRef.current = null;
    shapeStartRef.current = null;
    setMousePos(null);
  };

  // Удаление выбранной фигуры по клавише Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedShapeId) {
        setShapes(shapes.filter(s => s.id !== selectedShapeId));
        setSelectedShapeId(null);
        setInteraction('none');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, shapes]);

  // Перемещение слоя вверх/вниз
  const moveLayer = (shapeId: string, direction: 'up' | 'down') => {
    const index = shapes.findIndex(s => s.id === shapeId);
    if (index === -1) return;
    const newShapes = [...shapes];
    if (direction === 'up' && index < newShapes.length - 1) {
      [newShapes[index], newShapes[index + 1]] = [newShapes[index + 1], newShapes[index]];
    } else if (direction === 'down' && index > 0) {
      [newShapes[index - 1], newShapes[index]] = [newShapes[index], newShapes[index - 1]];
    }
    setShapes(newShapes);
  };

  // Обработчик клика для создания фигур (без изменений, оставляем как было)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === 'select') return; // в режиме выбора не создаём фигуры
    const coords = getDeviceCoords(e);
    if (!coords) return;
    const { x, y } = coords;

    const fillColor = hexToRGBA(color, 200);
    const strokeColor = hexToRGBA(color, 255);
    const fillOpacity = 0.8;

    if (selectedTool === 'rect') {
      const rect = new Rect(`rect_${Date.now()}_${Math.random()}`, 100, 60, new Transform({ x, y, rotation: 0, scaleX: 1, scaleY: 1 }), {
        fillStyle: fillColor, fillOpacity, strokeStyle: strokeColor, strokeWidth: lineThickness, strokeOpacity: 1,
      });
      setShapes([...shapes, rect]);
    } else if (selectedTool === 'circle') {
      const radius = 30 * (rendererRef.current?.dpr || 1);
      const oval = new Oval(`circle_${Date.now()}_${Math.random()}`, radius, radius, new Transform({ x, y, rotation: 0, scaleX: 1, scaleY: 1 }), {
        fillStyle: fillColor, fillOpacity, strokeStyle: strokeColor, strokeWidth: lineThickness, strokeOpacity: 1,
      });
      setShapes([...shapes, oval]);
    } else if (selectedTool === 'line') {
      if (lineStart === null) {
        setLineStart({ x, y });
      } else {
        const line = Line.fromScreenPoints(`line_${Date.now()}_${Math.random()}`, lineStart, { x, y }, {
          strokeStyle: strokeColor, strokeWidth: lineThickness, strokeOpacity: 1,
        });
        setShapes([...shapes, line]);
        setLineStart(null);
        setMousePos(null);
      }
    } else if (selectedTool === 'triangle') {
      const size = 60 * (rendererRef.current?.dpr || 1);
      const v1 = { x: x - size/2, y: y + size/3 };
      const v2 = { x: x + size/2, y: y + size/3 };
      const v3 = { x: x, y: y - size/2 };
      const triangle = new Triangle(`tri_${Date.now()}`, v1, v2, v3, undefined, {
        fillStyle: fillColor, fillOpacity, strokeStyle: strokeColor, strokeWidth: lineThickness, strokeOpacity: 1,
      });
      setShapes([...shapes, triangle]);
    } else if (selectedTool === 'quadratic') {
      const offset = 50 * (rendererRef.current?.dpr || 1);
      const p0 = { x: x - offset, y: y };
      const p1 = { x: x, y: y - offset };
      const p2 = { x: x + offset, y: y };
      const bez = new QuadraticBezier(`quad_${Date.now()}`, p0, p1, p2, undefined, {
        strokeStyle: strokeColor, strokeWidth: lineThickness, strokeOpacity: 1,
      });
      setShapes([...shapes, bez]);
    } else if (selectedTool === 'cubic') {
      const offset = 60 * (rendererRef.current?.dpr || 1);
      const p0 = { x: x - offset, y: y };
      const p1 = { x: x - offset/2, y: y - offset };
      const p2 = { x: x + offset/2, y: y + offset };
      const p3 = { x: x + offset, y: y };
      const bez = new CubicBezier(`cubic_${Date.now()}`, p0, p1, p2, p3, undefined, {
        strokeStyle: strokeColor, strokeWidth: lineThickness, strokeOpacity: 1,
      });
      setShapes([...shapes, bez]);
    } else if (selectedTool === 'path') {
      const pts = [
        { x: x - 80, y: y - 50 },
        { x: x - 40, y: y - 80 },
        { x: x, y: y - 20 },
        { x: x + 40, y: y - 70 },
        { x: x + 80, y: y },
      ];
      const path = new PathBezier(`path_${Date.now()}`, pts, 'polyline', false, undefined, {
        strokeStyle: strokeColor, strokeWidth: lineThickness, strokeOpacity: 1,
      });
      setShapes([...shapes, path]);
    }
  };

  const handleMouseLeave = () => {
    if (lineStart !== null) {
      setLineStart(null);
      setMousePos(null);
    }
    setInteraction('none');
    shapeStartRef.current = null;
  };

  // Возвращаем JSX (панель инструментов + canvas + панель слоёв)
  return (
    <div className="h-screen flex flex-col">
      {/* Header (без изменений) */}
      <motion.header className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <motion.button onClick={goBack} className="p-2 hover:bg-slate-800 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <h1 className="text-lg font-semibold">Редактирование проекта #{id === 'new' ? 'новый' : id}</h1>
        </div>
        <motion.button onClick={saveAndGoHome} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">
          <Save className="w-4 h-4" /> Сохранить
        </motion.button>
      </motion.header>

      <div className="flex flex-1 overflow-hidden">
        {/* Левая панель инструментов */}
        <motion.aside className="w-16 border-r border-slate-800 bg-slate-900/30 flex flex-col items-center py-4 gap-2">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <motion.button
                key={tool.id}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedTool(tool.id);
                  setLineStart(null);
                  setMousePos(null);
                  setInteraction('none');
                }}
                className={`p-3 rounded-lg transition-all ${selectedTool === tool.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                title={tool.label}
              >
                <Icon className="w-5 h-5" />
              </motion.button>
            );
          })}
        </motion.aside>

        {/* Центральная область с canvas */}
        <main className="flex-1 bg-slate-100 p-8 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl h-[600px] relative overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onClick={handleCanvasClick}
              className="w-full h-full block"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </main>

        {/* Правая панель свойств + слои */}
        <motion.aside className="w-72 border-l border-slate-800 bg-slate-900/30 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Palette className="w-4 h-4" /> Свойства</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 block mb-2">Цвет заливки/обводки</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 rounded" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Толщина обводки</label>
              <input type="range" min="1" max="20" value={lineThickness} onChange={(e) => setLineThickness(Number(e.target.value))} className="w-full" />
              <span className="text-xs text-slate-400">{lineThickness} px</span>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Алгоритм линий (толщина 1)</label>
              <select value={lineAlg} onChange={(e) => setLineAlg(e.target.value as LineAlg)} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white">
                <option value="bresenham">Брезенхем (ступенчатая)</option>
                <option value="wu">Сяолинь Ву (сглаженная)</option>
              </select>
            </div>
          </div>

          <hr className="my-4 border-slate-700" />

          <h3 className="font-semibold mb-2 flex items-center gap-2"><Move className="w-4 h-4" /> Слои</h3>
          <div className="space-y-2">
            {shapes.map((shape, idx) => (
              <div key={shape.id} className={`flex items-center justify-between p-2 rounded ${selectedShapeId === shape.id ? 'bg-blue-600/20 border border-blue-500' : 'bg-slate-800/50'}`}>
                <span className="truncate text-sm">{shape.id.substring(0, 12)}</span>
                <div className="flex gap-1">
                  <button onClick={() => moveLayer(shape.id, 'down')} disabled={idx === 0} className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                  <button onClick={() => moveLayer(shape.id, 'up')} disabled={idx === shapes.length-1} className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                  <button onClick={() => { setSelectedShapeId(shape.id); setInteraction('none'); }} className="p-1 hover:bg-slate-700 rounded">🔍</button>
                </div>
              </div>
            ))}
          </div>
          <hr className="my-4 border-slate-700" />

          <h3 className="font-semibold mb-2 flex items-center gap-2">📄 JSON выбранного объекта</h3>
          <div className="bg-slate-950 rounded p-2 overflow-auto max-h-60">
            {selectedShapeJSON ? (
              <pre className="text-xs text-green-300 whitespace-pre-wrap break-words font-mono">
                {selectedShapeJSON}
              </pre>
            ) : (
              <p className="text-slate-400 text-sm">Ничего не выбрано</p>
            )}
          </div>
          {selectedShapeJSON && (
            <button
              onClick={() => navigator.clipboard.writeText(selectedShapeJSON)}
              className="mt-2 w-full bg-slate-700 hover:bg-slate-600 py-1 rounded text-xs transition-colors"
            >
              📋 Копировать JSON
            </button>
          )}
          {selectedShapeId && (
            <button onClick={() => { setShapes(shapes.filter(s => s.id !== selectedShapeId)); setSelectedShapeId(null); }} className="mt-4 w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Удалить выбранное
            </button>
          )}
        </motion.aside>
      </div>
    </div>
  );
}