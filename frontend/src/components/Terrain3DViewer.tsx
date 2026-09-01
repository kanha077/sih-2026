import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  RotateCw,
  Sun,
  Maximize2,
  Minimize2,
  Grid,
  Layers,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  Mountain,
  ArrowUpDown,
  Sliders,
} from 'lucide-react';

import { ElevationStats } from '../types';

interface Terrain3DViewerProps {
  originalUrl: string;
  depthUrl: string;
  elevationUrl: string;
  colormapLabel?: string;
  theme?: 'dark' | 'light';
  elevationStats?: ElevationStats;
}

export const Terrain3DViewer: React.FC<Terrain3DViewerProps> = ({
  originalUrl,
  depthUrl,
  elevationUrl,
  colormapLabel = 'Hypsometric Elevation',
  theme,
  elevationStats,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const animFrameId = useRef<number | null>(null);
  const rawImageData = useRef<Uint8ClampedArray | null>(null);
  const originalGeometry = useRef<THREE.PlaneGeometry | null>(null);

  // Interaction State
  const [heightScale, setHeightScale] = useState<number>(1.5);
  const [tiltLevel, setTiltLevel] = useState<number>(0.75); // 0 = raw perspective, 1 = fully leveled
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [enableSkirt, setEnableSkirt] = useState<boolean>(true);
  const [textureMode, setTextureMode] = useState<'photo' | 'elevation' | 'depth'>('photo');
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [sunAngle, setSunAngle] = useState<number>(45);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoadingMesh, setIsLoadingMesh] = useState<boolean>(true);

  // Mouse Orbit interaction state
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const prevMousePos = useRef({ x: 0, y: 0 });
  const spherical = useRef({ radius: 28, theta: Math.PI / 4, phi: Math.PI / 3 });
  const target = useRef(new THREE.Vector3(0, 0, 0));

  const updateCamera = () => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = spherical.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(x + target.current.x, y + target.current.y, z + target.current.z);
    cameraRef.current.lookAt(target.current);
  };

  const handleResetCamera = () => {
    spherical.current = { radius: 28, theta: Math.PI / 4, phi: Math.PI / 3 };
    target.current.set(0, 0, 0);
    updateCamera();
  };

  // Recompute vertex positions with tilt compensation & inversion
  const updateVertexDisplacements = useCallback(() => {
    if (!meshRef.current || !rawImageData.current) return;

    const imgData = rawImageData.current;
    const gridSegments = 160;
    const posAttr = meshRef.current.geometry.attributes.position;
    const maxDisplacement = 4.5 * heightScale;

    for (let i = 0; i < posAttr.count; i++) {
      const r = Math.floor(i / gridSegments);
      const c = i % gridSegments;
      const pixelIdx = (r * gridSegments + c) * 4;
      const raw = imgData[pixelIdx] / 255.0;

      // Inversion
      const baseVal = isInverted ? (1.0 - raw) : raw;

      // Perspective tilt leveling (r goes 0 at top to gridSegments-1 at bottom)
      // Bottom of photo in perspective is artificially close/high; top is far/low
      const normY = (r / (gridSegments - 1)) - 0.5; // [-0.5 (top), +0.5 (bottom)]
      const leveled = Math.max(0, baseVal - (tiltLevel * normY * 0.7));

      // Edge skirt boundary taper (smoothly drop edges to 0 to prevent stretched vertical cliffs)
      let edgeFactor = 1.0;
      if (enableSkirt) {
        const edgeDistX = Math.min(c, gridSegments - 1 - c) / 8.0;
        const edgeDistY = Math.min(r, gridSegments - 1 - r) / 8.0;
        edgeFactor = Math.min(1.0, Math.min(edgeDistX, edgeDistY));
      }

      posAttr.setY(i, leveled * edgeFactor * maxDisplacement);
    }

    posAttr.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  }, [heightScale, tiltLevel, isInverted, enableSkirt]);

  // Build Terrain Mesh
  useEffect(() => {
    if (!containerRef.current) return;

    let isSubscribed = true;
    setIsLoadingMesh(true);

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // 1. Scene
    const scene = new THREE.Scene();
    const isLight = theme === 'light' || document.documentElement.classList.contains('light');
    scene.background = new THREE.Color(isLight ? 0xf5f2eb : 0x0f1318);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    updateCamera();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights (Cartographic Hillshade model)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff8e7, 1.8);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = true;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.4);
    fillLight.position.set(-15, 10, -15);
    scene.add(fillLight);

    // 5. Cadastral Ground Grid
    const grid = new THREE.GridHelper(30, 30, 0xe5a93c, 0x293440);
    grid.position.y = -0.05;
    scene.add(grid);
    gridHelperRef.current = grid;

    // 6. Heightfield Displacer
    const depthImg = new Image();
    depthImg.crossOrigin = 'anonymous';
    depthImg.src = depthUrl;

    depthImg.onload = () => {
      if (!isSubscribed) return;

      const imgW = depthImg.width;
      const imgH = depthImg.height;

      const canvas = document.createElement('canvas');
      const gridSegments = 160;
      canvas.width = gridSegments;
      canvas.height = gridSegments;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(depthImg, 0, 0, gridSegments, gridSegments);
      const imgData = ctx.getImageData(0, 0, gridSegments, gridSegments).data;
      rawImageData.current = imgData;

      const aspect = imgW / imgH;
      const meshSizeX = 18 * (aspect >= 1 ? 1 : aspect);
      const meshSizeZ = 18 * (aspect < 1 ? 1 : 1 / aspect);

      const geometry = new THREE.PlaneGeometry(
        meshSizeX,
        meshSizeZ,
        gridSegments - 1,
        gridSegments - 1
      );
      geometry.rotateX(-Math.PI / 2);
      originalGeometry.current = geometry;

      const posAttr = geometry.attributes.position;
      const maxDisplacement = 4.5 * heightScale;

      for (let i = 0; i < posAttr.count; i++) {
        const r = Math.floor(i / gridSegments);
        const c = i % gridSegments;
        const pixelIdx = (r * gridSegments + c) * 4;
        const raw = imgData[pixelIdx] / 255.0;

        const baseVal = isInverted ? (1.0 - raw) : raw;
        const normY = (r / (gridSegments - 1)) - 0.5;
        const leveled = Math.max(0, baseVal - (tiltLevel * normY * 0.7));

        let edgeFactor = 1.0;
        if (enableSkirt) {
          const edgeDistX = Math.min(c, gridSegments - 1 - c) / 8.0;
          const edgeDistY = Math.min(r, gridSegments - 1 - r) / 8.0;
          edgeFactor = Math.min(1.0, Math.min(edgeDistX, edgeDistY));
        }

        posAttr.setY(i, leveled * edgeFactor * maxDisplacement);
      }

      geometry.computeVertexNormals();

      const textureLoader = new THREE.TextureLoader();
      const currentTexUrl =
        textureMode === 'photo'
          ? originalUrl
          : textureMode === 'elevation'
          ? elevationUrl
          : depthUrl;

      textureLoader.load(currentTexUrl, (texture) => {
        if (!isSubscribed) return;

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        const material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.65,
          metalness: 0.1,
          wireframe: isWireframe,
          side: THREE.DoubleSide,
        });

        const terrainMesh = new THREE.Mesh(geometry, material);
        terrainMesh.castShadow = true;
        terrainMesh.receiveShadow = true;

        scene.add(terrainMesh);
        meshRef.current = terrainMesh;
        setIsLoadingMesh(false);
      });
    };

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);

      if (autoRotate && !isDragging.current && !isPanning.current) {
        spherical.current.theta += 0.003;
        updateCamera();
      }

      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    });
    resizeObserver.observe(container);

    return () => {
      isSubscribed = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      resizeObserver.disconnect();
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [depthUrl]);

  // Trigger vertex update when tilt, invert, skirt, or heightScale change
  useEffect(() => {
    updateVertexDisplacements();
  }, [updateVertexDisplacements]);

  // Update Texture
  useEffect(() => {
    if (!meshRef.current) return;
    const targetUrl =
      textureMode === 'photo'
        ? originalUrl
        : textureMode === 'elevation'
        ? elevationUrl
        : depthUrl;

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(targetUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (meshRef.current) {
        const mat = meshRef.current.material as THREE.MeshStandardMaterial;
        mat.map = tex;
        mat.needsUpdate = true;
      }
    });
  }, [textureMode, elevationUrl, originalUrl, depthUrl]);

  // Update Theme in Three.js Canvas
  useEffect(() => {
    if (!sceneRef.current) return;
    const isLight = theme === 'light' || document.documentElement.classList.contains('light');
    sceneRef.current.background = new THREE.Color(isLight ? 0xf5f2eb : 0x0f1318);
  }, [theme]);

  // Update Wireframe
  useEffect(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.wireframe = isWireframe;
    mat.needsUpdate = true;
  }, [isWireframe]);

  // Update Grid
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Update Sun Hillshade Angle
  useEffect(() => {
    if (dirLightRef.current) {
      const rad = (sunAngle * Math.PI) / 180;
      dirLightRef.current.position.set(20 * Math.cos(rad), 20 * Math.sin(rad), 20 * Math.sin(rad));
    }
  }, [sunAngle]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) isDragging.current = true;
    else if (e.button === 2) isPanning.current = true;
    prevMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current && !isPanning.current) return;
    const deltaX = e.clientX - prevMousePos.current.x;
    const deltaY = e.clientY - prevMousePos.current.y;
    prevMousePos.current = { x: e.clientX, y: e.clientY };

    if (isDragging.current) {
      spherical.current.theta -= deltaX * 0.008;
      spherical.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.05, spherical.current.phi - deltaY * 0.008)
      );
      updateCamera();
    } else if (isPanning.current && cameraRef.current) {
      const panSpeed = 0.03;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      cameraRef.current.matrix.extractBasis(right, up, new THREE.Vector3());

      target.current.addScaledVector(right, -deltaX * panSpeed);
      target.current.addScaledVector(up, deltaY * panSpeed);
      updateCamera();
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    isPanning.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    spherical.current.radius = Math.max(
      8,
      Math.min(60, spherical.current.radius + e.deltaY * 0.03)
    );
    updateCamera();
  };

  return (
    <div
      className={`relative w-full rounded-sm overflow-hidden bg-topo-canvas border border-topo-border shadow-xl reticle-box transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-0'
          : 'h-[520px] sm:h-[600px]'
      }`}
    >
      {/* 3D WebGL Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full cursor-grab active:cursor-grabbing three-canvas-container"
      />

      {/* Loading Overlay */}
      {isLoadingMesh && (
        <div className="absolute inset-0 flex items-center justify-center bg-topo-canvas/90 backdrop-blur-sm z-30">
          <div className="flex flex-col items-center gap-2 font-mono text-xs text-topo-ochre">
            <Sparkles className="w-6 h-6 animate-spin" />
            <span>DISPLACING TOPOGRAPHIC MESH VERTICES...</span>
          </div>
        </div>
      )}

      {/* Top Floating Control Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-20">
        
        {/* Surface Texture Switcher */}
        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-sm bg-topo-panel/95 border border-topo-border">
          <button
            onClick={() => setTextureMode('photo')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-mono transition-colors ${
              textureMode === 'photo'
                ? 'bg-topo-ochre text-topo-canvas font-bold'
                : 'text-topo-inkMuted hover:text-topo-ink'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo Overlay</span>
          </button>

          <button
            onClick={() => setTextureMode('elevation')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-mono transition-colors ${
              textureMode === 'elevation'
                ? 'bg-topo-ochre text-topo-canvas font-bold'
                : 'text-topo-inkMuted hover:text-topo-ink'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>{colormapLabel}</span>
          </button>

          <button
            onClick={() => setTextureMode('depth')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-mono transition-colors ${
              textureMode === 'depth'
                ? 'bg-topo-ochre text-topo-canvas font-bold'
                : 'text-topo-inkMuted hover:text-topo-ink'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Disparity Map</span>
          </button>
        </div>

        {/* View Tools */}
        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-sm bg-topo-panel/95 border border-topo-border">
          
          {/* Invert Z Button */}
          <button
            onClick={() => setIsInverted(!isInverted)}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-mono transition-colors ${
              isInverted ? 'bg-topo-ochre text-topo-canvas font-bold' : 'text-topo-inkMuted hover:text-topo-ink'
            }`}
            title="Invert Elevation (Flip Valleys & Peaks)"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flip Z</span>
          </button>

          {/* Skirt Base Button */}
          <button
            onClick={() => setEnableSkirt(!enableSkirt)}
            className={`px-2 py-1 rounded-sm text-xs font-mono transition-colors ${
              enableSkirt ? 'bg-topo-ochre/20 text-topo-ochre' : 'text-topo-inkMuted hover:text-topo-ink'
            }`}
            title="Toggle Clean Ground Perimeter Skirt"
          >
            Skirt
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-sm text-xs transition-colors ${
              autoRotate ? 'bg-topo-ochre/20 text-topo-ochre' : 'text-topo-inkMuted hover:text-topo-ink'
            }`}
            title="Toggle 360° Auto-Rotation"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-sm text-xs transition-colors ${
              showGrid ? 'bg-topo-ochre/20 text-topo-ochre' : 'text-topo-inkMuted hover:text-topo-ink'
            }`}
            title="Toggle Ground Grid"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsWireframe(!isWireframe)}
            className={`p-1.5 rounded-sm text-xs transition-colors ${
              isWireframe ? 'bg-topo-ochre/20 text-topo-ochre' : 'text-topo-inkMuted hover:text-topo-ink'
            }`}
            title="Toggle Wireframe Mesh"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded-sm text-topo-inkMuted hover:text-topo-ink transition-colors text-xs"
            title="Reset Perspective"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-sm text-topo-inkMuted hover:text-topo-ink transition-colors text-xs"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>

      {/* Bottom Floating Survey Dials & Elevation Range */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none z-20">
        
        {/* Left: Height Exaggeration, Tilt Leveler, and Sun Position Dials */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 sm:gap-4 px-3 py-1.5 rounded-sm bg-topo-panel/95 border border-topo-border text-xs font-mono">
          
          {/* Elevation Extrusion */}
          <div className="flex items-center gap-1.5">
            <Mountain className="w-3.5 h-3.5 text-topo-ochre shrink-0" />
            <span className="text-topo-inkMuted">Z-SCALE:</span>
            <input
              type="range"
              min="0.2"
              max="3.5"
              step="0.1"
              value={heightScale}
              onChange={(e) => setHeightScale(parseFloat(e.target.value))}
              className="w-16 sm:w-20 survey-slider cursor-pointer"
            />
            <span className="text-topo-ochre font-bold w-7 text-right">
              {heightScale.toFixed(1)}&times;
            </span>
          </div>

          <div className="hidden sm:block w-[1px] h-3.5 bg-topo-border" />

          {/* Perspective Tilt Leveler */}
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-topo-terra shrink-0" />
            <span className="text-topo-inkMuted">TILT LEVEL:</span>
            <input
              type="range"
              min="0.0"
              max="1.2"
              step="0.05"
              value={tiltLevel}
              onChange={(e) => setTiltLevel(parseFloat(e.target.value))}
              className="w-16 sm:w-20 survey-slider cursor-pointer"
              title="Remove camera perspective tilt so terrain sits flat"
            />
            <span className="text-topo-terra font-bold w-8 text-right">
              {Math.round(tiltLevel * 100)}%
            </span>
          </div>

          <div className="hidden md:block w-[1px] h-3.5 bg-topo-border" />

          {/* Sun Hillshade */}
          <div className="flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-topo-sand shrink-0" />
            <span className="text-topo-inkMuted">SUN:</span>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={sunAngle}
              onChange={(e) => setSunAngle(parseInt(e.target.value))}
              className="w-14 sm:w-16 survey-slider cursor-pointer"
            />
            <span className="text-topo-sand font-bold w-7 text-right">
              {sunAngle}&deg;
            </span>
          </div>
        </div>

        {/* Right: Hypsometric Elevation Legend Bar */}
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-sm bg-topo-panel/95 border border-topo-border text-[10px] font-mono">
          <span className="text-topo-inkDim">
            {elevationStats?.elevation_mode === 'calibrated' || elevationStats?.calibrated === true
              ? `${elevationStats.min_elevation}m (Basin)`
              : '0 (Basin)'}
          </span>
          <div className="w-20 sm:w-28 h-2 rounded-none bg-gradient-to-r from-[#194d23] via-[#dce775] via-[#6d4c41] to-[#ffffff] border border-topo-border" />
          <span className="text-topo-ink">
            {elevationStats?.elevation_mode === 'calibrated' || elevationStats?.calibrated === true
              ? `${elevationStats.max_elevation}m (Peak)`
              : '100 (Peak)'}
          </span>
        </div>

      </div>
    </div>
  );
};
