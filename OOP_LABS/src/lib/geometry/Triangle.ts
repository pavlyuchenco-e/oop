import { Shape, type Bounds } from "./Shape";
import { type RasterRenderer } from "../raster/RasterRenderer";
import { Transform } from "./Transform";

export class Triangle extends Shape{
    // Локальные координаты
    private _v1: {x: number, y: number};
    private _v2: {x: number, y: number};
    private _v3: {x: number, y: number};

    constructor(id: string, v1:{x: number, y: number}, v2: {x: number, y: number}, v3: {x: number, y: number}, transform?: Transform, style?: any){
        super(id, transform, style);
        const cx = (v1.x + v2.x + v3.x) / 3;
        const cy = (v1.y + v2.y + v3.y) / 3;

        // Перемещаем вершины в локальные координаты
        this._v1 = {x: v1.x - cx, y: v1.y - cy};
        this._v2 = {x: v2.x - cx, y: v2.y - cy};
        this._v3 = {x: v3.x - cx, y: v3.y - cy};

        this.transform.x = cx;
        this.transform.y = cy;
    }

    getLocalVertices(): {x: number, y: number}[]{
        return [this._v1, this._v2, this._v3];
    }

    drawRaster(r: RasterRenderer): void {
        const worldVertices = this.getLocalVertices().map(v => this.transformPointToDevice(v.x, v.y));

        if (this.fillOpacity > 0) {
            r.fillPolygon(worldVertices, this.getFillRGBA());
        }

        if (this.strokeWidth > 0 && this.strokeOpacity > 0){
             r.strokePolygon(worldVertices, this.getStrokeRGBA(), this.strokeWidth); 
        }
    }

     //метод барицентрических координат
    hitTest(px: number, py: number): boolean {
        const local = this.transformPointToLocal(px, py);
        if (!local) return false;
        const v0 = { x: this._v2.x - this._v1.x, y: this._v2.y - this._v1.y };
        const v1 = { x: this._v3.x - this._v1.x, y: this._v3.y - this._v1.y };
        const v2 = { x: local.x - this._v1.x, y: local.y - this._v1.y };
        const dot00 = v0.x * v0.x + v0.y * v0.y;
        const dot01 = v0.x * v1.x + v0.y * v1.y;
        const dot02 = v0.x * v2.x + v0.y * v2.y;
        const dot11 = v1.x * v1.x + v1.y * v1.y;
        const dot12 = v1.x * v2.x + v1.y * v2.y;
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
        return (u >= 0) && (v >= 0) && (u + v <= 1);
    }

    getBounds(): Bounds {
        const world = this.getLocalVertices().map(v => this.transformPointToDevice(v.x, v.y));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of world) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        return { minX, minY, maxX, maxY };
    }

    getLocalBounds(): Bounds {
        const xs = [this._v1.x, this._v2.x, this._v3.x];
        const ys = [this._v1.y, this._v2.y, this._v3.y];
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    }

    clone(): Triangle {
        return new Triangle(this.id, this._v1, this._v2, this._v3, this.transform.clone(), {
            fillStyle: { ...this.fillStyle },
            fillOpacity: this.fillOpacity,
            strokeStyle: { ...this.strokeStyle },
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
        });
    }

    toJSON(): any {
        return {
            type: "triangle",
            id: this.id,
            vertices: [this._v1, this._v2, this._v3],
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

    // AABB (перемещаем вершины пропорционально)
    resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number): void {
        const oldBounds = this.getBounds();
        const oldWidth = oldBounds.maxX - oldBounds.minX;
        const oldHeight = oldBounds.maxY - oldBounds.minY;
        const newWidth = maxX - minX;
        const newHeight = maxY - minY;
        if (oldWidth === 0 || oldHeight === 0) return;
        const scaleX = newWidth / oldWidth;
        const scaleY = newHeight / oldHeight;
        const newCenterX = (minX + maxX) / 2;
        const newCenterY = (minY + maxY) / 2;
        for (const v of [this._v1, this._v2, this._v3]) {
            const world = this.transformPointToDevice(v.x, v.y);
            const newWorldX = newCenterX + (world.x - oldBounds.minX - oldWidth/2) * scaleX;
            const newWorldY = newCenterY + (world.y - oldBounds.minY - oldHeight/2) * scaleY;
            // Преобразуем обратно в локальные
            const newLocal = this.transformPointToLocal(newWorldX, newWorldY);
            if (newLocal) {
                v.x = newLocal.x;
                v.y = newLocal.y;
            }
        }
        this.transform.x = newCenterX;
        this.transform.y = newCenterY;
    }
}