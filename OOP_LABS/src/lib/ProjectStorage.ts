import { mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/plugin-fs';

const BASE_DIR = 'VectorEngine/projects';

// Мета-информация проекта (хранится в index.json)
export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;   // ISO-дата
  updatedAt: string;   // ISO-дата
}

export interface ProjectData {
  meta: ProjectMeta;
  lineAlg: 'bresenham' | 'wu';
  shapes: any[];   // массив результатов toJSON() каждой фигуры
}

/** Гарантируем, что директория проектов существует */
async function ensureDir(): Promise<void> {
  try {
    await mkdir(BASE_DIR, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    });
  } catch {

  }
}

const INDEX_PATH = `${BASE_DIR}/index.json`;

async function readIndex(): Promise<ProjectMeta[]> {
  try {
    const text = await readTextFile(INDEX_PATH, {
      baseDir: BaseDirectory.Document,
    });
    return JSON.parse(text) as ProjectMeta[];
  } catch {
    return [];
  }
}

async function writeIndex(index: ProjectMeta[]): Promise<void> {
  await writeTextFile(INDEX_PATH, JSON.stringify(index, null, 2), {
    baseDir: BaseDirectory.Document,
  });
}

export async function loadProjectIndex(): Promise<ProjectMeta[]> {
  await ensureDir();
  return readIndex();
}

export async function loadProject(id: string): Promise<ProjectData | null> {
  await ensureDir();
  try {
    const text = await readTextFile(`${BASE_DIR}/${id}.json`, {
      baseDir: BaseDirectory.Document,
    });
    return JSON.parse(text) as ProjectData;
  } catch {
    return null;
  }
}

/**
 * Сохраняет проект.
 * Если проект с таким id уже есть — обновляет его (updatedAt меняется).
 * Если нового — создаёт запись в index.json.
 */
export async function saveProject(data: ProjectData): Promise<void> {
  await ensureDir();

  // 1. Записываем файл проекта
  await writeTextFile(
    `${BASE_DIR}/${data.meta.id}.json`,
    JSON.stringify(data, null, 2),
    { baseDir: BaseDirectory.Document }
  );

  // 2. Обновляем index.json
  const index = await readIndex();
  const existingIdx = index.findIndex(m => m.id === data.meta.id);
  if (existingIdx >= 0) {
    index[existingIdx] = data.meta;
  } else {
    index.push(data.meta);
  }
  await writeIndex(index);
}

/**
 * Удаляет проект из индекса.
 * Сам файл не удаляем (plugin-fs не требует разрешения на удаление),
 * просто убираем из index.json — галерея его больше не покажет.
 */
export async function removeProjectFromIndex(id: string): Promise<void> {
  const index = await readIndex();
  await writeIndex(index.filter(m => m.id !== id));
}