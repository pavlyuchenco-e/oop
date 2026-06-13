import { type RGBA } from "../raster/RasterRenderer";
import type { RasterRenderer } from "../raster/RasterRenderer";
import { Transform } from "./Transform";
import { mat3, type Mat3 } from "../math/mat3";

export interface ShapeStyle {
    fillStyle?: RGBA;
    fillOpacity?: number;
    strokeStyle?: RGBA;
    strokeWidth?: number;
    strokeOpacity?: number;
}

export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export abstract class Shape {
    readonly id: string;
    transform: Transform;
    fillStyle: RGBA;
    fillOpacity: number;
    strokeStyle: RGBA;
    strokeWidth: number;
    strokeOpacity: number;

    constructor(id: string, transform?: Transform, style?: ShapeStyle) {
        this.id = id;
        this.transform = transform ?? new Transform();
        this.fillStyle = style?.fillStyle ?? { r: 0, g: 0, b: 0, a: 255 };
        this.fillOpacity = style?.fillOpacity ?? 1;
        this.strokeStyle = style?.strokeStyle ?? { r: 0, g: 0, b: 0, a: 255 };
        this.strokeWidth = style?.strokeWidth ?? 1;
        this.strokeOpacity = style?.strokeOpacity ?? 1;
    }

    getLocalToDeviceMatrix(): Mat3 {
        return this.transform.getLocalToWorldMatrix();
    }

    getDeviceToLocalMatrix(): Mat3 | null{
        return this.transform.getWorldToLocalMatrix();
    }

    transformPointToDevice(px: number, py: number): {x: number; y: number} {
        const m = this.getLocalToDeviceMatrix();
        return mat3.transformPoint(m, px, py);
    }

    transformPointToLocal(px: number, py: number): { x: number; y: number } | null {
        const inv = this.getDeviceToLocalMatrix();
        if (!inv) return null;
        return mat3.transformPoint(inv, px, py);
    }

    abstract drawRaster(r: RasterRenderer): void;
    abstract hitTest(px: number, py: number): boolean;
    abstract getBounds(): Bounds;
    abstract getLocalBounds(): Bounds;
    abstract toJSON(): any;
    abstract clone(): Shape;
    abstract resizeFromDeviceAABB(minX: number, minY: number, maxX: number, maxY: number): void;

    getCenter(): {x: number; y: number} {
        const bounds = this.getBounds();
        return{
            x: (bounds.maxX + bounds.minX ) / 2,
            y: (bounds.maxY + bounds.minY) / 2,
        };
    }

    setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
        this.resizeFromDeviceAABB(minX, minY, maxX, maxY);
    }

    protected getFillRGBA(): RGBA{
        const c = this.fillStyle;
        const a = Math.round(c.a * this.fillOpacity);
        return { r: c.r, g: c.g, b: c.b, a };
    }

    protected getStrokeRGBA(): RGBA {
        const c = this.strokeStyle;
        const a = Math.round(c.a * this.strokeOpacity);
        return { r: c.r, g: c.g, b: c.b, a };
    }

    protected serializeStyle(): object {
        return {
            fillStyle: this.fillStyle,
            fillOpacity: this.fillOpacity,
            strokeStyle: this.strokeStyle,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
        };
    }
}