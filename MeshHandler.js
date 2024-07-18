import CMap2 from './CMapJS/CMap/CMap2.js';
import {Vector3} from './CMapJS/Libs/three.module.js';

/**
 * @class Generation - a container of subdivision iteration data
*/
class Generation {
    /**
     * Array containing the new vertex ids of the generation
     * @type {number}
     */
    vertices;
    /**
     * Attribute containing the position transformation of the generation
     * @type {Attribute}
     */
    transforms;
    
    constructor ( vertices, transforms ) {
        this.vertices = vertices;
        this.transforms = transforms;
    }
}


const path12_1 = [1, 2, -1];
const path_12_1 = [-1, 2, -1];
const W0 = 1/2, W1 = 1/8, W2 = -1/16;


/**
 * @class MeshHandler - handler to apply subdivisions, keep track of generations, and update positions
*/
export default class MeshHandler {
    /**
     * CMap of the mesh to be subdivided
     * @type {CMap2}
     */
    #mesh;

    /**
     * Attribute containing the positions of transformed vertices 
     * @type {Attribute}
     */
    #position;

    /**
     * Attribute containing the positions of vertices before transformation
     * @type {Attribute}
     */
    #position0;

    /**
     * Attribute containing the parents of vertices
     * @type {Attribute}
     */
    #parents;

    /**
     * Array containing all the subdivision generations
     * @type {Array}
     */
    #generations;

    /**
     * Creates a new mesh handler and initializes the generations structure
     * @param {CMap2} mesh - handled mesh
     */
    constructor ( mesh ) {
        this.#mesh = mesh;
        this.#position = mesh.getAttribute(mesh.vertex, "position");
        this.#position0 = mesh.addAttribute(mesh.vertex, "position0");
        this.#parents = mesh.addAttribute(mesh.vertex, "parents");
        this.#generations = [];


        /// initializing first generation
        const verticesGen0 = [];
        this.#mesh.foreach(this.#mesh.vertex, vd => {
            const vid = this.#mesh.cell(this.#mesh.vertex, vd);
            verticesGen0.push(vid);
            this.#position0[vid] = this.#position[vid].clone();
        });
        this.#newGeneration( verticesGen0 );
    }

    /**
     * Creates a new generation from the given vertices
     * @param {Array} vertices - vertex ids of the new generation
     */
    #newGeneration( vertices ) {
        const transforms = this.#mesh.addAttribute(this.#mesh.vertex, `transforms${this.#generations.length}`);
        const newGeneration = new Generation(vertices, transforms);
        this.#generations.push( newGeneration );
        return newGeneration;
    }

    /**
     * Applies a purely topological butterfly subdivision on the mesh
     * @returns {Array} vertex darts of all new vertices
     */
    #topologicalButterfly () {
        const faceCache = this.#mesh.cache(this.#mesh.face);
        const edgeCache = [];
        const edgeParents = [];

        this.#mesh.foreach(this.#mesh.edge, ed => {
            edgeCache.push(ed);
            const ed1 = this.#mesh.phi2[ed];
    
            const parents = [
                this.#mesh.cell(this.#mesh.vertex, ed),
                this.#mesh.cell(this.#mesh.vertex, ed1),
                this.#mesh.cell(this.#mesh.vertex, this.#mesh.phi_1[ed]),
                this.#mesh.cell(this.#mesh.vertex, this.#mesh.phi_1[ed1]),
                this.#mesh.cell(this.#mesh.vertex, this.#mesh.phi(path12_1, ed)),
                this.#mesh.cell(this.#mesh.vertex, this.#mesh.phi(path12_1, ed1)),
                this.#mesh.cell(this.#mesh.vertex, this.#mesh.phi(path_12_1, ed)),
                this.#mesh.cell(this.#mesh.vertex, this.#mesh.phi(path_12_1, ed1)),
            ];
    
            edgeParents.push(parents);
        });
        
        const newVerticesCache = edgeCache.map((ed, i) => {
            const vd = this.#mesh.cutEdge(ed, true);
            const vid = this.#mesh.cell(this.#mesh.vertex, vd);
            this.#parents[vid] = edgeParents[i];
            return vd;
        });

        let d0, d1;
        faceCache.forEach(fd => {
            d0 = this.#mesh.phi1[fd];
            d1 = this.#mesh.phi1[this.#mesh.phi1[d0]];
            this.#mesh.cutFace(d0, d1);

            d0 = d1;
            d1 = this.#mesh.phi1[this.#mesh.phi1[d0]];
            this.#mesh.cutFace(d0, d1);
            
            d0 = d1;
            d1 = this.#mesh.phi1[this.#mesh.phi1[d0]];
            this.#mesh.cutFace(d0, d1);
        });

        return newVerticesCache;
    }

    /**
     * Computes initial positions for all vertices of a generation
     * @private
     * @param {Generation} generation 
     */
    #computeGenerationInitialPositions ( generation ) {
        generation.vertices.forEach(vid => {
            this.#position0[vid] ??= new Vector3;

            const vpos = this.#position0[vid];
            const parents = this.#parents[vid];

            vpos.set(0,0,0);

            vpos.addScaledVector(this.#position[parents[0]], W0);
            vpos.addScaledVector(this.#position[parents[1]], W0);

            vpos.addScaledVector(this.#position[parents[2]], W1);
            vpos.addScaledVector(this.#position[parents[3]], W1);

            vpos.addScaledVector(this.#position[parents[4]], W2);
            vpos.addScaledVector(this.#position[parents[5]], W2);
            vpos.addScaledVector(this.#position[parents[6]], W2);
            vpos.addScaledVector(this.#position[parents[7]], W2);
        });
    }

    /**
     * Computes post transform positions for all vertices of a generation
     * @private
     * @param {Generation} generation 
     */
    #computeGenerationPositions ( generation ) {
        generation.vertices.forEach(vid => {
            this.#position[vid] ??= new Vector3;
            this.#position[vid].copy(this.#position0[vid]);

            this.#applyTransform(this.#position[vid], generation.transforms[vid]);
        });
    }

    /**
     * Applies a transformation to the given vertex
     * @param {Vector3} vpos - vertex position
     * @param {Vector3} transform - vertex transformation
     */
    #applyTransform ( vpos, transform ) {
        if(transform == undefined) 
            return;

        vpos.add(transform);
    }

     /**
     * Applies a butterfly subdivision to the mesh and computes positions of new vertices
     */
    subdivide ( ) {
	    const newVertices = this.#topologicalButterfly();
        const newVerticesIds = newVertices.map(vd => this.#mesh.cell(this.#mesh.vertex, vd));
        const newGeneration = this.#newGeneration( newVerticesIds );
        this.#computeGenerationInitialPositions( newGeneration );
        this.#computeGenerationPositions( newGeneration );
    }

    setTransform ( vid, generation, transform ) {
        generation.transforms[vid].copy(transform);
    }

    // updatePositions ( ) {

    // }
}