import { describe, expect, test } from "vitest";
import { Rect } from "./Rect";
import { Line } from "./Line";
import { Oval } from "./Oval";
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