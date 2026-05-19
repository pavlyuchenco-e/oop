import { describe, expect, test } from "vitest";
import { Rect } from "./Rect";
import { Line } from "./Line";
import { Oval } from "./Oval";
import { Triangle } from "./Triangle";
import { QuadraticBezier } from "./QuadraticBezier";
import { CubicBezier } from "./CubicBezier";
import { PathBezier } from "./PathBezier";
import { Transform } from "./Transform";

describe("Rect", () => {
    const rect = new Rect("r1", 100, 50, new Transform({ x: 200, y: 150, scaleX: 2, scaleY: 1 }));
    test("hitTest inside", () => {
        expect(rect.hitTest(200, 150)).toBe(true);   // центр
        expect(rect.hitTest(240, 150)).toBe(true);   // правый край (локально x=40, w/2=50)
        expect(rect.hitTest(200, 170)).toBe(true);   // низ
    });
    test("hitTest outside", () => {
        expect(rect.hitTest(200, 200)).toBe(false);
        expect(rect.hitTest(300, 150)).toBe(false);
    });
    test("getBounds", () => {
        const b = rect.getBounds();
        // центр (200,150), ширина 100*2=200, высота 50*1=50
        expect(b.minX).toBeCloseTo(100);
        expect(b.maxX).toBeCloseTo(300);
        expect(b.minY).toBeCloseTo(125);
        expect(b.maxY).toBeCloseTo(175);
    });
});

describe("Line", () => {
    const line = Line.fromScreenPoints("l1", { x: 100, y: 100 }, { x: 200, y: 200 });
    line.strokeWidth = 10;
    test("hitTest near line", () => {
        expect(line.hitTest(150, 150)).toBe(true);   // середина
        expect(line.hitTest(150, 145)).toBe(true);   // близко (в пределах 5 пикселей)
        expect(line.hitTest(150, 135)).toBe(false);  // далеко
    });
    test("getBounds", () => {
        const b = line.getBounds();
        expect(b.minX).toBe(100);
        expect(b.maxX).toBe(200);
        expect(b.minY).toBe(100);
        expect(b.maxY).toBe(200);
    });
});

describe("Oval", () => {
    const oval = new Oval("o1", 80, 40, new Transform({ x: 300, y: 200, scaleX: 1.5, scaleY: 1 }));
    test("hitTest inside", () => {
        expect(oval.hitTest(300, 200)).toBe(true);  // центр
        expect(oval.hitTest(350, 200)).toBe(true);  // правый край (локально x=50, rx=80, масштаб 1.5 => 50/1.5=33.3, rx=80)
        expect(oval.hitTest(300, 220)).toBe(true);
    });
    test("hitTest outside", () => {
        expect(oval.hitTest(450, 200)).toBe(false);
        expect(oval.hitTest(300, 250)).toBe(false);
    });
});

describe("Triangle", () => {
    const tri = new Triangle("t1", { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 });
    test("hitTest inside", () => {
        expect(tri.hitTest(50, 30)).toBe(true);
        expect(tri.hitTest(50, 70)).toBe(true);
    });
    test("hitTest outside", () => {
        expect(tri.hitTest(-10, 0)).toBe(false);
        expect(tri.hitTest(120, 0)).toBe(false);
        expect(tri.hitTest(50, 110)).toBe(false);
    });
    test("getBounds", () => {
        const b = tri.getBounds();
        expect(b.minX).toBeCloseTo(0);
        expect(b.maxX).toBeCloseTo(100);
        expect(b.minY).toBeCloseTo(0);
        expect(b.maxY).toBeCloseTo(100);
    });
    test("clone and toJSON", () => {
        const clone = tri.clone();
        const origBounds = tri.getLocalBounds();
        const cloneBounds = clone.getLocalBounds();
        expect(cloneBounds.minX).toBeCloseTo(origBounds.minX);
        expect(cloneBounds.minY).toBeCloseTo(origBounds.minY);
        expect(cloneBounds.maxX).toBeCloseTo(origBounds.maxX);
        expect(cloneBounds.maxY).toBeCloseTo(origBounds.maxY);
        const json = tri.toJSON();
        expect(json.type).toBe("triangle");
        expect(json.vertices).toHaveLength(3);
    });
});

describe("QuadraticBezier", () => {
    const qb = new QuadraticBezier("qb1", { x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 });
    qb.strokeWidth = 5; // увеличиваем порог попадания для тестов

    test("evalLocal at endpoints", () => {
        expect(qb.evalLocal(0)).toEqual({ x: 0, y: 0 });
        expect(qb.evalLocal(1)).toEqual({ x: 100, y: 0 });
    });
    test("hitTest on curve", () => {
        // точка в середине (t=0.5) – должна быть близко к кривой
        expect(qb.hitTest(50, 50)).toBe(true);
        // точка далеко от кривой
        expect(qb.hitTest(50, 80)).toBe(false);
    });
    test("getBounds approximates curve", () => {
        const b = qb.getBounds();
        expect(b.minX).toBeLessThanOrEqual(0);
        expect(b.maxX).toBeGreaterThanOrEqual(100);
        expect(b.minY).toBeLessThanOrEqual(0);
        expect(b.maxY).toBeGreaterThanOrEqual(49);
        expect(b.maxY).toBeLessThanOrEqual(51);
    });
    test("clone", () => {
        const clone = qb.clone();
        expect(clone.getControlPoints()).toEqual(qb.getControlPoints());
    });
});

describe("CubicBezier", () => {
    const cb = new CubicBezier("cb1", { x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 });
    cb.strokeWidth = 5;

    test("evalLocal at endpoints", () => {
        expect(cb.evalLocal(0)).toEqual({ x: 0, y: 0 });
        expect(cb.evalLocal(1)).toEqual({ x: 100, y: 0 });
    });
    test("hitTest on curve", () => {
        expect(cb.hitTest(50, 75)).toBe(true);
        expect(cb.hitTest(50, 90)).toBe(false);
    });
    test("getBounds", () => {
        const b = cb.getBounds();
        expect(b.minX).toBe(0);
        expect(b.maxX).toBe(100);
        expect(b.minY).toBe(0); 75
        expect(b.maxY).toBe(75); 
    });
});

describe("PathBezier (polyline mode)", () => {
    const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
    ];
    const path = new PathBezier("path1", points, "polyline", false);
    path.strokeWidth = 5;

    test("hitTest on segments", () => {
        // на первом отрезке (горизонталь)
        expect(path.hitTest(50, 2)).toBe(true);
        // на втором (вертикаль)
        expect(path.hitTest(98, 25)).toBe(true);
        // снаружи
        expect(path.hitTest(50, 60)).toBe(false);
    });
    test("getBounds", () => {
        const b = path.getBounds();
        expect(b.minX).toBe(0);
        expect(b.maxX).toBe(100);
        expect(b.minY).toBe(0);
        expect(b.maxY).toBe(50);
    });
    test("add/remove points", () => {
        path.addPointLocal({ x: 50, y: 25 });
        expect(path.getControlPoints()).toHaveLength(5);
        path.removePoint(2);
        expect(path.getControlPoints()).toHaveLength(4);
    });
    test("clone", () => {
        const clone = path.clone();
        expect(clone.getControlPoints()).toEqual(path.getControlPoints());
        expect(clone.pathType).toBe(path.pathType);
    });
});