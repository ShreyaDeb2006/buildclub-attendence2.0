// Euclidean distance between two face descriptors
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// Match a face descriptor against known members
export function findBestMatch(
  descriptor: number[],
  members: { id: string; name: string; faceDescriptor: number[] }[],
  threshold = 0.55
): { member: { id: string; name: string } | null; distance: number; confidence: number } {
  let bestMatch: { id: string; name: string } | null = null;
  let bestDistance = Infinity;

  for (const member of members) {
    if (!member.faceDescriptor || !Array.isArray(member.faceDescriptor)) continue;
    const distance = euclideanDistance(descriptor, member.faceDescriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = { id: member.id, name: member.name };
    }
  }

  const confidence = Math.max(0, Math.min(100, (1 - bestDistance) * 100));

  if (bestDistance > threshold) {
    return { member: null, distance: bestDistance, confidence: 0 };
  }

  return { member: bestMatch, distance: bestDistance, confidence };
}

// Detect head rotation from face landmarks
// Uses multiple landmark pairs for more accurate yaw estimation
export function detectHeadRotation(landmarks: {
  positions: { x: number; y: number }[];
}): { yaw: number; direction: "left" | "right" | "center" } {
  const nose = landmarks.positions[30]; // Nose tip
  const leftEye = landmarks.positions[36]; // Left eye outer corner
  const rightEye = landmarks.positions[45]; // Right eye outer corner
  const leftMouth = landmarks.positions[48]; // Left mouth corner
  const rightMouth = landmarks.positions[54]; // Right mouth corner
  const leftJaw = landmarks.positions[0]; // Leftmost jaw
  const rightJaw = landmarks.positions[16]; // Rightmost jaw

  if (!nose || !leftEye || !rightEye) {
    return { yaw: 0, direction: "center" };
  }

  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };
  const eyeWidth = rightEye.x - leftEye.x;
  if (eyeWidth === 0) return { yaw: 0, direction: "center" };

  // Primary signal: nose offset from eye center normalized by eye width
  const noseOffset = (nose.x - eyeCenter.x) / eyeWidth;

  // Secondary signal: jaw asymmetry (left jaw distance vs right jaw distance from nose)
  let jawAsymmetry = 0;
  if (leftJaw && rightJaw) {
    const leftJawDist = Math.abs(nose.x - leftJaw.x);
    const rightJawDist = Math.abs(rightJaw.x - nose.x);
    const jawWidth = leftJawDist + rightJawDist;
    if (jawWidth > 0) {
      jawAsymmetry = (rightJawDist - leftJawDist) / jawWidth;
    }
  }

  // Tertiary signal: mouth asymmetry
  let mouthAsymmetry = 0;
  if (leftMouth && rightMouth) {
    const mouthCenter = (leftMouth.x + rightMouth.x) / 2;
    const mouthWidth = rightMouth.x - leftMouth.x;
    if (mouthWidth > 0) {
      mouthAsymmetry = (nose.x - mouthCenter) / mouthWidth;
    }
  }

  // Combined yaw: weighted average of all signals
  const yaw = noseOffset * 0.5 + jawAsymmetry * 0.3 + mouthAsymmetry * 0.2;

  // STRICT threshold: 0.28 means the user must genuinely turn their head
  // The old 0.15 was triggering from slight movements / natural asymmetry
  let direction: "left" | "right" | "center" = "center";
  if (yaw < -0.28) direction = "right";
  else if (yaw > 0.28) direction = "left";

  return { yaw, direction };
}
