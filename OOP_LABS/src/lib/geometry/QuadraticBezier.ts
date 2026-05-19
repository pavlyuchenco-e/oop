import { BezierCurve } from "./BezierCurve";
import { Transform } from "./Transform";

export class QuadraticBezier extends BezierCurve {
    p0: { x: number; y: number };
    p1: { x: number; y: number };
    p2: { x: number; y: number };

    constructor(id: string, p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, transform?: Transform, style?: any) {
        super(id, transform, style);
        this.p0 = p0;
        this.p1 = p1;
        this.p2 = p2;
    }

    getControlPoints(): { x: number; y: number }[] {
        return [this.p0, this.p1, this.p2];
    }

    setControlPoint(index: number, pt: { x: number; y: number }): void {
        if (index === 0) this.p0 = pt;
        else if (index === 1) this.p1 = pt;
        else if (index === 2) this.p2 = pt;
        else throw new Error("Invalid index");
    }

    evalLocal(t: number): { x: number; y: number } {
        const mt = 1 - t;
        const x = mt*mt * this.p0.x + 2*mt*t * this.p1.x + t*t * this.p2.x;
        const y = mt*mt * this.p0.y + 2*mt*t * this.p1.y + t*t * this.p2.y;
        return { x, y };
    }

    clone(): QuadraticBezier {
        return new QuadraticBezier(this.id, { ...this.p0 }, { ...this.p1 }, { ...this.p2 }, this.transform.clone(), {
            fillStyle: { ...this.fillStyle },
            fillOpacity: this.fillOpacity,
            strokeStyle: { ...this.strokeStyle },
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
        });
    }

    toJSON(): any {
        return {
            type: "quadraticBezier",
            id: this.id,
            p0: this.p0,
            p1: this.p1,
            p2: this.p2,
            transform: this.transform.toJSON(),
            style: { /* ... */ }
        };
    }

    resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number): void {
        //масштабируем контрольные точки относительно центра AABB
        const oldBounds = this.getBounds();
        const scaleX = (maxX - minX) / (oldBounds.maxX - oldBounds.minX);
        const scaleY = (maxY - minY) / (oldBounds.maxY - oldBounds.minY);
        const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        for (let pt of [this.p0, this.p1, this.p2]) {
            const world = this.transformPointToDevice(pt.x, pt.y);
            const newWorldX = center.x + (world.x - center.x) * scaleX;
            const newWorldY = center.y + (world.y - center.y) * scaleY;
            const newLocal = this.transformPointToLocal(newWorldX, newWorldY);
            if (newLocal) {
                pt.x = newLocal.x;
                pt.y = newLocal.y;
            }
        }
        this.transform.x = center.x;
        this.transform.y = center.y;
    }
}