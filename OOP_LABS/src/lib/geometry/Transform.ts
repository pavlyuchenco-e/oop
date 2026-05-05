import { mat3, type Mat3 } from "../math/mat3";

export interface TransformParams {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
}

export class Transform {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;

    constructor(params: Partial<TransformParams> = {}){
        this.x = params.x ?? 0;
        this.y = params.y ?? 0;
        this.rotation = params.rotation ?? 0;
        this.scaleX = params.scaleX ?? 1;
        this.scaleY = params.scaleY ?? 1;
    }

    getLocalToWorldMatrix(): Mat3 {
        return mat3.fromTransform(this.x, this.y, this.rotation, this.scaleX, this.scaleY);
    }

    getWorldToLocalMatrix(): Mat3 | null {
        const m = this.getLocalToWorldMatrix();
        return mat3.invert(m);
    }

    clone(): Transform {
        return new Transform({
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
        });
    }

    toJSON(): TransformParams{
        return {
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
        };
    }

}