import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Circle, MousePointer, Palette, Pen, Square } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { RasterRenderer, type RGBA, type LineAlg, hexToRGBA } from '../lib/raster/RasterRenderer';
import { Shape } from '../lib/geometry/Shape';
import { Rect } from '../lib/geometry/Rect';
import { Line } from '../lib/geometry/Line';
import { Oval } from '../lib/geometry/Oval';
import { Transform } from '../lib/geometry/Transform';

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedTool, setSelectedTool] = useState('select');
  const [lineAlg, setLineAlg] = useState<LineAlg>('bresenham');
  const [color, setColor] = useState('#3b82f6');
  const [lineThickness, setLineThickness] = useState(1);

  const [shapes, setShapes] = useState<Shape[]>([]);
  const shapesRef = useRef<Shape[]>([]);

  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);

  const goBack = () => navigate(-1);
  const saveAndGoHome = () => navigate('/', { replace: true });

  const tools = [
    { id: 'select', icon: MousePointer, label: 'Выбор' },
    { id: 'rect', icon: Square, label: 'Прямоугольник' },
    { id: 'circle', icon: Circle, label: 'Круг' },
    { id: 'line', icon: Pen, label: 'Линия' },
  ];

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

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

  function drawScene(r: RasterRenderer) {
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

    for (const shape of shapesRef.current) {
      shape.drawRaster(r);
    }
  }

  // Вспомогательная функция: преобразовать CSS-координаты мыши в физические пиксели canvas
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

  // Обработчик клика: создание новой фигуры в зависимости от выбранного инструмента
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getDeviceCoords(e);
    if (!coords) return;
    const { x, y } = coords;

    // Базовые стили (цвета и прозрачность)
    const fillColor = hexToRGBA(color, 200);
    const strokeColor = hexToRGBA(color, 255);
    const fillOpacity = 0.8;

    // 1. Прямоугольник
    if (selectedTool === 'rect') {
      const rect = new Rect(
        `rect_${Date.now()}_${Math.random()}`,
        100, 60,                           // ширина, высота
        new Transform({ x, y, rotation: 0, scaleX: 1, scaleY: 1 }),
        {
          fillStyle: fillColor,
          fillOpacity,
          strokeStyle: strokeColor,
          strokeWidth: lineThickness,
          strokeOpacity: 1,
        }
      );
      setShapes([...shapes, rect]);
    }
    // 2. Круг (используем Oval с rx == ry)
    else if (selectedTool === 'circle') {
      const radius = 30 * (rendererRef.current?.dpr || 1);
      const oval = new Oval(
        `circle_${Date.now()}_${Math.random()}`,
        radius, radius,
        new Transform({ x, y, rotation: 0, scaleX: 1, scaleY: 1 }),
        {
          fillStyle: fillColor,
          fillOpacity,
          strokeStyle: strokeColor,
          strokeWidth: lineThickness,
          strokeOpacity: 1,
        }
      );
      setShapes([...shapes, oval]);
    }

    else if (selectedTool === 'line') {
      if (lineStart === null) {
        setLineStart({ x, y });
      } else {
        const line = Line.fromScreenPoints(
          `line_${Date.now()}_${Math.random()}`,
          lineStart,
          { x, y },
          {
            strokeStyle: strokeColor,
            strokeWidth: lineThickness,
            strokeOpacity: 1,
          }
        );
        setShapes([...shapes, line]);
        setLineStart(null);
        setMousePos(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool !== 'line' || lineStart === null) return;
    const coords = getDeviceCoords(e);
    if (coords) setMousePos(coords);
  };

  const handleMouseLeave = () => {
    if (lineStart !== null) {
      setLineStart(null);
      setMousePos(null);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between px-4"
      >
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={goBack}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <h1 className="text-lg font-semibold">
            Редактирование проекта #{id === 'new' ? 'новый' : id}
          </h1>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={saveAndGoHome}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          Сохранить
        </motion.button>
      </motion.header>

      <div className="flex flex-1 overflow-hidden">
        {/* Левая панель инструментов */}
        <motion.aside
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-16 border-r border-slate-800 bg-slate-900/30 flex flex-col items-center py-4 gap-2"
        >
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <motion.button
                key={tool.id}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedTool(tool.id);
                  // При смене инструмента сбрасываем рисование линии
                  setLineStart(null);
                  setMousePos(null);
                }}
                className={`p-3 rounded-lg transition-all ${
                  selectedTool === tool.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-800 text-slate-400'
                }`}
                title={tool.label}
              >
                <Icon className="w-5 h-5" />
              </motion.button>
            );
          })}
        </motion.aside>

        {/* Центральная область с canvas */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 bg-slate-100 p-8 flex items-center justify-center"
        >
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl h-[600px] relative overflow-hidden">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="w-full h-full block"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </motion.main>

        {/* Правая панель свойств */}
        <motion.aside
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-64 border-l border-slate-800 bg-slate-900/30 p-4"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Свойства
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 block mb-2">Цвет заливки/обводки</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">
                Толщина обводки (для Rect, Line, Oval)
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={lineThickness}
                onChange={(e) => setLineThickness(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-slate-400">{lineThickness} px</span>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">
                Алгоритм линий (толщина 1)
              </label>
              <select
                value={lineAlg}
                onChange={(e) => setLineAlg(e.target.value as LineAlg)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
              >
                <option value="bresenham">Брезенхем (ступенчатая)</option>
                <option value="wu">Сяолинь Ву (сглаженная)</option>
              </select>
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}