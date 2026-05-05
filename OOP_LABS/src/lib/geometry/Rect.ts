import { Shape, type Bounds } from "./Shape";
import { type RasterRenderer } from "../raster/RasterRenderer";
import { Transform } from "./Transform";

export class Rect extends Shape {
    width: number;
    height: number;

    constructor(id: string, width: number, height: number, transform?: Transform, style?: any) {
        super(id, transform, style);
        this.width = width;
        this.height = height;
    }

    private getLocalCorners(): { x: number; y: number }[]{
        const w2 = this.width / 2;
        const h2 = this.height / 2;
        return [
            { x: -w2, y: -h2 },
            { x:  w2, y: -h2 },
            { x:  w2, y:  h2 },
            { x: -w2, y:  h2 },
        ];
    }

    drawRaster(r: RasterRenderer): void {
        const corners = this.getLocalCorners();
        const worldCorners = corners.map(p => this.transformPointToDevice(p.x, p.y));

        if (this.fillOpacity > 0) {
            r.fillPolygon(worldCorners, this.getFillRGBA())
        }

         if (this.strokeWidth > 0 && this.strokeOpacity > 0){
            r.strokePolygon(worldCorners, this.getStrokeRGBA(), this.strokeWidth);
         }
    }

    hitTest(px: number, py: number): boolean {
        const local = this.transformPointToLocal(px, py);
        if (!local) return false;
        const w2 = this.width / 2;
        const h2 = this.height / 2;
        return Math.abs(local.x) <= w2 && Math.abs(local.y) <= h2;
    }

    getBounds(): Bounds {
        const corners = this.getLocalCorners();
        const world = corners.map(p => this.transformPointToDevice(p.x, p.y));
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
        const w2 = this.width / 2;
        const h2 = this.height / 2;
        return { minX: -w2, minY: -h2, maxX: w2, maxY: h2 };
    }

    resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number): void {
        const newWidth = maxX - minX;
        const newHeight = maxY - minY;
        const newCenterX = (minX + maxX) / 2;
        const newCenterY = (minY + maxY) / 2;

        this.transform.x = newCenterX;
        this.transform.y = newCenterY;
        this.width = newWidth;
        this.height = newHeight;
    }

    clone(): Rect {
        const clone = new Rect(this.id, this.width, this.height, this.transform.clone(), {
            fillStyle: { ...this.fillStyle },
            fillOpacity: this.fillOpacity,
            strokeStyle: { ...this.strokeStyle },
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
        });
        return clone;
    }

    toJSON(): any {
        return {
            type: "rect",
            id: this.id,
            width: this.width,
            height: this.height,
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
}