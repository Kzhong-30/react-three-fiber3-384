import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, useCursor, meshBounds } from '@react-three/drei'
import { useRef, useState, useCallback, useEffect } from 'react'
import * as THREE from 'three'

const FURNITURE_TYPES = [
  { id: 'sofa', name: '沙发', color: '#8B4513', dimensions: [2, 0.8, 1] as [number, number, number] },
  { id: 'table', name: '餐桌', color: '#A0522D', dimensions: [1.5, 0.75, 1.5] as [number, number, number] },
  { id: 'chair', name: '椅子', color: '#CD853F', dimensions: [0.5, 1, 0.5] as [number, number, number] },
  { id: 'bookshelf', name: '书架', color: '#654321', dimensions: [1.2, 1.8, 0.4] as [number, number, number] },
  { id: 'bed', name: '床', color: '#DEB887', dimensions: [2, 0.5, 2.2] as [number, number, number] },
]

interface FurnitureItem {
  id: string
  type: string
  position: [number, number, number]
  color: string
  dimensions: [number, number, number]
}

interface GhostState {
  visible: boolean
  position: [number, number, number]
  type: string | null
  color: string
  dimensions: [number, number, number]
}

function Floor({ onFloorHit }: { onFloorHit: (point: THREE.Vector3) => void }) {
  const floorRef = useRef<THREE.Mesh>(null!)
  const raycaster = useRef(new THREE.Raycaster())
  const pointer = useRef(new THREE.Vector2())
  const { camera, gl } = useThree()

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    gl.domElement.addEventListener('pointermove', handlePointerMove)
    return () => gl.domElement.removeEventListener('pointermove', handlePointerMove)
  }, [gl.domElement])

  useFrame(() => {
    raycaster.current.setFromCamera(pointer.current, camera)
    raycaster.current.layers.set(0)

    const intersects = raycaster.current.intersectObject(floorRef.current, false)

    if (intersects.length > 0) {
      onFloorHit(intersects[0].point)
    }
  })

  return (
    <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} layers={0}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#808080" />
    </mesh>
  )
}

function GhostModel({ ghost }: { ghost: GhostState }) {
  if (!ghost.visible || !ghost.type) return null

  const meshRef = useRef<THREE.Mesh>(null!)
  const bounds = useRef(new THREE.Box3())
  const [yOffset, setYOffset] = useState(0)

  useEffect(() => {
    if (meshRef.current) {
      bounds.current = meshBounds(meshRef.current)
      setYOffset(bounds.current.max.y)
    }
  }, [ghost.dimensions])

  const [width, height, depth] = ghost.dimensions

  return (
    <mesh ref={meshRef} position={[ghost.position[0], yOffset, ghost.position[2]]}>
      <boxGeometry args={[width, height, depth]} />
      <meshBasicMaterial color={ghost.color} opacity={0.4} transparent />
    </mesh>
  )
}

function PlacedFurniture({
  item,
  onSelect,
  isSelected,
}: {
  item: FurnitureItem
  onSelect: (id: string) => void
  isSelected: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null!)
  const bounds = useRef(new THREE.Box3())
  const [yOffset, setYOffset] = useState(0)

  useCursor(hovered)

  useEffect(() => {
    if (meshRef.current) {
      bounds.current = meshBounds(meshRef.current)
      setYOffset(bounds.current.max.y)
    }
  }, [item.dimensions])

  const [width, height, depth] = item.dimensions

  return (
    <mesh
      ref={meshRef}
      position={[item.position[0], yOffset, item.position[2]]}
      layers={2}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(item.id)
      }}
      castShadow
      receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color={item.color}
        emissive={isSelected ? '#ff6b6b' : hovered ? '#ffcccc' : '#000000'}
        emissiveIntensity={isSelected ? 0.3 : hovered ? 0.1 : 0}
      />
    </mesh>
  )
}

function FurniturePanel({
  onSelectFurniture,
  selectedTypeId,
}: {
  onSelectFurniture: (type: (typeof FURNITURE_TYPES)[0]) => void
  selectedTypeId: string | null
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        zIndex: 100,
      }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>选择家具</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {FURNITURE_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => onSelectFurniture(type)}
            style={{
              padding: '8px 12px',
              border: selectedTypeId === type.id ? '2px solid #2196F3' : '1px solid #ddd',
              borderRadius: '4px',
              background: selectedTypeId === type.id ? '#E3F2FD' : 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
            <div
              style={{
                width: '20px',
                height: '20px',
                background: type.color,
                borderRadius: '2px',
              }}
            />
            <span>{type.name}</span>
          </button>
        ))}
      </div>
      <p style={{ margin: '10px 0 0 0', fontSize: '11px', color: '#666' }}>点击场景放置家具</p>
    </div>
  )
}

