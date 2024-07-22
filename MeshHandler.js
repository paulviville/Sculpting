import CMap2 from './CMapJS/CMap/CMap2.js';
import {Vector3} from './CMapJS/Libs/three.module.js';
import TransformTool from './TransformTool.js';

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
     * Array containing the parent vertex ids of the generation
     * @type {number}
     */
    parentVertices;
    /**
     * Attribute containing the position transformation of the generation
     * @type {Attribute}
     */
    transforms;
    /** Attribute containing the position of vertices at this generation
     * @type {Attribute}
    */
    position;

    constructor ( vertices, parentVertices, position, transforms ) {
        this.vertices = vertices;
        this.parentVertices = parentVertices;
        this.position = position;
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
        this.#newGeneration( verticesGen0, [], this.#position0 );
    }

    /**
     * Creates a new generation from the given vertices
     * @param {Array} vertices - vertex ids of the new generation
     */
    #newGeneration( vertices, parentVertices, position0 ) {
        const generationId = this.#generations.length;
        const transforms = this.#mesh.addAttribute(this.#mesh.vertex, `transforms${this.#generations.length}`);
        const position = position0 ?? this.#mesh.addAttribute(this.#mesh.vertex, `position0_${this.#generations.length}`);;
        const newGeneration = new Generation(vertices, parentVertices, position, transforms);
        this.#generations.push( newGeneration );
        console.log(newGeneration   )
        return generationId;
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
     * @param {number} generationId 
     */
    #computeGenerationInitialPositions ( generationId ) {
        const parentGeneration = this.#generations[generationId - 1];

        const generation = this.#generations[generationId];
        generation.vertices.forEach(vid => {
            this.#position0[vid] ??= new Vector3;

            const vpos = this.#position0[vid];
            const parents = this.#parents[vid];

            vpos.set(0,0,0);

            vpos.addScaledVector(parentGeneration.position[parents[0]], W0);
            vpos.addScaledVector(parentGeneration.position[parents[1]], W0);

            vpos.addScaledVector(parentGeneration.position[parents[2]], W1);
            vpos.addScaledVector(parentGeneration.position[parents[3]], W1);

            vpos.addScaledVector(parentGeneration.position[parents[4]], W2);
            vpos.addScaledVector(parentGeneration.position[parents[5]], W2);
            vpos.addScaledVector(parentGeneration.position[parents[6]], W2);
            vpos.addScaledVector(parentGeneration.position[parents[7]], W2);
        });

        // generation.parentVertices.forEach(vid => {

        // });

    }

    /**
     * Computes post transform positions for all vertices
     * @private
     * @param {number} generationId 
     */
    #computeGenerationPositions ( generationId ) {
        const parentGeneration = this.#generations[generationId - 1];
        const generation = this.#generations[generationId];

        console.log(generation, parentGeneration)

        generation.vertices.forEach(vid => {
            this.#position[vid] ??= new Vector3;
            generation.position[vid] ??= new Vector3;
            generation.position[vid].copy(this.#position0[vid]);
        });

        generation.parentVertices.forEach(vid => {
            generation.position[vid] ??= new Vector3;
            generation.position[vid].copy(parentGeneration.position[vid]);
        });

        generation.transforms.forEach((transform, vid) => {
            this.#applyTransform(generation.position[vid], transform);
            console.log(generationId)
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
        const parentVertices = this.#mesh.cache(this.#mesh.vertex);
        const parentVerticesIds = parentVertices.map(vd => this.#mesh.cell(this.#mesh.vertex, vd));
	    const newVertices = this.#topologicalButterfly();
        const newVerticesIds = newVertices.map(vd => this.#mesh.cell(this.#mesh.vertex, vd));
        const newGeneration = this.#newGeneration( newVerticesIds, parentVerticesIds );
        this.#computeGenerationInitialPositions( newGeneration );
        // this.#computeGenerationPositions( newGeneration );
        this.updatePositions();
    }

    /**
     * Set the vertex transform at the specified generation
     * @param {number} vid - vertex id
     * @param {number} generationId - generation id
     * @param {Vector3} transform - transform to copy
     */
    setTransform ( vid, generationId, transform ) {
        this.#generations[generationId].transforms[vid] ??= new Vector3;
        this.#generations[generationId].transforms[vid].copy(transform);

        // console.log( this.#generations[generationId].transforms, this.#position, this.#position0)
    }

    /**
     * Get the vertex transform at the specified generation
     * @param {number} vid - vertex id
     * @param {number} generationId - generation id
     * @return {Vector3 | undefined} transform of the vertex
     */
    getTransform ( vid, generationId ) {
        return this.#generations[generationId].transforms[vid];
    }

    /**
     * Updates positions of all vertices cascading from input generation
     * @param {number} generationId 
     */
    updatePositions ( generationId = 0 ) {
        let i = generationId;

        /// maybe not only for 0, but for generationId
        /// switch loop to (i = i + 1;...)
        if(i == 0) {
            // this.#computeGenerationPositions(i);
            this.#computeGenerationPositions(i);
            ++i;
        }
        for(i; i < this.#generations.length; ++i) {
            this.#computeGenerationInitialPositions(i);
            // this.#computeGenerationPositions(i);
            this.#computeGenerationPositions(i);
        }

        const finalGeneration = this.#generations[this.#generations.length - 1]
        finalGeneration.vertices.forEach(vid => {
            this.#position[vid] ??= new Vector3();
            this.#position[vid].copy(finalGeneration.position[vid]);
        });

        finalGeneration.parentVertices.forEach(vid => {
            this.#position[vid] ??= new Vector3();
            this.#position[vid].copy(finalGeneration.position[vid]);
        });
    }

    getInitialPositions ( vertices ) {
        return vertices.map(vid => {
            return this.#position0[vid].clone();
        });      
    }

    getTransforms ( vertices, generationId = 0 ) {
        return vertices.map(vid => {
            return this.#generations[generationId].transforms[vid]?.clone();
        });      
    }

    getVertices ( generationId = 0 ) {
        const vertices = []

        for(let i = 0; i <= generationId; ++i) {
            vertices.push(...this.#generations[i].vertices);
        }

        return vertices;
    }

    /**
     * Returns all vertices, positions, and transforms of given generation
     * @param {number} generationId 
     */
    createTransformTool ( generationId = 0 ) {
        return new TransformTool(this, generationId);
    }
}