threshold = 128;
DEBUG = false;
var resolution = {'width' : 640, 'height':480};

var video = document.createElement('video');
video.width = 640;
video.height = 480;
video.loop = true;
video.volume = 0;
video.autoplay = true;
video.controls = true;
  
var glCanvas;
var camera;
var characterPlane;
var m;
var scene;
//Test
var sceneTest;
var cameraTest;
var avatarSpace;
var loader;
var legoBlock;


renderWidth = window.innerHeight*1.33*0.97;
renderHeight = window.innerHeight*0.97;

var robotSupport = false;
var robot;




//---------------------------- Init --------------------------------------
function initTrack() {
	//window.screen.lockOrientation("landscape");
	if(robotSupport){
		robot = new Robot();
		robot.ws.onmessage = function (evt){ 
			var msg = evt.data;
			var jMsg = JSON.parse(msg);
			//console.log("ws.onmessage: " + jMsg.type + " = " + jMsg.value);
			if(jMsg.type == "touch"){
				var adc = parseInt(jMsg.value)
				if(adc>512){
					avatarSpace.updateTouchSensor("OFF");
				}else{
					avatarSpace.updateTouchSensor("ON");
				}
				return;
			}
			if(jMsg.type == "light"){
				avatarSpace.updateLightSensor("ADC: " + jMsg.value);
				return;
			}
		}
	}else{
		robot = new VirtualRobot();
	}
	
	avatarSpace = new AvatarSpace();
	avatarSpace.avatar.onClick = function(){
		robot.playTone();
	}
	
	avatarSpace.legoPart =  new LegoPart("models/lego-extension.js");
	avatarSpace.legoPart.onLoad = function(){
		console.log("Lego part loaded.");
	}
	avatarSpace.legoPart.load();
	

    document.body.appendChild(video);
	video.style.display = 'none';

    var canvas = document.createElement('canvas');
    canvas.width = resolution.width;
    canvas.height = resolution.height;
    document.body.appendChild(canvas);
	canvas.style.display = 'none';

    var debugCanvas = document.createElement('canvas');
    debugCanvas.id = 'debugCanvas';
    debugCanvas.width = resolution.width;
    debugCanvas.height = resolution.height;
    document.body.appendChild(debugCanvas);
	debugCanvas.style.display = 'none';

    var videoCanvas = document.createElement('canvas');
    videoCanvas.width = video.width;
    videoCanvas.height = video.width*3/4;

    var ctx = canvas.getContext('2d');
    ctx.font = "24px URW Gothic L, Arial, Sans-serif";



    var raster = new NyARRgbRaster_Canvas2D(canvas);
    var param = new FLARParam(resolution.width,resolution.height);

    var resultMat = new NyARTransMatResult();

    var detector = new FLARMultiIdMarkerDetector(param, 100);
    detector.setContinueMode(true);


    var tmp = new Float32Array(16);

    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(renderWidth, renderHeight); // Keep

    glCanvas = renderer.domElement;
	glCanvas.style.position = "static";
    var s = glCanvas.style;
    document.body.appendChild(glCanvas);
	// OnMouseDown
	glCanvas.addEventListener( 'mousedown', onDocumentMouseDown, false );

    scene = new THREE.Scene();

	scene.add(avatarSpace.model);
	
    // Create a camera and a marker root object for your Three.js scene.
    camera = new THREE.Camera();
    scene.add(camera);
    
    // Next we need to make the Three.js camera use the FLARParam matrix.
    param.copyCameraMatrix(tmp, 10, 10000);
    camera.projectionMatrix.setFromArray(tmp);

    var videoTex = new THREE.Texture(videoCanvas);

    // Create scene and quad for the video.
    var plane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2, 0),
      new THREE.MeshBasicMaterial({map: videoTex})
    );
    plane.material.depthTest = false;
    plane.material.depthWrite = false;
    var videoCam = new THREE.Camera();
    var videoScene = new THREE.Scene();
    videoScene.add(plane);
    videoScene.add(videoCam);

    var times = [];
    var markers = {};
    var lastTime = 0;

    setInterval(function(){
		if (video.ended) video.play();
		if (video.paused) return;
		if (window.paused) return;
		if (video.currentTime == video.duration) {
			video.currentTime = 0;
		}
		if (video.currentTime == lastTime) return;
		lastTime = video.currentTime;
		videoCanvas.getContext('2d').drawImage(video,0,0);
		ctx.drawImage(videoCanvas, 0,0,resolution.width,resolution.height);
		var dt = new Date().getTime();

		canvas.changed = true;
		videoTex.needsUpdate = true;

		var t = new Date();
		var detected = detector.detectMarkerLite(raster, threshold);
		for (var idx = 0; idx<detected; idx++) {
			var id = detector.getIdMarkerData(idx);
			var currId;
			if (id.packetLength > 4) {
				currId = -1;
			}else{
				currId=0;
				for (var i = 0; i < id.packetLength; i++ ) {
					currId = (currId << 8) | id.getPacketData(i);
				}
			}
			if (!markers[currId]) {
				markers[currId] = {};
			}
			detector.getTransformMatrix(idx, resultMat);
			markers[currId].age = 0;
			markers[currId].transform = Object.asCopy(resultMat);
		}
		for (var i in markers) {
			var r = markers[i];
			if (r.age > 5) {
				delete markers[i];
				// Hide avatar space
				avatarSpace.model.visible = false;
			}
			r.age++;
		}
		for (var i in markers) {
			m = markers[i];
			if (!m.model) {
				// Show avatar space
				avatarSpace.model.visible = true;
				m.model = true;
			}
			copyMatrix(m.transform, tmp);
			avatarSpace.model.matrix.setFromArray(tmp);
			
			/* Matrix decomposition
			var mt = new THREE.Vector3();
			var ms = new THREE.Vector3();
			var mr = new THREE.Quaternion();
			avatarSpace.model.matrix.decompose(mt,mr,ms);
			console.log(mr);
			*/
			
			var rotation = new THREE.Matrix4().makeRotationY(Math.PI/4);
			avatarSpace.model.matrix.multiply(rotation);
			avatarSpace.model.matrixWorldNeedsUpdate = true;
		}
		renderer.autoClear = false;
		renderer.clear();
		renderer.render(videoScene, videoCam);
		renderer.render(scene, camera);
    }, 15);
}

