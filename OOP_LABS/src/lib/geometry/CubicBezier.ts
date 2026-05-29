import { BezierCurve } from "./BezierCurve";
import { Transform } from "./Transform";

export class CubicBezier extends BezierCurve {
    p0: { x: number; y: number };
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    p3: { x: number; y: number };

    constructor(id: string, p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, transform?: Transform, style?: any) {
        super(id, transform, style);
        this.p0 = p0;
        this.p1 = p1;
        this.p2 = p2;
        this.p3 = p3;
    }

    getControlPoints(): { x: number; y: number }[] {
        return [this.p0, this.p1, this.p2, this.p3];
    }

    setControlPoint(index: number, pt: { x: number; y: number }): void {
        if (index === 0) this.p0 = pt;
        else if (index === 1) this.p1 = pt;
        else if (index === 2) this.p2 = pt;
        else if (index === 3) this.p3 = pt;
        else throw new Error("Invalid index");
    }

    evalLocal(t: number): { x: number; y: number } {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = mt3 * this.p0.x + 3*mt2*t * this.p1.x + 3*mt*t2 * this.p2.x + t3 * this.p3.x;
        const y = mt3 * this.p0.y + 3*mt2*t * this.p1.y + 3*mt*t2 * this.p2.y + t3 * this.p3.y;
        return { x, y };
    }

    clone(): CubicBezier {
        return new CubicBezier(this.id, { ...this.p0 }, { ...this.p1 }, { ...this.p2 }, { ...this.p3 },  this.transform.clone(), {
            fillStyle: { ...this.fillStyle },
            fillOpacity: this.fillOpacity,
            strokeStyle: { ...this.strokeStyle },
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
        });
    }

     toJSON(): any {
        return {
            type: "cubicBezier",
            id: this.id,
            p0: this.p0,
            p1: this.p1,
            p2: this.p2,
            p3: this.p3,
            transform: this.transform.toJSON(),
            style: { /* ... */ }
        };
    }

    resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number): void {
        const oldBounds = this.getBounds();
        const oldW = oldBounds.maxX - oldBounds.minX;
        const oldH = oldBounds.maxY - oldBounds.minY;
        if (oldW === 0 || oldH === 0) return;
        const scaleX = (maxX - minX) / oldW;
        const scaleY = (maxY - minY) / oldH;
        const newCenterX = (minX + maxX) / 2;
        const newCenterY = (minY + maxY) / 2;
        const oldCenterX = (oldBounds.minX + oldBounds.maxX) / 2;
        const oldCenterY = (oldBounds.minY + oldBounds.maxY) / 2;

        // Шаг 1: вычисляем новые мировые позиции контрольных точек ДО изменения transform
        const pts = [this.p0, this.p1, this.p2, this.p3];
        const newWorldPositions = pts.map(pt => {
            const world = this.transformPointToDevice(pt.x, pt.y);
            return {
                x: newCenterX + (world.x - oldCenterX) * scaleX,
                y: newCenterY + (world.y - oldCenterY) * scaleY,
            };
        });

        // Шаг 2: обновляем позицию трансформа — теперь матрица актуальна
        this.transform.x = newCenterX;
        this.transform.y = newCenterY;

        // Шаг 3: переводим мировые точки в локальные через НОВУЮ инвертированную матрицу
        const newLocals = newWorldPositions.map(w => this.transformPointToLocal(w.x, w.y));
        if (newLocals[0]) { this.p0.x = newLocals[0].x; this.p0.y = newLocals[0].y; }
        if (newLocals[1]) { this.p1.x = newLocals[1].x; this.p1.y = newLocals[1].y; }
        if (newLocals[2]) { this.p2.x = newLocals[2].x; this.p2.y = newLocals[2].y; }
        if (newLocals[3]) { this.p3.x = newLocals[3].x; this.p3.y = newLocals[3].y; }
    }
}