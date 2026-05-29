export type RGBA = { r: number; g: number; b: number; a: number };
export type LineAlg = 'bresenham' | 'wu';

// TODO: Реализуйте функцию ограничения значения байта (от 0 до 255)
export function clampByte(v: number): number {
    return Math.min(255, Math.max(0, Math.round(v)));
}

// TODO: Реализуйте парсинг HEX-строки (например, "#FF0000" или "#F00") в объект RGBA
export function hexToRGBA(hex: string, alpha = 255): RGBA {
    let r = 0, g = 0, b = 0;
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
    } else {
        throw new Error('Неверный формат HEX цвета');
    }
    return { r, g, b, a: alpha };
}

export class RasterRenderer {
    private ctx: CanvasRenderingContext2D;
    private imageData: ImageData | null = null;
    private buf!: Uint8ClampedArray;
    width = 0; // физические пиксели
    height = 0; // физические пиксели
    dpr = 1;
    private canvas: HTMLCanvasElement;
    private _onWindowResize: () => void;
    private lineAlg: LineAlg = 'bresenham';

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('No 2D context');
        }
        this.ctx = ctx;
        this._onWindowResize = () => this.resize();
        window.addEventListener('resize', this._onWindowResize);
        this.resize();
    }

    dispose() {
        window.removeEventListener('resize', this._onWindowResize);
    }

    setLineAlgorithm(a: LineAlg) {
        this.lineAlg = a;
    }

    getLineAlgorithm(): LineAlg {
        return this.lineAlg;
    }

    // Управляющий метод рисования линий
    drawLine(x0: number, y0: number, x1: number, y1: number, color: RGBA)
    {
        if (this.lineAlg === 'wu') {
            this.drawLineWu(x0, y0, x1, y1, color);
        } else {
            this.drawLineBrassenham(x0, y0, x1, y1, color);
        }
    }

    // TODO: Вычисление 1D индекса в массиве buf по 2D координатам (x, y)
    private idx(x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return -1;
        return (y * this.width + x) * 4;
    }

    // TODO: Установка одного пикселя.
    setPixel(x: number, y: number, color: RGBA) {
        const i = this.idx(x, y);
        if (i === -1) return;
        this.buf[i] = clampByte(color.r);
        this.buf[i+1] = clampByte(color.g);
        this.buf[i+2] = clampByte(color.b);
        this.buf[i+3] = clampByte(color.a);
    }

    // TODO: Альфа-блендинг 
    // alphaFactor для алгоритма Ву.
    private blendPixel(x: number, y: number, color: RGBA, alphaFactor = 1)
    {
        const i = this.idx(x, y);
        if (i === -1) return;
        const srcA = (clampByte(color.a) / 255) * alphaFactor;
        if (srcA <= 0) return;
        const srcR = color.r / 255, srcG = color.g / 255, srcB = color.b / 255;
        const dstR = this.buf[i] / 255, dstG = this.buf[i+1] / 255, dstB = this.buf[i+2] / 255, dstA = this.buf[i+3] / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA <= 0) return;
        const outR = (srcR * srcA + dstR * dstA * (1 - srcA)) / outA;
        const outG = (srcG * srcA + dstG * dstA * (1 - srcA)) / outA;
        const outB = (srcB * srcA + dstB * dstA * (1 - srcA)) / outA;
        this.buf[i] = clampByte(outR * 255);
        this.buf[i+1] = clampByte(outG * 255);
        this.buf[i+2] = clampByte(outB * 255);
        this.buf[i+3] = clampByte(outA * 255);
    }

    // TODO: Жизненный цикл кадра.
    // devicePixelRatio (dpr). Создайте новый ImageData.
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.dpr = dpr;
        const newWidth = Math.floor(this.canvas.clientWidth * dpr);
        const newHeight = Math.floor(this.canvas.clientHeight * dpr);
        if (this.width === newWidth && this.height === newHeight) return;
        this.width = newWidth;
        this.height = newHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.buf = this.imageData.data;
    }

    // TODO: Очистка буфера. Заполните this.buf нулями, если clear = true
    beginFrame(clear = true) {
        if (clear && this.buf) this.buf.fill(0);
    }

    // TODO: Вывод буфера на экран. Используйте this.ctx.putImageData
    commit() {
        if (this.imageData) this.ctx.putImageData(this.imageData, 0, 0);
    }

    // TODO: Алгоритм Брезенхема. 
    drawLineBrassenham(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        let x = Math.round(x0), y = Math.round(y0);
        const x1r = Math.round(x1), y1r = Math.round(y1);
        const dx = Math.abs(x1r - x);
        const dy = -Math.abs(y1r - y);
        const sx = x < x1r ? 1 : -1;
        const sy = y < y1r ? 1 : -1;
        let err = dx + dy;
        while (true) {
            this.setPixel(x, y, color);
            if (x === x1r && y === y1r) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x += sx; }
            if (e2 <= dx) { err += dx; y += sy; }
        }
    }

    // TODO: Алгоритм Сяолиня Ву.
    drawLineWu(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        let x0i = x0, y0i = y0, x1i = x1, y1i = y1;
        const steep = Math.abs(y1i - y0i) > Math.abs(x1i - x0i);
        if (steep) { [x0i, y0i] = [y0i, x0i]; [x1i, y1i] = [y1i, x1i]; }
        if (x0i > x1i) { [x0i, x1i] = [x1i, x0i]; [y0i, y1i] = [y1i, y0i]; }
        const dx = x1i - x0i;
        const dy = y1i - y0i;
        const gradient = dx === 0 ? 1 : dy / dx;
        const fpart = (x: number) => x - Math.floor(x);
        const rfpart = (x: number) => 1 - fpart(x);
        let xEnd = Math.round(x0i);
        let yEnd = y0i + gradient * (xEnd - x0i);
        let xGap = rfpart(x0i + 0.5);
        let xPxl1 = xEnd, yPxl1 = Math.floor(yEnd);
        const drawPixel = (px: number, py: number, intensity: number) => {
            if (steep) this.blendPixel(py, px, color, intensity);
            else this.blendPixel(px, py, color, intensity);
        };
        drawPixel(xPxl1, yPxl1, rfpart(yEnd) * xGap);
        drawPixel(xPxl1, yPxl1 + 1, fpart(yEnd) * xGap);
        let intery = yEnd + gradient;
        xEnd = Math.round(x1i);
        yEnd = y1i + gradient * (xEnd - x1i);
        xGap = fpart(x1i + 0.5);
        const xPxl2 = xEnd, yPxl2 = Math.floor(yEnd);
        drawPixel(xPxl2, yPxl2, rfpart(yEnd) * xGap);
        drawPixel(xPxl2, yPxl2 + 1, fpart(yEnd) * xGap);
        for (let x = xPxl1 + 1; x <= xPxl2 - 1; x++) {
            drawPixel(x, Math.floor(intery), rfpart(intery));
            drawPixel(x, Math.floor(intery) + 1, fpart(intery));
            intery += gradient;
        }
    }

    // TODO: Отрисовка горизонтальной линии (для заливки). 
    private drawHSpan(y: number, x0: number, x1: number, color: RGBA) {
        let start = Math.round(Math.min(x0, x1));
        let end = Math.round(Math.max(x0, x1));
        for (let x = start; x <= end; x++) {
            this.blendPixel(x, y, color, 1);
        }
    }

    // TODO: Заливка многоугольника (Scanline). 
    fillPolygon(points: { x: number; y: number }[], color: RGBA) {
    if (points.length < 3) return;

    let yMin = Infinity, yMax = -Infinity;
    for (const p of points) {
        yMin = Math.min(yMin, p.y);
        yMax = Math.max(yMax, p.y);
    }
    yMin = Math.max(0, Math.floor(yMin));
    yMax = Math.min(this.height - 1, Math.ceil(yMax));

    const n = points.length;
    for (let y = yMin; y <= yMax; y++) {
        const intersections: number[] = [];
        for (let i = 0; i < n; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % n];
            // Пропуск горизонтальных рёбер
            if (p1.y === p2.y) continue;
            // Пересечение, если y строго между y1 и y2 (с учётом вершины)
            if ((p1.y < y && p2.y >= y) || (p2.y < y && p1.y >= y)) {
                const t = (y - p1.y) / (p2.y - p1.y);
                const xIntersect = p1.x + t * (p2.x - p1.x);
                intersections.push(xIntersect);
            }
        }
        intersections.sort((a, b) => a - b);
        for (let i = 0; i < intersections.length - 1; i += 2) {
            const xLeft = intersections[i];
            const xRight = intersections[i + 1];
            if (xLeft < xRight) {
                this.drawHSpan(y, xLeft, xRight, color);
            }
        }
    }
}

    // TODO: Заливка окружности
    fillCircle(cx: number, cy: number, radius: number, color: RGBA) {
        const r = Math.abs(radius);
        const yStart = Math.ceil(cy - r);
        const yEnd = Math.floor(cy + r);
        for (let y = yStart; y <= yEnd; y++) {
            if (y < 0 || y >= this.height) continue;
            const dy = y - cy;
            const dx = Math.sqrt(r * r - dy * dy);
            const x0 = cx - dx;
            const x1 = cx + dx;
            this.drawHSpan(y, x0, x1, color);
        }
    }

    strokeCircle(cx: number, cy: number, radius: number, color: RGBA, strokeWidth: number = 1): void {
        const r = Math.abs(radius);
        const steps = 36;
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            points.push({ x, y });
        }
        this.strokePolygon(points, color, strokeWidth);
    }

    // TODO: Отрисовка толстого отрезка (прямоугольник + шапки).
    strokeLine(x0: number, y0: number, x1: number, y1: number, color: RGBA, width = 1) {
        const w = Math.max(0, width);
        if (w <= 0) return;
        if (w <= 1) { this.drawLine(x0, y0, x1, y1, color); return; }
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) { this.fillCircle(x0, y0, w / 2, color); return; }
        const nx = -dy / len, ny = dx / len;
        const half = w / 2;
        const p1 = { x: x0 + nx * half, y: y0 + ny * half };
        const p2 = { x: x0 - nx * half, y: y0 - ny * half };
        const p3 = { x: x1 - nx * half, y: y1 - ny * half };
        const p4 = { x: x1 + nx * half, y: y1 + ny * half };
        this.fillPolygon([p1, p2, p3, p4], color);
        this.fillCircle(x0, y0, half, color);
        this.fillCircle(x1, y1, half, color);
    }

    // TODO: Отрисовка контура фигуры. См. пункт 2.5
    strokePolygon(points: { x: number; y: number }[], color: RGBA, width = 1) {
        if (points.length < 2) return;
        const n = points.length;
        // Рисуем все отрезки
        for (let i = 0; i < n; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % n];
            this.strokeLine(p1.x, p1.y, p2.x, p2.y, color, width);
        }
        // Заклеиваем стыки кругами с запасом
        const half = width / 2;
        const capRadius = half;  
        for (const p of points) {
            this.fillCircle(p.x, p.y, capRadius, color);
        }
    }
}