THREE.Matrix4.prototype.setFromArray = function(m) {
    return this.set(
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      m[3], m[7], m[11], m[15]
    );
};

function copyMatrix(mat, cm) {
    cm[0] = mat.m00;
    cm[1] = -mat.m10;
    cm[2] = mat.m20;
    cm[3] = 0;
    cm[4] = mat.m01;
    cm[5] = -mat.m11;
    cm[6] = mat.m21;
    cm[7] = 0;
    cm[8] = -mat.m02;
    cm[9] = mat.m12;
    cm[10] = -mat.m22;
    cm[11] = 0;
    cm[12] = mat.m03;
    cm[13] = -mat.m13;
    cm[14] = mat.m23;
    cm[15] = 1;
}



function onDocumentMouseDown( event ){
	// onClick works even when avatar space is none visible.  << ------- !!!
	var mouse = { x: 0, y: 0 }
	var vector = new THREE.Vector3();
	var raycaster = new THREE.Raycaster();
	mouse.x = ( (event.clientX - glCanvas.offsetLeft) / renderWidth ) * 2 - 1;  //Keep
    mouse.y = - ( (event.clientY - glCanvas.offsetTop) / renderHeight ) * 2 + 1; //Keep

	//console.log(mouse.x+ " x "+ mouse.y);
	
    vector.set( mouse.x, mouse.y, -0.5 );
    vector.unproject( camera );
	vector.sub( camera.position ).normalize();

    raycaster.set( camera.position,  vector);

    var intersects = raycaster.intersectObjects( scene.children, true );

    if ( intersects.length > 0 ) {
		avatarSpace.onClick(intersects[0].object);
	}
}