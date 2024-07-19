import { TransformControls } from './CMapJS/Libs/TransformControls.js';
import * as THREE from './CMapJS/Libs/three.module.js';

const geometry = new THREE.SphereGeometry(1, 10, 10);	
const material = new THREE.MeshLambertMaterial({color: new THREE.Color(0xFF0000)});


export default class TransformTool {
    #meshHandler;
    #generationId;
    #vertices;
    #positions0; 
    #transforms;
    #transformControl;
    #renderer;
    #scene;

    #size = 0.05;

    constructor ( meshHandler, generationId ) {
        this.#meshHandler = meshHandler;
        this.#generationId = generationId;

        this.#vertices = meshHandler.getVertices( this.#generationId );

        this.#update();
        this.#createRenderer();
    }

    #createRenderer ( ) {
        this.#renderer = new THREE.InstancedMesh(geometry, material, this.#vertices.length);
        this.#updateRenderer();
    }

    #update ( ) {
        this.#positions0 = this.#meshHandler.getInitialPositions( this.#vertices );
        this.#transforms = this.#meshHandler.getTransforms( this.#vertices );
    }

    #updateRenderer ( ) {
        const scale = new THREE.Vector3(this.#size, this.#size, this.#size);
        const matrix = new THREE.Matrix4();
        matrix.scale(scale);

        this.#vertices.forEach((vid, id) => {
            matrix.setPosition(this.#positions0[id]);
            this.#renderer.setMatrixAt(id, matrix);
        });
    }

    addTo ( scene ) {
        this.#scene = scene;
        this.show();
    }

    initializeTransformControl ( camera, dom ) {
        this.#transformControl = new TransformControls(camera, dom);
        this.#scene.add(this.#transformControl);

    }

    show ( ) {
        this.#scene.add(this.#renderer);
    }

    hide ( ) {
        this.#scene.remove(this.#renderer);
    }

    raycast ( raycaster ) {

    }

    resize ( ) {

    }
}