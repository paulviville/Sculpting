import { TransformControls } from './CMapJS/Libs/TransformControls.js';
import * as THREE from './CMapJS/Libs/three.module.js';
import { DualQuaternion } from './DualQuaternion.js';

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

    #dummy;
    #renderFunc;
    #orbitControls;
    #meshViewer;

    #targetVertex = 0;

    constructor ( meshHandler, generationId ) {
        this.#meshHandler = meshHandler;
        this.#generationId = generationId;

        this.#vertices = meshHandler.getVertices( this.#generationId );

        this.#update();

        this.#createRenderer();

        console.log(this.#transforms, this.#positions0)
    }

    #createRenderer ( ) {
        this.#renderer = new THREE.InstancedMesh(geometry, material, this.#vertices.length);
        this.#updateRenderer();
    }

    #update ( ) {
        this.#positions0 = this.#meshHandler.getInitialPositions( this.#generationId );
        this.#transforms = this.#meshHandler.getTransforms( this.#generationId );
    }

    #updateRenderer ( ) {
        const scale = new THREE.Vector3(this.#size, this.#size, this.#size);
        const matrix = new THREE.Matrix4();
        const tempVector = new THREE.Vector3();
        
        matrix.scale(scale);

        this.#vertices.forEach((vid, id) => {
            const dq = this.#positions0[id].clone();
            const trans = this.#transforms[id]?.clone();
            if(trans) {
                dq.premultiply(trans);
            }
            matrix.setPosition(dq.transform(tempVector.set(0, 0, 0).clone()));
            this.#renderer.setMatrixAt(id, matrix);
        });
        this.#renderer.instanceMatrix.needsUpdate = true;
    }

    #updateMatrix ( id ) {
        const scale = new THREE.Vector3(this.#size, this.#size, this.#size);
        const matrix = new THREE.Matrix4();
        const tempVector = new THREE.Vector3();
        const dq = this.#positions0[id].clone();
        const trans = this.#transforms[id]?.clone();
        if(trans) {
            dq.premultiply(trans);
        }
        matrix.scale(scale);
        matrix.setPosition(dq.transform(tempVector.set(0, 0, 0).clone()));
        this.#renderer.setMatrixAt(id, matrix);
        this.#renderer.instanceMatrix.needsUpdate = true;
    }

    #setTarget ( id ) {
        this.#targetVertex = id;
        const dq = this.#positions0[this.#targetVertex].clone();
        this.#transforms[this.#targetVertex] ??= new DualQuaternion();
        const trans = this.#transforms[this.#targetVertex] 
        dq.premultiply(trans);

        const translation = dq.getTranslation();
        const rotation = dq.getRotation();
        this.#dummy.position.copy(dq.transform(new THREE.Vector3()));
        this.#dummy.rotation.setFromQuaternion(rotation);
    }

    addTo ( scene ) {
        this.#scene = scene;
    }

    initializeTransformControl ( camera, dom, renderFunc, orbitControls, meshViewer ) {
        this.#dummy = new THREE.Group();
        this.#transformControl = new TransformControls(camera, dom);
        this.#transformControl.attach(this.#dummy)
        this.#renderFunc = renderFunc;
        this.#orbitControls = orbitControls;
        this.#meshViewer = meshViewer;

    }

    #computeTransform( id ) {
        const translation0 = this.#positions0[id].transform(new THREE.Vector3())
        const translation = this.#dummy.position.clone().sub(translation0)


        const rotation0 = this.#positions0[id].getRotation().invert()
        const rotation = new THREE.Quaternion().setFromEuler(this.#dummy.rotation)
        rotation.multiply(rotation0)
        console.log(rotation0, rotation)

        const transform = new DualQuaternion();
        const DQr = DualQuaternion.setFromRotation(rotation);
        const DQt = DualQuaternion.setFromTranslation(translation);
        transform.multiply(DQr)
        transform.premultiply(DQt)

        // const transform = DualQuaternion.setFromRotationTranslation(rotation, translation)
        // const transform = DualQuaternion.setFromTranslationRotation(rotation, translation)
        this.#transforms[id].copy(transform);
        // this.#transforms[this.#targetVertex].copy(this.#dummy.position);
        // this.#transforms[this.#targetVertex].sub(this.#positions0[this.#targetVertex]);
    }

    #onChange() {
        this.#renderFunc();
        if(this.#transformControl.dragging) {
            
            this.#computeTransform(this.#targetVertex);
            this.#updateMatrix(this.#targetVertex);

            this.#meshHandler.setTransform(
                this.#vertices[this.#targetVertex],
                this.#generationId,
                this.#transforms[this.#targetVertex]
            );
            this.#meshHandler.updatePositions(this.#generationId);
            this.#meshViewer.updateFacesPos()
        }
    }

    show ( ) {

        this.#update();
        this.#updateRenderer();
        this.#setTarget(this.#targetVertex);

        

        this.#scene.add(this.#renderer);
        this.#scene.add(this.#dummy)
        this.#scene.add(this.#transformControl);

        const controls = this.#orbitControls
        this.#transformControl.addEventListener('change', this.#onChange.bind(this));
        this.#transformControl.addEventListener('dragging-changed', function(event) {
            controls.enabled = !event.value;
        });
        this.#transformControl.enabled = true;
    }

    hide ( ) {
        this.#scene.remove(this.#renderer);
        this.#scene.remove(this.#dummy)
        this.#scene.remove(this.#transformControl);

        this.#transformControl.enabled = false;

    }

    raycast ( raycaster ) { 
        const hit = raycaster.intersectObject(this.#renderer)[0];
        if(hit) {
            this.#setTarget(hit.instanceId);
        }
    }

    resize ( size ) {
        this.#size = size;
        this.#updateRenderer();
    }

    setMode ( mode ) {
        this.#transformControl.setMode(mode)
    }

    setSpace ( mode ) {
        this.#transformControl.setSpace(mode)
    }
}