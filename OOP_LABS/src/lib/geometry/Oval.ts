import { Shape, type Bounds } from "./Shape";
import { type RasterRenderer } from "../raster/RasterRenderer";
import { Transform } from "./Transform";

export class Oval extends Shape {
    rx: number;
    ry: number;

    constructor(id: string, rx: number, ry: number, transform?: Transform, style?: any){
        super(id, transform, style);
        this.rx = rx;
        this.ry = ry;
    }

    private getLocalEllipsePoints(segments = 36): { x: number, y: number}[] {
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = this.rx  * Math.cos(angle);
            const y = this.ry * Math.sin(angle);
            points.push({ x, y });
        }

        return points;
    }

    drawRaster(r: RasterRenderer): void {
        const localPoints = this.getLocalEllipsePoints();
        const worldPoints = localPoints.map(p => this.transformPointToDevice(p.x, p.y));
        if (this.fillOpacity > 0){
            r.fillPolygon(worldPoints, this.getFillRGBA());
        }

        if(this.strokeOpacity > 0 && this.strokeWidth > 0){
            r.strokePolygon(worldPoints, this.getStrokeRGBA(), this.strokeWidth);
        }
    }

    hitTest(px: number, py: number): boolean {
        const local = this.transformPointToLocal(px, py);
        if (!local) return false;
        const xr = local.x / this.rx;
        const yr = local.y / this.ry;

        return xr * xr + yr * yr <= 1;
    }

    getBounds(): Bounds {
        const points = this.getLocalEllipsePoints();
        const world = points.map(p => this.transformPointToDevice(p.x, p.y));
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
        return { minX: -this.rx, minY: -this.ry, maxX: this.rx, maxY: this.ry };
    }

    clone(): Oval {
        const clone = new Oval(this.id, this.rx, this.ry, this.transform.clone(), {
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
            type: "oval",
            id: this.id,
            rx: this.rx,
            ry: this.ry,
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
        const newCenterX = (minX + maxX) / 2;
        const newCenterY = (minY + maxY) / 2;
        const newRx = (maxX - minX) / 2;
        const newRy = (maxY - minY) / 2;

        this.transform.x = newCenterX;
        this.transform.y = newCenterY;
        this.rx = newRx;
        this.ry = newRy;
    }
}