import { Shape, type Bounds } from "./Shape";
import { type RasterRenderer } from "../raster/RasterRenderer";
import { Transform } from "./Transform";


export class Line extends Shape {
    x1: number;
    y1: number;
    x2: number;
    y2: number;

    constructor (id: string, x1: number, y1: number, x2: number, y2: number, transform?: Transform, style?: any){
        super(id, transform, style)

        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }

    static fromScreenPoints(id: string, p1: { x: number; y: number }, p2: { x: number; y: number }, style?: any): Line {
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        const transform = new Transform({ x: cx, y: cy, rotation: 0, scaleX: 1, scaleY: 1 });
        const localP1 = { x: p1.x - cx, y: p1.y - cy };
        const localP2 = { x: p2.x - cx, y: p2.y - cy };
        return new Line(id, localP1.x, localP1.y, localP2.x, localP2.y, transform, style);
    }

    drawRaster(r: RasterRenderer): void {
        const start = this.transformPointToDevice(this.x1, this.y1);
        const end = this.transformPointToDevice(this.x2, this.y2);
        const strokeColor = this.getStrokeRGBA();
        if (this.strokeWidth <= 1) {
            r.drawLine( start.x, start.y, end.x, end.y, strokeColor);
        } else {
            r.strokeLine(start.x, start.y, end.x, end.y, strokeColor, this.strokeWidth);
        }
    }

    private distanceSqToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number{
        const abx = bx - ax;
        const aby = by - ay;
        const t = ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby) || 0;
        const clampedT = Math.max(0, Math.min(1, t));
        const projX = ax + clampedT * abx;
        const projY = ay + clampedT * aby;
        const dx = px - projX;
        const dy = py - projY;
        return dx * dx + dy * dy;
    }

    hitTest(px: number, py: number): boolean {
        const local = this.transformPointToLocal(px, py);
        if (!local) return false;
        const sqDist = this.distanceSqToSegment(local.x, local.y, this.x1, this.y1, this.x2, this.y2);

        const invScaleX = 1 / Math.abs(this.transform.scaleX);
        const invScaleY = 1 / Math.abs(this.transform.scaleY);
        // Use at least 5px hit area so thin lines (strokeWidth=1) are still selectable
        const minThreshold = 5 * Math.min(invScaleX, invScaleY);
        const threshold = Math.max(minThreshold, (this.strokeWidth / 2) * Math.min(invScaleX, invScaleY));
        return Math.sqrt(sqDist) <= threshold;
    }

    getBounds(): Bounds {
        const p1 = this.transformPointToDevice(this.x1, this.y1);
        const p2 = this.transformPointToDevice(this.x2, this.y2);
        const minX = Math.min(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxX = Math.max(p1.x, p2.x);
        const maxY = Math.max(p1.y, p2.y);
        
        return {minX, minY, maxX, maxY };
    }

    getLocalBounds(): Bounds {
        return{
            minX: Math.min(this.x1, this.x2),
            minY: Math.min(this.y1, this.y2),
            maxX: Math.max(this.x1, this.x2),
            maxY: Math.max(this.y1, this.y2),
        };
    }

    clone(): Line {
        const clone = new Line(this.id, this.x1, this.y1, this.x2, this.y2, this.transform.clone(),{
            fillStyle: { ...this.fillStyle },
            fillOpacity: this.fillOpacity,
            strokeStyle: { ...this.strokeStyle },
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
        });
        return clone;
    }

    toJSON(): any{
        return {
            type: "line",
            id: this.id,
            x1: this.x1,
            y1: this.y1,
            x2: this.x2,
            y2: this.y2,
            transform: this.transform.toJSON(),
            style: {
                fillStyle: this.fillStyle,
                fillOpacity: this.fillOpacity,
                strokeStyle: this.strokeStyle,
                strokeWidth: this.strokeWidth,
                strokeOpacity: this.strokeOpacity,
            },
        };
    }

    resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number): void {
        // Получаем текущие мировые позиции концов линии
        const p1dev = this.transformPointToDevice(this.x1, this.y1);
        const p2dev = this.transformPointToDevice(this.x2, this.y2);

        const oldMinX = Math.min(p1dev.x, p2dev.x);
        const oldMinY = Math.min(p1dev.y, p2dev.y);
        const oldMaxX = Math.max(p1dev.x, p2dev.x);
        const oldMaxY = Math.max(p1dev.y, p2dev.y);
        const oldW = oldMaxX - oldMinX;
        const oldH = oldMaxY - oldMinY;

        // Масштабируем каждую мировую точку в новый AABB
        // Если ширина/высота нулевая — просто смещаем без масштабирования по этой оси
        const mapX = oldW > 0
            ? (wx: number) => minX + (wx - oldMinX) / oldW * (maxX - minX)
            : (_: number) => (minX + maxX) / 2;
        const mapY = oldH > 0
            ? (wy: number) => minY + (wy - oldMinY) / oldH * (maxY - minY)
            : (_: number) => (minY + maxY) / 2;

        const newP1dev = { x: mapX(p1dev.x), y: mapY(p1dev.y) };
        const newP2dev = { x: mapX(p2dev.x), y: mapY(p2dev.y) };

        // Новый центр линии
        const newCenterX = (newP1dev.x + newP2dev.x) / 2;
        const newCenterY = (newP1dev.y + newP2dev.y) / 2;

        // Шаг 1: обновляем transform.x/y
        this.transform.x = newCenterX;
        this.transform.y = newCenterY;

        // Шаг 2: переводим мировые точки в локальные через новую инвертированную матрицу
        const newLocal1 = this.transformPointToLocal(newP1dev.x, newP1dev.y);
        const newLocal2 = this.transformPointToLocal(newP2dev.x, newP2dev.y);
        if (!newLocal1 || !newLocal2) return;

        this.x1 = newLocal1.x;
        this.y1 = newLocal1.y;
        this.x2 = newLocal2.x;
        this.y2 = newLocal2.y;
    }

}