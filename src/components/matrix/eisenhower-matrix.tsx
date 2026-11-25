"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { QuadrantColumn } from "@/components/matrix/quadrant-column";
import { TaskCard } from "@/components/matrix/task-card";
import { cn } from "@/lib/utils";
import { QUADRANT_IDS, QUADRANTS, type Quadrant, type Task } from "@/types/task";

interface EisenhowerMatrixProps {
  tasks: Task[];
  hideCompleted: boolean;
  selectedQuadrant?: "all" | Quadrant;
  generatingSubtaskIds: Set<string>;
  onMoveTask: (taskId: string, quadrant: Quadrant) => void;
  onToggleComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onGenerateSubtasks: (taskId: string) => Promise<void> | void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
}

const noop = () => {};

export function EisenhowerMatrix({
  tasks,
  hideCompleted,
  selectedQuadrant = "all",
  generatingSubtaskIds,
  onMoveTask,
  onToggleComplete,
  onDelete,
  onGenerateSubtasks,
  onToggleSubtask,
  onDeleteSubtask,
}: EisenhowerMatrixProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = String(event.active.id);
    const found = tasks.find((t) => t.id === taskId) ?? null;
    setActiveTask(found);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const targetQuadrant = String(over.id) as Quadrant;
    if (!QUADRANT_IDS.includes(targetQuadrant)) return;

    const taskId = String(active.id);
    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask || draggedTask.quadrant === targetQuadrant) return;

    onMoveTask(taskId, targetQuadrant);
  };

  const handleDragCancel = () => {
    setActiveTask(null);
  };

  const visibleQuadrants =
    selectedQuadrant === "all"
      ? QUADRANTS
      : QUADRANTS.filter((q) => q.id === selectedQuadrant);

  return (
    <DndContext
      id="eisenhower-dnd"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <section aria-label="Матрица Эйзенхауэра">
        <div
          className={cn(
            "grid grid-cols-1 items-start gap-4",
            selectedQuadrant === "all" && "xl:grid-cols-2"
          )}
        >
          {visibleQuadrants.map((meta) => {
            const quadrantTasks = tasks.filter((t) => t.quadrant === meta.id);
            return (
              <QuadrantColumn
                key={meta.id}
                meta={meta}
                tasks={quadrantTasks}
                hideCompleted={hideCompleted}
                generatingSubtaskIds={generatingSubtaskIds}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onGenerateSubtasks={onGenerateSubtasks}
                onToggleSubtask={onToggleSubtask}
                onDeleteSubtask={onDeleteSubtask}
              />
            );
          })}
        </div>
      </section>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            isOverlay
            onToggleComplete={noop}
            onDelete={noop}
            onGenerateSubtasks={noop}
            onToggleSubtask={noop}
            onDeleteSubtask={noop}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
