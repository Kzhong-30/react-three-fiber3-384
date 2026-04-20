import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useCursor, meshBounds, Grid } from '@react-three/drei'
import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import * as THREE from 'three'

// 家具类型定义
type FurnitureType = 'box' | 'sphere' | 'cylinder'

interface FurnitureItem {
  id: string
  type: FurnitureType
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string
}

interface DragState {
  isDragging: boolean
  furnitureType: FurnitureType | null
  ghostPosition: [number, number, number] | null
  color: string
}

// 获取家具几何体的包围盒底部偏移量
function getFurnitureBottomOffset(type: FurnitureType, scale: [number, number, number] = [1, 1, 1]): number {
  // 创建临时几何体计算包围盒
  let geometry: THREE.BufferGeometry
  switch (type) {
    case 'box':
      geometry = new THREE.BoxGeometry(1, 1, 1)
      break
    case 'sphere':
      geometry = new THREE.SphereGeometry(0.5, 32, 32)
      break
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
      break
    default:
      geometry = new THREE.BoxGeometry(1, 1, 1)
  }

  // 计算包围盒
  geometry.computeBoundingBox()
  const boundingBox = geometry.boundingBox!

  // 获取几何体的高度和中心偏移
  const height = boundingBox.max.y - boundingBox.min.y
  const centerOffset = (boundingBox.max.y + boundingBox.min.y) / 2

  // 计算底部到中心的距离，考虑缩放
  // 如果中心在0点，底部偏移就是高度的一半
  const bottomToCenter = height / 2 - centerOffset

  // 应用Y轴缩放后的实际底部偏移
  const yOffset = bottomToCenter * scale[1]

  // 清理
  geometry.dispose()

  return yOffset
}