function Scene({
  selectedFurniture,
  setSelectedFurniture,
  furniture,
  setFurniture,
  ghost,
  setGhost,
  hitPoint,
  setHitPoint,
}: {
  selectedFurniture: (typeof FURNITURE_TYPES)[0] | null
  setSelectedFurniture: (t: (typeof FURNITURE_TYPES)[0] | null) => void
  furniture: FurnitureItem[]
  setFurniture: React.Dispatch<React.SetStateAction<FurnitureItem[]>>
  ghost: GhostState
  setGhost: React.Dispatch<React.SetStateAction<GhostState>>
  hitPoint: THREE.Vector3 | null
  setHitPoint: (p: THREE.Vector3 | null) => void
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const handleFloorHit = useCallback(
    (point: THREE.Vector3) => {
      setHitPoint(point.clone())

      if (selectedFurniture) {
        setGhost({
          visible: true,
          position: [point.x, 0, point.z],
          type: selectedFurniture.id,
          color: selectedFurniture.color,
          dimensions: selectedFurniture.dimensions,
        })
      }
    },
    [selectedFurniture, setGhost, setHitPoint],
  )

  const handleCanvasClick = useCallback(() => {
    if (selectedFurniture && hitPoint) {
      const newItem: FurnitureItem = {
        id: `${selectedFurniture.id}-${Date.now()}`,
        type: selectedFurniture.id,
        position: [hitPoint.x, 0, hitPoint.z],
        color: selectedFurniture.color,
        dimensions: selectedFurniture.dimensions,
      }
      setFurniture((prev) => [...prev, newItem])
      setSelectedFurniture(null)
      setGhost((prev) => ({ ...prev, visible: false }))
    }
  }, [selectedFurniture, hitPoint, setFurniture, setSelectedFurniture, setGhost])

  return (
    <>
      <ambientLight intensity={0.4 * Math.PI} />
      <directionalLight position={[10, 15, 10]} intensity={1} castShadow />
      <hemisphereLight args={['#ffffff', '#8d8b8b', 0.5]} />

      <Floor onFloorHit={handleFloorHit} />

      <GhostModel ghost={ghost} />

      {furniture.map((item) => (
        <PlacedFurniture
          key={item.id}
          item={item}
          onSelect={setSelectedItemId}
          isSelected={selectedItemId === item.id}
        />
      ))}

      <mesh position={[0, 0, 0]} onClick={handleCanvasClick} visible={false}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} minDistance={5} maxDistance={30} />

      <gridHelper args={[20, 20, '#444444', '#666666']} position={[0, 0.01, 0]} />
    </>
  )
}

export default function RoomPlanner() {
  const [selectedFurniture, setSelectedFurniture] = useState<(typeof FURNITURE_TYPES)[0] | null>(null)
  const [furniture, setFurniture] = useState<FurnitureItem[]>([])
  const [hitPoint, setHitPoint] = useState<THREE.Vector3 | null>(null)
  const [ghost, setGhost] = useState<GhostState>({
    visible: false,
    position: [0, 0, 0],
    type: null,
    color: '#ffffff',
    dimensions: [1, 1, 1],
  })

  useEffect(() => {
    if (!selectedFurniture) {
      setGhost((prev) => ({ ...prev, visible: false }))
    }
  }, [selectedFurniture])

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <FurniturePanel onSelectFurniture={setSelectedFurniture} selectedTypeId={selectedFurniture?.id || null} />

      <Canvas shadows camera={{ position: [8, 8, 8], fov: 50 }} gl={{ antialias: true }}>
        <Scene
          selectedFurniture={selectedFurniture}
          setSelectedFurniture={setSelectedFurniture}
          furniture={furniture}
          setFurniture={setFurniture}
          ghost={ghost}
          setGhost={setGhost}
          hitPoint={hitPoint}
          setHitPoint={setHitPoint}
        />
      </Canvas>
    </div>
  )
}
