// toolStateManager.ts


interface ToolRegistration {
  deactivate: () => void;
}

const toolState = {
  activeTool: null as string | null,
  registeredTools: {} as Record<string, ToolRegistration>,
};

/**
 * Registra una herramienta en el sistema global
 * @param name Nombre único de la herramienta (ej. "zoom", "rectangle", "freehand")
 * @param deactivate Función que define cómo se desactiva esa herramienta
 */
export function registerTool(name: string, deactivate: () => void) {
  toolState.registeredTools[name] = { deactivate };
}

/**
 * Activa una herramienta y desactiva cualquier otra que estuviera activa.
 * @param name Nombre de la herramienta a activar
 */
export function activateTool(name: string) {
  // Si ya hay una herramienta activa diferente, desactívala primero
  if (toolState.activeTool && toolState.activeTool !== name) {
    const prevTool = toolState.registeredTools[toolState.activeTool];
    if (prevTool && typeof prevTool.deactivate === "function") {
      try {
        prevTool.deactivate();
      } catch (err) {
        console.warn(`Error al desactivar la herramienta ${toolState.activeTool}:`, err);
      }
    }
  }

  // Registra la nueva herramienta activa
  toolState.activeTool = name;
}

/**
 * Desactiva una herramienta manualmente (por nombre)
 * @param name Nombre de la herramienta a desactivar
 */
export function deactivateTool(name: string) {
  const tool = toolState.registeredTools[name];
  if (tool && typeof tool.deactivate === "function") {
    try {
      tool.deactivate();
    } catch (err) {
      console.warn(`Error al desactivar la herramienta ${name}:`, err);
    }
  }

  // Si era la activa, la eliminamos del registro activo
  if (toolState.activeTool === name) {
    toolState.activeTool = null;
  }
}

/**
 * Devuelve el nombre de la herramienta actualmente activa.
 */
export function getActiveTool(): string | null {
  return toolState.activeTool;
}

/**
 * Desactiva todas las herramientas registradas.
 */
export function deactivateAllTools() {
  Object.entries(toolState.registeredTools).forEach(([name, { deactivate }]) => {
    try {
      deactivate();
    } catch (err) {
      console.warn(`Error al desactivar la herramienta ${name}:`, err);
    }
  });
  toolState.activeTool = null;
}