import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

interface LetterProps {
    stage: 'HIDDEN' | 'READY' | 'OPENED';
    originPosition?: [number, number, number]; // Vị trí xuất phát (trong hộp)
}
  
export const Letter: React.FC<LetterProps> = ({
  stage,
  originPosition = [5.5, 2, 2], // Nên khớp với vị trí GiftBox
}) => {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // Dùng state nội bộ để ẩn hẳn vật thể khi HIDDEN (tối ưu performance)
  const [isVisible, setIsVisible] = useState(false);

  useFrame((state, delta) => {
    if (!ref.current) return;

    // 0. Giai đoạn ẨN
    if (stage === 'HIDDEN') {
        if (isVisible) setIsVisible(false);
        ref.current.scale.set(0, 0, 0);
        ref.current.position.set(...originPosition);
        return;
    }

    if (!isVisible) setIsVisible(true);

    // 1. Giai đoạn READY: Bay lên khỏi hộp, xoay nhẹ chờ đợi
    if (stage === 'READY') {
        // Đích đến: Bay cao hơn vị trí gốc 3 đơn vị
        const targetPos = new THREE.Vector3(originPosition[0], originPosition[1] + 3.5, originPosition[2]);
        
        // Di chuyển mượt (Lerp)
        ref.current.position.lerp(targetPos, delta * 3);
        
        // Xoay nhẹ tại chỗ (Idle animation)
        ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, 0, delta * 2);
        ref.current.rotation.y += delta * 0.5; // Xoay vòng tròn chậm
        ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.1; // Lắc lư nhẹ
        
        ref.current.scale.lerp(new THREE.Vector3(1, 1, 1), delta * 2);
    }

    // 2. Giai đoạn OPENED: Bay ra trước Camera để đọc
    if (stage === 'OPENED') {
        // Tính vị trí trước mặt camera (cách 4 đơn vị)
        const forwardVector = new THREE.Vector3(0, 0, -4);
        forwardVector.applyMatrix4(camera.matrixWorld);
        
        ref.current.position.lerp(forwardVector, delta * 4);
        
        // Xoay mặt thư về hướng camera
        ref.current.quaternion.slerp(camera.quaternion, delta * 4);
        
        // Phóng to để dễ đọc
        ref.current.scale.lerp(new THREE.Vector3(1.5, 1.5, 1.5), delta * 4);
    }
  });

  return (
    <group ref={ref} position={originPosition} scale={[0,0,0]} visible={isVisible}>
      {/* Phong bì / Giấy thư */}
      <mesh castShadow receiveShadow>
        <planeGeometry args={[3, 2]} />
        <meshStandardMaterial 
            color="#fffaf0" 
            side={THREE.DoubleSide} 
            roughness={0.6}
            emissive="#fffaf0"
            emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Viền trang trí (Optional) */}
      <mesh position={[0, 0, -0.01]}>
         <planeGeometry args={[3.1, 2.1]} />
         <meshStandardMaterial color="#D4AF37" />
      </mesh>

      {/* Nội dung thư */}
      {/* Lưu ý: Font nên để null để dùng default nếu chưa load được font custom */}
      <group position={[0, 0, 0.02]}>
         <Text 
            color="#1a1a1a" 
            fontSize={0.18} 
            maxWidth={2.6} 
            textAlign="center" 
            lineHeight={1.4}
            font={undefined} // Dùng font mặc định hệ thống để tránh lỗi load
            anchorY="middle"
            anchorX="center"
         >
            {`Gửi bạn,\n\nChúc bạn một mùa Giáng Sinh\nấm áp và an lành.\n\n(Nắm tay lại để đóng thư)`}
         </Text>
      </group>
    </group>
  );
};