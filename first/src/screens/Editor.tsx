import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Circle, MousePointer, Palette, Layers } from 'lucide-react';
import { useState } from 'react';

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedTool, setSelectedTool] = useState('select');

  const goBack = () => navigate(-1);
  const saveAndGoHome = () => navigate('/', { replace: true });

  const tools = [
    { id: 'select', icon: MousePointer, label: 'Выбор' },
    { id: 'circle', icon: Circle, label: 'Круг' },
  ];

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
        {/* Left Toolbar */}
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
                onClick={() => setSelectedTool(tool.id)}
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

        {/* Canvas Area */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 bg-slate-100 p-8 flex items-center justify-center"
        >
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl h-[600px] relative overflow-hidden">
            <div className="absolute inset-0 bg-white">
              {/* Здесь будет canvas для рисования */}
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Область для рисования</p>
                  <p className="text-sm mt-2">Выбран инструмент: {tools.find(t => t.id === selectedTool)?.label}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.main>

        {/* Right Properties Panel */}
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
              <label className="text-sm text-slate-400 block mb-2">Цвет</label>
              <input
                type="color"
                defaultValue="#3b82f6"
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
            
          </div>
        </motion.aside>
      </div>
    </div>
  );
}