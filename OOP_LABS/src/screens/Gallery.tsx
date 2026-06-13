import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { loadProjectIndex, type ProjectMeta } from '../lib/Projectstorage';

export default function Gallery() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Загружаем список проектов из index.json при монтировании.
   * loadProjectIndex() сам создаёт директорию, если её нет,
   * и возвращает [] при отсутствии файла — ошибки не будет.
   */
  useEffect(() => {
    loadProjectIndex()
      .then(setProjects)
      .catch(err => console.error('Ошибка загрузки списка проектов:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-12">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold"
        >
          Мои проекты
        </motion.h1>

        {/* Кнопка создания нового проекта — просто переходит на /editor/new */}
        <Link to="/editor/new">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
          >
            Создать проект
          </motion.button>
        </Link>
      </div>

      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <p className="text-slate-400 text-lg">Загрузка...</p>
        </motion.div>
      ) : projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <p className="text-slate-400 text-lg">У вас пока нет проектов</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {projects.map((project) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {/* Открываем проект по его сохранённому id */}
                <Link to={`/editor/${project.id}`}>
                  <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-800 hover:border-blue-500 transition-colors">
                    <div className="h-48 bg-gradient-to-br from-blue-600 to-purple-600" />
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1">{project.name}</h3>
                      <div className="text-slate-400 text-sm">
                        Изменён: {new Date(project.updatedAt).toLocaleDateString('ru-RU')}
                      </div>
                      <div className="text-slate-600 text-xs mt-1">
                        Создан: {new Date(project.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}