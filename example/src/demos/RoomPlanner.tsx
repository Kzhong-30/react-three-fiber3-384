import { Canvas, useThree } from '@react-three/fiber'
import { useCursor, meshBounds, OrbitControls } from '@react-three/drei'
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import * as THREE from 'three'

const FLOOR_LAYER = 1
const FURNITURE_LAYER = 2

const floorLayer = new THREE.Layers()
floorLayer.set(FLOOR_LAYER)

const furnitureLayer = new THREE.Layers()
furnitureLayer.set(FURNITURE_LAYER)

interface FurnitureConfig {
  id: string
  name: string
  geometry: 'box' | 'cylinder' | 'sphere'
  dimensions: [number, number, number]
  color: string
  position: [number, number, number]
}

const initialFurniture: FurnitureConfig[] = [
  { id: '1', name: 'Table', geometry: 'box', dimensions: [2, 0.8, 1], color: '#8B4513', position: [-2, 0, 0] },
  { id: '2', name: 'Chair', geometry: 'box', dimensions: [0.6, 1, 0.6], color: '#A0522D', position: [2, 0, 0] },
  { id: '3', name: 'Lamp', geometry: 'cylinder', dimensions: [0.3, 0.3, 1.5], color: '#FFD700', position: [0, 0, -3] },
  { id: '4', name: 'Sofa', geometry: 'box', dimensions: [2.5, 1, 1], color: '#4169E1', position: [0, 0, 3] },
]

function createGeometry(config: FurnitureConfig): THREE.BufferGeometry {
  const [w, h, d] = config.dimensions
  switch (config.geometry) {
    case 'cylinder':
      return new THREE.CylinderGeometry(w, w, h, 32)
    case 'sphere':
      return new THREE.SphereGeometry(w, 32, 32)
    default:
      return new THREE.BoxGeometry(w, h, d)
  }
}

function calculateYOffset(geometry: THREE.BufferGeometry): number {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  return (box.max.y - box.min.y) / 2
}

interface GhostModelProps {
  config: FurnitureConfig
  position: [number, number, number]
}

function GhostModel({ config, position }: GhostModelProps) {
  const geometry = useMemo(() => createGeometry(config), [config])
  const yOffset = useMemo(() => calculateYOffset(geometry), [geometry])

  return (
    <mesh position={[position[0], yOffset, position[2]]} geometry={geometry} layers={furnitureLayer}>
      <meshBasicMaterial color={config.color} transparent opacity={0.4} />
    </mesh>
  )
}

interface FurnitureItemProps {
  config: FurnitureConfig
  isDragging: boolean
  onDragStart: (config: FurnitureConfig, mesh: THREE.Mesh, yOffset: number) => void
}

function FurnitureItem({ config, isDragging, onDragStart }: FurnitureItemProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)
  const geometry = useMemo(() => createGeometry(config), [config])
  const yOffset = useMemo(() => calculateYOffset(geometry), [geometry])

  useCursor(hovered && !isDragging)

  return (
    <mesh
      ref={meshRef}
      position={[config.position[0], yOffset, config.position[2]]}
      geometry={geometry}
      layers={furnitureLayer}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (meshRef.current) {
          onDragStart(config, meshRef.current, yOffset)
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
      }}
      castShadow
      receiveShadow>
      <meshStandardMaterial
        color={hovered ? 'hotpink' : config.color}
        transparent={isDragging}
        opacity={isDragging ? 0.5 : 1}
      />
    </mesh>
  )
}

interface FloorProps {
  floorRef: React.RefObject<THREE.Mesh | null>
}

function Floor({ floorRef }: FloorProps) {
  return (
    <mesh
      ref={floorRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      layers={floorLayer}
      receiveShadow
      raycast={meshBounds}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#f0f0f0" side={THREE.DoubleSide} />
    </mesh>
  )
}

function Room() {
  const [furniture, setFurniture] = useState<FurnitureConfig[]>(initialFurniture)
  const [isDragging, setIsDragging] = useState(false)
  const [draggingConfig, setDraggingConfig] = useState<FurnitureConfig | null>(null)
  const [dragYOffset, setDragYOffset] = useState<number>(0)
  const [ghostPosition, setGhostPosition] = useState<[number, number, number] | null>(null)

  const floorRef = useRef<THREE.Mesh>(null)
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  const startDrag = useCallback((config: FurnitureConfig, mesh: THREE.Mesh, yOffset: number) => {
    setDraggingConfig(config)
    setDragYOffset(yOffset)
    setIsDragging(true)
    setGhostPosition([config.position[0], yOffset, config.position[2]])
  }, [])

  const endDrag = useCallback(() => {
    if (draggingConfig && ghostPosition) {
      setFurniture((prev) =>
        prev.map((f) => (f.id === draggingConfig.id ? { ...f, position: [ghostPosition[0], 0, ghostPosition[2]] } : f)),
      )
    }
    setDraggingConfig(null)
    setDragYOffset(0)
    setGhostPosition(null)
    setIsDragging(false)
  }, [draggingConfig, ghostPosition])

  useEffect(() => {
    if (!isDragging || !floorRef.current) return

    const handlePointerMove = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      raycaster.layers.set(FLOOR_LAYER)

      const intersects = raycaster.intersectObject(floorRef.current!)

      if (intersects.length > 0) {
        const point = intersects[0].point
        setGhostPosition([point.x, dragYOffset, point.z])
      }
    }

    const handlePointerUp = () => {
      endDrag()
    }

    gl.domElement.addEventListener('pointermove', handlePointerMove)
    gl.domElement.addEventListener('pointerup', handlePointerUp)

    return () => {
      gl.domElement.removeEventListener('pointermove', handlePointerMove)
      gl.domElement.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging, camera, gl, raycaster, endDrag, dragYOffset])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-10, 10, -10]} intensity={0.5} />

      <Floor floorRef={floorRef} />

      {furniture.map((config) => (
        <FurnitureItem
          key={config.id}
          config={config}
          isDragging={isDragging && draggingConfig?.id === config.id}
          onDragStart={startDrag}
        />
      ))}

      {isDragging && draggingConfig && ghostPosition && <GhostModel config={draggingConfig} position={ghostPosition} />}

      <OrbitControls enabled={!isDragging} />
    </>
  )
}

export default function App() {
  return (
    <Canvas shadows camera={{ position: [5, 8, 5], fov: 50 }}>
      <Room />
    </Canvas>
  )
}
