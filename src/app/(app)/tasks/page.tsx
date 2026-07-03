import { PageHeader, TaskList } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import { tasks } from "@/lib/domika-app-data";

export default function TasksPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Tareas"
        title="Agenda comercial"
        description="Prioriza llamadas, visitas, renovaciones y seguimientos para que ningún prospecto se enfríe."
        actions={
          <>
            <button className={styles.secondaryButton}>Ver calendario</button>
            <button className={styles.primaryButton}>Nueva tarea</button>
          </>
        }
      />
      <TaskList items={tasks} />
    </div>
  );
}

