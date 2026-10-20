/** Dispose owned GPU resources once. Shared procedural textures live per page. */
export function disposeTree(root) {
  if (!root) return;
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  root.traverse(object => {
    if (object.isReflector) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    if (object.material && !object.isReflector) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
    if (object.isLight && object.shadow) object.shadow.dispose();
  });
  materials.forEach(material => {
    for (const value of Object.values(material)) if (value?.isTexture && !value.userData.shared) textures.add(value);
    material.dispose();
  });
  geometries.forEach(g => g.dispose());
  textures.forEach(t => t.dispose());
  root.removeFromParent();
}
