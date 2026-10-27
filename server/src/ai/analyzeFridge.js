// Demo adapter. Replace this module with a real vision-model call.
// Uploaded files are held in memory by Multer and are not persisted to disk.
const demoItems = [
  { name: "Eggs", quantity: 4, unit: "count", stockStatus: "low", confidence: 0.72 },
  { name: "Milk", quantity: 1, unit: "carton", stockStatus: "available", confidence: 0.68 },
  { name: "Cheddar cheese", quantity: 1, unit: "pack", stockStatus: "low", confidence: 0.61 },
  { name: "Tomatoes", quantity: 3, unit: "count", stockStatus: "available", confidence: 0.7 },
  { name: "Lettuce", quantity: 1, unit: "head", stockStatus: "available", confidence: 0.64 },
  { name: "Butter", quantity: 1, unit: "pack", stockStatus: "empty", confidence: 0.52 }
];

export async function analyzeFridge({ files, source = "camera" }) {
  // TODO: Send image buffers to a vision model and request validated JSON.
  // Never log image contents or store photo buffers. Return only structured detections.
  if (source === "sample" || files?.length) {
    return {
      mode: "demo",
      notice: "Demo analysis is active. These are example detections, not results from your photos.",
      items: demoItems.map(item => ({ ...item }))
    };
  }
  return { mode: "demo", notice: "No images received.", items: [] };
}
