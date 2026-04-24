import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Circle, MousePointer, Palette, Pen } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { RasterRenderer, type RGBA, type LineAlg, hexToRGBA } from '../lib/raster/RasterRenderer';

// Тип для хранимых фигур
interface Shape {
  type: 'circle' | 'line';
  // для круга
  x?: number;
  y?: number;
  radius?: number;
  // для линии
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  thickness?: number;
  color: RGBA;
}

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedTool, setSelectedTool] = useState('select');
  const [lineAlg, setLineAlg] = useState<LineAlg>('bresenham');
  const [color, setColor] = useState('#3b82f6');
  const [lineThickness, setLineThickness] = useState(1);

  // Состояние для хранения всех нарисованных фигур
  const [shapes, setShapes] = useState<Shape[]>([]);
  const shapesRef = useRef<Shape[]>([]);

  // Для рисования линии по двум кликам
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  // Текущая позиция мыши для предпросмотра линии
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RasterRenderer | null>(null);

  // Навигация
  const goBack = () => navigate(-1);
  const saveAndGoHome = () => navigate('/', { replace: true });

  // Панель инструментов
  const tools = [
    { id: 'select', icon: MousePointer, label: 'Выбор' },
    { id: 'circle', icon: Circle, label: 'Круг' },
    { id: 'line', icon: Pen, label: 'Линия' },
  ];

  useEffect(() => {
      shapesRef.current = shapes;
  }, [shapes]);
  // Инициализация рендерера и цикла кадров
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
  }, []); // только при монтировании

  // Обновление алгоритма в рендерере при его изменении
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setLineAlgorithm(lineAlg);
    }
  }, [lineAlg]);

  // Функция отрисовки всей сцены: начальные примитивы + все фигуры из состояния
  function drawScene(r: RasterRenderer) {
    // 1. Закрашенный красный треугольник (многоугольник)
    const red: RGBA = { r: 255, g: 0, b: 0, a: 255 };
    r.fillPolygon([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 200, y: 300 },
    ], red);

    // 2. Полупрозрачный синий круг (проверка блендинга с треугольником → фиолетовый оттенок)
    const translucentBlue: RGBA = { r: 0, g: 100, b: 255, a: 200 };
    r.fillCircle(230, 150, 60, translucentBlue);

    // 3. Толстая ломаная (квадрат) – проверка strokePolygon без дырок (толщина 6)
    const black: RGBA = { r: 0, g: 0, b: 0, a: 255 };
    r.strokePolygon([
      { x: 500, y: 100 },
      { x: 700, y: 100 },
      { x: 700, y: 300 },
      { x: 500, y: 300 },
    ], black, 6);

    // 4. Диагональная линия для демонстрации переключения алгоритмов (толщина 1)
    const yellow: RGBA = { r: 255, g: 255, b: 0, a: 255 };
    r.drawLine(50, 400, 750, 550, yellow);

    for (const shape of shapesRef.current) {
      if (shape.type === 'circle') {
        r.fillCircle(shape.x!, shape.y!, shape.radius!, shape.color);
      } else if (shape.type === 'line') {
        if (shape.thickness! <= 1) {
          r.drawLine(shape.x1!, shape.y1!, shape.x2!, shape.y2!, shape.color);
        } else {
          r.strokeLine(shape.x1!, shape.y1!, shape.x2!, shape.y2!, shape.color, shape.thickness!);
        }
      }
    }

    // ------------------- Предпросмотр резиновой линии (если рисуем линию) -------------------
    if (selectedTool === 'line' && lineStart && mousePos) {
      const previewColor = hexToRGBA(color, 150); // полупрозрачный цвет для предпросмотра
      if (lineThickness <= 1) {
        r.drawLine(lineStart.x, lineStart.y, mousePos.x, mousePos.y, previewColor);
      } else {
        r.strokeLine(lineStart.x, lineStart.y, mousePos.x, mousePos.y, previewColor, lineThickness);
      }
    }
  }

  // Обработчик клика на canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const dpr = renderer.dpr;
    const x = (e.clientX - rect.left) * dpr;
    const y = (e.clientY - rect.top) * dpr;

    if (selectedTool === 'circle') {
      const newCircle: Shape = {
        type: 'circle',
        x,
        y,
        radius: 30 * dpr,
        color: hexToRGBA(color, 200),
      };
      setShapes([...shapes, newCircle]);
    } 
    else if (selectedTool === 'line') {
      if (lineStart === null) {
        // первый клик – запоминаем начало
        setLineStart({ x, y });
      } else {
        // второй клик – добавляем финальную линию
        const newLine: Shape = {
          type: 'line',
          x1: lineStart.x,
          y1: lineStart.y,
          x2: x,
          y2: y,
          thickness: lineThickness,
          color: hexToRGBA(color, 255),
        };
        setShapes([...shapes, newLine]);
        setLineStart(null);
        setMousePos(null);
      }
    }
  };

  // Движение мыши для предпросмотра линии
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool !== 'line' || lineStart === null) return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dpr = renderer.dpr;
    const x = (e.clientX - rect.left) * dpr;
    const y = (e.clientY - rect.top) * dpr;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    if (lineStart !== null) {
      // Если вышли за пределы canvas, сбрасываем рисование линии
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
              <label className="text-sm text-slate-400 block mb-2">Цвет линий/заливки</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">
                Толщина линии (для инструмента «Линия»)
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
              <label className="text-sm text-slate-400 block mb-2">Алгоритм рисования линий (толщина 1)</label>
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