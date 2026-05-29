import { Shape, type Bounds } from "./Shape";
import { type RasterRenderer } from "../raster/RasterRenderer";

export abstract class BezierCurve extends Shape {
    abstract getControlPoints(): { x: number; y: number }[];
    abstract setControlPoint(index: number, pt: { x: number; y: number }): void;
    abstract evalLocal(t: number): { x: number; y: number };

    protected flattenLocal(flatness = 1.0): { x: number; y: number }[] {
        const steps = Math.max(20, Math.floor(50 / Math.max(0.1, flatness)));
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            points.push(this.evalLocal(t));
        }
        return points;
    }

    public getFlattenedDevicePoints(flatness = 1.0): { x: number; y: number }[] {
        return this.flattenLocal(flatness).map(p => this.transformPointToDevice(p.x, p.y));
    }

    drawRaster(r: RasterRenderer): void {
        const points = this.getFlattenedDevicePoints();
        if (points.length < 2) return;
        if (this.strokeWidth > 0 && this.strokeOpacity > 0) {
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i+1];
                if (this.strokeWidth <= 1) {
                    r.drawLine(p1.x, p1.y, p2.x, p2.y, this.getStrokeRGBA());
                } else {
                    r.strokeLine(p1.x, p1.y, p2.x, p2.y, this.getStrokeRGBA(), this.strokeWidth);
                }
            }
        }
    }

    hitTest(px: number, py: number): boolean {
        const points = this.getFlattenedDevicePoints();
        if (points.length < 2) return false;
        let minDistSq = Infinity;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i+1];
            // расстояние от точки до отрезка
            const abx = p2.x - p1.x;
            const aby = p2.y - p1.y;
            const t = ((px - p1.x) * abx + (py - p1.y) * aby) / (abx*abx + aby*aby);
            const clampedT = Math.max(0, Math.min(1, t));
            const projX = p1.x + clampedT * abx;
            const projY = p1.y + clampedT * aby;
            const dx = px - projX;
            const dy = py - projY;
            const distSq = dx*dx + dy*dy;
            if (distSq < minDistSq) minDistSq = distSq;
        }
        const threshold = Math.max(5, this.strokeWidth / 2);
        return Math.sqrt(minDistSq) <= threshold;
    }

    getBounds(): Bounds {
        const points = this.getFlattenedDevicePoints();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        return { minX, minY, maxX, maxY };
    }

    getLocalBounds(): Bounds {
        const points = this.flattenLocal();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        return { minX, minY, maxX, maxY };
    }
}