// 地板组件 - 仅地板层接受射线检测
function Floor() {
  const floorRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  return (
    <>
      {/* 地板 - 使用 meshBounds 优化射线检测 */}
      <mesh
        ref={floorRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        raycast={meshBounds}
        name="floor"
        userData={{ isFloor: true }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#f0f0f0" transparent opacity={0.9} />
      </mesh>

      {/* 网格辅助线 */}
      <Grid
        position={[0, 0.01, 0]}
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#cccccc"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#999999"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid={false}
      />
    </>
  )
}

// Ghost 预览模型组件 - 半透明预览
function GhostFurniture({
  type,
  position,
  color,
}: {
  type: FurnitureType
  position: [number, number, number]
  color: string
}) {
  const meshRef = useRef<THREE.Mesh>(null!)

  // 根据模型包围盒动态计算 Y 轴偏移量
  const yOffset = useMemo(() => {
    return getFurnitureBottomOffset(type)
  }, [type])

  const geometry = useMemo(() => {
    switch (type) {
      case 'box':
        return new THREE.BoxGeometry(1, 1, 1)
      case 'sphere':
        return new THREE.SphereGeometry(0.5, 32, 32)
      case 'cylinder':
        return new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
      default:
        return new THREE.BoxGeometry(1, 1, 1)
    }
  }, [type])

  return (
    <mesh ref={meshRef} position={[position[0], position[1] + yOffset, position[2]]} geometry={geometry}>
      <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
    </mesh>
  )
}

// 已放置的家具组件
function PlacedFurniture({
  item,
  onSelect,
  isSelected,
}: {
  item: FurnitureItem
  onSelect: (id: string | null) => void
  isSelected: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  // 根据模型包围盒动态计算 Y 轴偏移量
  const yOffset = useMemo(() => {
    return getFurnitureBottomOffset(item.type, item.scale)
  }, [item.type, item.scale])

  const geometry = useMemo(() => {
    switch (item.type) {
      case 'box':
        return new THREE.BoxGeometry(1, 1, 1)
      case 'sphere':
        return new THREE.SphereGeometry(0.5, 32, 32)
      case 'cylinder':
        return new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
      default:
        return new THREE.BoxGeometry(1, 1, 1)
    }
  }, [item.type])

  return (
    <mesh
      ref={meshRef}
      position={[item.position[0], item.position[1] + yOffset, item.position[2]]}
      rotation={item.rotation}
      scale={item.scale}
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(isSelected ? null : item.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      userData={{ isFurniture: true, furnitureId: item.id }}>
      <meshStandardMaterial
        color={item.color}
        emissive={isSelected ? '#333333' : '#000000'}
        transparent
        opacity={hovered ? 0.8 : 1}
      />
    </mesh>
  )
}

// 场景组件
function Scene() {
  const { camera, scene, gl } = useThree()
  const [furniture, setFurniture] = useState<FurnitureItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    furnitureType: null,
    ghostPosition: null,
    color: '#ff6b6b',
  })

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const mouse = useMemo(() => new THREE.Vector2(), [])

  // 获取地板交点 - 只检测地板层，忽略其他家具
  const getFloorIntersection = useCallback(
    (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = gl.domElement.getBoundingClientRect()
      if (!rect) return null

      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      // 只检测地板层，忽略其他家具
      const floorMesh = scene.getObjectByName('floor')
      if (!floorMesh) return null

      const intersects = raycaster.intersectObject(floorMesh, false)

      if (intersects.length > 0) {
        return intersects[0].point
      }
      return null
    },
    [camera, scene, raycaster, mouse, gl],
  )

  // 处理全局鼠标移动 - 使用原生事件确保即使鼠标在家具上也能触发
  useEffect(() => {
    if (!dragState.isDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragState.furnitureType) return

      const point = getFloorIntersection(e.clientX, e.clientY)
      if (point) {
        setDragState((prev) => ({
          ...prev,
          ghostPosition: [point.x, 0, point.z],
        }))
      }
    }

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragState.isDragging || !dragState.furnitureType || !dragState.ghostPosition) {
        setDragState({
          isDragging: false,
          furnitureType: null,
          ghostPosition: null,
          color: '#ff6b6b',
        })
        return
      }

      const point = getFloorIntersection(e.clientX, e.clientY)
      if (point) {
        // 根据模型类型计算正确的 Y 轴位置
        const yOffset = getFurnitureBottomOffset(dragState.furnitureType)

        const newFurniture: FurnitureItem = {
          id: Date.now().toString(),
          type: dragState.furnitureType,
          position: [point.x, 0, point.z],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: dragState.color,
        }

        setFurniture((prev) => [...prev, newFurniture])
      }

      setDragState({
        isDragging: false,
        furnitureType: null,
        ghostPosition: null,
        color: '#ff6b6b',
      })
    }

    // 添加全局事件监听
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState.isDragging, dragState.furnitureType, dragState.ghostPosition, dragState.color, getFloorIntersection])

  // 删除选中的家具
  const deleteSelected = useCallback(() => {
    if (selectedId) {
      setFurniture((prev) => prev.filter((item) => item.id !== selectedId))
      setSelectedId(null)
    }
  }, [selectedId])

  // 开始拖拽新家具
  const startDragging = useCallback((type: FurnitureType, color: string) => {
    setDragState({
      isDragging: true,
      furnitureType: type,
      ghostPosition: [0, 0, 0],
      color,
    })
    setSelectedId(null)
  }, [])

  return (
    <>
      {/* 灯光 */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, 10, -5]} intensity={0.5} />

      {/* 地板 - 只检测地板层 */}
      <Floor />

      {/* 已放置的家具 */}
      {furniture.map((item) => (
        <PlacedFurniture key={item.id} item={item} onSelect={setSelectedId} isSelected={selectedId === item.id} />
      ))}

      {/* Ghost 预览模型 */}
      {dragState.isDragging && dragState.ghostPosition && dragState.furnitureType && (
        <GhostFurniture type={dragState.furnitureType} position={dragState.ghostPosition} color={dragState.color} />
      )}

      {/* UI 控制面板 */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          minWidth: '200px',
          pointerEvents: 'auto',
        }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#333' }}>家具库</h3>
        <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>点击选择家具，然后在地板上拖拽放置</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => startDragging('box', '#ff6b6b')}
            style={{
              padding: '10px 15px',
              background: dragState.furnitureType === 'box' ? '#ff6b6b' : '#f0f0f0',
              color: dragState.furnitureType === 'box' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
            <span style={{ fontSize: '20px' }}>📦</span> 立方体
          </button>

          <button
            onClick={() => startDragging('sphere', '#4ecdc4')}
            style={{
              padding: '10px 15px',
              background: dragState.furnitureType === 'sphere' ? '#4ecdc4' : '#f0f0f0',
              color: dragState.furnitureType === 'sphere' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
            <span style={{ fontSize: '20px' }}>🔵</span> 球体
          </button>

          <button
            onClick={() => startDragging('cylinder', '#ffe66d')}
            style={{
              padding: '10px 15px',
              background: dragState.furnitureType === 'cylinder' ? '#ffe66d' : '#f0f0f0',
              color: dragState.furnitureType === 'cylinder' ? '#333' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
            <span style={{ fontSize: '20px' }}>🛢️</span> 圆柱体
          </button>
        </div>

        {selectedId && (
          <>
            <div style={{ margin: '15px 0', borderTop: '1px solid #ddd' }}></div>
            <button
              onClick={deleteSelected}
              style={{
                padding: '10px 15px',
                background: '#ff4757',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                width: '100%',
              }}>
              删除选中家具
            </button>
          </>
        )}

        {dragState.isDragging && (
          <>
            <div style={{ margin: '15px 0', borderTop: '1px solid #ddd' }}></div>
            <p style={{ margin: 0, fontSize: '12px', color: '#4ecdc4' }}>🖱️ 拖拽到目标位置，松开鼠标放置</p>
          </>
        )}

        <div style={{ marginTop: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '6px' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#666', fontWeight: 'bold' }}>当前状态:</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#999' }}>家具数量: {furniture.length}</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#999' }}>选中: {selectedId ? '是' : '否'}</p>
        </div>
      </div>
    </>
  )
}

// 主应用组件
export default function RoomPlanner() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }} shadows gl={{ antialias: true, alpha: true }}>
        <Scene />
      </Canvas>
    </div>
  )
}
