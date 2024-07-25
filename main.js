import * as THREE from './CMapJS/Libs/three.module.js';
import * as Meshes from './meshes.js';

import { loadCMap2 } from './CMapJS/IO/SurfaceFormats/CMap2IO.js';
import { exportCmap2 } from './CMapJS/IO/SurfaceFormats/CMap2IO.js';

import { OrbitControls } from './CMapJS/Libs/OrbitsControls.js';
import MeshViewer from './MeshViewer.js';
import MeshHandler from './MeshHandler.js';

import { GUI } from './CMapJS/Libs/dat.gui.module.js';

import catmullClark from './CMapJS/Modeling/Subdivision/Surface/CatmullClark.js';
import loop from './CMapJS/Modeling/Subdivision/Surface/Loop.js';
import dooSabin from './CMapJS/Modeling/Subdivision/Surface/DooSabin.js';
import sqrt2 from './CMapJS/Modeling/Subdivision/Surface/Sqrt2.js';
import sqrt3 from './CMapJS/Modeling/Subdivision/Surface/Sqrt3.js';
import butterfly from './CMapJS/Modeling/Subdivision/Surface/Butterfly.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xAAAAAA);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000.0);
camera.position.set(0, 0, 2);

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

let controls = new OrbitControls(camera, renderer.domElement)


window.addEventListener('resize', function() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});

let ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
scene.add(ambientLight);
let pointLight = new THREE.PointLight(0xFFFFFF, 1);
pointLight.position.set(10,8,5);
scene.add(pointLight);

let meshViewer;
let meshHandler;
let cmap;

const settings = new (function() {
	this.showVertex = false;
	this.vertexSize = 0.01;
	this.vertexColor = 0x4EA6BA;
	this.updateVertexColor = function (color) {meshViewer.setVertexColor(color)};
	this.updateVertexVisibility = function (visible) {meshViewer.vertexVisibility(visible)};
	this.showEdge = false;
	this.edgeSize = 0.5;
	this.edgeColor = 0x0A0A20;
	this.updateEdgeColor = function (color) {meshViewer.setEdgeColor(color)};
	this.updateEdgeVisibility = function (visible) {meshViewer.edgeVisibility(visible)};
	this.showFace = true;
	this.faceColor = 0x66AABB;
	this.updateFaceColor = function (color) {meshViewer.setFaceColor(color)};
	this.updateFaceVisibility = function (visible) {meshViewer.faceVisibility(visible)};

	this.vertexResize = function (size) {meshViewer.resizeVertices(size)};
	this.edgeResize = function (size) {meshViewer.resizeEdges(size)};


	this.mesh = 'octahedron';

	this.nbSubdivs = 0;
	this.subdivide = function () {
		meshHandler.subdivide()
		meshViewer.updateMeshes()
		++this.nbSubdivs;
	};
	
	this.showTool = false;
	this.tooldID = 0;
	this.activeTool;
	this.tools = [];
	this.toolSize = 0.05;

	this.toggleTool = function () {
		if(this.showTool)
			this.openTool()
		else
			this.closeTool()
	}

	this.openTool = function () {


		if(this.activeTool)
			this.activeTool.hide();

		if(this.tooldID > this.nbSubdivs) {
			this.tooldID = this.nbSubdivs;
		}

		if(!this.tools[this.tooldID]) {
			this.tools[this.tooldID] = meshHandler.createTransformTool(this.tooldID);
			this.tools[this.tooldID].initializeTransformControl(camera, renderer.domElement, render, controls, meshViewer);
			this.tools[this.tooldID].addTo(scene);
			this.tools[this.tooldID].resize(this.toolSize);
		}

		if(this.showTool)
			this.tools[this.tooldID].show();
		this.activeTool = this.tools[this.tooldID];
	}

	this.closeTool = function() {
		this.activeTool.hide();
		this.activeTool = null;
	}

	this.resizeTool = function() {
		this.tools[this.tooldID].resize(this.toolSize);
	}

	this.saveMesh = function() {
		console.log(exportCmap2(cmap, 'off'));
	}
});

function loadMesh (mesh) {
	cmap = loadCMap2('off', Meshes[mesh + '_off']);

	meshHandler = new MeshHandler(cmap);

	meshHandler.updatePositions();

	if(meshViewer)
		meshViewer.delete();
	meshViewer = new MeshViewer(cmap, {
		vertexColor: settings.vertexColor,
		edgeColor: settings.edgeColor,
		faceColor: settings.faceColor,
		vertexSize: settings.vertexSize,
		edgeSize: settings.edgeSize,

	});
	meshViewer.initialize({
		vertices: settings.showVertex,
		edges: settings.showEdge,
		faces: settings.showFace,
	});
	meshViewer.addMeshesTo(scene);

}

const raycaster = new THREE.Raycaster;
const mouse = new THREE.Vector2;

function setMouse(event) {
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}
const mouseDown = function(event) {
	setMouse(event);

	console.log(event.button);
	if(settings.activeTool && event.button == 1 ){
		controls.enableZoom = false;
		console.log(settings.activeTool);
		raycaster.setFromCamera(mouse, camera);
		settings.activeTool.raycast(raycaster);
	}
}

const mouseUp = function(event) {
	controls.enableZoom = true;
}

window.addEventListener('pointerdown', mouseDown);
window.addEventListener('pointerup', mouseUp);

const gui = new GUI({autoPlace: true, hideable: true});
const settingsFolder = gui.addFolder("Settings");
settingsFolder.add(settings, 'showVertex').onChange(settings.updateVertexVisibility);
settingsFolder.add(settings, 'showEdge').onChange(settings.updateEdgeVisibility);
settingsFolder.add(settings, 'showFace').onChange(settings.updateFaceVisibility);
settingsFolder.addColor(settings, 'vertexColor').onChange(settings.updateVertexColor);
settingsFolder.addColor(settings, 'edgeColor').onChange(settings.updateEdgeColor);
settingsFolder.addColor(settings, 'faceColor').onChange(settings.updateFaceColor);
settingsFolder.add(settings, 'vertexSize').min(0.001).max(0.1).step(0.001).onChange(settings.vertexResize);
settingsFolder.add(settings, 'edgeSize').min(0.2).max(5).step(0.05).onChange(settings.edgeResize);

gui.add(settings, 'mesh', ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron']).onChange(loadMesh);
// gui.add(settings, 'subdivision', ['catmullClark', 'loop △', 'sqrt2 □', 'sqrt3 △', 'doosabin', 'butterfly △']);
gui.add(settings, 'subdivide');
gui.add(settings, 'tooldID').onChange(settings.openTool.bind(settings));
gui.add(settings, 'showTool').onChange(settings.toggleTool.bind(settings));
gui.add(settings, 'toolSize').onChange(settings.resizeTool.bind(settings));
gui.add(settings, 'saveMesh');
loadMesh(settings.mesh);

function render()
{
	renderer.render(scene, camera);
}

function mainloop()
{
    render();
    requestAnimationFrame(mainloop);
}

mainloop();