import { Shape, type Bounds } from "./Shape";
import { type RasterRenderer } from "../raster/RasterRenderer";
import { Transform } from "./Transform";
import { CubicBezier } from "./CubicBezier";

export type PathType = 'polyline' | 'bezier' | 'catmull';

export class PathBezier extends Shape {
    points: { x: number; y: number }[];   // локальные точки
    pathType: PathType;
    closed: boolean;
    private cachedBeziers: CubicBezier[] | null = null;

    constructor(id: string, points: { x: number; y: number }[], pathType: PathType, closed = false, transform?: Transform, style?: any) {
        super(id, transform, style);
        this.points = points;
        this.pathType = pathType;
        this.closed = closed;
        this.updateCache();
    }

    // для bezier и catmull
    private updateCache(): void {
        if (this.pathType === 'polyline') {
            this.cachedBeziers = null;
            return;
        }
        if (this.pathType === 'bezier') {
            // Группируем по 4 точки: [p0,p1,p2,p3] -> сегмент, затем [p3,p4,p5,p6] и т.д.
            const beziers: CubicBezier[] = [];
            for (let i = 0; i + 3 < this.points.length; i += 3) {
                const seg = new CubicBezier(
                    `${this.id}_seg_${i}`,
                    this.points[i], this.points[i+1], this.points[i+2], this.points[i+3],
                    new Transform({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })
                );
                beziers.push(seg);
            }
            this.cachedBeziers = beziers;
        }
        else if (this.pathType === 'catmull') {
            this.cachedBeziers = this.catmullRomToBeziers();
        }
    }

    private catmullRomToBeziers(): CubicBezier[] {
        const pts = this.points;
        if (pts.length < 2) return [];
        const beziers: CubicBezier[] = [];
        const effectivePoints = this.closed ? [...pts, pts[0]] : pts;
        for (let i = 0; i < effectivePoints.length - 1; i++) {
            const p0 = effectivePoints[Math.max(0, i-1)];
            const p1 = effectivePoints[i];
            const p2 = effectivePoints[i+1];
            const p3 = effectivePoints[Math.min(effectivePoints.length-1, i+2)];
            // Коэффициент натяжения
            const tension = 0.5;
            const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
            const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
            const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
            const cp2y = p2.y - (p3.y - p1.y) * tension / 3;
            const bezier = new CubicBezier(
                `${this.id}_cat_${i}`,
                p1, { x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }, p2,
                new Transform({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })
            );
            beziers.push(bezier);
        }
        return beziers;
    }

    private getFlattenedDevicePoints(): { x: number; y: number }[] {
        if (this.pathType === 'polyline') {
            return this.points.map(p => this.transformPointToDevice(p.x, p.y));
        } else if (this.cachedBeziers) {
            const flat: { x: number; y: number }[] = [];
            for (const bez of this.cachedBeziers) {
                const segPoints = bez.getFlattenedDevicePoints();
                if (flat.length === 0) flat.push(...segPoints);
                else flat.push(...segPoints.slice(1));
            }
            if (this.closed && flat.length > 0) flat.push(flat[0]); // замыкаем
            return flat;
        }
        return [];
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
            // расстояние до отрезка
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
        const threshold = this.strokeWidth / 2;
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
        const pts = this.points;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        return { minX, minY, maxX, maxY };
    }

    clone(): PathBezier {
        return new PathBezier(this.id, this.points.map(p => ({ ...p })), this.pathType, this.closed, this.transform.clone(), {
            fillStyle: { ...this.fillStyle },
            fillOpacity: this.fillOpacity,
            strokeStyle: { ...this.strokeStyle },
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
        });
    }

    toJSON(): any {
        return {
            type: "pathBezier",
            id: this.id,
            points: this.points,
            pathType: this.pathType,
            closed: this.closed,
            transform: this.transform.toJSON(),
            style: this.serializeStyle(),
        };
    }

    getControlPoints(): { x: number; y: number }[] {
        return this.points;
    }

    setControlPoint(index: number, pt: { x: number; y: number }): void {
        if (index >= 0 && index < this.points.length) {
            this.points[index] = pt;
            this.updateCache();
        }
    }

    addPointLocal(pt: { x: number; y: number }, insertAtIndex?: number): void {
        if (insertAtIndex !== undefined && insertAtIndex >= 0 && insertAtIndex <= this.points.length) {
            this.points.splice(insertAtIndex, 0, pt);
        } else {
            this.points.push(pt);
        }
        this.updateCache();
    }

    removePoint(index: number): void {
        if (index >= 0 && index < this.points.length) {
            this.points.splice(index, 1);
            this.updateCache();
        }
    }

    resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number): void {
        // Масштабируем все точки относительно нового AABB
        const oldBounds = this.getBounds();
        const scaleX = (maxX - minX) / (oldBounds.maxX - oldBounds.minX);
        const scaleY = (maxY - minY) / (oldBounds.maxY - oldBounds.minY);
        const newCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        for (let pt of this.points) {
            const world = this.transformPointToDevice(pt.x, pt.y);
            const newWorldX = newCenter.x + (world.x - newCenter.x) * scaleX;
            const newWorldY = newCenter.y + (world.y - newCenter.y) * scaleY;
            const newLocal = this.transformPointToLocal(newWorldX, newWorldY);
            if (newLocal) {
                pt.x = newLocal.x;
                pt.y = newLocal.y;
            }
        }
        this.transform.x = newCenter.x;
        this.transform.y = newCenter.y;
        this.updateCache();
    }
}